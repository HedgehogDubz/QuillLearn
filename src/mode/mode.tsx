import React, { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import "./mode.css";

interface ModeModalProps {
    sessionId: string;
    title: string;
    onClose: () => void;
}

function ModeModal({ sessionId, title, onClose }: ModeModalProps) {
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
        navigate(`/sheets/${sessionId}`);
    };

    const handleLearn = () => {
        navigate(`/learn/${sessionId}`);
    };

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
                    <button className="mode_btn mode_btn_disabled" disabled>
                        <span className="mode_btn_icon">📊</span>
                        <span className="mode_btn_label">Quiz</span>
                        <span className="mode_btn_desc">Coming Soon</span>
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

export default ModeModal;
