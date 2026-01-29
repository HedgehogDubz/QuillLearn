import React from 'react';
import './LoadingScreen.css';

interface LoadingScreenProps {
    message?: string;
    showServerNote?: boolean;
}

export const LoadingScreen: React.FC<LoadingScreenProps> = ({
    message = 'Loading...',
    showServerNote = true
}) => {
    return (
        <div className="loading-screen">
            <div className="loading-content">
                <div className="loading-logo spinning">
                    <img src="/logo.png" alt="QuillLearn Hedgehog" />
                </div>
                <p className="loading-message">{message}</p>
                {showServerNote && (
                    <div className="loading-server-note">
                        <p className="loading-note-title">⏳ May take a minute or two</p>
                        <p className="loading-note-text">
                            Since QuillLearn is in development, the free server tier (Render)
                            automatically turns off after minutes of inactivity. If it has turned off,
                            it may take a minute or two to start back up.
                        </p>
                    </div>
                )}
            </div>
        </div>
    );
};

export default LoadingScreen;

