import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import API_BASE_URL from "../../config/apiConfig";
import MicButton from "../../components/MicButton/MicButton.jsx";
import "./HomePage.css";

function HomePage() {
  const navigate = useNavigate();
  const [stories, setStories] = useState([]);
  const [isVoiceRegistered, setIsVoiceRegistered] = useState(false);
  const [isRegistering, setIsRegistering] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [isRecording, setIsRecording] = useState(false);
  const [mediaRecorder, setMediaRecorder] = useState(null);

  const [scriptLines, setScriptLines] = useState([]);
  const [scriptIndex, setScriptIndex] = useState(0);
  const [registeredVoiceId, setRegisteredVoiceId] = useState(null);
  const itemsPerPage = 4;

  // 다음 문장으로 넘기는 함수
  const handleNextScript = () => {
    if (!scriptLines || scriptLines.length === 0) return;

    if (scriptIndex < scriptLines.length - 1) {
      setScriptIndex(prev => prev + 1);
    } else {
      stopRecording();
    }
  };

  useEffect(() => {
    fetch(`${API_BASE_URL}/api/stories`)
      .then((res) => res.json())
      .then((data) => setStories(data.story))
      .catch((err) => console.error("데이터 로딩 실패:", err));

    fetch(`${API_BASE_URL}/api/voice/scriptLines`)
      .then((res) => res.json())
      .then((data) => {
        // data 구조가 { scripts: [...] } 형태라고 가정합니다.
        setScriptLines(data.scripts || []);
      })
      .catch((err) => console.error("스크립트 로딩 실패:", err));

    const momVoiceId = localStorage.getItem("mpt_mom_voice_id");
    if (momVoiceId) {
      setIsVoiceRegistered(true);
      setRegisteredVoiceId(momVoiceId);
    }
  }, []);

  const handleVoiceRegister = async (audioBlob) => {
    setIsRegistering(true);
    const formData = new FormData();
    formData.append("file", audioBlob, "mom_voice.wav");

    try {
      const response = await fetch(`${API_BASE_URL}/api/voice/register`, {
        method: "POST",
        body: formData,
      });

      const data = await response.json();

      if (data.status === "success") {
        localStorage.setItem("mpt_mom_voice_id", data.voice_id);
        setIsVoiceRegistered(true);
        setRegisteredVoiceId(data.voice_id);
        alert("성공! 이제 따뜻한 동화를 읽어줄게요!");
      }
    } catch (err) {
      alert("목소리를 담는 데 실패했어요. 다시 시도해볼까요?");
    } finally {
      setIsRegistering(false);
    }
  };

  // 녹음 시작 함수: 권한 요청부터 실제 녹음 시작까지 전체 로직
  const startRecording = async () => {
    try {
      // 안드로이드 앱 빌드 환경에서 시스템 권한을 요청합니다.
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });

      const recorder = new MediaRecorder(stream);
      const chunks = [];

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunks.push(e.data);
      };

      recorder.onstop = () => {
        const blob = new Blob(chunks, { type: "audio/wav" });
        handleVoiceRegister(blob);
      };

      recorder.start();

      setMediaRecorder(recorder);
      setIsRecording(true);
      setScriptIndex(0);

      console.log("녹음이 정상적으로 시작되었습니다.");

    } catch (err) {
      console.error("마이크 에러:", err);
      // 핸드폰에서도 에러를 볼 수 있게 alert를 사용합니다.
      alert("❌ 마이크 에러: " + err.message);
    }
  };

  // 녹음 중단 함수
  const stopRecording = () => {
    mediaRecorder.stop();
    setIsRecording(false);
  };

  // 페이지네이션 계산
  const indexOfLastItem = currentPage * itemsPerPage;
  const indexOfFirstItem = indexOfLastItem - itemsPerPage;
  const currentStories = stories.slice(indexOfFirstItem, indexOfLastItem);
  const totalPages = Math.ceil(stories.length / itemsPerPage);

  return (
    <div className="tablet-page">
      {/* 상단 좌측 (등록된 경우에만 노출) */}
      {isVoiceRegistered && (
        <div className="top-left-voice-badge">
          <span className="dot-icon">●</span>
          <span className="badge-text">{registeredVoiceId}</span>
        </div>
      )}
      <main className="tablet-frame">
        <header className="header-section">
          <p className="service-label">MAMA / PAPA TELLER</p>
          <h1 className="main-title">우리 아이 동화 도서관</h1>
        </header>

        <section className="story-list-section">
          <div className="story-grid">
            {currentStories.map((story) => (
              <div
                key={story.story_id}
                className={`story-card ${!isVoiceRegistered ? "locked" : ""}`}
                onClick={() => {
                  if (isVoiceRegistered) {
                    navigate(`/story/${story.story_id}`, {
                      state: {
                        voiceId: registeredVoiceId,
                        storyTitle: story.title
                      }
                    });
                  } else {
                    alert("목소리를 먼저 등록해 주세요! 🎙️");
                  }
                }}
              >
                <div className="image-container">
                  <img src={story.image_path} alt={story.title} className="story-image" />
                  {!isVoiceRegistered && <div className="lock-overlay">🔒</div>}
                </div>
                <div className="story-info">
                  <h3>{story.title}</h3>
                  <span className="duration-tag">{story.duration}</span>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* 페이지네이션 컨트롤: 아이들이 누르기 쉽게 동글동글하게 */}
        <div className="pagination-container">
          <button
            disabled={currentPage === 1}
            onClick={() => setCurrentPage(prev => prev - 1)}
            className="pag-btn"
          >이전</button>
          <span className="page-indicator">{currentPage} / {totalPages}</span>
          <button
            disabled={currentPage === totalPages}
            onClick={() => setCurrentPage(prev => prev + 1)}
            className="pag-btn"
          >다음</button>
        </div>

        {(!isVoiceRegistered || isRecording || isRegistering) && (
          <section className="registration-guide">

            {/* 녹음 시작 전 (마이크 누르기 전) */}
            {!isRecording && !isRegistering && (
              <div className="script-card intro-card">
                <p className="guide-text">우리 아이에게 들려줄 목소리가 필요해요 🎙️</p>
                <div className="mobile-script-display">
                  <p className="voice-script-large">
                    오른쪽 위 마이크 버튼을 누르면<br />읽어주실 문장이 나타납니다! ↗️
                  </p>
                </div>
                <p className="status-msg">마음의 준비가 되면 마이크를 눌러주세요.</p>
              </div>
            )}

            {/* 녹음 중 (마이크 눌렀을 때 본격적으로 스크립트 노출) */}
            {isRecording && !isRegistering && (
              <div className="script-card" onClick={handleNextScript}>
                <p className="guide-text">화면을 터치하며 다정하게 읽어주세요</p>

                {/* 모바일 화면에 꽉 차게 보일 현재 문장 */}
                <div className="mobile-script-display">
                  <span className="emotion-tag">{scriptLines[scriptIndex].emotion}</span>
                  <p className="voice-script-large">
                    "{scriptLines[scriptIndex].text}"
                  </p>
                </div>

                {/* 진행도 표시 및 터치 안내 */}
                <div className="script-progress">
                  <span className="progress-text">{scriptIndex + 1} / {scriptLines.length}</span>
                  {scriptIndex < scriptLines.length - 1 ? (
                    <p className="tap-guide">화면을 터치하면 다음 문장이 나와요 👉</p>
                  ) : (
                    <p className="tap-guide finish-guide">마지막 문장이에요! 마이크 버튼을 다시 눌러주세요 ✅</p>
                  )}
                </div>

                <p className="status-msg" style={{ color: "#e74c3c", fontWeight: "bold" }}>
                  녹음 중이에요! 🔴
                </p>
              </div>
            )}

            {/* 녹음 완료 후 API 전송 중 (로딩 화면) */}
            {isRegistering && (
              <div className="script-card loading-card">
                <div className="mobile-script-display">
                  <p className="voice-script-large">소중한 목소리를<br />예쁘게 담는 중이에요...✨</p>
                </div>
              </div>
            )}

          </section>
        )}

        <div className="fixed-mic-container">
          <MicButton
            isRecording={isRecording}
            onClick={isRecording ? stopRecording : startRecording}
          />
        </div>
      </main>
    </div>
  );
}

export default HomePage;