"""Quality control: input guardrails (before the LLM) and output checks (after the LLM)."""
from __future__ import annotations

import re
from dataclasses import dataclass, field

from . import retrieval
from .retrieval import normalize
from .schemas import Profile

MEDICAL_DISCLAIMER = (
    "⚕️ *I'm an AI coach, not a doctor. For pain, injuries or medical conditions, please check with a "
    "doctor or physiotherapist before following this advice.*"
)

INJECTION_PATTERNS = [
    r"ignore (all |any |the )?(previous|above|prior|earlier) (instructions|prompts?|rules)",
    r"(reveal|show|print|repeat|give me) (me )?(your|the) (system )?(prompt|instructions)",
    r"system prompt",
    r"you are now (?!going)",
    r"\bjailbreak\b",
    r"\bdan mode\b",
    r"developer mode",
    r"oublie (tes|les) instructions",
    r"ignore (tes|les) instructions",
]

DANGEROUS_PATTERNS = {
    "steroids": r"\b(steroid|steroids|anabolic|anabolisant|tren|trenbolone|dianabol|anavar|winstrol|sarms?|testosterone (cycle|injection)|hgh|clenbuterol|clen)\b",
    "eating_disorder": r"\b(purge|purging|make myself (vomit|throw up)|vomir|laxatives?|starve myself|stop eating|not eat for|pro.?ana|thinspo|diuretics? to lose)\b",
    "self_harm": r"\b(kill myself|suicide|suicidal|self.?harm|hurt myself|me suicider)\b",
}

DANGEROUS_REPLIES = {
    "steroids": (
        "I can't help with anabolic steroids, SARMs, clenbuterol or other performance-enhancing drugs: they carry "
        "serious risks (heart, liver, hormones, fertility) and are illegal without a prescription in many countries. "
        "If you want faster progress, I can help you optimise the things that really work: progressive overload, "
        "enough protein (1.6-2.2 g/kg), sleep, and a well-designed program. Want me to review your training plan?"
    ),
    "eating_disorder": (
        "I'm not able to help with extreme methods like purging, laxatives or starving yourself: they are dangerous "
        "and can seriously harm your health. If food or your body feels hard to manage right now, please talk to a "
        "doctor or a specialist. If you'd like, I can help you build a **safe, gradual** plan with enough food to "
        "fuel your training."
    ),
    "self_harm": (
        "I'm really sorry you're feeling this way. I'm only a fitness chatbot and can't give you the help you deserve, "
        "but you don't have to go through this alone. Please contact a local emergency number or a crisis line right "
        "now, or talk to someone you trust."
    ),
}

FITNESS_KEYWORDS = r"""\b(gym|workout|training|train|exercise|exercice|muscle|muscu|musculation|sets?|reps?|rep|squat|bench|deadlift|
press|curl|row|pull|push|plank|cardio|run|running|stretch|warm|split|program|programme|routine|weight|poids|kg|lbs|
fat|lean|bulk|cut|recomp|calorie|calories|kcal|protein|proteine|carbs?|glucides|fats?|lipides|macro|macros|diet|regime|
meal|repas|eat|manger|food|recipe|recette|cook|cuisine|breakfast|lunch|dinner|snack|prep|freezer|grocery|courses|
water|eau|hydrat|sleep|sommeil|rest|repos|recovery|sore|courbature|injury|blessure|pain|douleur|supplement|creatine|
whey|vitamin|halal|vegan|vegetarian|body|corps|abs|chest|back|legs|arms|glutes|shoulder|biceps|triceps|calves|
hamstrings|quads|forearm|traps|obliques|lose|perdre|gain|prendre|health|sante|healthy|fit|fitness|sport|beginner|
debutant|home|maison|dumbbell|haltere|bodyweight|equipment|plan|goal|objectif|tdee|bmr|bmi|step|walk|marche|
coach|tajine|couscous|harira|rice|riz|chicken|poulet|egg|oeuf|tuna|thon|oats|avoine)"""

OFF_TOPIC_KEYWORDS = r"""\b(python|javascript|java|code|coding|programming|sql|bitcoin|crypto|stock|bourse|election|
president|politics|politique|religion|movie|film|netflix|song|lyrics|homework|devoir|math|equation|capital of|
weather|meteo|translate|traduire|poem|poeme|essay|dissertation|hack|password)\b"""

GREETING = r"^\s*(hi|hello|hey|salut|bonjour|bonsoir|salam|salam alaykoum|yo|thanks|thank you|merci|ok|okay|cool|nice|great|super|who are you|qui es.tu|help|aide)\b"

MEDICAL_PATTERNS = r"""\b(chest pain|douleur thoracique|heart|coeur|cardiac|blood pressure|tension|diabet|diabete|pregnan|enceinte|
asthma|asthme|hernia|hernie|torn|dechir|fracture|broken|surgery|operation|chirurgie|medication|medicament|
dizzy|vertige|faint|injur|blesse|blessure|pain|douleur|hurts?|mal au|sciatica|sciatique|tendinitis|tendinite)"""

OFF_TOPIC_REPLY = (
    "I'm GymBuddy, your gym & nutrition coach 💪, so I can only help with training, exercises, nutrition, recipes, "
    "meal prep, recovery and healthy habits. Try for example: *\"What exercises should I do for my chest at home?\"* "
    "or *\"How much protein do I need?\"*"
)

INJECTION_REPLY = (
    "I can't change my instructions or reveal my configuration. I'm here to help with your training and nutrition: "
    "what would you like to work on today?"
)

# allergen -> words that reveal it in a reply
ALLERGEN_WORDS = {
    "dairy": ["milk", "cheese", "yogurt", "yoghurt", "whey", "butter", "cream", "lait", "fromage", "yaourt"],
    "lactose": ["milk", "cheese", "yogurt", "whey", "cream", "lait", "fromage"],
    "gluten": ["bread", "pasta", "oats", "couscous", "wheat", "flour", "msemen", "khobz", "pain", "pates", "ble"],
    "egg": ["egg", "omelette", "oeuf"],
    "eggs": ["egg", "omelette", "oeuf"],
    "fish": ["tuna", "salmon", "sardine", "fish", "thon", "saumon", "poisson"],
    "shellfish": ["shrimp", "prawn", "crab", "lobster", "crevette"],
    "peanut": ["peanut", "cacahuete"],
    "peanuts": ["peanut", "cacahuete"],
    "nuts": ["almond", "walnut", "cashew", "hazelnut", "peanut", "amande", "noix"],
    "tree_nuts": ["almond", "walnut", "cashew", "hazelnut", "amande", "noix"],
    "soy": ["tofu", "soy", "soja", "edamame"],
    "sesame": ["sesame", "tahini", "hummus", "houmous"],
}


@dataclass
class GuardResult:
    allowed: bool
    flags: list[str] = field(default_factory=list)
    reply: str | None = None  # set when the request is answered without the LLM


def check_input(message: str, profile: Profile | None = None) -> GuardResult:
    text = normalize(message)
    flags: list[str] = []

    if not text.strip():
        return GuardResult(False, ["empty"], "Your message looks empty. What would you like to ask about training or nutrition?")

    for p in INJECTION_PATTERNS:
        if re.search(p, text):
            return GuardResult(False, ["prompt_injection"], INJECTION_REPLY)

    for kind, p in DANGEROUS_PATTERNS.items():
        if re.search(p, text):
            return GuardResult(False, ["dangerous", kind], DANGEROUS_REPLIES[kind])

    is_fitness = bool(re.search(FITNESS_KEYWORDS, text, re.X)) or retrieval.detect_muscle(text) is not None
    is_off = bool(re.search(OFF_TOPIC_KEYWORDS, text, re.X))
    if is_off and not is_fitness:
        return GuardResult(False, ["off_topic"], OFF_TOPIC_REPLY)

    if re.search(GREETING, text):
        flags.append("greeting")
    elif not is_fitness:
        flags.append("unclear_topic")  # LLM decides, but is told to stay in scope / ask a clarifying question

    if re.search(MEDICAL_PATTERNS, text, re.X):
        flags.append("medical")

    m = re.search(r"\b(\d{3,4})\s*(kcal|calories|cal)\b", text)
    if m and profile is not None:
        floor = 1500 if profile.sex == "male" else 1200
        if int(m.group(1)) < floor:
            flags.append("low_calorie_request")

    return GuardResult(True, flags)


def check_output(reply: str, profile: Profile | None, flags: list[str]) -> tuple[str, list[str]]:
    out_flags: list[str] = []
    text = normalize(reply)

    if profile is not None and profile.allergies:
        hits = []
        for allergy in profile.allergies:
            words = ALLERGEN_WORDS.get(allergy.replace(" ", "_"), [allergy])
            found = [w for w in words if re.search(rf"\b{re.escape(w)}", text)]
            if found:
                hits.append(f"{allergy} ({', '.join(sorted(set(found)))})")
        if hits:
            out_flags.append("allergen_mentioned")
            reply += (
                f"\n\n⚠️ **Allergy check:** you told me you're allergic to {', '.join(hits)}. "
                "If this answer mentions it, skip that item or ask me for an alternative."
            )

    if profile is not None and profile.injuries:
        risky = []
        for e in retrieval.exercises():
            if normalize(e["name"]) in text:
                bad = [a for a in e["avoid_if"] if any(a in inj or inj in a for inj in profile.injuries)]
                if bad:
                    risky.append(e["name"])
        if risky:
            out_flags.append("injury_conflict")
            reply += (
                f"\n\n⚠️ **Injury check:** {', '.join(risky)} can stress the area you injured "
                f"({', '.join(profile.injuries)}). Use a pain-free alternative or get a professional's OK first."
            )

    if "medical" in flags:
        if MEDICAL_DISCLAIMER not in reply:
            out_flags.append("disclaimer_added")
            reply += "\n\n" + MEDICAL_DISCLAIMER

    return reply, out_flags
