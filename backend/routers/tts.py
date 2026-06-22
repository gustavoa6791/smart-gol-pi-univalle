from fastapi import APIRouter, HTTPException
from fastapi.responses import FileResponse
from pydantic import BaseModel

from services.base import azure_speech_configured
from services.text_to_speech import TextToSpeechService

router = APIRouter(
    prefix="/tts",
    tags=["tts"],
)

_tts_service: TextToSpeechService | None = None


def _get_tts_service() -> TextToSpeechService:
    global _tts_service
    if not azure_speech_configured():
        raise HTTPException(
            status_code=503,
            detail="Azure Speech no está configurado en el servidor.",
        )
    if _tts_service is None:
        _tts_service = TextToSpeechService()
    return _tts_service


class TTSRequest(BaseModel):
    text: str


@router.post("/generate")
def generate_audio(request: TTSRequest):
    tts_service = _get_tts_service()
    _, filename = tts_service.synthesize_to_file(request.text)
    return FileResponse(
        filename,
        media_type="audio/wav",
        filename="speech.wav",
    )
