import io
import os
import re
import json
from urllib.parse import quote
from pathlib import Path
from fastapi import APIRouter, HTTPException, Query
from fastapi.responses import StreamingResponse
from pydub import AudioSegment


from app.services.parent_voice_engine import generate_parent_speech

router = APIRouter(prefix="/api/stream", tags=["Stream"])

BASE_DIR = Path(__file__).parent.parent.parent
DATA_DIR = BASE_DIR / "data"
STORY_DIR = DATA_DIR / "story"
FRONTEND_PUBLIC_DIR = BASE_DIR / "frontend" / "public"
FRONTEND_DIST_DIR = BASE_DIR / "frontend" / "dist"


def normalize_image_path(raw_image):
    if not raw_image:
        return ""

    image_path = str(raw_image).strip()

    if image_path.startswith(("http://", "https://", "data:", "blob:")):
        return image_path

    if image_path.startswith("/"):
        return image_path

    return f"/{image_path}"


def public_image_exists(image_path):
    if not image_path:
        return False

    if image_path.startswith(("http://", "https://", "data:", "blob:")):
        return True

    relative_path = image_path.lstrip("/")

    return any(
        (base_dir / relative_path).exists()
        for base_dir in (FRONTEND_PUBLIC_DIR, FRONTEND_DIST_DIR)
    )


def get_scene_image_path(story_info, scene):
    # 1순위: JSON 장면 안에 image가 직접 있으면 그걸 사용
    for key in ("image", "image_path", "storyImage"):
        if scene.get(key):
            return normalize_image_path(scene.get(key))

    # 2순위: 정해진 폴더 규칙으로 자동 탐색
    story_id = story_info.get("story_id", "")
    scene_id = scene.get("id")

    if story_id and scene_id is not None:
        auto_candidates = [
            f"/illusts/{story_id}/scene_{scene_id}.png",
            f"/illusts/{story_id}/scene_{scene_id}.jpg",
            f"/illusts/{story_id}/scene_{scene_id}.jpeg",
            f"/illusts/{story_id}/scene_{scene_id}.webp",
            f"/illusts/{story_id}/{scene_id}.png",
            f"/illusts/{story_id}/{scene_id}.jpg",
            f"/illusts/{story_id}/{scene_id}.jpeg",
            f"/illusts/{story_id}/{scene_id}.webp",
        ]

        for candidate in auto_candidates:
            if public_image_exists(candidate):
                return candidate

    # 3순위: 장면 이미지가 없으면 기존 대표 이미지 사용
    return normalize_image_path(story_info.get("image_path", ""))

def clean_text_combined(text):
    text = re.sub(r"""['"`Standard‘’Standard“”]""", "", text)
    text = text.replace("…", ".").replace("—", ",")
    text = re.sub(r"(\d)([가-힣])", r"\1 \2", text)
    text = re.sub(r"([가-힣])(\d)", r"\1 \2", text)
    text = re.sub(r"\.{2,}", ".", text)
    return text.strip()

def apply_audio_processing(audio, pitch="normal", speed=1.0):
    if pitch == "high":
        audio = audio._spawn(audio.raw_data, overrides={"frame_rate": int(audio.frame_rate * 1.1)})
    elif pitch == "low":
        audio = audio._spawn(audio.raw_data, overrides={"frame_rate": int(audio.frame_rate * 0.9)})
    if speed != 1.0:
        audio = audio._spawn(audio.raw_data, overrides={"frame_rate": int(audio.frame_rate * speed)})
    return audio.set_frame_rate(44100)

EMOTION_MAP = {
    "gentle": "평온", "scary": "공포", "urgent": "기쁨", 
    "happy": "기쁨", "sad": "슬픔", "neutral": "평온"
}
PAUSE_MS = {"gentle": 800, "scary": 1200, "urgent": 500, "happy": 600, "sad": 1000, "neutral": 700}

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
        current_time_ms = 0  # 누적 재생 시간 (밀리초 단위)
        
        for scene in story_data.get("scenes", []):
            clean_text = clean_text_combined(scene["text"])
            scene_emotion = scene.get("emotion", "neutral")
            kr_emotion = EMOTION_MAP.get(scene_emotion, "평온")
            
            temp_path = None
            try:
                # 현재 장면의 시작 시간을 타임라인에 기록 (초 단위로 변환)
                timeline.append({
                    "scene_index": len(timeline),
                    "start_time": current_time_ms / 1000.0,
                    "text": scene["text"], # 대사 전체 전달
                    "emotion": scene.get("emotion", "neutral"), # 감정 정보
                    "id": scene.get("id"),
                    "image": get_scene_image_path(story_info, scene)
                })

                temp_path = generate_parent_speech(clean_text, voice_id=voice_id, emotion=kr_emotion)
                scene_audio = AudioSegment.from_file(temp_path)
                
                scene_audio = apply_audio_processing(
                    scene_audio, 
                    pitch=scene.get("pitch", "normal"), 
                    speed=scene.get("speed", 1.0)
                )
                
                # 메인 오디오에 합치기
                combined_audio += scene_audio
                current_time_ms += len(scene_audio) # 음성 길이 더하기

                # 장면 사이 여백 추가
                pause_duration = PAUSE_MS.get(scene_emotion, 700)
                combined_audio += AudioSegment.silent(duration=pause_duration)
                current_time_ms += pause_duration # 여백 길이 더하기
                
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

        # 4. 타임라인 데이터를 JSON 문자열로 변환
        timeline_json = json.dumps(timeline, ensure_ascii=False)
        
        # 한글이 포함된 JSON 문자열을 URL Safe하게 인코딩합니다.
        safe_timeline_json = quote(timeline_json)

        return StreamingResponse(
            audio_buffer, 
            media_type="audio/mpeg",
            headers={
                "Content-Disposition": f"inline; filename={story_id}.mp3",
                "X-Story-Timeline": safe_timeline_json,  # 커스텀 헤더에 타임라인 삽입
                "Access-Control-Expose-Headers": "X-Story-Timeline"  # 프론트에서 접근 허용
            }
        )

    except Exception as e:
        print(f"서버 에러: {e}")
        raise HTTPException(status_code=500, detail="동화를 읽어주는 중에 문제가 생겼어요.")