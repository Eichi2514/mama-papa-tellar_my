import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import API_BASE_URL from "../../config/apiConfig";
import VoiceBadge from "../../components/VoiceBadge.jsx";
import "./FamilyVoicesViewPage.css";

function FamilyVoicesViewPage() {
    const navigate = useNavigate();
    const [voiceList, setVoiceList] = useState([]);
    const [isRegistering, setIsRegistering] = useState(false);
    const [isRecording, setIsRecording] = useState(false);
    const [mediaRecorder, setMediaRecorder] = useState(null);
    const [newVoiceName, setNewVoiceName] = useState("");
    const [showNameInput, setShowNameInput] = useState(false);
    const [scriptLines, setScriptLines] = useState([]);
    const [scriptIndex, setScriptIndex] = useState(0);

    useEffect(() => {
        refreshVoiceList();
    }, []);

    const refreshVoiceList = () => {
        const keys = Object.keys(localStorage).filter(key => key.startsWith("mpt_") && key.endsWith("_voice_id"));
        const list = keys.map(key => ({
            key: key,
            name: key.replace("mpt_", "").replace("_voice_id", "").toUpperCase(),
            id: localStorage.getItem(key)
        }));
        setVoiceList(list);
    };

    const deleteVoice = (e, key, name) => {
        e.stopPropagation(); // 카드 클릭(선택) 이벤트 전파 방지

        if (window.confirm(`${name} 목소리를 삭제할까요? 아이가 슬퍼할지도 몰라요! ✨`)) {
            // 해당 보이스 ID 삭제
            localStorage.removeItem(key);

            // 만약 현재 선택된 목소리가 삭제하는 목소리라면 선택 해제
            const currentSelectedKey = localStorage.getItem("mpt_selected_voice_key");
            if (currentSelectedKey === key) {
                localStorage.removeItem("mpt_selected_voice_key");
                window.dispatchEvent(new Event("voiceChanged"));
            }

            alert("목소리가 보관함에서 사라졌어요.");
            refreshVoiceList();
        }
    };

    const handleAddClick = () => {
        setShowNameInput(true);
    };

    // 이름 입력 후 확인 버튼: 스크립트 로드 후 '즉시' 녹음 시작
    const prepareRecording = async () => {
        if (!newVoiceName.trim()) {
            alert("누구의 목소리인지 이름을 지어주세요! ✨");
            return;
        }

        try {
            const response = await fetch(`${API_BASE_URL}/api/voice/scriptLines`);
            const data = await response.json();
            setScriptLines(data.scripts || []);
            setShowNameInput(false);

            // 별도의 마이크 클릭 없이 바로 시스템 권한 요청 및 녹음 시작
            startRecordingProcess();
        } catch (err) {
            alert("동화 나라 스크립트를 가져오지 못했어요. 잠시 후 다시 시도해 주세요.");
        }
    };

    const startRecordingProcess = async () => {
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
            alert("❌ 마이크 권한이 필요해요: " + err.message);
        }
    };

    const stopRecording = () => {
        if (mediaRecorder) {
            mediaRecorder.stop();
            setIsRecording(false);
        }
    };

    const handleNextScript = () => {
        if (scriptIndex < scriptLines.length - 1) {
            setScriptIndex(prev => prev + 1);
        } else {
            // 마지막 문장 읽기 완료 시 자동 정지 및 전송
            stopRecording();
        }
    };

    const handleVoiceRegister = async (audioBlob) => {
        setIsRegistering(true);
        const formData = new FormData();
        formData.append("file", audioBlob, `${newVoiceName}_voice.wav`);

        try {
            const response = await fetch(`${API_BASE_URL}/api/voice/register`, {
                method: "POST",
                body: formData,
            });
            const data = await response.json();

            if (data.status === "success") {
                const storageKey = `mpt_${newVoiceName}_voice_id`;
                localStorage.setItem(storageKey, data.voice_id);
                localStorage.setItem("mpt_selected_voice_key", storageKey);

                alert(`${newVoiceName} 목소리가 따뜻하게 담겼어요! 🎙️`);
                refreshVoiceList();
                setNewVoiceName("");
            }
        } catch (err) {
            alert("목소리를 담는 데 실패했어요.");
        } finally {
            setIsRegistering(false);
        }
    };

    const selectVoice = (key) => {
        const currentSelectedKey = localStorage.getItem("mpt_selected_voice_key");

        if (currentSelectedKey === key) {
            // 이미 선택된 것을 다시 누르면 취소
            localStorage.removeItem("mpt_selected_voice_key");
            alert("목소리 선택이 해제되었어요. 새로운 목소리를 골라보세요! ✨");
        } else {
            // 다른 목소리 또는 새로 선택하는 경우
            localStorage.setItem("mpt_selected_voice_key", key);
            alert("이제 이 목소리로 동화를 읽어드릴게요! 🏠");
        }
        // 화면 갱신을 위해 배지가 트리거되도록 처리하거나, 필요한 경우 로컬 상태를 업데이트할 수 있습니다.
        window.dispatchEvent(new Event("voiceChanged"));
        refreshVoiceList();
    };

    return (
        <div className="tablet-page">
            <VoiceBadge />

            <main className="tablet-frame">
                <header className="header-section">
                    <p className="service-label">MAMA / PAPA TELLER</p>
                    <h1 className="main-title">우리 가족 목소리함</h1>
                </header>

                <section className="voice-list-grid">
                    {voiceList.map((voice) => {
                        const isSelected = localStorage.getItem("mpt_selected_voice_key") === voice.key;

                        return (
                            <div
                                key={voice.key}
                                className={`voice-item-card ${isSelected ? "selected-voice" : ""}`}
                                onClick={() => selectVoice(voice.key)}
                            >
                                <div className="voice-avatar">
                                    {isSelected ? "🌟" : "🎙️"} {/* 선택 시 아이콘 변경으로 직관성 부여 */}
                                </div>
                                <h3>{voice.name}</h3>
                                {/* <p className="voice-id-tag">ID: {voice.id}</p> */}
                                {isSelected ? (
                                    <span className="selected-tag">사용 중</span>
                                ) : (
                                    !isRecording && (
                                        <button
                                            className="delete-voice-btn"
                                            onClick={(e) => deleteVoice(e, voice.key, voice.name)}
                                        >
                                            삭제하기
                                        </button>
                                    )
                                )}
                            </div>
                        );
                    })}

                    {!isRecording && !showNameInput && (
                        <div className="voice-item-card add-card" onClick={handleAddClick}>
                            <div className="add-icon">+</div>
                            <h3>새 목소리 등록</h3>
                        </div>
                    )}
                </section>

                {showNameInput && (
                    <div className="name-input-overlay">
                        <div className="name-input-card">
                            <h3>목소리 주인공이 누구인가요?</h3>
                            <input
                                type="text"
                                value={newVoiceName}
                                onChange={(e) => setNewVoiceName(e.target.value)}
                                placeholder="예: 엄마, 아빠, 할머니"
                                autoFocus
                            />
                            <div className="btn-group">
                                <button onClick={() => setShowNameInput(false)}>취소</button>
                                <button onClick={prepareRecording}>확인</button>
                            </div>
                        </div>
                    </div>
                )}

                {(isRecording || isRegistering) && (
                    <section className="registration-guide full-overlay">
                        {isRecording && !isRegistering && (
                            <div className="script-card" onClick={handleNextScript}>
                                <p className="guide-text">"{newVoiceName}" 목소리를 담고 있어요</p>
                                <div className="mobile-script-display">
                                    <span className="emotion-tag">{scriptLines[scriptIndex]?.emotion}</span>
                                    <p className="voice-script-large">"{scriptLines[scriptIndex]?.text}"</p>
                                </div>
                                <div className="script-progress">
                                    <span className="progress-text">{scriptIndex + 1} / {scriptLines.length}</span>
                                    {scriptIndex < scriptLines.length - 1 ? (
                                        <p className="tap-guide">화면을 터치하면 다음 문장이 나와요 👉</p>
                                    ) : (
                                        <p className="tap-guide finish-guide">마지막 문장이에요! 터치하면 완료 ✅</p>
                                    )}
                                </div>
                                <p className="status-msg-red">녹음 중이에요! 🔴</p>
                            </div>
                        )}
                        {isRegistering && (
                            <div className="script-card loading-card">
                                <p className="voice-script-large">소중한 목소리를<br />예쁘게 담는 중이에요...✨</p>
                            </div>
                        )}
                    </section>
                )}
            </main>
        </div>
    );
}

export default FamilyVoicesViewPage;