import React, { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import "./mode.css";

interface ModeModalProps {
    sessionId: string;
    title: string;
    onClose: () => void;
    type: 'sheet' | 'note' | 'diagram';
}

function ModeModal({ sessionId, title, onClose, type }: ModeModalProps) {
    const navigate = useNavigate();

    // Close on Escape key
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === "Escape") {
                onClose();
            }
        };
        document.addEventListener("keydown", handleKeyDown);
        return () => document.removeEventListener("keydown", handleKeyDown);
    }, [onClose]);

    // Close when clicking on overlay (outside modal)
    const handleOverlayClick = (e: React.MouseEvent) => {
        if (e.target === e.currentTarget) {
            onClose();
        }
    };

    const handleEdit = () => {
        if (type === 'sheet') {
            navigate(`/sheets/${sessionId}`);
        } else if (type === 'note') {
            navigate(`/notes/${sessionId}`);
        } else {
            navigate(`/diagrams/${sessionId}`);
        }
    };

    const handleLearn = () => {
        if (type === 'diagram') {
            navigate(`/learn/diagram/${sessionId}`);
        } else {
            navigate(`/learn/${sessionId}`);
        }
    };

    const handleQuiz = () => {
        navigate(`/quiz/${sessionId}`);
    };

    const handleWriting = () => {
        navigate(`/writing/${sessionId}`);
    };

    // Render sheet mode options
    if (type === 'sheet') {
        return (
            <div className="mode_overlay" onClick={handleOverlayClick}>
                <div className="mode_modal">
                    <div className="mode_header">
                        <h2 className="mode_title">{title}</h2>
                        <button className="mode_close_btn" onClick={onClose}>×</button>
                    </div>
                    <div className="mode_grid">
                        <button className="mode_btn mode_btn_edit" onClick={handleEdit}>
                            <span className="mode_btn_icon">✏️</span>
                            <span className="mode_btn_label">Edit</span>
                            <span className="mode_btn_desc">Modify your flashcard data</span>
                        </button>
                        <button className="mode_btn mode_btn_learn" onClick={handleLearn}>
                            <span className="mode_btn_icon">📚</span>
                            <span className="mode_btn_label">Learn</span>
                            <span className="mode_btn_desc">Study with spaced repetition</span>
                        </button>
                        <button className="mode_btn mode_btn_quiz" onClick={handleQuiz}>
                            <span className="mode_btn_icon">📊</span>
                            <span className="mode_btn_label">Quiz</span>
                            <span className="mode_btn_desc">Test your knowledge</span>
                        </button>
                        <button className="mode_btn mode_btn_disabled" disabled>
                            <span className="mode_btn_icon">🎯</span>
                            <span className="mode_btn_label">Match</span>
                            <span className="mode_btn_desc">Coming Soon</span>
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    // Render diagram mode options
    if (type === 'diagram') {
        return (
            <div className="mode_overlay" onClick={handleOverlayClick}>
                <div className="mode_modal">
                    <div className="mode_header">
                        <h2 className="mode_title">{title}</h2>
                        <button className="mode_close_btn" onClick={onClose}>×</button>
                    </div>
                    <div className="mode_grid mode_grid_notes">
                        <button className="mode_btn mode_btn_edit" onClick={handleEdit}>
                            <span className="mode_btn_icon">✏️</span>
                            <span className="mode_btn_label">Edit</span>
                            <span className="mode_btn_desc">Modify your diagram</span>
                        </button>
                        <button className="mode_btn mode_btn_learn" onClick={handleLearn}>
                            <span className="mode_btn_icon">📚</span>
                            <span className="mode_btn_label">Learn</span>
                            <span className="mode_btn_desc">Study diagram labels</span>
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    // Render note mode options
    return (
        <div className="mode_overlay" onClick={handleOverlayClick}>
            <div className="mode_modal">
                <div className="mode_header">
                    <h2 className="mode_title">{title}</h2>
                    <button className="mode_close_btn" onClick={onClose}>×</button>
                </div>
                <div className="mode_grid mode_grid_notes">
                    <button className="mode_btn mode_btn_edit" onClick={handleEdit}>
                        <span className="mode_btn_icon">✏️</span>
                        <span className="mode_btn_label">Edit</span>
                        <span className="mode_btn_desc">Modify your note</span>
                    </button>
                    <button className="mode_btn mode_btn_writing" onClick={handleWriting}>
                        <span className="mode_btn_icon">✍️</span>
                        <span className="mode_btn_label">Writing</span>
                        <span className="mode_btn_desc">Practice recall by writing</span>
                    </button>
                </div>
            </div>
        </div>
    );
}

export default ModeModal;
