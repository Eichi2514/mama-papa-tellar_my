import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import API_BASE_URL from "../../config/apiConfig";
import MicButton from "../../components/MicButton/MicButton.jsx";
import VoiceBadge from "../../components/VoiceBadge.jsx";
import "./StoryListViewPage.css";

function StoryListViewPage() {
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
    const [showModeModal, setShowModeModal] = useState(false);
    const [selectedStory, setSelectedStory] = useState(null);
    const [narratorKey, setNarratorKey] = useState(null);
    const [characterKey, setCharacterKey] = useState(null);
    const [voiceList, setVoiceList] = useState([]);
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
                setScriptLines(data.scripts || []);
            })
            .catch((err) => console.error("스크립트 로딩 실패:", err));
    
    // 목소리 로드 추가
    const keys = Object.keys(localStorage).filter(
        (k) => k.startsWith("mpt_") && k.endsWith("_voice_id")
    );
    const list = keys.map((k) => ({
        key: k,
        name: k.replace("mpt_", "").replace("_voice_id", ""),
        id: localStorage.getItem(k),
    }));
    setVoiceList(list);
    if (list.length > 0) {
        setNarratorKey(list[0].key);
        setCharacterKey(list.length > 1 ? list[1].key : list[0].key);
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

    // 녹음 시작 및 중지 함수
    const startRecording = async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            const recorder = new MediaRecorder(stream);
            const chunks = [];
            recorder.ondataavailable = (e) => { if (e.data.size > 0) chunks.push(e.data); };
            recorder.onstop = () => {
                const blob = new Blob(chunks, { type: "audio/wav" });
                handleVoiceRegister(blob);
            };
            recorder.start();
            setMediaRecorder(recorder);
            setIsRecording(true);
            setScriptIndex(0);
        } catch (err) {
            alert("❌ 마이크 에러: " + err.message);
        }
    };

    const stopRecording = () => {
        mediaRecorder.stop();
        setIsRecording(false);
    };

    // 최근 본 동화 
    const saveRecentStory = (story) => {
        const storageKey = "mpt_recent_stories";
        const savedStories = JSON.parse(localStorage.getItem(storageKey) || "[]");

        const nextStories = [
            {
                story_id: story.story_id,
                title: story.title,
                viewed_at: new Date().toISOString(),
            },
            ...savedStories.filter((item) => item.story_id !== story.story_id),
        ].slice(0, 10);

        localStorage.setItem(storageKey, JSON.stringify(nextStories));
    };

    // 페이지네이션 계산
    const indexOfLastItem = currentPage * itemsPerPage;
    const indexOfFirstItem = indexOfLastItem - itemsPerPage;
    const currentStories = stories.slice(indexOfFirstItem, indexOfLastItem);
    const totalPages = Math.ceil(stories.length / itemsPerPage);

    // 핸들러 함수 추가
    const handleNormalStart = () => {
    setShowModeModal(false);
    navigate(`/story/${selectedStory.story_id}`, {
        state: { voiceId: localStorage.getItem(narratorKey) },
    });
};

    const handleRoleplayStart = () => {
    setShowModeModal(false);
    navigate(`/story/${selectedStory.story_id}`, {
        state: {
            narratorVoiceId: localStorage.getItem(narratorKey),
            characterVoiceId: localStorage.getItem(characterKey),
        },
    });
};

    return (
        <div className="tablet-page">
            <VoiceBadge onKeyDetected={(key) => {
                const hasVoice = !!key;
                setIsVoiceRegistered(hasVoice);
                if (hasVoice) {
                    setRegisteredVoiceId(localStorage.getItem(key));
                }
            }} />

            <main className="tablet-frame">
                <header className="header-section">
                    <p className="service-label">MAMA / PAPA TELLER</p>
                    <h1 className="main-title">우리 아이 동화 도서관</h1>
                </header>

                <button
                    type="button"
                    className="story-search-link"
                    onClick={() => navigate("/story/search")}
                >
                    🔍 동화 검색
                </button>

                <section className="story-list-section">
                    <div className="story-grid">
                        {currentStories.map((story) => (
                            <div
                                key={story.story_id}
                                className={`story-card ${!isVoiceRegistered ? "locked" : ""}`}
                                onClick={() => {
                                    if (isVoiceRegistered) {
                                        saveRecentStory(story);

                                        setSelectedStory(story);
                                        setShowModeModal(true);
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

                <div className="pagination-container">
                    <button disabled={currentPage === 1} onClick={() => setCurrentPage(prev => prev - 1)} className="pag-btn">이전</button>
                    <span className="page-indicator">{currentPage} / {totalPages}</span>
                    <button disabled={currentPage === totalPages} onClick={() => setCurrentPage(prev => prev + 1)} className="pag-btn">다음</button>
                </div>
            </main>
            {showModeModal && ( // 모달 jsx 추가
                <div className="mode-modal-overlay" onClick={() => setShowModeModal(false)}>
                    <div className="mode-modal-card" onClick={(e) => e.stopPropagation()}>
                        <h3>누가 읽어줄까요?</h3>

                        <p className="role-label">📖 내레이터 <span className="role-desc">이야기 설명 목소리</span></p>
                        <div className="role-voice-list">
                            {voiceList.map((v) => (
                                <button
                                    key={v.key}
                                    className={`role-voice-btn ${narratorKey === v.key ? "selected" : ""}`}
                                    onClick={() => setNarratorKey(v.key)}
                                >
                                    {narratorKey === v.key ? "🌟" : "🎙️"} {v.name}
                                </button>
                            ))}
                        </div>

                        <p className="role-label">🎭 등장인물 <span className="role-desc">{selectedStory?.characters?.join(", ")}</span></p>
                        <div className="role-voice-list">
                            {voiceList.map((v) => (
                                <button
                                    key={v.key}
                                    className={`role-voice-btn ${characterKey === v.key ? "selected" : ""}`}
                                    onClick={() => setCharacterKey(v.key)}
                                >
                                    {characterKey === v.key ? "🌟" : "🎙️"} {v.name}
                                </button>
                            ))}
                        </div>

                        <div className="mode-btn-group">
                            <button className="normal-start-btn" onClick={handleNormalStart}>
                                한 목소리로 읽기
                            </button>
                            <button
                                className="roleplay-start-btn"
                                onClick={handleRoleplayStart}
                                disabled={voiceList.length < 2}
                                style={{ opacity: voiceList.length < 2 ? 0.5 : 1 }}
                            >
                                🎭 역할극 모드
                                {voiceList.length < 2 && <span style={{fontSize:"11px", display:"block"}}>목소리 2개 필요</span>}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

export default StoryListViewPage;