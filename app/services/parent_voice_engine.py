from elevenlabs.client import ElevenLabs
from dotenv import load_dotenv
import os
from pathlib import Path

ROOT_DIR = Path(__file__).parent.parent.parent
load_dotenv(ROOT_DIR / ".env")

api_key = os.getenv("ELEVENLABS_GEN_API_KEY")
client = ElevenLabs(api_key=api_key)

EMOTION_SETTINGS = {
    "기쁨": {"stability": 0.1, "similarity_boost": 1.0, "style": 1.0},
    "슬픔": {"stability": 0.7, "similarity_boost": 1.0, "style": 0.05},
    "공포": {"stability": 0.05, "similarity_boost": 1.0, "style": 1.0},
    "평온": {"stability": 0.9, "similarity_boost": 1.0, "style": 0.0},
}

def generate_parent_speech(text, voice_id, emotion="평온"):
    """프론트에서 넘겨받은 voice_id를 사용하여 맞춤형 음성을 생성합니다."""
    settings = EMOTION_SETTINGS.get(emotion, EMOTION_SETTINGS["평온"])
    
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