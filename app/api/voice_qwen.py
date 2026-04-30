# app/api/voice_qwen.py

from fastapi import APIRouter, HTTPException, UploadFile, File
import httpx
import base64
import os
import uuid
import traceback
import io
from pydub import AudioSegment
from dotenv import load_dotenv

router = APIRouter(prefix="/api/voice", tags=["Voice"])

# 환경 변수 로드
load_dotenv()
DASHSCOPE_API_KEY = os.getenv("DASHSCOPE_API_KEY")
TARGET_MODEL = "qwen3-tts-vc-2026-01-22"
ENROLLMENT_URL = "https://dashscope-intl.aliyuncs.com/api/v1/services/audio/tts/customization"

@router.get("/scriptLines")
async def get_scripts():
    """부모님이 목소리 등록(녹음)을 위해 화면을 보며 읽을 샘플 스크립트예요."""
    return {
        "scripts": [
            { "emotion": "(다정하고 차분하게)", "text": "안녕, 사랑하는 우리 아가. 오늘 하루는 어땠어? 밥도 꼭꼭 씹어 잘 먹고, 친구들이랑 신나게 뛰어놀았니?" },
            { "emotion": "(조금 놀라고 신난 목소리로)", "text": "우와! 저기 밤하늘을 좀 봐! 반짝반짝 빛나는 별똥별이 떨어지고 있어! 정말 신기하고 예쁘지 않니?" },
            { "emotion": "(궁금해하며 묻듯이)", "text": "우리 아가는 나중에 커서 어떤 사람이 되고 싶어? 하늘을 훨훨 나는 멋진 우주 비행사? 아니면 동물 친구들과 이야기하는 마법사?" },
            { "emotion": "(작고 부드럽게 속삭이듯)", "text": "자, 이제 밤이 깊었어. 따뜻한 이불속으로 쏙 들어가서 두 눈을 꼭 감아보자. 숨을 크게 들이마시고, 천천히 내쉬고..." },
            { "emotion": "(사랑을 듬뿍 담아서)", "text": "내가 세상에서 제일 재미있고 포근한 꿈나라 이야기를 들려줄게. 오늘도 정말 사랑해, 좋은 꿈 꿔." }
        ]
    }

@router.post("/register")
async def register_voice(file: UploadFile = File(...)):
    """부모님의 목소리를 Qwen3에 등록하여 고유의 목소리 ID를 발급받는 API예요."""
    try:
        if not DASHSCOPE_API_KEY:
            raise ValueError("DashScope API Key가 설정되지 않았어요. 아이에게 들려줄 준비가 덜 되었나 봐요!")

        audio_content = await file.read()
        
        # 🌟 핵심 해결책: 어떤 파일이 들어오든 순수 WAV 포맷으로 변환합니다!
        try:
            # 1. 프론트에서 받은 파일을 메모리에 올립니다.
            input_buffer = io.BytesIO(audio_content)
            
            # 2. Pydub이 파일을 읽어서 오디오 데이터로 만듭니다. (ffmpeg가 알아서 형식을 해석해요)
            audio_segment = AudioSegment.from_file(input_buffer)
            
            # 3. Qwen3가 가장 좋아하는 16kHz, 1채널 WAV 형식으로 최적화해서 다시 내보냅니다.
            audio_segment = audio_segment.set_frame_rate(16000).set_channels(1)
            output_buffer = io.BytesIO()
            audio_segment.export(output_buffer, format="wav")
            
            # 4. 변환된 깨끗한 WAV 데이터를 Base64로 만듭니다.
            base64_str = base64.b64encode(output_buffer.getvalue()).decode('utf-8')
            data_uri = f"data:audio/wav;base64,{base64_str}"
            
        except Exception as pydub_error:
            raise ValueError(f"오디오 파일을 변환하는 데 실패했어요. 녹음 파일에 문제가 있나 봐요! ({pydub_error})")

        # 중복되지 않는 고유한 부모님 목소리 닉네임 생성
        user_nickname = f"parent_{uuid.uuid4().hex[:6]}"

        payload = {
            "model": "qwen-voice-enrollment",
            "input": {
                "action": "create",
                "target_model": TARGET_MODEL,
                "preferred_name": user_nickname,
                "audio": {"data": data_uri}
            }
        }
        
        headers = {
            "Authorization": f"Bearer {DASHSCOPE_API_KEY}",
            "Content-Type": "application/json"
        }

        # 부모님의 목소리를 서버에 안전하게 전달합니다.
        async with httpx.AsyncClient(timeout=60.0) as client:
            response = await client.post(ENROLLMENT_URL, json=payload, headers=headers)
            
            if response.status_code != 200:
                raise HTTPException(status_code=response.status_code, detail=f"목소리 등록에 실패했어요: {response.text}")
            
            result = response.json()
            voice_id = result["output"]["voice"]

        return {
            "status": "success", 
            "voice_id": voice_id,
            "message": "우리 아이에게 들려줄 목소리를 소중히 저장했어요!"
        }
    except Exception as e:
        print("🚨 앗! 목소리 등록 중 에러가 발생했어요! 상세 내용:")
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))