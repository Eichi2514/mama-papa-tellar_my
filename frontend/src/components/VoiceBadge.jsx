import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";

function VoiceBadge({ onKeyDetected, homePath = "/" }) {
    const navigate = useNavigate();
    const [displayVoiceId, setDisplayVoiceId] = useState(null);

    useEffect(() => {
        // 배지 정보를 갱신하는 함수
        const updateBadge = () => {
            const activeVoiceKey = localStorage.getItem("mpt_selected_voice_key");
            if (activeVoiceKey) {
                const selectedId = localStorage.getItem(activeVoiceKey);
                if (selectedId) {
                    // setDisplayVoiceId(selectedId);
                    const cleanName = activeVoiceKey
                        .replace("mpt_", "")
                        .replace("_voice_id", "");
                    setDisplayVoiceId(cleanName);
                    if (onKeyDetected) onKeyDetected(activeVoiceKey);
                }
            } else {
                setDisplayVoiceId(null);
                if (onKeyDetected) onKeyDetected(null);
            }
        };

        // 처음 로드될 때 실행
        updateBadge();

        // 커스텀 이벤트 "voiceChanged"가 발생하면 updateBadge를 실행
        window.addEventListener("voiceChanged", updateBadge);
        // 다른 탭에서 변경될 경우를 대비한 storage 이벤트도 유지
        window.addEventListener("storage", updateBadge);

        return () => {
            // 청소할 때 귀(리스너)도 같이 떼어줍니다.
            window.removeEventListener("voiceChanged", updateBadge);
            window.removeEventListener("storage", updateBadge);
        };
    }, [onKeyDetected]);

    // 홈 버튼 클릭 시 안전하게 음성을 종료하고 화면을 이동하는 핸들러 함수
    const handleHomeClick = () => {
        // 1) Web Audio API 및 일반 HTML5 Audio 객체 전역 종료 프로세스        
        try {
            // 현재 페이지 내의 모든 Audio 요소를 찾아 멈춥니다.
            const playingAudios = document.querySelectorAll("audio");
            playingAudios.forEach((audio) => {
                audio.pause();
                audio.currentTime = 0; // 재생 위치도 처음으로 초기화해 줍니다.
            });

            // 만약 전역 혹은 window 객체에 커스텀 오디오 객체(예: window.mptPlayer)
            if (window.mptAudioInstance) {
                window.mptAudioInstance.pause();
                window.mptAudioInstance.currentTime = 0;
            }
        } catch (error) {
            console.error("음성 정지 중 따뜻한 에러가 발생했어요: ", error);
        }

        // 2) 부모님이 지정해주신 소중한 경로(homePath) 또는 기본값("/")으로 이동합니다.
        navigate(homePath);
    };

    // 전체 상단 바 스타일
    const topBarStyle = {
        position: "absolute",
        top: "4px",
        left: "4px",
        right: "8px",
        zIndex: 100,
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
    };

    const badgeStyle = {
        display: "flex",
        alignItems: "center",
        gap: "6px",
        padding: "6px 12px",
        backgroundColor: "rgba(232, 245, 233, 0.8)",
        borderRadius: "30px",
        border: "1px solid #c8e6c9",
        backdropFilter: "blur(4px)",
        WebkitBackdropFilter: "blur(4px)",
        visibility: displayVoiceId ? "visible" : "hidden",
    };

    const homeButtonStyle = {
        width: "40px",
        height: "40px",
        borderRadius: "50%",
        backgroundColor: "rgba(255, 255, 255, 0.9)",
        border: "1px solid #f0e2d3",
        color: "#a26d3d",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        cursor: "pointer",
        fontSize: "20px",
        boxShadow: "0 4px 10px rgba(162, 109, 61, 0.15)",
        transition: "transform 0.2s ease",
    };

    const textStyle = {
        fontSize: "0.75rem",
        color: "#2e7d32",
        fontWeight: "600",
        maxWidth: "120px",
        overflow: "hidden",
        textOverflow: "ellipsis",
        whiteSpace: "nowrap",
    };

    const dotStyle = {
        fontSize: "0.6rem",
        color: "#4caf50",
    };

    return (
        <div style={topBarStyle}>
            <style>
                {`
                @keyframes blink {
                    0% { opacity: 1; }
                    50% { opacity: 0.4; }
                    100% { opacity: 1; }
                }
                .dot-blink {
                    animation: blink 2s infinite;
                }
                .home-btn:active {
                    transform: scale(0.9);
                }
                `}
            </style>

            {/* 왼쪽: 뒤로가기 버튼 */}
            <div
                className="home-btn"
                style={homeButtonStyle}
                onClick={handleHomeClick}
                title="이전으로 돌아가기"
            >
                ⬅
            </div>

            {/* 오른쪽: 보이스 뱃지 */}
            <div style={badgeStyle}>
                <span className="dot-blink" style={dotStyle}>●</span>
                <span style={textStyle}>{displayVoiceId || "선택된 목소리 없음"}</span>
            </div>
        </div>
    );
}

export default VoiceBadge;