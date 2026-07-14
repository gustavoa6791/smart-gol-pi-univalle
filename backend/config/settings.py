import os
from dotenv import load_dotenv

load_dotenv()

AZURE_SPEECH_KEY = os.getenv("AZURE_SPEECH_KEY")
AZURE_SPEECH_REGION = os.getenv("AZURE_SPEECH_REGION", "eastus")
AZURE_FACE_ENDPOINT = os.getenv("AZURE_FACE_ENDPOINT")
AZURE_FACE_KEY = os.getenv("AZURE_FACE_KEY")

FACE_PROVIDER = os.getenv("FACE_PROVIDER", "local").lower()

DEFAULT_SYNTHESIS_VOICE = "es-CO-GonzaloNeural"
# Agregar estas dos líneas
AZURE_VISION_ENDPOINT = os.getenv("AZURE_VISION_ENDPOINT")
AZURE_VISION_KEY = os.getenv("AZURE_VISION_KEY")