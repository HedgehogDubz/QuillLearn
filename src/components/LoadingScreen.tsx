import React from 'react';
import './LoadingScreen.css';

interface LoadingScreenProps {
    message?: string;
    type?: 'sheet' | 'note' | 'general';
}

export const LoadingScreen: React.FC<LoadingScreenProps> = ({
    message = 'Loading...'
}) => {
    return (
        <div className="loading-screen">
            <div className="loading-content">
                <div className="loading-logo">
                    <img src="/quill-logo.svg" alt="QuillLearn" />
                </div>
                <div className="loading-spinner" />
                <p className="loading-message">{message}</p>
            </div>
        </div>
    );
};

export default LoadingScreen;

