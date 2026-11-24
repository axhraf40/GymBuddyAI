"""Google Places (New) integration for "Healthy restaurants near you".

Used when GOOGLE_PLACES_API_KEY is set; otherwise the app falls back to OpenStreetMap.
Gives real Google Maps data: photo, rating, number of reviews, price level, open now / closing time,
and a Google Maps link. Google does not expose menus, so the dishes shown are suggestions made by the
AI model from the restaurant's name, cuisine and description, matched to the user's goal and diet.
"""
from __future__ import annotations

import json
import logging
import re
import time
from datetime import datetime, timedelta, timezone

import httpx

from . import llm
from .config import settings

log = logging.getLogger("gymbuddy.places")

SEARCH_URL = "https://places.googleapis.com/v1/places:searchText"
FIELD_MASK = ",".join([
    "places.id",
    "places.displayName",
    "places.formattedAddress",
    "places.location",
    "places.rating",
    "places.userRatingCount",
    "places.priceLevel",
    "places.primaryTypeDisplayName",
    "places.types",
    "places.googleMapsUri",
    "places.photos",
    "places.currentOpeningHours",
    "places.utcOffsetMinutes",
    "places.editorialSummary",
    "places.servesVegetarianFood",
])

PRICE = {
    "PRICE_LEVEL_INEXPENSIVE": "$",
    "PRICE_LEVEL_MODERATE": "$$",
    "PRICE_LEVEL_EXPENSIVE": "$$$",
    "PRICE_LEVEL_VERY_EXPENSIVE": "$$$$",
}

_CACHE: dict[str, tuple[float, list[dict]]] = {}
_PHOTO_CACHE: dict[str, tuple[float, str]] = {}


def enabled() -> bool:
    return bool(settings.google_places_api_key)


def _closing_text(p: dict) -> tuple[bool | None, str]:
    """('open_now', 'Open · closes 23:00') from currentOpeningHours.nextCloseTime/nextOpenTime + utcOffsetMinutes."""
    hours = p.get("currentOpeningHours") or {}
    open_now = hours.get("openNow")
    offset = timedelta(minutes=p.get("utcOffsetMinutes") or 0)

    def local(ts: str | None) -> str:
        if not ts:
            return ""
        try:
            dt = datetime.fromisoformat(ts.replace("Z", "+00:00")).astimezone(timezone.utc) + offset
            return dt.strftime("%H:%M")
        except ValueError:
            return ""

    if open_now is True:
        close = local(hours.get("nextCloseTime"))
        return True, f"Open · closes {close}" if close else "Open now"
    if open_now is False:
        nxt = local(hours.get("nextOpenTime"))
        return False, f"Closed · opens {nxt}" if nxt else "Closed now"
    return None, ""


def search(lat: float | None, lon: float | None, city: str, radius_m: int = 3000) -> list[dict] | None:
    """Healthy-leaning restaurant search. None on API error (caller falls back to OpenStreetMap)."""
    key = f"{round(lat or 0, 3)}|{round(lon or 0, 3)}|{city.lower().strip()}"
    hit = _CACHE.get(key)
    if hit and time.time() - hit[0] < 1800:
        return hit[1]

    body: dict = {"maxResultCount": 15, "languageCode": "en"}
    if lat is not None and lon is not None:
        body["textQuery"] = "healthy restaurant"
        body["locationBias"] = {"circle": {"center": {"latitude": lat, "longitude": lon}, "radius": float(radius_m)}}
    else:
        body["textQuery"] = f"healthy restaurant in {city}"
    try:
        r = httpx.post(
            SEARCH_URL,
            json=body,
            headers={
                "X-Goog-Api-Key": settings.google_places_api_key,
                "X-Goog-FieldMask": FIELD_MASK,
                "Content-Type": "application/json",
            },
            timeout=12,
        )
    except httpx.HTTPError as e:
        log.warning("Google Places request failed: %s", e)
        return None
    if r.status_code != 200:
        log.warning("Google Places HTTP %s: %s", r.status_code, r.text[:300])
        return None

    places = []
    for p in r.json().get("places") or []:
        loc = p.get("location") or {}
        open_now, hours_text = _closing_text(p)
        photo = ((p.get("photos") or [{}])[0] or {}).get("name", "")
        places.append({
            "place_id": p.get("id", ""),
            "name": (p.get("displayName") or {}).get("text", ""),
            "cuisine": (p.get("primaryTypeDisplayName") or {}).get("text", "Restaurant"),
            "address": p.get("formattedAddress", ""),
            "lat": loc.get("latitude"),
            "lon": loc.get("longitude"),
            "rating": p.get("rating"),
            "rating_count": p.get("userRatingCount"),
            "price": PRICE.get(p.get("priceLevel", ""), ""),
            "open_now": open_now,
            "hours_text": hours_text,
            "maps_url": p.get("googleMapsUri", ""),
            "photo_ref": photo,
            "summary": (p.get("editorialSummary") or {}).get("text", ""),
            "vegetarian": bool(p.get("servesVegetarianFood")),
            "types": p.get("types") or [],
        })
    _CACHE[key] = (time.time(), places)
    return places


def photo_url(photo_ref: str, max_px: int = 480) -> str:
    """Resolve a Places photo name to a public googleusercontent URL (the API key is never sent to the browser)."""
    if not photo_ref or not re.fullmatch(r"places/[\w-]+/photos/[\w-]+", photo_ref):
        return ""
    hit = _PHOTO_CACHE.get(photo_ref)
    if hit and time.time() - hit[0] < 3600:
        return hit[1]
    try:
        r = httpx.get(
            f"https://places.googleapis.com/v1/{photo_ref}/media",
            params={"maxWidthPx": max_px, "skipHttpRedirect": "true", "key": settings.google_places_api_key},
            timeout=8,
        )
        uri = r.json().get("photoUri", "") if r.status_code == 200 else ""
    except Exception as e:
        log.warning("Places photo failed: %s", e)
        uri = ""
    if uri:
        _PHOTO_CACHE[photo_ref] = (time.time(), uri)
    return uri


def suggest_dishes(places: list[dict], goal: str, diet: str, allergies: list[str]) -> dict[str, list[dict]]:
    """One AI call for all places: 2 likely dishes each, fitted to the goal. {} if the AI is unavailable."""
    if not places or llm.is_mock():
        return {}
    listing = "\n".join(
        f"{i}. {p['name']} | {p['cuisine']} | {p.get('summary', '')[:140]}" for i, p in enumerate(places, 1)
    )
    prompt = (
        "For each restaurant below, suggest the 2 healthiest dishes such a place typically serves, "
        f"for someone whose goal is '{goal}', diet '{diet}', allergies: {', '.join(allergies) or 'none'}. "
        "Give realistic dishes for that cuisine, an estimated kcal and protein (g), and a 6-word ordering tip. "
        'Answer ONLY JSON: {"1": [{"dish": "...", "kcal": 520, "protein_g": 40, "tip": "..."}, ...], "2": [...]}\n\n'
        + listing
    )
    try:
        text = llm.chat([{"role": "user", "content": prompt}], temperature=0.3, max_tokens=1400)
        match = re.search(r"\{.*\}", text, re.S)
        data = json.loads(match.group(0)) if match else {}
    except Exception as e:
        log.warning("Dish suggestions failed: %s", e)
        return {}
    out: dict[str, list[dict]] = {}
    for i, p in enumerate(places, 1):
        dishes = data.get(str(i)) or []
        clean = []
        for d in dishes[:2]:
            if isinstance(d, dict) and d.get("dish"):
                clean.append({
                    "dish": str(d["dish"])[:90],
                    "kcal": int(d.get("kcal") or 0) or None,
                    "protein_g": int(d.get("protein_g") or 0) or None,
                    "tip": str(d.get("tip") or "")[:80],
                })
        if clean:
            out[p["place_id"]] = clean
    return out
