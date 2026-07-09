import os
from pathlib import Path
from dotenv import load_dotenv

# Carga .env del backend y del raíz del proyecto (útil en Docker y desarrollo local)
load_dotenv()
load_dotenv(Path(__file__).resolve().parents[2] / ".env")

AZURE_SPEECH_KEY = os.getenv("AZURE_SPEECH_KEY")
AZURE_SPEECH_REGION = os.getenv("AZURE_SPEECH_REGION", "eastus")

AZURE_VISION_KEY = os.getenv("AZURE_VISION_KEY")
AZURE_VISION_ENDPOINT = os.getenv("AZURE_VISION_ENDPOINT")

DEFAULT_SYNTHESIS_VOICE = "es-CO-GonzaloNeural"