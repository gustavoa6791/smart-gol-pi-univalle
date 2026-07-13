"""Moderación de fotos de jugador con Azure Computer Vision + detección local de gestos.

Adult detecta contenido sexual/gore. Gestos ofensivos (dedo medio) casi nunca salen
en Tags/Description de Vision: se detectan con MediaPipe Hands. OCR cubre insultos
escritos; Content Safety solo si el endpoint del recurso lo soporta.
"""
from __future__ import annotations

import base64
import logging
import re

import requests

from config.settings import AZURE_VISION_ENDPOINT, AZURE_VISION_KEY
from services.azure_vision_ocr import (
    AzureVisionNotConfiguredError,
    azure_vision_configured,
    extract_text_from_image,
)
from services.hand_gesture_moderation import detect_offensive_hand_gestures

logger = logging.getLogger(__name__)

ADULT_THRESHOLD = 0.60
RACY_THRESHOLD = 0.75
GORE_THRESHOLD = 0.50
# Content Safety severities: 0 (safe) .. 6 (high). 2+ = rechazar
CONTENT_SAFETY_MIN_SEVERITY = 2

BLOCKED_TAGS = {
    "nude",
    "nudity",
    "lingerie",
    "weapon",
    "gun",
    "rifle",
    "pistol",
    "knife",
    "blood",
    "gore",
    "swastika",
    "nazi",
    "ss symbol",
    "confederate flag",
    "middle finger",
    "obscene",
    "insult",
}

# Frases en la descripción/caption de Vision (inglés)
BLOCKED_CAPTION_PHRASES = [
    "middle finger",
    "flipping the bird",
    "giving the finger",
    "obscene gesture",
    "offensive gesture",
    "rude gesture",
    "insulting gesture",
    "finger gesture",
    "showing the finger",
    "one finger",
    "raised middle",
]

# Texto ofensivo leído por OCR (español e inglés, sin acentos)
BLOCKED_TEXT_PATTERNS = [
    r"\bmiddle\s*finger\b",
    r"\bfuck\b",
    r"\bshit\b",
    r"\bbitch\b",
    r"\basshole\b",
    r"\bnigger\b",
    r"\bnazi\b",
    r"\bhitler\b",
    r"\bppt\b",  # cuidado: falso positivo raro
    r"\bhpta\b",
    r"\bhijueputa\b",
    r"\bputo\b",
    r"\bputa\b",
    r"\bmarica\b",
    r"\bguevon\b",
    r"\bguev[oó]n\b",
    r"\bpendejo\b",
    r"\bpendeja\b",
    r"\bmalparido\b",
    r"\bchinga\b",
    r"\bcabr[oó]n\b",
    r"\bverga\b",
    r"\bpij[ao]\b",
    r"\bcoño\b",
    r"\bcul[eo]\b",
]


class InappropriateImageError(Exception):
    """La imagen no supera la moderación de contenido."""

    def __init__(self, reasons: list[str]):
        self.reasons = reasons
        super().__init__(self.user_message())

    def user_message(self) -> str:
        joined = "; ".join(self.reasons)
        return (
            "La foto fue rechazada por contenido inapropiado. "
            f"Motivos: {joined}. "
            "Sube una foto apropiada del jugador (sin violencia, contenido adulto, "
            "gestos ni mensajes ofensivos)."
        )


def _base_endpoint() -> str:
    if not azure_vision_configured():
        raise AzureVisionNotConfiguredError(
            "Azure AI Vision no está configurado. "
            "Define AZURE_VISION_KEY y AZURE_VISION_ENDPOINT."
        )
    return AZURE_VISION_ENDPOINT.rstrip("/")


def _strip_accents(text: str) -> str:
    import unicodedata

    return "".join(
        c for c in unicodedata.normalize("NFD", text) if unicodedata.category(c) != "Mn"
    )


def _analyze_vision(image_bytes: bytes) -> dict:
    """Computer Vision Analyze 3.2: Adult + Tags + Description."""
    url = (
        f"{_base_endpoint()}/vision/v3.2/analyze"
        f"?visualFeatures=Adult,Tags,Description&language=en"
    )
    resp = requests.post(
        url,
        headers={
            "Ocp-Apim-Subscription-Key": AZURE_VISION_KEY,
            "Content-Type": "application/octet-stream",
        },
        data=image_bytes,
        timeout=60,
    )
    if resp.status_code != 200:
        raise RuntimeError(
            f"Azure Vision Analyze devolvió HTTP {resp.status_code}: {resp.text[:300]}"
        )
    return resp.json()


def _try_content_safety(image_bytes: bytes) -> list[str]:
    """Azure AI Content Safety (Hate/Violence/Sexual/SelfHarm). Si el recurso no lo tiene, []."""
    url = f"{_base_endpoint()}/contentsafety/image:analyze?api-version=2024-09-01"
    payload = {
        "image": {"content": base64.b64encode(image_bytes).decode("ascii")},
        "categories": ["Hate", "SelfHarm", "Sexual", "Violence"],
        "outputType": "FourSeverityLevels",
    }
    try:
        resp = requests.post(
            url,
            headers={
                "Ocp-Apim-Subscription-Key": AZURE_VISION_KEY,
                "Content-Type": "application/json",
            },
            json=payload,
            timeout=60,
        )
    except requests.RequestException:
        return []

    if resp.status_code != 200:
        # Recurso solo Computer Vision → 404/400; no fallar todo el flujo
        return []

    reasons: list[str] = []
    labels = {
        "Hate": "contenido ofensivo / de odio",
        "SelfHarm": "autolesión",
        "Sexual": "contenido sexual",
        "Violence": "violencia",
    }
    for item in resp.json().get("categoriesAnalysis") or []:
        category = item.get("category")
        severity = int(item.get("severity") or 0)
        if severity >= CONTENT_SAFETY_MIN_SEVERITY and category in labels:
            reasons.append(f"{labels[category]} (severidad {severity})")
    return reasons


def _check_adult(data: dict) -> list[str]:
    reasons: list[str] = []
    adult = data.get("adult") or {}
    adult_score = float(adult.get("adultScore") or 0)
    racy_score = float(adult.get("racyScore") or 0)
    gore_score = float(adult.get("goreScore") or 0)

    if adult.get("isAdultContent") or adult_score >= ADULT_THRESHOLD:
        reasons.append("contenido adulto / sexual")
    if adult.get("isRacyContent") or racy_score >= RACY_THRESHOLD:
        reasons.append("contenido sexual sugerente")
    if adult.get("isGoryContent") or gore_score >= GORE_THRESHOLD:
        reasons.append("violencia / contenido gráfico")
    return reasons


def _check_tags(data: dict) -> list[str]:
    matched: list[str] = []
    for tag in data.get("tags") or []:
        name = (tag.get("name") or "").strip().lower()
        conf = float(tag.get("confidence") or 0)
        if name in BLOCKED_TAGS and conf >= 0.35:
            matched.append(name)

    if not matched:
        return []
    return [
        "símbolos o gestos ofensivos detectados ("
        + ", ".join(sorted(set(matched)))
        + ")"
    ]


def _check_description(data: dict) -> list[str]:
    desc = data.get("description") or {}
    captions = [
        (c.get("text") or "").lower()
        for c in (desc.get("captions") or [])
        if c.get("text")
    ]
    tags_from_desc = [t.lower() for t in (desc.get("tags") or []) if isinstance(t, str)]
    blob = " ".join(captions + tags_from_desc)
    if not blob:
        return []

    hits = [p for p in BLOCKED_CAPTION_PHRASES if p in blob]
    # Heurística: descripción habla de un solo dedo levantado / gesto
    if re.search(r"\b(middle|obscene|rude|insulting)\b.*\b(finger|gesture)\b", blob):
        hits.append("gesto ofensivo (descripción)")
    if re.search(r"\bfinger\b.*\b(up|raised|extended)\b", blob):
        hits.append("gesto ofensivo (dedo levantado)")

    if not hits:
        return []
    return ["gesto o mensaje ofensivo en la imagen (" + ", ".join(sorted(set(hits))) + ")"]


def _check_ocr_text(image_bytes: bytes) -> list[str]:
    try:
        raw = extract_text_from_image(image_bytes)
    except Exception:
        return []

    if not raw or not raw.strip():
        return []

    norm = _strip_accents(raw.lower())
    hits: list[str] = []
    for pattern in BLOCKED_TEXT_PATTERNS:
        if re.search(pattern, norm, flags=re.IGNORECASE):
            hits.append(pattern)

    if not hits:
        return []
    return ["texto ofensivo en la imagen"]


def _check_hand_gestures(image_bytes: bytes) -> list[str]:
    try:
        if detect_offensive_hand_gestures(image_bytes):
            return ["gesto ofensivo detectado (dedo medio / similar)"]
    except Exception:
        logger.exception("Fallo en detección local de gestos ofensivos")
    return []


def moderate_player_photo(image_bytes: bytes) -> None:
    """Valida la foto. Lanza InappropriateImageError si debe rechazarse."""
    if not azure_vision_configured():
        raise AzureVisionNotConfiguredError(
            "Azure AI Vision no está configurado para moderación."
        )

    reasons: list[str] = []

    # 1) Gestos ofensivos locales (Vision no los reporta de forma fiable)
    reasons.extend(_check_hand_gestures(image_bytes))

    # 2) Adult + Tags + Description (Computer Vision)
    data = _analyze_vision(image_bytes)
    reasons.extend(_check_adult(data))
    reasons.extend(_check_tags(data))
    reasons.extend(_check_description(data))

    # 3) Content Safety (si el mismo endpoint lo soporta)
    reasons.extend(_try_content_safety(image_bytes))

    # 4) OCR: mensajes / insultos escritos en la foto
    reasons.extend(_check_ocr_text(image_bytes))

    unique_reasons = list(dict.fromkeys(reasons))
    if unique_reasons:
        raise InappropriateImageError(unique_reasons)
