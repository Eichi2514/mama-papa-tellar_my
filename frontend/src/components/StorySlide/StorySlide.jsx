import React, { useState, useEffect } from "react";
import "./StorySlide.css";

function StorySlide({ page }) {
  const [isError, setIsError] = useState(false);

  // 1. 파일 주소 해결 함수 (기존 로직 유지)
  const resolveMediaSrc = (src) => {
    if (!src) return "";

    // 외부 주소, base64, blob 주소는 그대로 사용
    if (/^(https?:|data:|blob:)/.test(src)) {
      return src;
    }

    // /로 시작하면 그대로 사용
    if (src.startsWith("/")) {
      return src;
    }

    // 그 외에는 앞에 / 붙이기
    return `/${src}`;
  };

  const mediaSrc = resolveMediaSrc(page?.image);

  // 2. 입력된 파일이 MP4 비디오인지 판별하는 함수
  const isVideoFile = (src) => {
    if (!src) return false;
    // 확장자가 .mp4로 끝나거나 mp4 문자열을 포함하고 있는지 체크
    return src.toLowerCase().endsWith(".mp4") || src.toLowerCase().includes(".mp4");
  };

  const isVideo = isVideoFile(mediaSrc);

  // 미디어 소스가 바뀔 때마다 에러 상태 초기화
  useEffect(() => {
    setIsError(false);
  }, [mediaSrc]);

  if (!page) {
    return <div className="illustration-card">데이터를 기다리는 중...</div>;
  }

  return (
    <>
      <div
        className="illustration-card"
        style={{ position: "relative", overflow: "hidden" }}
      >
        {mediaSrc ? (
          isVideo ? (
            /* 🎥 비디오(MP4) 재생 영역 */
            <video
              className="illustration-image" // 기존 CSS 스타일(크기, 비율 등)을 그대로 유지하도록 클래스 적용
              src={mediaSrc}
              autoPlay
              loop
              muted
              playsInline
              onError={() => setIsError(true)}
              style={{ objectFit: "cover", width: "100%", height: "100%" }}
            />
          ) : (
            /* 🖼️ 일반 이미지 재생 영역 */
            <img
              className="illustration-image"
              src={mediaSrc}
              alt="동화 이미지"
              onError={() => setIsError(true)}
            />
          )
        ) : (
          <div className="image-empty-box">이미지나 영상이 없습니다.</div>
        )}

        {/* 🚨 미디어 로드 실패 시 에러 화면 */}
        {isError && (
          <div
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              background: "#fff0f0",
              color: "#d32f2f",
              padding: "20px",
              fontSize: "14px",
              wordBreak: "break-all",
              display: "flex",
              flexDirection: "column",
              justifyContent: "center",
              border: "2px solid red",
              zIndex: 10, // 비디오 위로 에러 창이 확실히 보이도록 레이어 순서 지정
            }}
          >
            <p style={{ fontWeight: "bold", marginBottom: "10px" }}>
              미디어(이미지/영상) 로드 실패
            </p>
            <p>
              <strong>넘어온 주소:</strong>{" "}
              {page.image || "값이 없음(null/undefined)"}
            </p>
            <p>
              <strong>실제 적용 주소:</strong>{" "}
              {mediaSrc || "값이 없음(null/undefined)"}
            </p>
            <p style={{ marginTop: "10px", fontSize: "12px", color: "#666" }}>
              frontend/public 안에 넣었다면 주소는
              /illusts/ST_002/scene_1.mp4 혹은 .png 형태여야 합니다.
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