import "./MicButton.css";

function MicButton({ isRecording, onClick }) {
  const buttonClassName = isRecording ? "mic-button isRecording" : "mic-button";

  return (
    <button className={buttonClassName} onClick={onClick} aria-label="음성 인식 시작">
      <span className="mic-icon">{isRecording ? "⏳" : "🎤"}</span>
    </button>
  );
}

export default MicButton;