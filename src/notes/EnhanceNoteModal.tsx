import React, { useState } from 'react';
import { useAuth } from '../auth/AuthContext';
import { authFetch } from '../utils/api';
import './ConvertToSheetModal.css'; // Reuse the same CSS

export type EnhancementType = 'improve' | 'summarize' | 'expand' | 'simplify' | 'formalize' | 'custom';

interface EnhanceNoteModalProps {
    isOpen: boolean;
    onClose: () => void;
    noteContent: string;
    noteTitle: string;
    onEnhanced: (enhancedContent: string) => void;
}

interface EnhancementOption {
    type: EnhancementType;
    label: string;
    description: string;
}

const ENHANCEMENT_OPTIONS: EnhancementOption[] = [
    {
        type: 'improve',
        label: 'Improve Writing',
        description: 'Fix grammar, improve clarity, and enhance overall writing quality'
    },
    {
        type: 'summarize',
        label: 'Summarize',
        description: 'Create a concise summary of the key points'
    },
    {
        type: 'expand',
        label: 'Expand & Elaborate',
        description: 'Add more detail, examples, and explanations to your notes'
    },
    {
        type: 'simplify',
        label: 'Simplify',
        description: 'Make the content easier to understand with simpler language'
    },
    {
        type: 'formalize',
        label: 'Make Formal',
        description: 'Convert to professional, academic-style writing'
    },
    {
        type: 'custom',
        label: 'Custom Prompt',
        description: 'Write your own instructions for how to enhance the notes'
    }
];

export const EnhanceNoteModal: React.FC<EnhanceNoteModalProps> = ({
    isOpen,
    onClose,
    noteContent,
    noteTitle,
    onEnhanced
}) => {
    const { user } = useAuth();

    const [enhancementType, setEnhancementType] = useState<EnhancementType>('improve');
    const [customPrompt, setCustomPrompt] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const validateCustomPrompt = (): string | null => {
        if (enhancementType === 'custom' && !customPrompt.trim()) {
            return 'Please enter a custom prompt for the enhancement';
        }
        return null;
    };

    const handleSubmit = async () => {
        const validationError = validateCustomPrompt();
        if (validationError) {
            setError(validationError);
            return;
        }

        setIsLoading(true);
        setError(null);

        try {
            const response = await authFetch('/api/enhance-note', {
                method: 'POST',
                body: JSON.stringify({
                    noteContent,
                    noteTitle,
                    enhancementType,
                    customPrompt: enhancementType === 'custom' ? customPrompt : undefined,
                    userId: user?.id || null
                }),
            });

            const result = await response.json();

            if (!response.ok || !result.success) {
                let errorMessage = result.error || 'Failed to enhance notes';
                if (result.message) {
                    if (result.message.includes('credentials') || result.message.includes('AWS')) {
                        errorMessage = 'AI service temporarily unavailable. Please try again later.';
                    } else if (result.message.includes('timeout')) {
                        errorMessage = 'The enhancement is taking too long. Try with shorter content.';
                    } else if (result.message.includes('rate limit')) {
                        errorMessage = 'Too many requests. Please wait a moment and try again.';
                    }
                }
                throw new Error(errorMessage);
            }

            // Pass enhanced content back to parent
            onEnhanced(result.enhancedContent);
            onClose();
        } catch (err) {
            console.error('Enhancement error:', err);
            setError(err instanceof Error ? err.message : 'An unexpected error occurred. Please try again.');
        } finally {
            setIsLoading(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="convert_modal_overlay" onClick={onClose}>
            <div className="convert_modal_content" onClick={(e) => e.stopPropagation()}>
                <div className="convert_modal_header">
                    <h3>🪄 Enhance Notes with AI</h3>
                    <button className="convert_modal_close" onClick={onClose}>×</button>
                </div>

                <div className="convert_modal_body">
                    {/* Enhancement Type */}
                    <div className="convert_section">
                        <label className="convert_section_label">
                            <span className="convert_section_icon">🎯</span>
                            Enhancement Type
                        </label>
                        <div className="convert_type_grid">
                            {ENHANCEMENT_OPTIONS.map((option) => (
                                <label
                                    key={option.type}
                                    className={`convert_type_card ${enhancementType === option.type ? 'selected' : ''}`}
                                >
                                    <input
                                        type="radio"
                                        name="enhancementType"
                                        value={option.type}
                                        checked={enhancementType === option.type}
                                        onChange={() => setEnhancementType(option.type)}
                                    />
                                    <span className="convert_type_label">{option.label}</span>
                                    <span className="convert_type_desc">{option.description}</span>
                                </label>
                            ))}
                        </div>
                    </div>

                    {/* Custom Prompt Section - Only shown when custom is selected */}
                    {enhancementType === 'custom' && (
                        <div className="convert_section convert_custom_section">
                            <label className="convert_section_label">
                                Your Custom Instructions
                            </label>
                            <div className="convert_custom_prompt_container">
                                <textarea
                                    className="convert_custom_textarea"
                                    value={customPrompt}
                                    onChange={(e) => setCustomPrompt(e.target.value)}
                                    placeholder="Describe how you want the AI to enhance your notes..."
                                    rows={4}
                                />
                                <div className="convert_custom_guidelines">
                                    <div className="convert_guidelines_header">
                                        Tips for effective prompts
                                    </div>
                                    <ul className="convert_guidelines_list">
                                        <li>Be specific about what you want changed</li>
                                        <li>Mention the style or tone you prefer</li>
                                        <li>Specify any sections to focus on</li>
                                    </ul>
                                    <div className="convert_guidelines_examples">
                                        <strong>Examples:</strong>
                                        <p>"Add bullet points and subheadings for better organization"</p>
                                        <p>"Rewrite in the style of a textbook"</p>
                                        <p>"Translate to Spanish while keeping technical terms"</p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Error Message */}
                    {error && (
                        <div className="convert_error">
                            {error}
                        </div>
                    )}
                </div>

                <div className="convert_modal_footer">
                    <button
                        className="convert_btn convert_btn_cancel"
                        onClick={onClose}
                        disabled={isLoading}
                    >
                        Cancel
                    </button>
                    <button
                        className="convert_btn convert_btn_primary"
                        onClick={handleSubmit}
                        disabled={isLoading}
                    >
                        {isLoading ? (
                            <>
                                <span className="convert_spinner"></span>
                                Enhancing...
                            </>
                        ) : (
                            '🪄 Enhance Notes'
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
};

