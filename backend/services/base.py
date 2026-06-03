import azure.cognitiveservices.speech as speechsdk

from config.settings import (
    AZURE_SPEECH_KEY,
    AZURE_SPEECH_REGION,
)

def build_speech_config(voice_name=None):

    cfg = speechsdk.SpeechConfig(
        subscription=AZURE_SPEECH_KEY,
        region=AZURE_SPEECH_REGION
    )

    if voice_name:
        cfg.speech_synthesis_voice_name = voice_name

    return cfg