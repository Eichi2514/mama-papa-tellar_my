import React, { useState, useEffect, useRef } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import API_BASE_URL from "../../config/apiConfig";
import EmotionBar from "../../components/EmotionBar/EmotionBar.jsx";
import StoryNavigation from "../../components/StoryNavigation/StoryNavigation.jsx";
import StorySlide from "../../components/StorySlide/StorySlide.jsx";
import PlaybackRateControl from "../../components/PlaybackRateControl/PlaybackRateControl.jsx";
import VoiceBadge from "../../components/VoiceBadge.jsx";
import LoadingOverlay from "../../components/LoadingOverlay.jsx";
import Alert from "../../components/Alert.jsx";
import "./StoryViewerPage.css";

// ─── 완청 기록 ────────────────────────────────────────────────────────────────
function markStoryCompleted(storyId) {
  const KEY_COUNT = 'mpt_completed_books';
  const KEY_RECENT = 'mpt_recent_stories';

  const recentStories = JSON.parse(localStorage.getItem(KEY_RECENT) || '[]');

  // 최근 목록에서 해당 storyId 찾기
  const alreadyCompleted = recentStories.some(
    (s) => s.story_id === storyId && s.completed
  );
  if (alreadyCompleted) return;

  // completed 플래그 추가
  const updated = recentStories.map((s) =>
    s.story_id === storyId ? { ...s, completed: true } : s
  );
  localStorage.setItem(KEY_RECENT, JSON.stringify(updated));

  // 완청 편수 = completed인 항목 수
  const count = updated.filter((s) => s.completed).length;
  localStorage.setItem(KEY_COUNT, String(count));
}

// ─── 컴포넌트 ─────────────────────────────────────────────────────────────────
function StoryViewerPage() {
  const alertRef = useRef();
  const { storyId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();

  const voiceId = location.state?.voiceId;
  const situation = location.state?.situation;
  const narratorVoiceId = location.state?.narratorVoiceId;
  const characterVoiceMap = location.state?.characterVoiceMap;
  const childName = location.state?.childName || "";
  const useChildProtagonist = location.state?.useChildProtagonist || false;

  const [sceneQueue, setSceneQueue] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isFinished, setIsFinished] = useState(false);
  const [streamDone, setStreamDone] = useState(false);
  const [totalScenes, setTotalScenes] = useState(0);
  const [dynamicTimeline, setDynamicTimeline] = useState(null); // 누락된 State 추가

  const [playbackRate, setPlaybackRate] = useState(1);

  const audioRef = useRef(null);
  const sceneQueueRef = useRef([]);
  const currentIndexRef = useRef(0);
  const streamDoneRef = useRef(false);
  const waitIntervalRef = useRef(null);
  const firstChunkRef = useRef(true);
  const playbackRateRef = useRef(1);

  // ── 특정 장면 재생 ──────────────────────────────────────────────────────
  const playScene = (index, queue) => {
    if (index >= queue.length) return;

    if (waitIntervalRef.current) {
      clearInterval(waitIntervalRef.current);
      waitIntervalRef.current = null;
    }

    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.onended = null;
      audioRef.current = null;
    }

    const { audioUrl } = queue[index];
    const audio = new Audio(audioUrl);
    audio.playbackRate = playbackRateRef.current;
    audioRef.current = audio;

    audio.onplay = () => setIsPlaying(true);
    audio.onpause = () => setIsPlaying(false);

    audio.onended = () => {
      const nextIndex = currentIndexRef.current + 1;

      if (nextIndex < sceneQueueRef.current.length) {
        // 다음 장면 이미 도착 → 바로 재생
        currentIndexRef.current = nextIndex;
        setCurrentIndex(nextIndex);
        playScene(nextIndex, sceneQueueRef.current);
      } else if (streamDoneRef.current) {
        // 스트림 완료 + 마지막 장면 → 완청
        setIsPlaying(false);
        setIsFinished(true);
        markStoryCompleted(storyId);
      } else {
        // 다음 청크 아직 안 옴 → 폴링 대기
        waitIntervalRef.current = setInterval(() => {
          if (nextIndex < sceneQueueRef.current.length) {
            clearInterval(waitIntervalRef.current);
            waitIntervalRef.current = null;
            currentIndexRef.current = nextIndex;
            setCurrentIndex(nextIndex);
            playScene(nextIndex, sceneQueueRef.current);
          } else if (streamDoneRef.current) {
            clearInterval(waitIntervalRef.current);
            waitIntervalRef.current = null;
            setIsPlaying(false);
            setIsFinished(true);
            markStoryCompleted(storyId);
          }
        }, 200);
      }
    };

    audio.play().catch((err) => console.warn("재생 에러:", err));
    setCurrentIndex(index);
    currentIndexRef.current = index;
  };

  // ── 스트림 수신 + 오디오 관리 useEffect ────────────────────────────────────────────
  useEffect(() => {
    if (!voiceId && !(narratorVoiceId && characterVoiceMap)) {
      alertRef.current.show("목소리 정보가 없어요. 메인으로 돌아갑니다.", true, "🎙️");
      navigate("/");
      return;
    }

    // 누적 버퍼 (Uint8Array)
    let rawBuffer = new Uint8Array(0);

    const appendBuffer = (a, b) => {
      const merged = new Uint8Array(a.length + b.length);
      merged.set(a, 0);
      merged.set(b, a.length);
      return merged;
    };

    // 버퍼에서 완성된 청크를 꺼냄
    const processBuffer = () => {
      while (true) {
        // 헤더 8바이트 확인
        if (rawBuffer.length < 8) break;

        const view = new DataView(rawBuffer.buffer, rawBuffer.byteOffset);
        const jsonLength = view.getUint32(0, false);
        const audioLength = view.getUint32(4, false);
        const totalNeeded = 8 + jsonLength + audioLength;

        // 청크 전체가 도착했는지 확인
        if (rawBuffer.length < totalNeeded) break;

        try {
          const jsonBytes = rawBuffer.slice(8, 8 + jsonLength);
          const audioBytes = rawBuffer.slice(8 + jsonLength, totalNeeded);

          const timeline = JSON.parse(new TextDecoder().decode(jsonBytes));
          const audioBlob = new Blob([audioBytes], { type: "audio/mpeg" });
          const audioUrl = URL.createObjectURL(audioBlob);

          const newQueue = [...sceneQueueRef.current, { timeline, audioUrl }];
          sceneQueueRef.current = newQueue;
          setSceneQueue([...newQueue]);

          // 첫 장면 도착 → 즉시 재생 시작
          if (firstChunkRef.current) {
            firstChunkRef.current = false;
            setIsLoading(false);
            setTotalScenes(timeline.total_scenes || 0);
            currentIndexRef.current = 0;
            playScene(0, newQueue);
          }
        } catch (e) {
          console.warn("청크 파싱 에러:", e);
        }

        // 처리한 청크만큼 버퍼에서 제거
        rawBuffer = rawBuffer.slice(totalNeeded);
      }
    };

    const fetchStream = async () => {
      try {
        const streamUrl = (narratorVoiceId && characterVoiceMap)
          ? `${API_BASE_URL}/api/stream/play/${storyId}?narrator_voice_id=${narratorVoiceId}&character_voice_map=${encodeURIComponent(JSON.stringify(characterVoiceMap))}&child_name=${encodeURIComponent(childName)}&use_child_protagonist=${useChildProtagonist}`
          : `${API_BASE_URL}/api/stream/play/${storyId}?voice_id=${voiceId}&child_name=${encodeURIComponent(childName)}&use_child_protagonist=${useChildProtagonist}`;
        const response = await fetch(streamUrl);

        // 헤더에서 전체 씬 수 받아오기
        const total = response.headers.get("X-Total-Scenes");
        if (total) setTotalScenes(Number(total));

        const reader = response.body.getReader();

        while (true) {
          const { done, value } = await reader.read();
          if (done) {
            streamDoneRef.current = true;
            setStreamDone(true);
            processBuffer(); // 마지막 남은 버퍼 처리
            break;
          }
          rawBuffer = appendBuffer(rawBuffer, value);
          processBuffer();
        }
      } catch (err) {
        console.warn("스트림 에러:", err);
        setIsLoading(false);
      }
    };

    fetchStream();

    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
      if (waitIntervalRef.current) {
        clearInterval(waitIntervalRef.current);
      }
    };
  }, [storyId, voiceId, narratorVoiceId, characterVoiceMap, navigate]);

  // ── 핸들러 ──────────────────────────────────────────────────────────────
  const togglePlay = () => {
    if (!audioRef.current) return;
    isPlaying ? audioRef.current.pause() : audioRef.current.play();
  };

  const handlePrevPage = () => {
    const prevIndex = currentIndexRef.current - 1;
    if (prevIndex < 0 || sceneQueueRef.current.length === 0) return;
    playScene(prevIndex, sceneQueueRef.current);
  };

  const handleNextPage = () => {
    const nextIndex = currentIndexRef.current + 1;
    if (nextIndex >= sceneQueueRef.current.length) return;
    playScene(nextIndex, sceneQueueRef.current);
  };

  const handleReplay = () => {
    setIsFinished(false);
    playScene(0, sceneQueueRef.current);
  };

  const handleGoHome = () => navigate("/pages/StoryListViewPage");

  const handlePlaybackRateChange = (rate) => {
    setPlaybackRate(rate);
    playbackRateRef.current = rate;
    if (audioRef.current) audioRef.current.playbackRate = rate;
  };

  // ── 현재 장면 이미지 처리 ──────────────────────────────────────────────────
  const currentScene = sceneQueue[currentIndex]?.timeline ?? null;
  const lastPageIndex = Math.max(sceneQueue.length - 1, 0);

  const getSceneImage = (scene) => {
    const rawImage = scene?.image || scene?.storyImage || "";
    if (!rawImage) return "";
    if (/^(https?:|data:|blob:)/.test(rawImage)) return rawImage;
    if (rawImage.startsWith("/")) return rawImage;
    return `/${rawImage}`;
  };

  return (
    <div className="tablet-page">
      <VoiceBadge homePath="/pages/StoryListViewPage" />
      <main className="tablet-frame">
        <section className="storybook-section">
          <p className="service-label">MAMA / PAPA TELLER</p>
          {/* 헤더 영역 */}
          <div className="storybook-header">
            <div className="playback-controls">
              <button className="play-pause-btn" onClick={togglePlay}>
                {isPlaying ? "⏸️ 잠깐 멈춤" : "▶️ 다시 재생"}
              </button>
            </div>

            <p className="page-count">
              {sceneQueue.length > 0
                ? `${currentIndex + 1} / ${totalScenes}`
                : "준비 중..."}
            </p>
          </div>

          {/* 상황 요약 (기획용) */}
          {situation && (
            <p className="situation-summary">입력 상황: {situation}</p>
          )}

          {/* 메인 동화 슬라이드 */}
          {isLoading || !currentScene ? (
            <LoadingOverlay
              message={<>엄마 아빠 목소리를 불러오고 있어...<br />잠시만 기다려줘! ✨</>}
            />
          ) : (
            <StorySlide
              page={{
                image: getSceneImage(currentScene),
                text: currentScene.text,
              }}
            />
          )}

          {/* 하단 감정 바
          {currentPage && (
            <EmotionBar
              emotion={currentPage.emotion}
              emotionLevel={currentPage.emotionLevel || 3}
            />
          )} */}

          {/* 속도 조절 */}
          {!isLoading && currentScene && (
            <PlaybackRateControl
              playbackRate={playbackRate}
              onChange={handlePlaybackRateChange}
            />
          )}

          {/* 페이지 네비게이션 */}
          <StoryNavigation
            currentPageIndex={currentIndex}
            lastPageIndex={lastPageIndex}
            onPrev={handlePrevPage}
            onNext={handleNextPage}
          />
        </section>

        {isFinished && (
          <div className="story-finished-overlay">
            <div className="finished-content">
              <h2>🌟 정말 재미있는 이야기였어!</h2>
              <p>우리 아이, 한 번 더 들어볼까?</p>
              <div className="button-group">
                <button onClick={handleReplay} className="replay-btn">
                  다시 읽기 🔄
                </button>
                <button onClick={handleGoHome} className="home-btn">
                  다른 동화 보기 🏠
                </button>
              </div>
            </div>
          </div>
        )}
      </main>
      <Alert ref={alertRef} />
    </div>
  );
}

export default StoryViewerPage;