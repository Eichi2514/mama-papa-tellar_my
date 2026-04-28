import React, { useState, useEffect, useRef } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import API_BASE_URL from "../../config/apiConfig";
import EmotionBar from "../../components/EmotionBar/EmotionBar.jsx";
import StoryNavigation from "../../components/StoryNavigation/StoryNavigation.jsx";
import StorySlide from "../../components/StorySlide/StorySlide.jsx";
import "./StoryViewerPage.css";

function StoryViewerPage() {
  const { storyId } = useParams();
  const [dynamicTimeline, setDynamicTimeline] = useState([]);
  const navigate = useNavigate();
  const location = useLocation();

  // 1. 상태 관리
  const [currentPageIndex, setCurrentPageIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isFinished, setIsFinished] = useState(false);

  // 2. 오디오 제어를 위한 Ref
  const audioRef = useRef(null);

  // 3. 데이터 로드 (목소리 ID 및 상황 정보)
  const voiceId = location.state?.voiceId;
  const situation = location.state?.situation;

  // 4. 현재 페이지 정보 (서버에서 받은 실제 데이터만 사용!)
  const storyData = dynamicTimeline;
  const currentPage = storyData.length > 0 ? storyData[currentPageIndex] : null;
  const lastPageIndex = storyData.length > 0 ? storyData.length - 1 : 0;

  const handleEnded = () => {
    setIsPlaying(false);
    setIsFinished(true); // 동화가 끝났음을 알림
  };

  const handleReplay = () => {
    setIsFinished(false);
    setCurrentPageIndex(0);
    if (audioRef.current) {
      audioRef.current.currentTime = 0;
      audioRef.current.play();
    }
  };

  useEffect(() => {
    if (!voiceId) {
      alert("목소리 정보가 없어요. 메인으로 돌아갑니다.");
      navigate("/");
      return;
    }

    const initStoryAudio = async () => {
      try {
        // 1. 서버에서 오디오와 타임라인 한 번에 가져오기
        const response = await fetch(`${API_BASE_URL}/api/stream/play/${storyId}?voice_id=${voiceId}`);

        // 헤더에서 인코딩된 타임라인 추출 및 디코딩
        const encoded = response.headers.get("X-Story-Timeline");
        if (encoded) {
          const decodedTimeline = JSON.parse(decodeURIComponent(encoded));
          setDynamicTimeline(decodedTimeline);
        }

        // 2. 오디오 객체 생성 및 Ref 저장
        const blob = await response.blob();
        const audio = new Audio(URL.createObjectURL(blob));
        audioRef.current = audio;

        // 3. 리스너 등록 (로딩 완료, 재생/일시정지, 시간 업데이트, 종료)
        audio.oncanplaythrough = () => setIsLoading(false);
        audio.onplay = () => setIsPlaying(true);
        audio.onpause = () => setIsPlaying(false);
        audio.onended = () => {
          setIsPlaying(false);
          setIsFinished(true); // 동화 종료 오버레이 띄우기
        };

        // 📝 클로저(Closure) 이슈를 피하기 위해 함수형 업데이트 사용
        audio.ontimeupdate = () => {
          const currentTime = audio.currentTime;

          setDynamicTimeline(prevTimeline => {
            if (prevTimeline.length === 0) return prevTimeline;

            // 현재 시간보다 앞에 있는 마지막 인덱스를 찾음
            const newIndex = prevTimeline.reduce((acc, page, idx) => {
              const start = page.start_time || page.startTime || 0;
              return currentTime >= start ? idx : acc;
            }, 0);

            setCurrentPageIndex(prev => newIndex !== prev ? newIndex : prev);
            return prevTimeline;
          });
        };

        // 4. 재생 시도
        await audio.play();
      } catch (err) {
        console.warn("오디오 준비 중 에러 발생:", err);
        setIsLoading(false);
      }
    };

    initStoryAudio();

    // 언마운트 시 정리 (클린업)
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
    };
  }, [storyId, voiceId, navigate]);

  // 5. 핸들러 함수
  const handlePrevPage = () => {
    if (currentPageIndex > 0 && storyData.length > 0) {
      const prevIndex = currentPageIndex - 1;
      setCurrentPageIndex(prevIndex);
      // 수동 조작 시 실제 데이터의 시작 시간으로 오디오 이동
      if (audioRef.current) {
        audioRef.current.currentTime = storyData[prevIndex].start_time || storyData[prevIndex].startTime || 0;
      }
    }
  };

  const handleNextPage = () => {
    if (currentPageIndex < lastPageIndex && storyData.length > 0) {
      const nextIndex = currentPageIndex + 1;
      setCurrentPageIndex(nextIndex);
      // 수동 조작 시 실제 데이터의 시작 시간으로 오디오 이동
      if (audioRef.current) {
        audioRef.current.currentTime = storyData[nextIndex].start_time || storyData[nextIndex].startTime || 0;
      }
    }
  };

  const handleGoHome = () => {
    navigate("/");
  };

  const togglePlay = () => {
    if (!audioRef.current) return;
    if (isPlaying) {
      audioRef.current.pause();
    } else {
      audioRef.current.play();
    }
  };

  return (
    <div className="tablet-page">
      <main className="tablet-frame">
        <section className="storybook-section">
          {/* 헤더 영역 */}
          <div className="storybook-header">
            <button className="home-button" onClick={handleGoHome}>
              처음으로
            </button>

            <div className="playback-controls">
              <button className="play-pause-btn" onClick={togglePlay}>
                {isPlaying ? "⏸️ 잠깐 멈춤" : "▶️ 다시 재생"}
              </button>
            </div>

            <p className="page-count">
              {/* 🗑️ 가짜 데이터 길이 대신 진짜 데이터 길이 사용 */}
              {storyData.length > 0 ? `${currentPageIndex + 1} / ${storyData.length}` : "준비 중..."}
            </p>
          </div>

          {/* 상황 요약 (기획용) */}
          {situation && <p className="situation-summary">입력 상황: {situation}</p>}

          {/* 메인 동화 슬라이드 */}
          {isLoading || storyData.length === 0 || !currentPage ? (
            <div className="loading-container">
              <p>엄마 아빠 목소리를 열심히 가져오고 있어요...✨</p>
            </div>
          ) : (
            <StorySlide
              page={{
                image: location.state?.storyImage || currentPage.image_path || currentPage.storyImage,
                text: currentPage.text
              }}
            />
          )}

          {/* 하단 감정 바 */}
          {currentPage && (
            <EmotionBar
              emotion={currentPage.emotion}
              emotionLevel={currentPage.emotionLevel || 3}
            />
          )}

          {/* 페이지 네비게이션 */}
          <StoryNavigation
            currentPageIndex={currentPageIndex}
            lastPageIndex={lastPageIndex}
            onPrev={handlePrevPage}
            onNext={handleNextPage}
          />
        </section>

        {
          isFinished && (
            <div className="story-finished-overlay">
              <div className="finished-content">
                <h2>🌟 정말 재미있는 이야기였어!</h2>
                <p>우리 아이, 한 번 더 들어볼까?</p>
                <div className="button-group">
                  <button onClick={handleReplay} className="replay-btn">다시 읽기 🔄</button>
                  <button onClick={handleGoHome} className="home-btn">다른 동화 보기 🏠</button>
                </div>
              </div>
            </div>
          )
        }
      </main>
    </div>
  );
}

export default StoryViewerPage;