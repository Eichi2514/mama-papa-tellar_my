from fastapi import APIRouter, HTTPException, UploadFile, File
import httpx
import uuid
import os
from dotenv import load_dotenv

router = APIRouter(prefix="/api/voice", tags=["Voice"])

# .env 로드
load_dotenv()
ELEVENLABS_GEN_API_KEY = os.getenv("ELEVENLABS_GEN_API_KEY")

@router.get("/scriptLines")
async def get_scripts():
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
    try:
        if not ELEVENLABS_GEN_API_KEY:
            raise ValueError("API Key missing")

        audio_content = await file.read()
        user_nickname = f"user_{uuid.uuid4().hex[:6]}"

        async with httpx.AsyncClient(timeout=60.0) as client:
            headers = {"xi-api-key": ELEVENLABS_GEN_API_KEY}
            data = {
                "name": f"MPT_{user_nickname}",
                "description": "마마파파텔러 서비스용 보이스 클로닝"
            }
            files = {"files": (file.filename, audio_content, "audio/wav")}
            
            response = await client.post(
                "https://api.elevenlabs.io/v1/voices/add",
                headers=headers,
                data=data,
                files=files
            )
            
            if response.status_code != 200:
                return {"status": "error", "message": "목소리 등록 실패"}
            
            result = response.json()
            
        return {
            "status": "success", 
            "voice_id": result["voice_id"],
            "message": "우리 아이에게 들려줄 목소리를 소중히 저장했어요!"
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))