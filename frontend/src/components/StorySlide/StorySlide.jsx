import React, { useState, useEffect } from "react";
import "./StorySlide.css";

function StorySlide({ page }) {
  const [isError, setIsError] = useState(false);

  const resolveImageSrc = (image) => {
    if (!image) return "";

    // 외부 이미지, base64, blob 주소는 그대로 사용
    if (/^(https?:|data:|blob:)/.test(image)) {
      return image;
    }

    // /illusts/ST_002/scene_1.png 처럼 /로 시작하면 그대로 사용
    if (image.startsWith("/")) {
      return image;
    }

    // illusts/ST_002/scene_1.png 처럼 들어오면 앞에 / 붙이기
    return `/${image}`;
  };

  const imageSrc = resolveImageSrc(page?.image);

  // 페이지 이미지가 바뀔 때마다 에러 상태 초기화
  useEffect(() => {
    setIsError(false);
  }, [imageSrc]);

  if (!page) {
    return <div className="illustration-card">데이터를 기다리는 중...</div>;
  }

  return (
    <>
      <div
        className="illustration-card"
        style={{ position: "relative", overflow: "hidden" }}
      >
        {imageSrc ? (
          <img
            className="illustration-image"
            src={imageSrc}
            alt="동화 이미지"
            onError={() => setIsError(true)}
          />
        ) : (
          <div className="image-empty-box">이미지가 없습니다.</div>
        )}

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
            }}
          >
            <p style={{ fontWeight: "bold", marginBottom: "10px" }}>
              이미지 로드 실패
            </p>
            <p>
              <strong>넘어온 주소:</strong>{" "}
              {page.image || "값이 없음(null/undefined)"}
            </p>
            <p>
              <strong>실제 적용 주소:</strong>{" "}
              {imageSrc || "값이 없음(null/undefined)"}
            </p>
            <p style={{ marginTop: "10px", fontSize: "12px", color: "#666" }}>
              frontend/public 안에 이미지를 넣었다면 주소는
              /illusts/ST_002/scene_1.png 형태여야 합니다.
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
