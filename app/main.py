from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.api import stories, voice, stream                        # Qwen3 쓰려면 여기를 주석
# from app.api import stories, voice_qwen, stream_qwen              # Qwen3 쓰려면 여기를 주석해제

app = FastAPI(title="마마/파파 텔러 API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# 분리된 라우터들을 등록합니다.
app.include_router(stories.router)

app.include_router(voice.router)                    # Qwen3 쓰려면 여기를 주석처리
app.include_router(stream.router)                   # Qwen3 쓰려면 여기를 주석처리

# app.include_router(voice_qwen.router)               # Qwen3 쓰려면 여기를 주석해제
# app.include_router(stream_qwen.router)              # Qwen3 쓰려면 여기를 주석해제

@app.get("/")
async def root():
    return {"message": "아이들을 위한 따뜻한 이야기 세상, 마마/파파 텔러입니다."}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)