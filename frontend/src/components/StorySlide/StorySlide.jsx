import React, { useState, useEffect } from "react";
import "./StorySlide.css";

function StorySlide({ page }) {
  const [isError, setIsError] = useState(false);

  // 페이지가 바뀔 때마다 에러 상태 초기화
  useEffect(() => {
    setIsError(false);
  }, [page?.image]);

  if (!page) return <div className="illustration-card">데이터를 기다리는 중...</div>;

  return (
    <>
      <div className="illustration-card" style={{ position: 'relative', overflow: 'hidden' }}>
        <img
          className="illustration-image"
          src={page.image}
          alt="동화 이미지"
          onError={() => setIsError(true)}
        />

        {/* 🚨 이미지가 깨졌을 때만 나타나는 디버깅 패널 */}
        {isError && (
          <div style={{
            position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
            background: '#fff0f0', color: '#d32f2f',
            padding: '20px', fontSize: '14px', wordBreak: 'break-all',
            display: 'flex', flexDirection: 'column', justifyContent: 'center', border: '2px solid red'
          }}>
            <p style={{ fontWeight: 'bold', marginBottom: '10px' }}>⚠️ 이미지 로드 실패!</p>
            <p><strong>넘어온 주소:</strong> {page.image || "값이 없음(null/undefined)"}</p>
            <p style={{ marginTop: '10px', fontSize: '12px', color: '#666' }}>
              TIP: 주소가 /illusts/... 로 시작한다면 앞에 API_BASE_URL이 빠진 것일 수 있습니다.
            </p>
          </div>
        )}
      </div>

      <div className="story-text-card">
        <p>{page.text}</p>
      </div>
    </>
  );
}

export default StorySlide;