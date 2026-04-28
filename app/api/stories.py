from fastapi import APIRouter, HTTPException
import json
import os

router = APIRouter(prefix="/api/stories", tags=["Stories"])

# 경로 설정
CURRENT_FILE_PATH = os.path.abspath(__file__)
BASE_DIR = os.path.dirname(os.path.dirname(os.path.dirname(CURRENT_FILE_PATH)))
METADATA_PATH = os.path.join(BASE_DIR, "data", "metadata.json")

@router.get("")
async def get_stories():
    try:
        if not os.path.exists(METADATA_PATH):
            raise HTTPException(status_code=404, detail="동화 꾸러미를 찾을 수 없어요.")
            
        with open(METADATA_PATH, "r", encoding="utf-8") as f:
            data = json.load(f)
        return data
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))