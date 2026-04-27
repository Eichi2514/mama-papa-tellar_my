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
    "기쁨": {"stability": 0.1, "similarity_boost": 1.0, "style": 1.0},
    "슬픔": {"stability": 0.7, "similarity_boost": 1.0, "style": 0.05},
    "공포": {"stability": 0.05, "similarity_boost": 1.0, "style": 1.0},
    "평온": {"stability": 0.9, "similarity_boost": 1.0, "style": 0.0},
}

def generate_voice(text, emotion="평온"):
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
    generate_voice("어흥! 호랑이가 나타났다!", emotion="공포")
    generate_voice("와! 금도끼를 찾았어요!", emotion="기쁨")
    generate_voice("나무꾼은 슬피 울었어요.", emotion="슬픔")
    generate_voice("옛날 옛날에 나무꾼이 살았어요.", emotion="평온")