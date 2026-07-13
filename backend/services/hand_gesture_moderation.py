"""Detección local de gestos ofensivos (dedo medio) con MediaPipe Hands.

Azure Computer Vision / Content Safety no identifican de forma fiable este gesto
(caption genérica tipo "person posing"). Usamos landmarks de manos.
"""
from __future__ import annotations

import math
from typing import Sequence

import cv2
import mediapipe as mp
import numpy as np

# Índices MediaPipe Hands
_WRIST = 0
_INDEX_TIP, _INDEX_PIP, _INDEX_MCP = 8, 6, 5
_MIDDLE_TIP, _MIDDLE_PIP, _MIDDLE_MCP = 12, 10, 9
_RING_TIP, _RING_PIP, _RING_MCP = 16, 14, 13
_PINKY_TIP, _PINKY_PIP, _PINKY_MCP = 20, 18, 17


def _dist(a, b) -> float:
    return math.hypot(a.x - b.x, a.y - b.y)


def _finger_extension_ratio(lm, tip: int, pip: int, mcp: int) -> float:
    """Qué tan extendido está el dedo: tip→MCP / PIP→MCP. >1 ≈ extendido."""
    tip_mcp = _dist(lm[tip], lm[mcp])
    pip_mcp = _dist(lm[pip], lm[mcp]) or 1e-6
    return tip_mcp / pip_mcp


def _is_middle_finger_gesture(lm) -> bool:
    """True si el dedo medio está claramente extendido y el resto no."""
    mid = _finger_extension_ratio(lm, _MIDDLE_TIP, _MIDDLE_PIP, _MIDDLE_MCP)
    idx = _finger_extension_ratio(lm, _INDEX_TIP, _INDEX_PIP, _INDEX_MCP)
    ring = _finger_extension_ratio(lm, _RING_TIP, _RING_PIP, _RING_MCP)
    pinky = _finger_extension_ratio(lm, _PINKY_TIP, _PINKY_PIP, _PINKY_MCP)

    # Medio bien extendido; índice/anular/meñique relativamente replegados
    mid_ok = mid >= 1.25
    others_folded = idx < 1.15 and ring < 1.15 and pinky < 1.20
    mid_dominates = mid > idx + 0.20 and mid > ring + 0.20 and mid > pinky + 0.15

    # Evitar falsos positivos de "señalar" (índice solo)
    not_pointing = idx < mid - 0.10

    return bool(mid_ok and others_folded and mid_dominates and not_pointing)


def _decode_image(image_bytes: bytes) -> np.ndarray | None:
    arr = np.frombuffer(image_bytes, dtype=np.uint8)
    img = cv2.imdecode(arr, cv2.IMREAD_COLOR)
    return img


def detect_offensive_hand_gestures(image_bytes: bytes) -> bool:
    """
    Devuelve True si al menos una mano muestra gesto de dedo medio.
    Si MediaPipe no encuentra manos, False (no rechazar por eso).
    """
    img = _decode_image(image_bytes)
    if img is None:
        return False

    # Upscale imágenes pequeñas para mejorar landmarks
    h, w = img.shape[:2]
    if max(h, w) < 480:
        scale = 480 / max(h, w)
        img = cv2.resize(img, (int(w * scale), int(h * scale)), interpolation=cv2.INTER_CUBIC)

    rgb = cv2.cvtColor(img, cv2.COLOR_BGR2RGB)

    hands = mp.solutions.hands.Hands(
        static_image_mode=True,
        max_num_hands=4,
        min_detection_confidence=0.45,
        model_complexity=1,
    )
    try:
        result = hands.process(rgb)
    finally:
        hands.close()

    if not result.multi_hand_landmarks:
        return False

    for hand_landmarks in result.multi_hand_landmarks:
        lm: Sequence = hand_landmarks.landmark
        if _is_middle_finger_gesture(lm):
            return True
    return False
