"""Endpoint que emite un token de autorización de Azure Speech.

El STT corre en el navegador, pero NO queremos exponer ahí la AZURE_SPEECH_KEY.
El navegador pide este token (válido ~10 min) y autentica el SDK con él
(`SpeechConfig.fromAuthorizationToken`). La key nunca sale del servidor.
"""
import urllib.error
import urllib.request

from fastapi import APIRouter, Depends, HTTPException

import auth as auth_utils
import models
from config.settings import AZURE_SPEECH_KEY, AZURE_SPEECH_REGION

router = APIRouter(prefix="/api/speech", tags=["speech"])


@router.get("/token")
def get_speech_token(
    _: models.User = Depends(auth_utils.require_admin_or_organizer),
):
    """Devuelve {token, region} para que el navegador haga STT con Azure."""
    if not AZURE_SPEECH_KEY:
        raise HTTPException(status_code=503, detail="Azure Speech no está configurado")

    url = f"https://{AZURE_SPEECH_REGION}.api.cognitive.microsoft.com/sts/v1.0/issueToken"
    req = urllib.request.Request(
        url,
        method="POST",
        data=b"",
        headers={
            "Ocp-Apim-Subscription-Key": AZURE_SPEECH_KEY,
            "Content-Length": "0",
        },
    )
    try:
        with urllib.request.urlopen(req, timeout=10) as resp:
            token = resp.read().decode("utf-8")
    except urllib.error.HTTPError as e:
        raise HTTPException(
            status_code=502,
            detail=f"Azure rechazó la solicitud de token (HTTP {e.code}). "
                   f"Revisa AZURE_SPEECH_KEY / AZURE_SPEECH_REGION.",
        )
    except Exception as e:  # noqa: BLE001
        raise HTTPException(status_code=502, detail=f"No se pudo obtener el token de Azure: {e}")

    return {"token": token, "region": AZURE_SPEECH_REGION}
