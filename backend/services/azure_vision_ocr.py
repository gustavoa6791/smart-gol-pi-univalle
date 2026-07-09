"""OCR con Azure AI Vision / Computer Vision (Read API).

Soporta el endpoint del recurso en Azure Portal, p. ej.:
  https://tu-recurso.cognitiveservices.azure.com/

La clave de Speech NO sirve si el recurso es solo de voz; hace falta un recurso
Computer Vision o Azure AI services con Vision habilitado.
"""
from __future__ import annotations

import time

import requests

from config.settings import AZURE_VISION_ENDPOINT, AZURE_VISION_KEY


class AzureVisionNotConfiguredError(RuntimeError):
    pass


def azure_vision_configured() -> bool:
    return bool(AZURE_VISION_KEY and AZURE_VISION_ENDPOINT)


def _base_endpoint() -> str:
    if not azure_vision_configured():
        raise AzureVisionNotConfiguredError(
            "Azure AI Vision no está configurado. "
            "Define AZURE_VISION_KEY y AZURE_VISION_ENDPOINT en el archivo .env."
        )
    return AZURE_VISION_ENDPOINT.rstrip("/")


def _vision_headers() -> dict[str, str]:
    return {
        "Ocp-Apim-Subscription-Key": AZURE_VISION_KEY,
        "Content-Type": "application/octet-stream",
    }


def _raise_azure_error(status_code: int, body: str) -> None:
    if status_code == 401:
        raise RuntimeError(
            "Azure rechazó la clave o el endpoint (401). "
            "Crea un recurso «Computer Vision» o «Azure AI services» en Azure Portal, "
            "copia Key y Endpoint a AZURE_VISION_KEY y AZURE_VISION_ENDPOINT en .env. "
            "La clave de Speech no funciona para OCR si el recurso es solo de voz."
        )
    if status_code == 403:
        raise RuntimeError(
            "Azure denegó el acceso (403). Verifica que el recurso tenga OCR/Read habilitado."
        )
    if status_code == 429:
        raise RuntimeError("Azure Vision: límite de uso alcanzado (429). Intenta más tarde.")
    raise RuntimeError(
        f"Azure Vision devolvió HTTP {status_code}. "
        f"Revisa la configuración. Detalle: {body[:300]}"
    )


def _read_with_rest_v32(image_bytes: bytes) -> str:
    """Computer Vision Read 3.2 — compatible con la mayoría de recursos Vision."""
    base = _base_endpoint()
    analyze_url = f"{base}/vision/v3.2/read/analyze?language=es"

    resp = requests.post(
        analyze_url,
        headers=_vision_headers(),
        data=image_bytes,
        timeout=60,
    )
    if resp.status_code not in (200, 202):
        _raise_azure_error(resp.status_code, resp.text)

    operation_url = resp.headers.get("Operation-Location")
    if not operation_url:
        raise RuntimeError("Azure Vision no devolvió Operation-Location.")

    for _ in range(30):
        time.sleep(1)
        poll = requests.get(
            operation_url,
            headers={"Ocp-Apim-Subscription-Key": AZURE_VISION_KEY},
            timeout=30,
        )
        if poll.status_code != 200:
            _raise_azure_error(poll.status_code, poll.text)

        payload = poll.json()
        status = payload.get("status")
        if status == "succeeded":
            lines: list[str] = []
            for result in payload.get("analyzeResult", {}).get("readResults", []):
                for line in result.get("lines", []):
                    text = (line.get("text") or "").strip()
                    if text:
                        lines.append(text)
            return "\n".join(lines)
        if status == "failed":
            raise RuntimeError("Azure Vision no pudo leer la imagen (operación fallida).")

    raise RuntimeError("Azure Vision tardó demasiado en procesar la imagen.")


def _read_with_image_analysis(image_bytes: bytes) -> str:
    """Image Analysis 4.0 (SDK) — algunos recursos nuevos."""
    from azure.ai.vision.imageanalysis import ImageAnalysisClient
    from azure.ai.vision.imageanalysis.models import VisualFeatures
    from azure.core.credentials import AzureKeyCredential
    from azure.core.exceptions import HttpResponseError

    client = ImageAnalysisClient(
        endpoint=_base_endpoint(),
        credential=AzureKeyCredential(AZURE_VISION_KEY),
    )
    try:
        result = client.analyze(
            image_data=image_bytes,
            visual_features=[VisualFeatures.READ],
            language="es",
        )
    except HttpResponseError as exc:
        _raise_azure_error(exc.status_code or 0, str(exc.message))

    lines: list[str] = []
    if result.read and result.read.blocks:
        for block in result.read.blocks:
            for line in block.lines:
                if line.text:
                    lines.append(line.text.strip())
    return "\n".join(lines)


def extract_text_from_image(image_bytes: bytes) -> str:
    """Extrae texto de una imagen usando Azure Vision Read."""
    try:
        return _read_with_rest_v32(image_bytes)
    except RuntimeError as rest_err:
        # Si el endpoint no expone v3.2, intentar Image Analysis 4.0
        if "404" in str(rest_err) or "Not Found" in str(rest_err):
            return _read_with_image_analysis(image_bytes)
        raise
