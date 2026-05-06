import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import VoiceBadge from "../../components/VoiceBadge.jsx";
import "./RecentStoriesPage.css";

function RecentStoriesPage() {
    const navigate = useNavigate();
    const [recentStories, setRecentStories] = useState([]);
    const [completedIds, setCompletedIds] = useState([]);

    useEffect(() => {
        const savedStories = JSON.parse(
            localStorage.getItem("mpt_recent_stories") || "[]"
        );
        const completed = savedStories
            .filter((s) => s.completed)
            .map((s) => s.story_id);
        setCompletedIds(completed);

        setRecentStories(savedStories);
        setCompletedIds(completed);
    }, []);

    const formatViewedAt = (value) => {
        if (!value) return "";
        return new Intl.DateTimeFormat("ko-KR", {
            month: "long",
            day: "numeric",
            hour: "2-digit",
            minute: "2-digit",
        }).format(new Date(value));
    };

    return (
        <div className="recent-page">
            <main className="recent-frame">
                <VoiceBadge />

                <header className="recent-header">
                    <p className="recent-label">MAMA / PAPA TELLER</p>
                    <h1>최근 본 동화</h1>
                </header>

                <section className="recent-list">
                    {recentStories.length === 0 ? (
                        <p className="recent-empty">
                            아직 최근 본 동화가 없어요.
                        </p>
                    ) : (
                        recentStories.map((story) => {
                            const isCompleted = completedIds.includes(story.story_id);
                            return (
                                <article
                                    key={`${story.story_id}-${story.viewed_at}`}
                                    className="recent-item"
                                >
                                    <div className="recent-item-header">
                                        <h2>{story.title}</h2>
                                        {/* 완청 뱃지 */}
                                        {isCompleted && (
                                            <span className="completed-badge">✅ 완청</span>
                                        )}
                                    </div>
                                    <p>{formatViewedAt(story.viewed_at)}</p>
                                </article>
                            );
                        })
                    )}
                </section>
            </main>
        </div>
    );
}

export default RecentStoriesPage;
