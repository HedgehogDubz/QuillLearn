import { useState, useEffect, useMemo, useCallback, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import './writing.css'
import Header from '../header/header.tsx'
import { useAuth } from '../auth/AuthContext'
import { authFetch } from '../utils/api'

// ============ Types ============
interface WritingOptions {
    matchingLevel: 'word' | 'character'
    wrongAnswerBehavior: 'tellRightAway' | 'retype' | 'showAtEnd'
    displayMode: 'hidden' | 'paragraph'
}

interface WordResult {
    word: string
    userInput: string
    isCorrect: boolean
    position: number
}

interface NoteData {
    title: string
    content: string
}

// ============ Helper Functions ============

// Strip HTML tags and get plain text
function stripHtml(html: string): string {
    const doc = new DOMParser().parseFromString(html, 'text/html');
    return doc.body.textContent || '';
}

// Split text into words (keeping punctuation attached)
function splitIntoWords(text: string): string[] {
    // Split on whitespace but keep words with punctuation
    return text.split(/\s+/).filter(word => word.length > 0);
}

async function loadNoteData(sessionId: string): Promise<NoteData | null> {
    try {
        const response = await authFetch(`/api/notes/${sessionId}`);
        const result = await response.json();

        if (result.success && result.data) {
            return {
                title: result.data.title || 'Untitled Note',
                content: result.data.content || ''
            };
        }
    } catch (error) {
        console.error('Error loading note data:', error);
    }
    return null;
}

function formatTime(seconds: number): string {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
}

// ============ Components ============

// Options Screen Component
interface WritingOptionsScreenProps {
    noteTitle: string
    wordCount: number
    onStart: (options: WritingOptions) => void
}

function WritingOptionsScreen({ noteTitle, wordCount, onStart }: WritingOptionsScreenProps) {
    const [matchingLevel, setMatchingLevel] = useState<'word' | 'character'>('word');
    const [wrongAnswerBehavior, setWrongAnswerBehavior] = useState<'tellRightAway' | 'retype' | 'showAtEnd'>('tellRightAway');
    const [displayMode, setDisplayMode] = useState<'hidden' | 'paragraph'>('hidden');

    const handleStart = () => {
        onStart({ matchingLevel, wrongAnswerBehavior, displayMode });
    };

    return (
        <div className="writing_options_screen">
            <h1 className="writing_options_title">Writing Practice</h1>
            <p className="writing_options_subtitle">{noteTitle}</p>
            <p className="writing_options_info">{wordCount} words to practice</p>

            <div className="writing_options_group">
                <h3 className="writing_options_group_title">Display Mode</h3>
                <div className="writing_option_row">
                    <span className="writing_option_label">Show words</span>
                    <select
                        className="writing_option_select"
                        value={displayMode}
                        onChange={(e) => setDisplayMode(e.target.value as 'hidden' | 'paragraph')}
                    >
                        <option value="hidden">Hidden (recall from memory)</option>
                        <option value="paragraph">Paragraph (see all words)</option>
                    </select>
                </div>
            </div>

            <div className="writing_options_group">
                <h3 className="writing_options_group_title">Matching Level</h3>
                <div className="writing_option_row">
                    <span className="writing_option_label">Match by</span>
                    <select
                        className="writing_option_select"
                        value={matchingLevel}
                        onChange={(e) => setMatchingLevel(e.target.value as 'word' | 'character')}
                    >
                        <option value="word">Word (exact word match)</option>
                        <option value="character">Character (every character)</option>
                    </select>
                </div>
            </div>

            <div className="writing_options_group">
                <h3 className="writing_options_group_title">Wrong Answer Behavior</h3>
                <div className="writing_option_row">
                    <span className="writing_option_label">When wrong</span>
                    <select
                        className="writing_option_select"
                        value={wrongAnswerBehavior}
                        onChange={(e) => setWrongAnswerBehavior(e.target.value as 'tellRightAway' | 'retype' | 'showAtEnd')}
                    >
                        <option value="tellRightAway">Tell me right away</option>
                        <option value="retype">Make me retype</option>
                        <option value="showAtEnd">Show all at end</option>
                    </select>
                </div>
            </div>

            <button className="writing_start_btn" onClick={handleStart}>
                Start Writing Practice
            </button>
        </div>
    );
}

// Writing Game Component
interface WritingGameProps {
    words: string[]
    options: WritingOptions
    onFinish: (results: WordResult[], elapsedTime: number) => void
}

function WritingGame({ words, options, onFinish }: WritingGameProps) {
    const [currentIndex, setCurrentIndex] = useState(0);
    const [userInput, setUserInput] = useState('');
    const [results, setResults] = useState<WordResult[]>([]);
    const [elapsedTime, setElapsedTime] = useState(0);
    const [showFeedback, setShowFeedback] = useState(false);
    const [lastCorrect, setLastCorrect] = useState(false);
    const [completedWords, setCompletedWords] = useState<string[]>([]);
    const [isRetrying, setIsRetrying] = useState(false); // Track if user is retrying after wrong answer
    const inputRef = useRef<HTMLInputElement>(null);
    const resultsRef = useRef<WordResult[]>([]); // Use ref to track results for onFinish

    const currentWord = words[currentIndex];

    // Keep resultsRef in sync
    useEffect(() => {
        resultsRef.current = results;
    }, [results]);

    // Timer
    useEffect(() => {
        const timer = setInterval(() => {
            setElapsedTime(prev => prev + 1);
        }, 1000);
        return () => clearInterval(timer);
    }, []);

    // Focus input on mount and when moving to next word
    useEffect(() => {
        inputRef.current?.focus();
    }, [currentIndex, showFeedback]);

    // Move to next word/finish
    const moveToNext = useCallback((newResults: WordResult[], completedWord: string) => {
        const newCompletedWords = [...completedWords, completedWord];
        setCompletedWords(newCompletedWords);

        if (currentIndex >= words.length - 1) {
            // Finish the game
            onFinish(newResults, elapsedTime);
        } else {
            setCurrentIndex(prev => prev + 1);
            setUserInput('');
            setShowFeedback(false);
            setIsRetrying(false);
        }
    }, [currentIndex, words.length, completedWords, elapsedTime, onFinish]);

    // Handle character mode - check on every keystroke
    const handleCharacterInput = (newValue: string) => {
        setUserInput(newValue);

        // Check if the current input matches the target so far
        const targetSoFar = currentWord.slice(0, newValue.length);
        const isMatchingSoFar = newValue.toLowerCase() === targetSoFar.toLowerCase();

        if (newValue.length === currentWord.length) {
            // Completed the word
            const isCorrect = newValue.toLowerCase() === currentWord.toLowerCase();
            setLastCorrect(isCorrect);

            if (isCorrect) {
                // Correct - record and auto-advance
                const newResults = [...results, { word: currentWord, userInput: newValue, isCorrect: true, position: currentIndex }];
                setResults(newResults);
                moveToNext(newResults, newValue);
            } else {
                // Wrong
                setShowFeedback(true);
                if (options.wrongAnswerBehavior === 'showAtEnd') {
                    const newResults = [...results, { word: currentWord, userInput: newValue, isCorrect: false, position: currentIndex }];
                    setResults(newResults);
                    moveToNext(newResults, currentWord);
                } else if (options.wrongAnswerBehavior === 'retype') {
                    // Clear and retry
                    setIsRetrying(true);
                    setTimeout(() => {
                        setUserInput('');
                        setShowFeedback(false);
                    }, 600);
                } else {
                    // tellRightAway - show feedback, wait for user to press next
                    const newResults = [...results, { word: currentWord, userInput: newValue, isCorrect: false, position: currentIndex }];
                    setResults(newResults);
                }
            }
        } else if (!isMatchingSoFar && newValue.length > 0) {
            // Wrong character typed
            setLastCorrect(false);
            setShowFeedback(true);

            if (options.wrongAnswerBehavior === 'showAtEnd') {
                // Just continue, will record at end of word
            } else if (options.wrongAnswerBehavior === 'retype') {
                // Clear the wrong character
                setIsRetrying(true);
                setTimeout(() => {
                    setUserInput(newValue.slice(0, -1)); // Remove wrong character
                    setShowFeedback(false);
                }, 300);
            } else {
                // tellRightAway - flash feedback but let them continue
                setTimeout(() => {
                    setShowFeedback(false);
                }, 300);
            }
        }
    };

    // Handle word mode submit
    const handleWordSubmit = () => {
        if (!userInput.trim()) return;

        const isCorrect = userInput.trim().toLowerCase() === currentWord.toLowerCase();
        setLastCorrect(isCorrect);
        setShowFeedback(true);

        if (isCorrect) {
            // Correct - record and auto-advance
            // If retrying, don't add another result (already recorded the wrong attempt)
            if (isRetrying) {
                // Just move on without recording again
                setIsRetrying(false);
                moveToNext(results, userInput);
            } else {
                const newResults = [...results, { word: currentWord, userInput, isCorrect: true, position: currentIndex }];
                setResults(newResults);
                moveToNext(newResults, userInput);
            }
        } else {
            // Wrong
            if (options.wrongAnswerBehavior === 'showAtEnd') {
                const newResults = [...results, { word: currentWord, userInput, isCorrect: false, position: currentIndex }];
                setResults(newResults);
                moveToNext(newResults, currentWord);
            } else if (options.wrongAnswerBehavior === 'retype') {
                // Record the wrong answer only on first attempt
                if (!isRetrying) {
                    const newResults = [...results, { word: currentWord, userInput, isCorrect: false, position: currentIndex }];
                    setResults(newResults);
                }
                // Show feedback briefly, then clear for retry
                setIsRetrying(true);
                setTimeout(() => {
                    setUserInput('');
                    setShowFeedback(false);
                }, 800);
            } else {
                // tellRightAway - show feedback, wait for user to click next
                const newResults = [...results, { word: currentWord, userInput, isCorrect: false, position: currentIndex }];
                setResults(newResults);
            }
        }
    };

    // Handle input change
    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const newValue = e.target.value;

        if (options.matchingLevel === 'character') {
            handleCharacterInput(newValue);
        } else {
            setUserInput(newValue);
        }
    };

    // Handle key presses
    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (options.matchingLevel === 'word') {
            // Word mode: Space or Enter submits
            if (e.key === ' ' || e.key === 'Enter') {
                e.preventDefault();
                if (showFeedback && !lastCorrect && options.wrongAnswerBehavior === 'tellRightAway') {
                    // Wrong answer shown, advance to next
                    moveToNext(results, currentWord);
                } else if (!showFeedback) {
                    // Submit the word (works for both normal and retry attempts)
                    handleWordSubmit();
                }
            }
        } else {
            // Character mode: Enter or Space advances after wrong answer feedback
            if ((e.key === 'Enter' || e.key === ' ') && showFeedback && !lastCorrect && options.wrongAnswerBehavior === 'tellRightAway') {
                e.preventDefault();
                moveToNext(results, currentWord);
            }
        }
    };

    // Context preview - show surrounding words (for hidden mode)
    const getContextPreview = () => {
        // Show more context - up to 10 words before
        const start = Math.max(0, currentIndex - 10);
        const contextWords = [];
        for (let i = start; i < currentIndex; i++) {
            contextWords.push(completedWords[i] || words[i]);
        }
        return contextWords.join(' ');
    };

    // Render paragraph view - shows all words with current highlighted
    const renderParagraphView = () => {
        return (
            <div className="writing_paragraph">
                {words.map((word, idx) => {
                    let className = 'writing_paragraph_word';
                    if (idx < currentIndex) {
                        // Completed word - check if it was correct
                        const result = results.find(r => r.position === idx);
                        if (result) {
                            className += result.isCorrect ? ' completed correct' : ' completed incorrect';
                        } else {
                            className += ' completed';
                        }
                    } else if (idx === currentIndex) {
                        className += ' current';
                    } else {
                        className += ' upcoming';
                    }
                    return (
                        <span key={idx} className={className}>
                            {idx < currentIndex ? (completedWords[idx] || word) : word}
                            {idx < words.length - 1 ? ' ' : ''}
                        </span>
                    );
                })}
            </div>
        );
    };

    // For character mode, show which characters are typed
    const renderCharacterProgress = () => {
        if (options.matchingLevel !== 'character') return null;

        return (
            <div className="writing_char_progress">
                {currentWord.split('').map((char, idx) => {
                    const userChar = userInput[idx];
                    let className = 'writing_char';
                    if (userChar !== undefined) {
                        className += userChar.toLowerCase() === char.toLowerCase() ? ' correct' : ' incorrect';
                    } else if (idx === userInput.length) {
                        className += ' current';
                    }
                    return (
                        <span key={idx} className={className}>
                            {userChar !== undefined ? userChar : '_'}
                        </span>
                    );
                })}
            </div>
        );
    };

    return (
        <div className="writing_game_screen">
            <div className="writing_header">
                <span className="writing_progress">
                    Word {currentIndex + 1} of {words.length}
                </span>
                <span className="writing_timer">{formatTime(elapsedTime)}</span>
            </div>

            {/* Paragraph mode - show all words */}
            {options.displayMode === 'paragraph' && renderParagraphView()}

            {/* Hidden mode - show context preview */}
            {options.displayMode === 'hidden' && (
                <div className="writing_context">
                    <span className="writing_context_text">{getContextPreview()}</span>
                    <span className="writing_current_placeholder">_____</span>
                </div>
            )}

            {renderCharacterProgress()}

            <div className="writing_input_area">
                <input
                    ref={inputRef}
                    type="text"
                    className={`writing_input ${showFeedback ? (lastCorrect ? 'correct' : 'incorrect') : ''}`}
                    value={userInput}
                    onChange={handleInputChange}
                    onKeyDown={handleKeyDown}
                    placeholder={options.matchingLevel === 'character' ? "Type each character..." : "Type the word, then press Space or Enter..."}
                    autoComplete="off"
                    autoCapitalize="off"
                    spellCheck={false}
                />
            </div>

            {showFeedback && !lastCorrect && options.wrongAnswerBehavior === 'tellRightAway' && (
                <div className="writing_feedback incorrect">
                    ✗ The word was: "{currentWord}"
                </div>
            )}

            {showFeedback && !lastCorrect && options.wrongAnswerBehavior === 'retype' && (
                <div className="writing_feedback incorrect">
                    ✗ Try again!
                </div>
            )}

            {showFeedback && !lastCorrect && options.wrongAnswerBehavior === 'tellRightAway' && (
                <button className="writing_next_btn" onClick={() => moveToNext(results, currentWord)}>
                    {currentIndex >= words.length - 1 ? 'See Results' : 'Next Word (Space/Enter)'}
                </button>
            )}
        </div>
    );
}


// Results Screen Component
interface WritingResultsProps {
    results: WordResult[]
    elapsedTime: number
    noteTitle: string
    onRetry: () => void
    onExit: () => void
}

function WritingResults({ results, elapsedTime, noteTitle, onRetry, onExit }: WritingResultsProps) {
    const correctCount = results.filter(r => r.isCorrect).length;
    const percentage = results.length > 0 ? Math.round((correctCount / results.length) * 100) : 0;

    // Group consecutive results for display
    const incorrectWords = results.filter(r => !r.isCorrect);

    return (
        <div className="writing_results_screen">
            <div className="writing_results_header">
                <h1 className="writing_results_title">Practice Complete!</h1>
                <p className="writing_results_subtitle">{noteTitle}</p>
            </div>

            <div className="writing_results_stats">
                <div className="writing_stat">
                    <div className="writing_stat_value score">{percentage}%</div>
                    <div className="writing_stat_label">Accuracy</div>
                </div>
                <div className="writing_stat">
                    <div className="writing_stat_value">{correctCount}/{results.length}</div>
                    <div className="writing_stat_label">Words Correct</div>
                </div>
                <div className="writing_stat">
                    <div className="writing_stat_value">{formatTime(elapsedTime)}</div>
                    <div className="writing_stat_label">Time</div>
                </div>
            </div>

            {incorrectWords.length > 0 && (
                <div className="writing_results_mistakes">
                    <h3 className="writing_results_mistakes_title">Words to Review</h3>
                    <div className="writing_mistakes_list">
                        {incorrectWords.map((result, idx) => (
                            <div key={idx} className="writing_mistake_item">
                                <span className="writing_mistake_correct">{result.word}</span>
                                <span className="writing_mistake_arrow">→</span>
                                <span className="writing_mistake_wrong">{result.userInput}</span>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            <div className="writing_results_actions">
                <button className="writing_action_btn" onClick={onExit}>
                    Back to Home
                </button>
                <button className="writing_action_btn primary" onClick={onRetry}>
                    Try Again
                </button>
            </div>
        </div>
    );
}

// Main Writing Component
function Writing() {
    const { sessionId } = useParams<{ sessionId: string }>();
    const navigate = useNavigate();
    const { user } = useAuth();
    const [noteData, setNoteData] = useState<NoteData | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [phase, setPhase] = useState<'options' | 'playing' | 'results'>('options');
    const [writingOptions, setWritingOptions] = useState<WritingOptions | null>(null);
    const [writingResults, setWritingResults] = useState<{ results: WordResult[], time: number } | null>(null);

    // Extract words from note content
    const words = useMemo(() => {
        if (!noteData?.content) return [];
        const plainText = stripHtml(noteData.content);
        return splitIntoWords(plainText);
    }, [noteData]);

    // Load note data
    useEffect(() => {
        const fetchData = async () => {
            if (!sessionId) {
                setError('No session ID provided');
                setLoading(false);
                return;
            }

            const data = await loadNoteData(sessionId);
            if (data && data.content) {
                setNoteData(data);
            } else {
                setError('No content found for this note');
            }
            setLoading(false);
        };

        fetchData();
    }, [sessionId]);

    const handleStart = (options: WritingOptions) => {
        setWritingOptions(options);
        setPhase('playing');
    };

    const handleFinish = useCallback((results: WordResult[], elapsedTime: number) => {
        setWritingResults({ results, time: elapsedTime });
        setPhase('results');
    }, []);

    const handleRetry = () => {
        setWritingResults(null);
        setPhase('options');
    };

    const handleExit = () => {
        navigate('/');
    };

    if (!user) {
        return (
            <div className="writing_container">
                <Header />
                <div className="writing_content">
                    <p>Please <a href="/login">log in</a> to practice writing.</p>
                </div>
            </div>
        );
    }

    if (loading) {
        return (
            <div className="writing_container">
                <Header />
                <div className="writing_content">
                    <p>Loading note...</p>
                </div>
            </div>
        );
    }

    if (error || !noteData || words.length === 0) {
        return (
            <div className="writing_container">
                <Header />
                <div className="writing_content">
                    <p>{error || 'This note has no content to practice'}</p>
                    <a href="/">← Back to Home</a>
                </div>
            </div>
        );
    }

    return (
        <div className="writing_container">
            <Header />
            <div className="writing_content">
                {phase === 'options' && (
                    <WritingOptionsScreen
                        noteTitle={noteData.title}
                        wordCount={words.length}
                        onStart={handleStart}
                    />
                )}

                {phase === 'playing' && writingOptions && (
                    <WritingGame
                        words={words}
                        options={writingOptions}
                        onFinish={handleFinish}
                    />
                )}

                {phase === 'results' && writingResults && (
                    <WritingResults
                        results={writingResults.results}
                        elapsedTime={writingResults.time}
                        noteTitle={noteData.title}
                        onRetry={handleRetry}
                        onExit={handleExit}
                    />
                )}
            </div>
        </div>
    );
}

export default Writing;

