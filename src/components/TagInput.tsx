import React, { useState, useRef, useEffect } from 'react';
import './TagInput.css';

interface TagInputProps {
    tags: string[];
    onTagsChange: (tags: string[]) => void;
    readOnly?: boolean;
    placeholder?: string;
    maxTags?: number;
    suggestions?: string[];
}

const TagInput: React.FC<TagInputProps> = ({
    tags,
    onTagsChange,
    readOnly = false,
    placeholder = 'Add tag...',
    maxTags = 10,
    suggestions = []
}) => {
    const [inputValue, setInputValue] = useState('');
    const [showSuggestions, setShowSuggestions] = useState(false);
    const [isExpanded, setIsExpanded] = useState(false);
    const inputRef = useRef<HTMLInputElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);

    // Filter suggestions based on input
    const filteredSuggestions = suggestions.filter(
        s => s.toLowerCase().includes(inputValue.toLowerCase()) && !tags.includes(s)
    ).slice(0, 5);

    // Close suggestions when clicking outside
    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
                setShowSuggestions(false);
                setIsExpanded(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const addTag = (tag: string) => {
        const trimmedTag = tag.trim().toUpperCase();
        if (trimmedTag && !tags.includes(trimmedTag) && tags.length < maxTags) {
            onTagsChange([...tags, trimmedTag]);
            setInputValue('');
            setShowSuggestions(false);
        }
    };

    const removeTag = (tagToRemove: string) => {
        if (!readOnly) {
            onTagsChange(tags.filter(t => t !== tagToRemove));
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' || e.key === ',') {
            e.preventDefault();
            addTag(inputValue);
        } else if (e.key === 'Backspace' && !inputValue && tags.length > 0) {
            removeTag(tags[tags.length - 1]);
        } else if (e.key === 'Escape') {
            setShowSuggestions(false);
            setIsExpanded(false);
        }
    };

    const handleTagClick = () => {
        if (!readOnly) {
            setIsExpanded(true);
            setTimeout(() => inputRef.current?.focus(), 0);
        }
    };

    // Collapsed view: show tag icon and count, or first few tags
    if (!isExpanded && !readOnly) {
        return (
            <div className="tag-input-collapsed" onClick={handleTagClick}>
                <span className="tag-icon">🏷️</span>
                {tags.length === 0 ? (
                    <span className="tag-placeholder">Add tags</span>
                ) : (
                    <>
                        {tags.slice(0, 2).map(tag => (
                            <span key={tag} className="tag-pill tag-pill-small">{tag}</span>
                        ))}
                        {tags.length > 2 && (
                            <span className="tag-more">+{tags.length - 2}</span>
                        )}
                    </>
                )}
            </div>
        );
    }

    const handleWrapperClick = () => {
        if (!readOnly && inputRef.current) {
            inputRef.current.focus();
        }
    };

    return (
        <div className="tag-input-container" ref={containerRef}>
            <div className="tag-input-wrapper" onClick={handleWrapperClick}>
                <span className="tag-icon">🏷️</span>
                <div className="tag-list">
                    {tags.map(tag => (
                        <span key={tag} className="tag-pill">
                            {tag}
                            {!readOnly && (
                                <button
                                    className="tag-remove"
                                    onClick={(e) => { e.stopPropagation(); removeTag(tag); }}
                                    aria-label={`Remove ${tag}`}
                                >
                                    ×
                                </button>
                            )}
                        </span>
                    ))}
                    {!readOnly && tags.length < maxTags && (
                        <input
                            ref={inputRef}
                            type="text"
                            className="tag-input"
                            value={inputValue}
                            onChange={(e) => {
                                setInputValue(e.target.value);
                                setShowSuggestions(true);
                            }}
                            onKeyDown={handleKeyDown}
                            onFocus={() => setShowSuggestions(true)}
                            placeholder={tags.length === 0 ? placeholder : ''}
                        />
                    )}
                </div>
                {isExpanded && (
                    <button className="tag-collapse" onClick={() => setIsExpanded(false)}>✓</button>
                )}
            </div>
            {showSuggestions && filteredSuggestions.length > 0 && (
                <div className="tag-suggestions">
                    {filteredSuggestions.map(suggestion => (
                        <div
                            key={suggestion}
                            className="tag-suggestion"
                            onClick={() => addTag(suggestion)}
                        >
                            {suggestion}
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

export default TagInput;

