from fastapi import APIRouter
from fastapi.responses import FileResponse

from services.text_to_speech import TextToSpeechService

router = APIRouter(
    prefix="/tts",
    tags=["tts"]
)

tts_service = TextToSpeechService()

from pydantic import BaseModel

class TTSRequest(BaseModel):
    text: str

@router.post("/generate")
def generate_audio(request: TTSRequest):

    result, filename = tts_service.synthesize_to_file(
        request.text
    )

    return FileResponse(
        filename,
        media_type="audio/wav",
        filename="speech.wav"
    )