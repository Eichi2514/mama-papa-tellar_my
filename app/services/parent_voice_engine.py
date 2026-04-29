from elevenlabs.client import ElevenLabs
from dotenv import load_dotenv
import os
from pathlib import Path

ROOT_DIR = Path(__file__).parent.parent.parent
load_dotenv(ROOT_DIR / ".env")

api_key = os.getenv("ELEVENLABS_GEN_API_KEY")
client = ElevenLabs(api_key=api_key)

EMOTION_SETTINGS = {
    "calm":    {"stability": 0.80, "similarity_boost": 0.90, "style": 0.10},
    "warm":    {"stability": 0.70, "similarity_boost": 0.90, "style": 0.25},
    "gentle":  {"stability": 0.75, "similarity_boost": 0.90, "style": 0.20},
    "happy":   {"stability": 0.35, "similarity_boost": 0.85, "style": 0.65},
    "joyful":  {"stability": 0.20, "similarity_boost": 0.85, "style": 0.85},
    "sad":     {"stability": 0.60, "similarity_boost": 0.90, "style": 0.55},
    "scary":   {"stability": 0.25, "similarity_boost": 0.85, "style": 0.80},
    "shocked": {"stability": 0.15, "similarity_boost": 0.85, "style": 0.90},
    "urgent":  {"stability": 0.20, "similarity_boost": 0.85, "style": 0.85},
    "stern":   {"stability": 0.75, "similarity_boost": 0.85, "style": 0.40},
    "greedy":  {"stability": 0.30, "similarity_boost": 0.80, "style": 0.75}
}

def generate_parent_speech(text, voice_id, emotion="평온",voice_settings=None):
    """프론트에서 넘겨받은 voice_id를 사용하여 맞춤형 음성을 생성합니다."""
    settings = EMOTION_SETTINGS.get(emotion, EMOTION_SETTINGS["calm"])
    
    audio_generator = client.text_to_speech.convert(
        voice_id=voice_id,  # 이제 고정값이 아닌 인자로 받은 ID 사용
        text=text,
        model_id="eleven_multilingual_v2",
        voice_settings={
            "stability": settings["stability"],
            "similarity_boost": settings["similarity_boost"],
            "style": settings["style"],
            "use_speaker_boost": True
        }
    )

    temp_filename = f"temp_speech_{os.getpid()}.mp3"
    with open(temp_filename, "wb") as f:
        for chunk in audio_generator:
            if chunk:
                f.write(chunk)
    
    return temp_filename