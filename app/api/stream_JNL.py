import json
import re
import sys
import time
import os
from pathlib import Path

import numpy as np
import sounddevice as sd
from pydub import AudioSegment


PROJECT_ROOT = Path(__file__).parent.parent.parent

if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))


DATA_DIR = PROJECT_ROOT / "data"
STORY_DIR = DATA_DIR / "story"
OUTPUT_DIR = PROJECT_ROOT / "output"


EMOTION_PARAMS = {
    "gentle": {"pause_after": 0.8, "kr_emotion": "평온"},
    "scary": {"pause_after": 1.2, "kr_emotion": "공포"},
    "urgent": {"pause_after": 0.5, "kr_emotion": "기쁨"},
    "happy": {"pause_after": 0.6, "kr_emotion": "기쁨"},
    "sad": {"pause_after": 1.0, "kr_emotion": "슬픔"},
    "neutral": {"pause_after": 0.7, "kr_emotion": "평온"},
}


def load_metadata():
    meta_path = DATA_DIR / "metadata.json"

    with open(meta_path, "r", encoding="utf-8") as f:
        return json.load(f)


def load_story(filename):
    story_path = STORY_DIR / filename

    with open(story_path, "r", encoding="utf-8") as f:
        return json.load(f)


def clean_text(text):
    text = str(text)

    text = re.sub(r"""['"`‘’“”]""", " ", text)
    text = re.sub(r"[…]+", "... ", text)
    text = re.sub(r"[—–]+", ", ", text)
    text = re.sub(r"([.!?])", r"\1 ", text)
    text = re.sub(r"([,;:])", r"\1 ", text)
    text = re.sub(r"\s+", " ", text)

    return text.strip()


def tts_generate(text, params):
    from app.services.tts_service import generate_voice

    kr_emotion = params["kr_emotion"]

    mp3_bytes = generate_voice_bytes(text, emotion=kr_emotion)
    
    return mp3_bytes


def play_audio_sd(mp3_path):
    if not os.path.exists(mp3_path):
        print(f"파일이 없습니다: {mp3_path}")
        return

    try:
        audio = AudioSegment.from_mp3(mp3_path)

        samples = np.array(audio.get_array_of_samples()).astype(np.float32)
        samples /= np.iinfo(audio.array_type).max

        if audio.channels == 2:
            samples = samples.reshape((-1, 2))

        sd.play(samples, samplerate=audio.frame_rate)
        sd.wait()

    except Exception as error:
        print(f"재생 실패: {error}")

    finally:
        if os.path.exists(mp3_path):
            os.unlink(mp3_path)


def find_story_file_by_id(story_id):
    metadata = load_metadata()

    for story in metadata["story"]:
        if story["story_id"] == story_id:
            return story["file_name"]

    return None


def run_story(filename):
    story = load_story(filename)
    title = story["story_title"]
    scenes = story["scenes"]

    print(f"\n{title} 시작 (총 {len(scenes)}장면)\n")

    title_params = EMOTION_PARAMS["neutral"]
    title_mp3 = tts_generate(clean_text(title), title_params)
    play_audio_sd(title_mp3)
    time.sleep(title_params["pause_after"])

    for scene in scenes:
        emotion = scene.get("emotion", "neutral")
        params = EMOTION_PARAMS.get(emotion, EMOTION_PARAMS["neutral"])

        text = clean_text(scene["text"])

        print(f"장면 {scene['id']} [{emotion}]")
        print(f"  {text}\n")

        mp3_path = tts_generate(text, params)
        play_audio_sd(mp3_path)

        time.sleep(params["pause_after"])

    print("끝!")


def run_story_by_id(story_id):
    filename = find_story_file_by_id(story_id)

    if filename is None:
        print(f"story_id를 찾을 수 없어요: {story_id}")
        return

    run_story(filename)


if __name__ == "__main__":
    run_story_by_id("ST_001")