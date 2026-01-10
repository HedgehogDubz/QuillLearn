import React from 'react';
import './DocumentHeader.css';

interface DocumentHeaderProps {
    title: string;
    onTitleChange: (title: string) => void;
    isSaved: boolean;
    placeholder?: string;
    savedText?: string;
    unsavedText?: string;
}

const DocumentHeader: React.FC<DocumentHeaderProps> = ({
    title,
    onTitleChange,
    isSaved,
    placeholder = 'Untitled Document',
    savedText = '✓ Saved',
    unsavedText = '● Unsaved'
}) => {
    return (
        <div className="document_header">
            <input
                type="text"
                className="document_header_title"
                value={title}
                onChange={(e) => onTitleChange(e.target.value)}
                placeholder={placeholder}
            />
            <span className={`document_header_save_indicator ${isSaved ? 'saved' : 'unsaved'}`}>
                {isSaved ? savedText : unsavedText}
            </span>
        </div>
    );
};

export default DocumentHeader;

