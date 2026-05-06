import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import API_BASE_URL from "../../config/apiConfig";
import VoiceBadge from "../../components/VoiceBadge.jsx";
import "./StorySearchPage.css";

function StorySearchPage() {
    const navigate = useNavigate();

    const [stories, setStories] = useState([]);
    const [searchQuery, setSearchQuery] = useState("");

    useEffect(() => {
        fetch(`${API_BASE_URL}/api/stories`)
            .then((res) => res.json())
            .then((data) => setStories(data.story || []))
            .catch((err) => console.error("동화 데이터 로딩 실패:", err));
    }, []);

    const keyword = searchQuery.trim().toLowerCase();

    const searchedStories = keyword
        ? stories.filter((story) =>
            story.title?.toLowerCase().includes(keyword)
        )
        : [];

    const handleStoryClick = (story) => {
        const voiceId = localStorage.getItem("mpt_mom_voice_id");

        if (!voiceId) {
            alert("목소리를 먼저 등록해 주세요! 🎙️");
            navigate("/pages/StoryListViewPage");
            return;
        }

        navigate(`/story/${story.story_id}`, {
            state: {
                voiceId,
                storyTitle: story.title,
            },
        });
    };

    return (
        <div className="search-page">
            <main className="search-frame">
                <VoiceBadge homePath="/pages/StoryListViewPage" />

                <header className="search-header">
                    <p className="service-label">MAMA / PAPA TELLER</p>
                    <h1>동화책 검색</h1>
                </header>

                <section className="search-box-section">
                    <input
                        type="text"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder="찾고 싶은 동화 제목을 입력해요"
                        autoFocus
                    />
                </section>

                <section className="search-result-section">
                    {keyword && searchedStories.length === 0 && (
                        <p className="search-empty">찾는 동화가 없어요.</p>
                    )}

                    {keyword && searchedStories.map((story) => (
                        <div
                            key={story.story_id}
                            className="search-story-card"
                            onClick={() => handleStoryClick(story)}
                        >
                            <img
                                src={story.image_path}
                                alt={story.title}
                                className="search-story-image"
                            />

                            <div className="search-story-info">
                                <h2>{story.title}</h2>
                                <span>{story.duration}</span>
                            </div>
                        </div>
                    ))}
                </section>
            </main>
        </div>
    );
}

export default StorySearchPage;
