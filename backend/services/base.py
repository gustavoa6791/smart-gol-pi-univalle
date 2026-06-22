import azure.cognitiveservices.speech as speechsdk

from config.settings import (
    AZURE_SPEECH_KEY,
    AZURE_SPEECH_REGION,
)


def azure_speech_configured() -> bool:
    return bool(AZURE_SPEECH_KEY and AZURE_SPEECH_REGION)


def build_speech_config(voice_name=None):
    if not azure_speech_configured():
        raise RuntimeError(
            "Azure Speech no está configurado. Define AZURE_SPEECH_KEY y AZURE_SPEECH_REGION."
        )

    cfg = speechsdk.SpeechConfig(
        subscription=AZURE_SPEECH_KEY,
        region=AZURE_SPEECH_REGION,
    )

    if voice_name:
        cfg.speech_synthesis_voice_name = voice_name

    return cfg