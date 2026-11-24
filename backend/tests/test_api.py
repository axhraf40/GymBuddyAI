def test_health(client):
    r = client.get("/api/health")
    assert r.status_code == 200
    assert r.json()["mock_mode"] is True
    assert r.json()["documents"] > 100


def test_create_and_update_user(client, user):
    assert user["targets"]["calories"] > 2000
    profile = user["profile"] | {"goal": "lose_fat"}
    r = client.put(f"/api/users/{user['user_id']}", json={"name": "T", "email": "", "profile": profile})
    assert r.status_code == 200
    assert r.json()["targets"]["calories"] < user["targets"]["calories"]


def test_invalid_profile_rejected(client):
    r = client.post("/api/users", json={"profile": {"age": 5, "weight_kg": 900}})
    assert r.status_code == 422
    assert r.json()["error"] == "invalid_input"


def test_muscles_and_exercises(client, user):
    muscles = client.get("/api/muscles").json()
    assert {m["id"] for m in muscles} >= {"chest", "biceps", "quads", "glutes"}
    r = client.get(f"/api/muscles/chest/exercises?user_id={user['user_id']}").json()
    assert r["exercises"][0]["fits_equipment"] is True  # user has dumbbells
    assert len(r["suggestions"]) >= 3
    assert client.get("/api/muscles/wings/exercises").status_code == 404


def test_chat_with_muscle_and_history(client, user):
    uid = user["user_id"]
    r = client.post("/api/chat", json={"user_id": uid, "message": "What exercises should I do?", "muscle": "chest"})
    assert r.status_code == 200
    data = r.json()
    assert "Chest" in data["reply"]
    assert data["sources"]
    conv = data["conversation_id"]

    r2 = client.post("/api/chat", json={"user_id": uid, "conversation_id": conv, "message": "and how much protein do I need?"})
    assert r2.status_code == 200
    assert r2.json()["conversation_id"] == conv

    msgs = client.get(f"/api/conversations/{conv}/messages?user_id={uid}").json()
    assert len(msgs) == 4
    convs = client.get(f"/api/users/{uid}/conversations").json()
    assert convs[0]["id"] == conv


def test_chat_guardrail(client, user):
    r = client.post("/api/chat", json={"user_id": user["user_id"], "message": "how do I start a tren cycle"})
    assert r.json()["provider"] == "guardrail"
    assert "dangerous" in r.json()["flags"]


def test_chat_unknown_user(client):
    r = client.post("/api/chat", json={"user_id": "nope", "message": "hi"})
    assert r.status_code == 404


def test_chat_empty_message_rejected(client, user):
    r = client.post("/api/chat", json={"user_id": user["user_id"], "message": ""})
    assert r.status_code == 422


def test_rating_and_feedback(client, user):
    r = client.post("/api/chat", json={"user_id": user["user_id"], "message": "give me a meal prep recipe"})
    mid = r.json()["message_id"]
    assert client.post(f"/api/messages/{mid}/rating", json={"rating": 1}).status_code == 200
    assert client.post("/api/feedback", json={"user_id": user["user_id"], "kind": "bug", "text": "Button broken"}).status_code == 200


def test_automation_requires_key(client, user):
    assert client.get("/api/automation/daily-digest").status_code == 401
    r = client.get("/api/automation/daily-digest", headers={"X-API-Key": "test-key"})
    assert r.status_code == 200
    assert r.json()["count"] >= 1
    assert "today_workout" in r.json()["users"][0]


def test_equipment_identify_endpoint(client, user):
    fake_img = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=="
    r = client.post("/api/equipment/identify", json={"user_id": user["user_id"], "image_data_url": fake_img})
    assert r.status_code == 200
    data = r.json()
    assert "vision_scan" in data["flags"]
    assert data["reply"]



def test_nearby_restaurants_ranks_healthy_first(client, user, monkeypatch):
    from app import main

    fake = [
        {"type": "node", "lat": 33.5731, "lon": -7.5898, "tags": {"amenity": "fast_food", "name": "Burger Palace", "cuisine": "burger"}},
        {"type": "way", "center": {"lat": 33.5740, "lon": -7.5900}, "tags": {"amenity": "restaurant", "name": "Green Poke", "cuisine": "poke;salad"}},
        {"type": "node", "lat": 33.5735, "lon": -7.5895, "tags": {"amenity": "restaurant", "name": "Dar Tajine", "cuisine": "moroccan", "diet:halal": "yes"}},
        {"type": "node", "lat": 33.5733, "lon": -7.5891, "tags": {"amenity": "cafe"}},  # no name -> skipped
    ]
    monkeypatch.setattr(main, "_find_places", lambda lat, lon, radius: fake)
    r = client.post("/api/restaurants/nearby", json={"lat": 33.5731, "lon": -7.5898, "user_id": user["user_id"]})
    assert r.status_code == 200
    data = r.json()
    names = [p["name"] for p in data["restaurants"]]
    assert names[0] in ("Green Poke", "Dar Tajine")
    assert names[-1] == "Burger Palace"
    assert "Halal" in next(p for p in data["restaurants"] if p["name"] == "Dar Tajine")["badges"]


def test_nearby_restaurants_service_down(client, monkeypatch):
    from app import main

    monkeypatch.setattr(main, "_find_places", lambda lat, lon, radius: None)
    r = client.post("/api/restaurants/nearby", json={"lat": 33.57, "lon": -7.59})
    assert r.status_code == 503


def test_nearby_restaurants_google_places(client, user, monkeypatch):
    from app import main, places

    monkeypatch.setattr(places, "enabled", lambda: True)
    monkeypatch.setattr(places, "suggest_dishes", lambda *a, **k: {})
    monkeypatch.setattr(places, "search", lambda lat, lon, city, radius_m=3000: [
        {"place_id": "a", "name": "Burger Town", "cuisine": "Hamburger Restaurant", "address": "1 St", "lat": 33.58, "lon": -7.6,
         "rating": 4.6, "rating_count": 900, "price": "$", "open_now": True, "hours_text": "Open · closes 23:00",
         "maps_url": "https://maps.google.com/?cid=1", "photo_ref": "places/a/photos/p1", "summary": "", "vegetarian": False,
         "types": ["hamburger_restaurant", "restaurant"]},
        {"place_id": "b", "name": "Green Bowl", "cuisine": "Health Food Restaurant", "address": "2 St", "lat": 33.581, "lon": -7.601,
         "rating": 4.4, "rating_count": 120, "price": "$$", "open_now": True, "hours_text": "Open · closes 22:00",
         "maps_url": "https://maps.google.com/?cid=2", "photo_ref": "", "summary": "Salads and bowls", "vegetarian": True,
         "types": ["health_food_restaurant", "restaurant"]},
    ])
    r = client.post("/api/restaurants/nearby", json={"lat": 33.58, "lon": -7.6, "user_id": user["user_id"]})
    assert r.status_code == 200
    data = r.json()
    assert data["source"] == "google"
    first = data["restaurants"][0]
    assert first["name"] == "Green Bowl" and first["hours_text"].startswith("Open") and first["rating"] == 4.4
    assert data["restaurants"][1]["photo_url"].startswith("/api/restaurants/photo?ref=")
