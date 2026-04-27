"""
데이터 정제 및 오디오 인터페이스

설치: pip install playsound==1.2.2

실행: python app/api/stream_JMS.py
"""

import json
import re
import time
import os
from pathlib import Path

from playsound import playsound


# data/ 폴더 경로 (이 파일 기준 프로젝트 루트 → data/)
DATA_DIR = Path(__file__).parent.parent.parent / "data"
STORY_DIR = DATA_DIR / "story"


# 감정별 속도 / 일시정지 설정
EMOTION_PARAMS = {
    "gentle": {"speed": 0.90, "slow": True,  "pause_after": 0.8, "kr_emotion": "평온"},
    "scary":  {"speed": 0.80, "slow": True,  "pause_after": 1.2, "kr_emotion": "공포"},
    "urgent": {"speed": 1.25, "slow": False, "pause_after": 0.5, "kr_emotion": "기쁨"},
    "happy":  {"speed": 1.15, "slow": False, "pause_after": 0.6, "kr_emotion": "기쁨"},
    "sad":    {"speed": 0.80, "slow": True,  "pause_after": 1.0, "kr_emotion": "슬픔"},
    "neutral":{"speed": 1.00, "slow": False, "pause_after": 0.7, "kr_emotion": "평온"},
}


# 동화 목록 불러오기
def load_metadata():
    meta_path = DATA_DIR / "metadata.json"
    with open(meta_path, "r", encoding="utf-8") as f:
        return json.load(f)


# 동화 JSON 불러오기
def load_story(filename):
    path = STORY_DIR / filename
    with open(path, "r", encoding="utf-8") as f:
        return json.load(f)


# 텍스트 정제
def clean_text(text):
    # 특수문자 → TTS 친화적 기호로 변환
    text = text.replace("…", ".").replace("—", ",")
    text = text.replace("!", ". ").replace("?", ". ")
    # 숫자와 한글 사이 공백 확보 (예: "3명" → "3 명")
    text = re.sub(r"(\d)([가-힣])", r"\1 \2", text)
    text = re.sub(r"([가-힣])(\d)", r"\1 \2", text)
    # 연속 마침표 정리 (예: "..." → ".")
    text = re.sub(r"\.{2,}", ".", text)
    # 연속 공백 제거
    text = re.sub(r" {2,}", " ", text)
    return text.strip()


# TTS 생성 → mp3 파일 경로 반환 (tts_service.generate_voice 연동)
def tts_generate(text, params):
    from app.services.tts_service import generate_voice
    kr_emotion = params["kr_emotion"]
    mp3_path = generate_voice(text, emotion=kr_emotion)
    return mp3_path

''' gTTS 임시 대체 (오프라인 테스트용)
def tts_generate(text, params):
    from gtts import gTTS
    tts = gTTS(text=text, lang="ko", slow=params["slow"])
    with tempfile.NamedTemporaryFile(suffix=".mp3", delete=False) as tmp:
        tmp_path = tmp.name
    tts.save(tmp_path)
    return tmp_path
'''


# 오디오 재생 (mp3 → playsound)
# gTTS, ElevenLabs 모두 mp3로 반환하므로 공통 사용

def play_audio(mp3_path):
    if not os.path.exists(mp3_path):
        print(f" 파일이 없습니다 : {mp3_path}")
        return
    try:
        playsound(mp3_path)
    except Exception as e:
        print(f" 재생 실패 : {e}")
    finally:
        if os.path.exists(mp3_path):
            os.unlink(mp3_path)

# 동화 목록 출력
def print_story_list():
    meta = load_metadata()
    print("\n사용 가능한 동화 목록:")
    for story in meta["story"]:
        print(f"  [{story['story_id']}] {story['title']} ({story['duration']}) - {story['file_name']}")
    print()


# 전체 동화 실행
def run_story(filename):
    try:
        story = load_story(filename)
    except FileNotFoundError:
        print(f"동화 파일을 찾을 수 없습니다: {filename}")
        return

    title  = story["story_title"]
    scenes = story["scenes"]

    print(f"\n{title} 시작 (총 {len(scenes)}장면)\n")

    for scene in scenes:
        text    = clean_text(scene["text"])
        emotion = scene["emotion"]
        params  = EMOTION_PARAMS.get(emotion, EMOTION_PARAMS["neutral"])

        print(f"장면 {scene['id']} [{emotion}]")
        print(f"  {text}\n")

        mp3_path = tts_generate(text, params)
        play_audio(mp3_path)
        time.sleep(params["pause_after"])

    print("끝!")

# 동화 목록 출력 후 실행
if __name__ == "__main__":
    print_story_list()
    run_story("cowherd_and_weaver.json")