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

    const handleStart = () => {
        onStart({ matchingLevel, wrongAnswerBehavior });
    };

    return (
        <div className="writing_options_screen">
            <h1 className="writing_options_title">Writing Practice</h1>
            <p className="writing_options_subtitle">{noteTitle}</p>
            <p className="writing_options_info">{wordCount} words to practice</p>

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
    const inputRef = useRef<HTMLInputElement>(null);

    const currentWord = words[currentIndex];

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
    }, [currentIndex]);

    const checkMatch = (input: string, target: string): boolean => {
        if (options.matchingLevel === 'word') {
            return input.trim().toLowerCase() === target.toLowerCase();
        } else {
            // Character-level: must match exactly (case-insensitive)
            return input.toLowerCase() === target.toLowerCase();
        }
    };

    const handleSubmit = () => {
        if (!userInput.trim()) return;

        const isCorrect = checkMatch(userInput, currentWord);
        setLastCorrect(isCorrect);
        setShowFeedback(true);

        if (options.wrongAnswerBehavior === 'showAtEnd') {
            // Record and move on without feedback
            setResults([...results, { word: currentWord, userInput, isCorrect, position: currentIndex }]);
            setCompletedWords([...completedWords, userInput]);
            moveToNext();
        } else if (options.wrongAnswerBehavior === 'retype' && !isCorrect) {
            // Clear input and let user retry
            setTimeout(() => {
                setUserInput('');
                setShowFeedback(false);
            }, 800);
        } else {
            // tellRightAway or correct
            setResults([...results, { word: currentWord, userInput, isCorrect, position: currentIndex }]);
            setCompletedWords([...completedWords, isCorrect ? userInput : currentWord]);
        }
    };

    const moveToNext = useCallback(() => {
        if (currentIndex >= words.length - 1) {
            onFinish(results, elapsedTime);
        } else {
            setCurrentIndex(prev => prev + 1);
            setUserInput('');
            setShowFeedback(false);
        }
    }, [currentIndex, words.length, results, elapsedTime, onFinish]);

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter') {
            if (showFeedback && options.wrongAnswerBehavior === 'tellRightAway') {
                moveToNext();
            } else if (!showFeedback) {
                handleSubmit();
            }
        }
    };

    // Context preview - show surrounding words
    const getContextPreview = () => {
        const start = Math.max(0, currentIndex - 3);
        const contextWords = [];
        for (let i = start; i < currentIndex; i++) {
            contextWords.push(completedWords[i] || words[i]);
        }
        return contextWords.join(' ');
    };

    return (
        <div className="writing_game_screen">
            <div className="writing_header">
                <span className="writing_progress">
                    Word {currentIndex + 1} of {words.length}
                </span>
                <span className="writing_timer">{formatTime(elapsedTime)}</span>
            </div>

            <div className="writing_context">
                <span className="writing_context_text">{getContextPreview()}</span>
                <span className="writing_current_placeholder">_____</span>
            </div>

            <div className="writing_input_area">
                <input
                    ref={inputRef}
                    type="text"
                    className={`writing_input ${showFeedback ? (lastCorrect ? 'correct' : 'incorrect') : ''}`}
                    value={userInput}
                    onChange={(e) => setUserInput(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder="Type the next word..."
                    disabled={showFeedback && options.wrongAnswerBehavior !== 'retype'}
                />
                {!showFeedback && (
                    <button className="writing_submit_btn" onClick={handleSubmit}>
                        Submit
                    </button>
                )}
            </div>

            {showFeedback && options.wrongAnswerBehavior !== 'showAtEnd' && (
                <div className={`writing_feedback ${lastCorrect ? 'correct' : 'incorrect'}`}>
                    {lastCorrect ? '✓ Correct!' : `✗ The word was: "${currentWord}"`}
                </div>
            )}

            {showFeedback && options.wrongAnswerBehavior === 'tellRightAway' && (
                <button className="writing_next_btn" onClick={moveToNext}>
                    {currentIndex >= words.length - 1 ? 'See Results' : 'Next Word'}
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

