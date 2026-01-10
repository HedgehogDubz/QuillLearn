import React from 'react';
import './DocumentHeader.css';

interface DocumentHeaderProps {
    title: string;
    onTitleChange: (title: string) => void;
    isSaved: boolean;
    placeholder?: string;
    savedText?: string;
    unsavedText?: string;
    readOnly?: boolean;
    permission?: 'owner' | 'editor' | 'view' | null;
}

const DocumentHeader: React.FC<DocumentHeaderProps> = ({
    title,
    onTitleChange,
    isSaved,
    placeholder = 'Untitled Document',
    savedText = '✓ Saved',
    unsavedText = '● Unsaved',
    readOnly = false,
    permission = null
}) => {
    const getPermissionBadge = () => {
        if (!permission) return null;

        const badges = {
            owner: { text: '👑 Owner', color: '#dbeafe', textColor: '#1e40af' },
            editor: { text: '✏️ Editor', color: '#dcfce7', textColor: '#166534' },
            view: { text: '👁️ Viewer', color: '#fef3c7', textColor: '#92400e' }
        };

        const badge = badges[permission];
        if (!badge) return null;

        return (
            <span style={{
                display: 'inline-block',
                marginLeft: '10px',
                padding: '4px 12px',
                backgroundColor: badge.color,
                color: badge.textColor,
                borderRadius: '4px',
                fontSize: '14px',
                fontWeight: '500'
            }}>
                {badge.text}
            </span>
        );
    };

    return (
        <div className="document_header">
            <input
                type="text"
                className="document_header_title"
                value={title}
                onChange={(e) => onTitleChange(e.target.value)}
                placeholder={placeholder}
                readOnly={readOnly}
            />
            {getPermissionBadge()}
            {permission !== 'view' && (
                <span className={`document_header_save_indicator ${isSaved ? 'saved' : 'unsaved'}`}>
                    {isSaved ? savedText : unsavedText}
                </span>
            )}
        </div>
    );
};

export default DocumentHeader;

