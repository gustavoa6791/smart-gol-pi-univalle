import uuid
import azure.cognitiveservices.speech as speechsdk

from config.settings import DEFAULT_SYNTHESIS_VOICE
from .base import build_speech_config


class TextToSpeechService:

    def __init__(self,
                 voice_name: str = DEFAULT_SYNTHESIS_VOICE):
        self._config = build_speech_config(
            voice_name=voice_name
        )

    def synthesize_to_file(self, text: str):

        filename = f"/tmp/{uuid.uuid4()}.wav"

        audio_config = speechsdk.audio.AudioOutputConfig(
            filename=filename
        )

        synthesizer = speechsdk.SpeechSynthesizer(
            speech_config=self._config,
            audio_config=audio_config
        )

        result = synthesizer.speak_text_async(text).get()

        return result, filename