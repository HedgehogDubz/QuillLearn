import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import './ConvertToSheetModal.css';

export type ConversionType = 'direct' | 'vocabulary' | 'study' | 'theme' | 'custom';

interface ConvertToSheetModalProps {
    isOpen: boolean;
    onClose: () => void;
    noteContent: string;
    noteTitle: string;
}

export interface ConversionOptions {
    conversionType: ConversionType;
    numRows: number;
    numColumns: number;
    columnHeaders: string[];
    customPrompt?: string;
}

const DEFAULT_HEADERS: Record<ConversionType, string[]> = {
    direct: ['Question', 'Answer'],
    vocabulary: ['Term', 'Definition'],
    study: ['Question', 'Answer'],
    theme: ['Topic', 'Key Points'],
    custom: ['Column 1', 'Column 2']
};

interface ConversionOption {
    type: ConversionType;
    emoji: string;
    label: string;
    description: string;
}

const CONVERSION_OPTIONS: ConversionOption[] = [
    {
        type: 'direct',
        emoji: '📝',
        label: 'Direct Questions from Notes',
        description: 'Extract questions and answers directly from your notes content'
    },
    {
        type: 'vocabulary',
        emoji: '📚',
        label: 'Pure Vocabulary',
        description: 'Extract key terms and their definitions'
    },
    {
        type: 'study',
        emoji: '🧠',
        label: 'Study Questions Based on Notes',
        description: 'Generate comprehension questions to test understanding of the content'
    },
    {
        type: 'theme',
        emoji: '💡',
        label: 'Theme-based Generation',
        description: 'Create related study content inspired by the themes in your notes'
    },
    {
        type: 'custom',
        emoji: '✨',
        label: 'Custom Prompt',
        description: 'Write your own instructions for how to convert the notes'
    }
];

const CUSTOM_PROMPT_PLACEHOLDER = `Example prompts:

• "Create flashcards focusing on dates and events mentioned in the notes"
• "Generate questions that test cause-and-effect relationships"
• "Extract formulas and their applications from these math notes"
• "Create vocabulary cards with example sentences"

Your prompt will be combined with the notes content to generate the study sheet.`;

export const ConvertToSheetModal: React.FC<ConvertToSheetModalProps> = ({
    isOpen,
    onClose,
    noteContent,
    noteTitle
}) => {
    const navigate = useNavigate();
    const { user } = useAuth();

    const [conversionType, setConversionType] = useState<ConversionType>('direct');
    const [numRows, setNumRows] = useState(10);
    const [numColumns, setNumColumns] = useState(2);
    const [columnHeaders, setColumnHeaders] = useState<string[]>(['Question', 'Answer']);
    const [customPrompt, setCustomPrompt] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Update column headers when conversion type changes
    useEffect(() => {
        const defaultHeaders = DEFAULT_HEADERS[conversionType];
        setColumnHeaders(prev => {
            const newHeaders = [...defaultHeaders];
            // Keep existing headers if they exist, fill with defaults
            for (let i = 0; i < numColumns; i++) {
                if (i < prev.length && prev[i] && i >= defaultHeaders.length) {
                    newHeaders[i] = prev[i];
                } else if (i >= defaultHeaders.length) {
                    newHeaders[i] = `Column ${i + 1}`;
                }
            }
            return newHeaders.slice(0, numColumns);
        });
    }, [conversionType, numColumns]);

    // Update column headers when numColumns changes
    useEffect(() => {
        setColumnHeaders(prev => {
            const newHeaders = [...prev];
            while (newHeaders.length < numColumns) {
                newHeaders.push(`Column ${newHeaders.length + 1}`);
            }
            return newHeaders.slice(0, numColumns);
        });
    }, [numColumns]);

    const handleHeaderChange = (index: number, value: string) => {
        setColumnHeaders(prev => {
            const newHeaders = [...prev];
            newHeaders[index] = value;
            return newHeaders;
        });
    };

    const validateCustomPrompt = (): string | null => {
        if (conversionType === 'custom' && !customPrompt.trim()) {
            return 'Please enter a custom prompt for the conversion';
        }
        return null;
    };

    const handleSubmit = async () => {
        // Validate custom prompt
        const validationError = validateCustomPrompt();
        if (validationError) {
            setError(validationError);
            return;
        }

        setIsLoading(true);
        setError(null);

        try {
            const response = await fetch('/api/notes-to-sheets', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    noteContent,
                    noteTitle,
                    conversionType,
                    numRows,
                    numColumns,
                    columnHeaders,
                    customPrompt: conversionType === 'custom' ? customPrompt : undefined,
                    userId: user?.id || null
                }),
            });

            const result = await response.json();

            if (!response.ok || !result.success) {
                // Provide more user-friendly error messages
                let errorMessage = result.error || 'Failed to convert notes to sheet';
                if (result.message) {
                    // Check for common error patterns and provide helpful messages
                    if (result.message.includes('credentials') || result.message.includes('AWS')) {
                        errorMessage = 'AI service temporarily unavailable. Please try again later.';
                    } else if (result.message.includes('timeout')) {
                        errorMessage = 'The conversion is taking too long. Try reducing the number of rows.';
                    } else if (result.message.includes('rate limit')) {
                        errorMessage = 'Too many requests. Please wait a moment and try again.';
                    }
                }
                throw new Error(errorMessage);
            }

            // Navigate to the new sheet
            navigate(`/sheets/${result.sessionId}`);
            onClose();
        } catch (err) {
            console.error('Conversion error:', err);
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
                    <h3>📊 Convert Notes to Sheet</h3>
                    <button className="convert_modal_close" onClick={onClose}>×</button>
                </div>

                <div className="convert_modal_body">
                    {/* Conversion Type */}
                    <div className="convert_section">
                        <label className="convert_section_label">
                            <span className="convert_section_icon">🎯</span>
                            Conversion Type
                        </label>
                        <div className="convert_type_grid">
                            {CONVERSION_OPTIONS.map((option) => (
                                <label
                                    key={option.type}
                                    className={`convert_type_card ${conversionType === option.type ? 'selected' : ''}`}
                                >
                                    <input
                                        type="radio"
                                        name="conversionType"
                                        value={option.type}
                                        checked={conversionType === option.type}
                                        onChange={() => setConversionType(option.type)}
                                    />
                                    <span className="convert_type_emoji">{option.emoji}</span>
                                    <span className="convert_type_label">{option.label}</span>
                                    <span className="convert_type_desc">{option.description}</span>
                                </label>
                            ))}
                        </div>
                    </div>

                    {/* Custom Prompt Section - Only shown when custom is selected */}
                    {conversionType === 'custom' && (
                        <div className="convert_section convert_custom_section">
                            <label className="convert_section_label">
                                <span className="convert_section_icon">✍️</span>
                                Your Custom Instructions
                            </label>
                            <div className="convert_custom_prompt_container">
                                <textarea
                                    className="convert_custom_textarea"
                                    value={customPrompt}
                                    onChange={(e) => setCustomPrompt(e.target.value)}
                                    placeholder="Describe how you want the AI to convert your notes..."
                                    rows={4}
                                />
                                <div className="convert_custom_guidelines">
                                    <div className="convert_guidelines_header">
                                        <span>💡</span> Tips for effective prompts
                                    </div>
                                    <ul className="convert_guidelines_list">
                                        <li>Be specific about what type of content you want</li>
                                        <li>Mention the format (Q&A, definitions, comparisons)</li>
                                        <li>Specify any focus areas or topics to emphasize</li>
                                    </ul>
                                    <div className="convert_guidelines_examples">
                                        <strong>Examples:</strong>
                                        <p>"Create flashcards focusing on dates and events"</p>
                                        <p>"Generate questions testing cause-and-effect"</p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Sheet Structure */}
                    <div className="convert_section">
                        <label className="convert_section_label">
                            <span className="convert_section_icon">📐</span>
                            Sheet Structure
                        </label>
                        <div className="convert_structure_row">
                            <div className="convert_field">
                                <label>Number of Rows</label>
                                <input
                                    type="number"
                                    min="1"
                                    max="50"
                                    value={numRows}
                                    onChange={(e) => setNumRows(Math.max(1, Math.min(50, parseInt(e.target.value) || 10)))}
                                />
                                <span className="convert_field_hint">Max 50 rows</span>
                            </div>
                            <div className="convert_field">
                                <label>Number of Columns</label>
                                <select
                                    value={numColumns}
                                    onChange={(e) => setNumColumns(parseInt(e.target.value))}
                                >
                                    {[2, 3, 4, 5, 6].map(n => (
                                        <option key={n} value={n}>{n} columns</option>
                                    ))}
                                </select>
                            </div>
                        </div>
                    </div>

                    {/* Column Headers */}
                    <div className="convert_section">
                        <label className="convert_section_label">
                            <span className="convert_section_icon">🏷️</span>
                            Column Headers
                        </label>
                        <div className="convert_headers_grid">
                            {columnHeaders.map((header, index) => (
                                <div key={index} className="convert_header_field">
                                    <label>Column {index + 1}</label>
                                    <input
                                        type="text"
                                        value={header}
                                        onChange={(e) => handleHeaderChange(index, e.target.value)}
                                        placeholder={`Column ${index + 1}`}
                                    />
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Error Message */}
                    {error && (
                        <div className="convert_error">
                            ⚠️ {error}
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
                                Generating...
                            </>
                        ) : (
                            '🚀 Generate Sheet'
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
};

