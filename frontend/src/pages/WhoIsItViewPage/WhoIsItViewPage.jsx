import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import API_BASE_URL from "../../config/apiConfig";
import VoiceBadge from "../../components/VoiceBadge.jsx";
import "./WhoIsItViewPage.css";

function WhoIsItViewPage() {
    const navigate = useNavigate();
    const [quizData, setQuizData] = useState(null);
    const [options, setOptions] = useState([]);
    const [currentVoiceKey, setCurrentVoiceKey] = useState(null);
    const [isCorrect, setIsCorrect] = useState(null);
    const [currentAudioUrl, setCurrentAudioUrl] = useState(null);
    const [isLoading, setIsLoading] = useState(false);

    // 현재 재생 중인 오디오를 담아둘 Ref
    const activeAudioRef = useRef(null);

    // 페이지를 아예 나갈 때(언마운트)를 위한 안전장치 추가
    useEffect(() => {
        return () => {
            if (activeAudioRef.current) {
                activeAudioRef.current.pause();
                activeAudioRef.current = null;
            }
        };
    }, []);

    // 음성 URL 메모리 정리는 별도로 관리하기
    useEffect(() => {
        return () => {
            if (currentAudioUrl) {
                URL.revokeObjectURL(currentAudioUrl);
            }
        };
    }, [currentAudioUrl]);

    // 퀴즈 데이터를 가져오고 보기를 섞는 함수
    const fetchRandomQuiz = async () => {
        try {
            // 새로운 문제를 불러올 때도 이전에 나오던 소리는 다정하게 꺼주기
            if (activeAudioRef.current) {
                activeAudioRef.current.pause();
                activeAudioRef.current = null;
            }

            const res = await fetch(`${API_BASE_URL}/api/quizzes`);
            const data = await res.json();
            const allQuizzes = data.quizzes;

            // 1. 랜덤하게 문제 하나 선택
            const randomIndex = Math.floor(Math.random() * allQuizzes.length);
            const selectedQuiz = allQuizzes[randomIndex];

            // 2. 정답을 제외한 나머지 리스트에서 오답 3개 무작위 추출
            const wrongAnswers = allQuizzes
                .filter(q => q.id !== selectedQuiz.id)
                .sort(() => 0.5 - Math.random())
                .slice(0, 3)
                .map(q => q.answer);

            // 3. 정답과 오답을 합쳐서 무작위로 섞기
            const combinedOptions = [selectedQuiz.answer, ...wrongAnswers].sort(() => 0.5 - Math.random());

            setQuizData(selectedQuiz);
            setOptions(combinedOptions);
            setIsCorrect(null); // 새로운 문제이므로 정답 상태 초기화

            // 새로운 문제로 넘어갈 때 이전 음성 URL 메모리 해제 및 초기화
            if (currentAudioUrl) {
                URL.revokeObjectURL(currentAudioUrl);
                setCurrentAudioUrl(null);
            }
        } catch (err) {
            console.error("퀴즈 데이터 로딩 실패:", err);
        }
    };

    useEffect(() => {
        fetchRandomQuiz();
    }, []);

    useEffect(() => {
        if (quizData && currentVoiceKey) {
            playHint();
        }
    }, [quizData, currentVoiceKey]);

    // 부모님 목소리로 힌트 듣기 (TTS 재생 로직)
    const playHint = async () => {
        if (!quizData || !currentVoiceKey) {
            alert("목소리를 먼저 선택해주세요! 🎙️");
            return;
        }

        // 이미 재생 중인 소리가 있다면 겹쳐 들리지 않게
        if (activeAudioRef.current) {
            activeAudioRef.current.pause();
        }

        // 이미 생성된 음성 URL이 있다면 서버 호출 없이 바로 재생
        if (currentAudioUrl) {
            const audio = new Audio(currentAudioUrl);
            activeAudioRef.current = audio;
            audio.play();
            return;
        }

        setIsLoading(true);
        console.log(`부모님 목소리(${currentVoiceKey})로 재생: ${quizData.voiceScript}`);

        try {
            const voiceId = localStorage.getItem(currentVoiceKey);
            const response = await fetch(`${API_BASE_URL}/api/quizzes/play?quiz_id=${quizData.id}&voice_id=${voiceId}`, {
                method: "GET",
            });

            if (response.ok) {
                const audioBlob = await response.blob();
                const audioUrl = URL.createObjectURL(audioBlob);
                setCurrentAudioUrl(audioUrl); // 생성된 URL 상태에 저장
                const audio = new Audio(audioUrl);
                activeAudioRef.current = audio; // 6. 보물 상자에 넣어두기
                audio.play(); // 아이에게 다정한 힌트 들려주기!
            } else {
                console.error("앗, 오디오 파일을 가져오는 데 문제가 생겼어요.");
            }
        } catch (err) {
            console.error("음성 재생 실패:", err);
        } finally {
            setIsLoading(false);
        }
    };

    const handleAnswerClick = (selected) => {
        if (selected === quizData.answer) {
            setIsCorrect(true);
            if (activeAudioRef.current) {
                activeAudioRef.current.pause();
            }
            alert("딩동댕! 정답이에요! 🎉");
            // 약간의 딜레이 후 다음 문제로
            setTimeout(fetchRandomQuiz, 1500);
        } else {
            setIsCorrect(false);
            alert("아쉬워요! 다시 한번 잘 들어볼까? 🤔");
        }
    };

    return (
        <div className="tablet-page">
            <VoiceBadge onKeyDetected={(key) => setCurrentVoiceKey(key)} />

            <main className="tablet-frame quiz-frame">
                <header className="header-section">
                    <p className="service-label">MAMA / PAPA TELLER</p>
                    <h1 className="main-title">누구일까? 퀴즈</h1>
                </header>

                {quizData && (
                    <section className="quiz-content">
                        <div className="quiz-image-container">
                            {/* 로딩 중일 때 보여줄 오버레이 */}
                            {isLoading && (
                                <div className="loading-overlay">
                                    <div className="loading-spinner"></div>
                                    <p>엄마 아빠 목소리를 불러오고 있어...<br /> 잠시만 기다려줘! ✨</p>
                                </div>
                            )}
                            <img src={quizData.imageUrl} alt="퀴즈 이미지" className="quiz-main-image" />
                            <button className="play-hint-btn" onClick={playHint}>
                                🔊 부모님 힌트 다시 듣기
                            </button>
                        </div>

                        <div className="options-grid">
                            {options.map((option, index) => (
                                <button
                                    key={index}
                                    className="option-button"
                                    onClick={() => handleAnswerClick(option)}
                                >
                                    {option}
                                </button>
                            ))}
                        </div>
                    </section>
                )}

                <div className="quiz-footer">
                    <button className="pag-btn" onClick={() => navigate(-1)}>뒤로가기</button>
                    <button className="pag-btn" onClick={fetchRandomQuiz}>다른 문제 풀기</button>
                </div>
            </main>
        </div>
    );
}

export default WhoIsItViewPage;