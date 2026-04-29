import io
import os
import re
import json
from urllib.parse import quote
from pathlib import Path

from pydub import AudioSegment
from fastapi import APIRouter, HTTPException, Query
from fastapi.responses import StreamingResponse

from app.services.parent_voice_engine import generate_parent_speech

router = APIRouter(prefix="/api/stream", tags=["Stream"])

BASE_DIR = Path(__file__).parent.parent.parent
DATA_DIR = BASE_DIR / "data"
STORY_DIR = DATA_DIR / "story"

# ── 감정 설정 (기존 튜닝값 그대로) ───────────────────────

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
    "greedy":  {"stability": 0.30, "similarity_boost": 0.80, "style": 0.75},
}

# ── story.json 감정 → parent_voice_engine.py 감정 키 정규화 ────────────────────
EMOTION_MAP = {
    "calm": "calm",
    "warm": "warm",
    "gentle": "gentle",
    "happy": "happy",
    "joyful": "joyful",
    "sad": "sad",
    "scary": "scary",
    "shocked": "shocked",
    "urgent": "urgent",
    "stern": "stern",
    "greedy": "greedy",
    "neutral": "calm"
}


# ── 화자별 보정치 ──────────────────────────────────────────
SPEAKER_OVERLAY = {
    "narrator":   {"stability": +0.00, "style": +0.00},
    "tiger":      {"stability": -0.10, "style": +0.15},
    "brother":    {"stability": +0.05, "style": +0.10},
    "sister":     {"stability": +0.05, "style": +0.10},
    "god":        {"stability": +0.15, "style": -0.10},
    "king":       {"stability": +0.10, "style": -0.05},
    "fairy":      {"stability": +0.00, "style": +0.10},
    "woodcutter": {"stability": +0.05, "style": +0.00},
    "deer":       {"stability": +0.00, "style": +0.10},
    "rabbit":     {"stability": -0.05, "style": +0.15},
    "turtle":     {"stability": +0.10, "style": -0.05},
    "lover":      {"stability": +0.00, "style": +0.05},
}

# ── 화자별 뒤 무음 길이 (ms) ──────────────────────────────
SPEAKER_PAUSE = {
    "narrator":   600,
    "tiger":      250,
    "brother":    400,
    "sister":     400,
    "god":        950,
    "king":       800,
    "fairy":      500,
    "woodcutter": 500,
    "deer":       400,
    "rabbit":     300,
    "turtle":     750,
    "lover":      500,
}

def normalize_emotion(emotion: str) -> str:
    return EMOTION_MAP.get(emotion, "calm")

def clamp(value: float, lo: float = 0.0, hi: float = 1.0) -> float:
    return max(lo, min(hi, value))


def get_voice_settings(emotion: str, speaker: str) -> dict:
    base = EMOTION_SETTINGS.get(emotion, EMOTION_SETTINGS["calm"]).copy()
    overlay = SPEAKER_OVERLAY.get(speaker, {})

    base["stability"] = clamp(base["stability"] + overlay.get("stability", 0.0))
    base["style"] = clamp(base["style"] + overlay.get("style", 0.0))

    return base


# ── 구두점 전처리 ──────────────────────────────────────────
def preprocess_text(text: str) -> str:
    text = re.sub(r'!', '! ',        text)
    text = re.sub(r'\?', '? ',       text)
    text = re.sub(r',', ',  ',       text)
    text = re.sub(r"(\d)([가-힣])", r"\1 \2", text)
    text = re.sub(r"([가-힣])(\d)", r"\1 \2", text)
    text = re.sub(r'[…]|\.{3}', '... ', text)
    text = re.sub(r' {2,}', ' ', text).strip()
    return text

@router.get("/play/{story_id}") 
async def stream_story_audio(
    story_id: str, 
    voice_id: str = Query(..., description="프론트 로컬스토리지에서 가져온 부모님 목소리 ID")
):
    try:
        # 1. 동화 정보 로드
        with open(DATA_DIR / "metadata.json", "r", encoding="utf-8") as f:
            meta = json.load(f)

        story_info = next((s for s in meta["story"] if s["story_id"] == story_id), None)
        
        if not story_info:
            raise HTTPException(status_code=404, detail="동화를 찾을 수 없습니다.")

        with open(STORY_DIR / story_info["file_name"], "r", encoding="utf-8") as f:
            story_data = json.load(f)

        # 2. 오디오 합성 및 타임라인 계산
        combined_audio = AudioSegment.empty()
        timeline = []
        current_time_ms = 0
        
        for scene_index, scene in enumerate(story_data.get("scenes", [])):
            text = scene.get("text", "").strip()
            if not text:
                continue

            clean_text = preprocess_text(text)
            speaker = scene.get("speaker", "narrator")
            scene_emotion = normalize_emotion(scene.get("emotion", "calm"))

            temp_path = None

            try:
                timeline.append({
                    "scene_index": scene_index,
                    "start_time": current_time_ms / 1000.0,
                    "text": text,
                    "speaker": speaker,
                    "emotion": scene_emotion,
                    "id": scene.get("id"),
                    "storyImage": story_info.get("image_path")
                })

                voice_settings = get_voice_settings(scene_emotion, speaker)

                temp_path = generate_parent_speech(
                    clean_text,
                    voice_id=voice_id,
                    emotion=scene_emotion,
                    voice_settings=voice_settings,
                    )

                scene_audio = AudioSegment.from_file(temp_path)

                combined_audio += scene_audio
                current_time_ms += len(scene_audio)

                pause_duration = SPEAKER_PAUSE.get(speaker, SPEAKER_PAUSE["narrator"])
                combined_audio += AudioSegment.silent(duration=pause_duration)
                current_time_ms += pause_duration

            except Exception as e:
                print(f"장면 합성 중 에러 발생: {e}")
                continue

            finally:
                if temp_path and os.path.exists(temp_path):
                    os.remove(temp_path)

        if len(combined_audio) == 0:
            raise HTTPException(status_code=500, detail="음성 생성에 실패했습니다.")

        # 3. 메모리 스트리밍
        audio_buffer = io.BytesIO()
        combined_audio.export(audio_buffer, format="mp3", bitrate="128k")
        audio_buffer.seek(0)

        # 4. 타임라인 데이터 헤더 삽입
        timeline_json = json.dumps(timeline, ensure_ascii=False)
        safe_timeline_json = quote(timeline_json)

        return StreamingResponse(
            audio_buffer,
            media_type="audio/mpeg",
            headers={
                "Content-Disposition": f"inline; filename={story_id}.mp3",
                "X-Story-Timeline": safe_timeline_json,
                "Access-Control-Expose-Headers": "X-Story-Timeline"
            }
        )

    except HTTPException:
        raise

    except Exception as e:
        print(f"서버 에러: {e}")
        raise HTTPException(status_code=500, detail="동화를 읽어주는 중에 문제가 생겼어요.")