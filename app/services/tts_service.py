#기존 elevenlabs.py 파일명은 충돌에러로 인해 임의로 바꿨습니다. 

from elevenlabs.client import ElevenLabs
from dotenv import load_dotenv

import os

# 프로젝트 루트의 .env 불러오기
ROOT_DIR = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
load_dotenv(os.path.join(ROOT_DIR, '.env'))

api_key = os.getenv("ELEVENLABS_API_KEY")
voice_id_mom = os.getenv("VOICE_ID_MOM")

# 클라이언트 생성
client = ElevenLabs(api_key=api_key)

# 복제된 목소리 목록 확인
voices = client.voices.get_all()
for v in voices.voices:
    if v.category == "cloned":
        print(v.name, v.voice_id)

# output 폴더 생성 (없으면 자동 생성)
OUTPUT_DIR = os.path.join(ROOT_DIR, "output")
os.makedirs(OUTPUT_DIR, exist_ok=True)

# 감정별 파라미터 설정
emotion_settings = {
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
    "greedy":  {"stability": 0.30, "similarity_boost": 0.80, "style": 0.75},
    # "기쁨": {"stability": 0.1, "similarity_boost": 1.0, "style": 1.0},
    # "슬픔": {"stability": 0.7, "similarity_boost": 1.0, "style": 0.05},
    # "공포": {"stability": 0.05, "similarity_boost": 1.0, "style": 1.0},
    # "평온": {"stability": 0.9, "similarity_boost": 1.0, "style": 0.0},
}

def generate_voice(text, emotion="calm"):
    settings = emotion_settings[emotion]

    audio = client.text_to_speech.convert(
        voice_id=voice_id_mom,
        text=text,
        model_id="eleven_multilingual_v2",
        voice_settings={
            "stability": settings["stability"],
            "similarity_boost": settings["similarity_boost"],
            "style": settings["style"],
            "use_speaker_boost": True
        }
    )

    filename = os.path.join(OUTPUT_DIR, f"파일명_{emotion}.mp3")
    with open(filename, "wb") as f:
        for chunk in audio:
            f.write(chunk)
    print(f"저장완료: {filename}")
    return str(filename)

# 같은 문장을 감정별로 4개 생성
if __name__ == "__main__":
# 한국어
    generate_voice("어흥! 호랑이가 나타났다!", emotion="scary")
    generate_voice("와! 금도끼를 찾았어요!", emotion="joyful")
    generate_voice("나무꾼은 슬피 울었어요.", emotion="sad")
    generate_voice("옛날 옛날에 나무꾼이 살았어요.", emotion="warm")

    # # 영어
    # generate_voice("Roar! A tiger has appeared!", emotion="scary")
    # generate_voice("Wow! I found the golden axe!", emotion="joyful")
    # generate_voice("The woodcutter cried sadly.", emotion="sad")
    # generate_voice("Once upon a time, there lived a woodcutter.", emotion="warm")

    # # 일본어
    # generate_voice("ガオー！虎が現れた！", emotion="scary")
    # generate_voice("わあ！金の斧を見つけた！", emotion="joyful")
    # generate_voice("木こりは悲しく泣きました。", emotion="sad")
    # generate_voice("昔々、木こりが住んでいました。", emotion="warm")
