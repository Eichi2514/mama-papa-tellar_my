import os
import requests
import base64
import pathlib
import dashscope
from pathlib import Path
from dotenv import load_dotenv

# 환경 설정
load_dotenv(Path(__file__).parent.parent.parent / '.env')

API_KEY = os.getenv("DASHSCOPE_API_KEY")
ROOT_DIR = Path(__file__).parent.parent.parent
OUTPUT_DIR = ROOT_DIR / "output"
OUTPUT_DIR.mkdir(exist_ok=True)
REF_AUDIO_PATH = ROOT_DIR / "SKH_샘플0428.m4a"

TARGET_MODEL = "qwen3-tts-vc-2026-01-22"
ENROLLMENT_URL = "https://dashscope-intl.aliyuncs.com/api/v1/services/audio/tts/customization"

# 1단계: 목소리 등록
def enroll_voice(audio_path):
    file_path = pathlib.Path(audio_path)
    base64_str = base64.b64encode(file_path.read_bytes()).decode()
    data_uri = f"data:audio/mp4;base64,{base64_str}"

    payload = {
        "model": "qwen-voice-enrollment",
        "input": {
            "action": "create",
            "target_model": TARGET_MODEL,
            "preferred_name": "parent_voice",
            "audio": {"data": data_uri}
        }
    }
    headers = {
        "Authorization": f"Bearer {API_KEY}",
        "Content-Type": "application/json"
    }

    resp = requests.post(ENROLLMENT_URL, json=payload, headers=headers)
    if resp.status_code != 200:
        raise RuntimeError(f"목소리 등록 실패: {resp.status_code}, {resp.text}")

    voice_id = resp.json()["output"]["voice"]
    print(f"✅ 목소리 등록 완료: {voice_id}")
    return voice_id

# 2단계: TTS 생성
def generate_voice_qwen(text, voice_id, emotion="joyful"):

    dashscope.base_http_api_url = 'https://dashscope-intl.aliyuncs.com/api/v1'

    response = dashscope.MultiModalConversation.call(
        model=TARGET_MODEL,
        api_key=API_KEY,
        text=text,
        voice=voice_id,
        stream=False
    )

    if response.status_code == 200:
        audio_url = response.output.audio["url"]
        audio_data = requests.get(audio_url).content
                
        # 생성된 음성 데이터를 경로에 저장합니다.
        final_filename = str(OUTPUT_DIR / f"{emotion}_result.mp3") 
        with open(final_filename, "wb") as f:
            f.write(audio_data)
        
        print(f"✨ {emotion} 생성 완료: {final_filename}")
            
        return final_filename
    else:
        print(f"❌ 합성 실패: {response.message}")
        return None

# 실행
if __name__ == "__main__":
    if not REF_AUDIO_PATH.exists():
        print(f"⚠️ 경고: {REF_AUDIO_PATH} 파일이 없습니다.")
    else:
        voice_id = enroll_voice(REF_AUDIO_PATH)
        generate_voice_qwen("어흥! 호랑이가 나타났다!", voice_id, emotion="fear")
        generate_voice_qwen("와! 금도끼를 찾았어요!", voice_id, emotion="joyful")
        generate_voice_qwen("나무꾼은 슬피 울었어요.", voice_id, emotion="sad")
        generate_voice_qwen("옛날 옛날에 나무꾼이 살았어요.", voice_id, emotion="calm")