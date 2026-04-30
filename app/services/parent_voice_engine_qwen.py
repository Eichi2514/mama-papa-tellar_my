import os
import dashscope
from pathlib import Path
from dotenv import load_dotenv
import requests
import uuid

# 설정 로드
ROOT_DIR = Path(__file__).parent.parent.parent
load_dotenv(ROOT_DIR / ".env")
dashscope.api_key = os.getenv("DASHSCOPE_API_KEY")

# Qwen3는 텍스트 지시어를 통해 감정을 풍부하게 표현합니다.
EMOTION_PROMPTS = {
    "기쁨": "(밝고 활기차게, 웃음 섞인 목소리로) ",
    "슬픔": "(나지막하고 촉촉한 목소리로, 아이를 달래듯이) ",
    "공포": "(조금 떨리는 듯 긴박하게, 속삭이듯이) ",
    "평온": "(따뜻하고 인자한 부모님의 미소를 머금고) ",
}

def generate_parent_speech(text, voice_id, emotion="평온"):
    # (앞부분 로직은 동일하게 유지...)
    prefix = EMOTION_PROMPTS.get(emotion, EMOTION_PROMPTS["평온"])
    full_text = prefix + text

    dashscope.base_http_api_url = 'https://dashscope-intl.aliyuncs.com/api/v1'

    response = dashscope.MultiModalConversation.call(
        model="qwen3-tts-vc-2026-01-22",
        text=full_text,
        voice=voice_id,
        stream=False
    )

    if response.status_code == 200:
        audio_url = response.output.audio["url"]
        
        # 1. 생성된 오디오 URL에서 실제 음성 데이터를 다운로드합니다.
        audio_data = requests.get(audio_url).content
        
        # 2. 고유한 임시 파일명으로 저장합니다. (stream.py에서 읽고 지울 수 있도록)
        temp_filename = f"temp_speech_{uuid.uuid4().hex}.mp3"
        with open(temp_filename, "wb") as f:
            f.write(audio_data)
            
        return temp_filename # 이제 URL이 아닌 진짜 파일 경로를 반환해요!
    else:
        print(f"❌ 음성 생성 실패: {response.message}")
        return None