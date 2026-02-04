import { useState, useEffect, useMemo, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import './quiz.css'
import Header from '../header/header.tsx'
import { useAuth } from '../auth/AuthContext'
import { authFetch } from '../utils/api'

// ============ Types ============
interface QuizQuestion {
    questionText: string
    correctAnswer: string
    questionColumnIndex: number
    answerColumnIndex: number
    cardIndex: number
}

interface QuizAnswer {
    question: QuizQuestion
    userAnswer: string
    isCorrect: boolean
}

interface QuizOptions {
    questionType: 'mcq' | 'type'
    mcqOptionCount: number
    wrongAnswerBehavior: 'retry' | 'moveOn' | 'showAtEnd'
    questionCount: number
    questionColumn: number
    answerColumn: number
}

interface SessionData {
    headers: string[]
    cards: string[][]
    title: string
}

// ============ Helper Functions ============
function parseCellContent(value: string): { text: string; images: string[] } {
    const imageRegex = /\|\|\|IMG:([^|]+)\|\|\|/g;
    const images: string[] = [];
    let match;
    while ((match = imageRegex.exec(value)) !== null) {
        images.push(match[1]);
    }
    const text = value.replace(imageRegex, '').trim();
    return { text, images };
}

function shuffleArray<T>(array: T[]): T[] {
    const shuffled = [...array];
    for (let i = shuffled.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
}

async function loadSessionData(sessionId: string): Promise<SessionData | null> {
    try {
        const response = await authFetch(`/api/sheets/${sessionId}`);
        const result = await response.json();

        if (result.success && result.data) {
            const data = result.data;
            let rawData: string[][] | null = null;

            if (data.rows && Array.isArray(data.rows)) {
                rawData = data.rows.map((row: { data: string[] }) => row.data);
            }

            if (rawData && rawData.length > 0) {
                const headers = rawData[0].map((h, i) => h.trim() || `Column ${i + 1}`);
                const cards = rawData
                    .slice(1)
                    .filter(row => row.some(cell => cell.trim() !== ''));
                return { headers, cards, title: data.title || 'Untitled' };
            }
        }
    } catch (error) {
        console.error('Error loading session data:', error);
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
interface QuizOptionsScreenProps {
    headers: string[]
    cardCount: number
    onStart: (options: QuizOptions) => void
}

function QuizOptionsScreen({ headers, cardCount, onStart }: QuizOptionsScreenProps) {
    const [questionType, setQuestionType] = useState<'mcq' | 'type'>('mcq');
    const [mcqOptionCount, setMcqOptionCount] = useState(4);
    const [wrongAnswerBehavior, setWrongAnswerBehavior] = useState<'retry' | 'moveOn' | 'showAtEnd'>('moveOn');
    const [questionCount, setQuestionCount] = useState(Math.min(10, cardCount));
    const [questionColumn, setQuestionColumn] = useState(0);
    const [answerColumn, setAnswerColumn] = useState(headers.length > 1 ? 1 : 0);

    const handleStart = () => {
        onStart({
            questionType,
            mcqOptionCount,
            wrongAnswerBehavior,
            questionCount,
            questionColumn,
            answerColumn
        });
    };

    return (
        <div className="quiz_options_screen">
            <h1 className="quiz_options_title">Quiz Options</h1>
            <p className="quiz_options_subtitle">Configure your quiz settings</p>

            {/* Question/Answer Columns */}
            <div className="quiz_options_group">
                <h3 className="quiz_options_group_title">Columns</h3>
                <div className="quiz_option_row">
                    <span className="quiz_option_label">Question Column</span>
                    <select
                        className="quiz_option_select"
                        value={questionColumn}
                        onChange={(e) => setQuestionColumn(Number(e.target.value))}
                    >
                        {headers.map((header, idx) => (
                            <option key={idx} value={idx}>{header}</option>
                        ))}
                    </select>
                </div>
                <div className="quiz_option_row">
                    <span className="quiz_option_label">Answer Column</span>
                    <select
                        className="quiz_option_select"
                        value={answerColumn}
                        onChange={(e) => setAnswerColumn(Number(e.target.value))}
                    >
                        {headers.map((header, idx) => (
                            <option key={idx} value={idx}>{header}</option>
                        ))}
                    </select>
                </div>
            </div>

            {/* Question Type */}
            <div className="quiz_options_group">
                <h3 className="quiz_options_group_title">Question Type</h3>
                <div className="quiz_option_row">
                    <span className="quiz_option_label">Type</span>
                    <select
                        className="quiz_option_select"
                        value={questionType}
                        onChange={(e) => setQuestionType(e.target.value as 'mcq' | 'type')}
                    >
                        <option value="mcq">Multiple Choice</option>
                        <option value="type">Type Answer</option>
                    </select>
                </div>
                {questionType === 'mcq' && (
                    <div className="quiz_option_row">
                        <span className="quiz_option_label">Number of Options</span>
                        <input
                            type="number"
                            className="quiz_option_input"
                            value={mcqOptionCount}
                            onChange={(e) => setMcqOptionCount(Math.max(2, Math.min(6, Number(e.target.value))))}
                            min={2}
                            max={6}
                        />
                    </div>
                )}
            </div>

            {/* Quiz Settings */}
            <div className="quiz_options_group">
                <h3 className="quiz_options_group_title">Settings</h3>
                <div className="quiz_option_row">
                    <span className="quiz_option_label">Number of Questions</span>
                    <input
                        type="number"
                        className="quiz_option_input"
                        value={questionCount}
                        onChange={(e) => setQuestionCount(Math.max(1, Math.min(cardCount, Number(e.target.value))))}
                        min={1}
                        max={cardCount}
                    />
                </div>
                <div className="quiz_option_row">
                    <span className="quiz_option_label">Wrong Answer Behavior</span>
                    <select
                        className="quiz_option_select"
                        value={wrongAnswerBehavior}
                        onChange={(e) => setWrongAnswerBehavior(e.target.value as 'retry' | 'moveOn' | 'showAtEnd')}
                    >
                        <option value="moveOn">Move On (Show Correct)</option>
                        <option value="retry">Retry Until Correct</option>
                        <option value="showAtEnd">Show All at End</option>
                    </select>
                </div>
            </div>

            <button
                className="quiz_start_btn"
                onClick={handleStart}
                disabled={questionColumn === answerColumn}
            >
                Start Quiz
            </button>
            {questionColumn === answerColumn && (
                <p style={{ color: 'var(--color-error-500)', textAlign: 'center' }}>
                    Question and answer columns must be different
                </p>
            )}
        </div>
    );
}


// Quiz Game Component
interface QuizGameProps {
    sessionData: SessionData
    options: QuizOptions
    onFinish: (answers: QuizAnswer[], elapsedTime: number) => void
}

function QuizGame({ sessionData, options, onFinish }: QuizGameProps) {
    const [currentIndex, setCurrentIndex] = useState(0);
    const [answers, setAnswers] = useState<QuizAnswer[]>([]);
    const [elapsedTime, setElapsedTime] = useState(0);
    const [userInput, setUserInput] = useState('');
    const [showFeedback, setShowFeedback] = useState(false);
    const [lastAnswerCorrect, setLastAnswerCorrect] = useState(false);
    const [selectedOption, setSelectedOption] = useState<number | null>(null);
    const [mcqOptions, setMcqOptions] = useState<string[]>([]);

    // Generate questions from cards
    const questions = useMemo(() => {
        const shuffledCards = shuffleArray(
            sessionData.cards.map((card, idx) => ({ card, idx }))
        );
        const selected = shuffledCards.slice(0, options.questionCount);

        return selected.map(({ card, idx }) => ({
            questionText: parseCellContent(card[options.questionColumn]).text,
            correctAnswer: parseCellContent(card[options.answerColumn]).text,
            questionColumnIndex: options.questionColumn,
            answerColumnIndex: options.answerColumn,
            cardIndex: idx
        }));
    }, [sessionData, options]);

    // Timer
    useEffect(() => {
        const timer = setInterval(() => {
            setElapsedTime(prev => prev + 1);
        }, 1000);
        return () => clearInterval(timer);
    }, []);

    // Generate MCQ options for current question
    useEffect(() => {
        if (options.questionType === 'mcq' && questions[currentIndex]) {
            const correctAnswer = questions[currentIndex].correctAnswer;
            const otherAnswers = sessionData.cards
                .map(card => parseCellContent(card[options.answerColumn]).text)
                .filter(ans => ans !== correctAnswer && ans.trim() !== '');

            const shuffledOthers = shuffleArray(otherAnswers);
            const wrongOptions = shuffledOthers.slice(0, options.mcqOptionCount - 1);
            const allOptions = shuffleArray([correctAnswer, ...wrongOptions]);
            setMcqOptions(allOptions);
        }
        setSelectedOption(null);
        setUserInput('');
        setShowFeedback(false);
    }, [currentIndex, questions, sessionData, options]);

    const currentQuestion = questions[currentIndex];

    // Move to next question or finish - accepts the updated answers array
    const moveToNext = useCallback((updatedAnswers: QuizAnswer[]) => {
        if (currentIndex >= questions.length - 1) {
            onFinish(updatedAnswers, elapsedTime);
        } else {
            setCurrentIndex(prev => prev + 1);
        }
    }, [currentIndex, questions.length, elapsedTime, onFinish]);

    const handleAnswer = (answer: string) => {
        const isCorrect = answer.trim().toLowerCase() === currentQuestion.correctAnswer.trim().toLowerCase();
        setLastAnswerCorrect(isCorrect);
        setShowFeedback(true);

        const newAnswer: QuizAnswer = {
            question: currentQuestion,
            userAnswer: answer,
            isCorrect
        };

        if (options.wrongAnswerBehavior === 'showAtEnd') {
            // Just record and move on without showing feedback
            const newAnswers = [...answers, newAnswer];
            setAnswers(newAnswers);
            setTimeout(() => moveToNext(newAnswers), 300);
        } else if (options.wrongAnswerBehavior === 'retry' && !isCorrect) {
            // Let user retry - don't record or move on
            setTimeout(() => {
                setShowFeedback(false);
                setSelectedOption(null);
                setUserInput('');
            }, 1000);
        } else {
            // moveOn or correct answer
            const newAnswers = [...answers, newAnswer];
            setAnswers(newAnswers);
        }
    };

    const handleMcqSelect = (optionIndex: number) => {
        if (showFeedback) return;
        setSelectedOption(optionIndex);
        handleAnswer(mcqOptions[optionIndex]);
    };

    const handleTypeSubmit = () => {
        if (!userInput.trim() || showFeedback) return;
        handleAnswer(userInput);
    };

    if (!currentQuestion) {
        return <div>Loading questions...</div>;
    }

    return (
        <div className="quiz_game_screen">
            <div className="quiz_header">
                <span className="quiz_progress">
                    Question {currentIndex + 1} of {questions.length}
                </span>
                <span className="quiz_timer">{formatTime(elapsedTime)}</span>
            </div>

            <div className="quiz_question_card">
                <div className="quiz_question_label">
                    {sessionData.headers[options.questionColumn]}
                </div>
                <p className="quiz_question_text">{currentQuestion.questionText}</p>
            </div>

            {/* MCQ Options */}
            {options.questionType === 'mcq' && (
                <div className="quiz_options">
                    {mcqOptions.map((opt, idx) => {
                        const isSelected = selectedOption === idx;
                        const isCorrectOption = opt === currentQuestion.correctAnswer;
                        let className = 'quiz_option_btn';
                        if (showFeedback && isSelected && !lastAnswerCorrect) {
                            className += ' incorrect';
                        }
                        if (showFeedback && isCorrectOption) {
                            className += ' correct';
                        }
                        return (
                            <button
                                key={idx}
                                className={className}
                                onClick={() => handleMcqSelect(idx)}
                                disabled={showFeedback}
                            >
                                {opt}
                            </button>
                        );
                    })}
                </div>
            )}

            {/* Type Answer */}
            {options.questionType === 'type' && (
                <div className="quiz_type_input_wrapper">
                    <input
                        type="text"
                        className={`quiz_type_input ${showFeedback ? (lastAnswerCorrect ? 'correct' : 'incorrect') : ''}`}
                        value={userInput}
                        onChange={(e) => setUserInput(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && handleTypeSubmit()}
                        placeholder="Type your answer..."
                        disabled={showFeedback}
                        autoFocus
                    />
                    <button
                        className="quiz_submit_btn"
                        onClick={handleTypeSubmit}
                        disabled={showFeedback || !userInput.trim()}
                    >
                        Submit
                    </button>
                </div>
            )}

            {/* Feedback */}
            {showFeedback && options.wrongAnswerBehavior !== 'showAtEnd' && (
                <div className={`quiz_feedback ${lastAnswerCorrect ? 'correct' : 'incorrect'}`}>
                    {lastAnswerCorrect ? '✓ Correct!' : `✗ Incorrect! The answer is: ${currentQuestion.correctAnswer}`}
                </div>
            )}

            {/* Next Button (for moveOn behavior) */}
            {showFeedback && options.wrongAnswerBehavior === 'moveOn' && (
                <button className="quiz_next_btn" onClick={() => moveToNext(answers)}>
                    {currentIndex >= questions.length - 1 ? 'See Results' : 'Next Question'}
                </button>
            )}
        </div>
    );
}



// Results Screen Component
interface QuizResultsProps {
    answers: QuizAnswer[]
    elapsedTime: number
    sessionTitle: string
    onRetry: () => void
    onExit: () => void
}

function QuizResults({ answers, elapsedTime, sessionTitle, onRetry, onExit }: QuizResultsProps) {
    const correctCount = answers.filter(a => a.isCorrect).length;
    const percentage = answers.length > 0 ? Math.round((correctCount / answers.length) * 100) : 0;

    return (
        <div className="quiz_results_screen">
            <div className="quiz_results_header">
                <h1 className="quiz_results_title">Quiz Complete!</h1>
                <p className="quiz_results_subtitle">{sessionTitle}</p>
            </div>

            <div className="quiz_results_stats">
                <div className="quiz_stat">
                    <div className="quiz_stat_value score">{percentage}%</div>
                    <div className="quiz_stat_label">Score</div>
                </div>
                <div className="quiz_stat">
                    <div className="quiz_stat_value">{correctCount}/{answers.length}</div>
                    <div className="quiz_stat_label">Correct</div>
                </div>
                <div className="quiz_stat">
                    <div className="quiz_stat_value">{formatTime(elapsedTime)}</div>
                    <div className="quiz_stat_label">Time</div>
                </div>
            </div>

            <div className="quiz_results_questions">
                <h3 className="quiz_results_questions_title">Question Review</h3>
                {answers.map((answer, idx) => (
                    <div key={idx} className={`quiz_result_item ${answer.isCorrect ? 'correct' : 'incorrect'}`}>
                        <div className="quiz_result_question">
                            {idx + 1}. {answer.question.questionText}
                        </div>
                        <div className="quiz_result_answer">
                            <strong>Correct Answer:</strong> {answer.question.correctAnswer}
                        </div>
                        <div className={`quiz_result_your_answer ${answer.isCorrect ? 'correct' : 'incorrect'}`}>
                            <strong>Your Answer:</strong> {answer.userAnswer}
                            {answer.isCorrect ? ' ✓' : ' ✗'}
                        </div>
                    </div>
                ))}
            </div>

            <div className="quiz_results_actions">
                <button className="quiz_action_btn" onClick={onExit}>
                    Back to Home
                </button>
                <button className="quiz_action_btn primary" onClick={onRetry}>
                    Try Again
                </button>
            </div>
        </div>
    );
}

// Main Quiz Component
function Quiz() {
    const { sessionId } = useParams<{ sessionId: string }>();
    const navigate = useNavigate();
    const { user } = useAuth();
    const [sessionData, setSessionData] = useState<SessionData | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [quizPhase, setQuizPhase] = useState<'options' | 'playing' | 'results'>('options');
    const [quizOptions, setQuizOptions] = useState<QuizOptions | null>(null);
    const [quizResults, setQuizResults] = useState<{ answers: QuizAnswer[], time: number } | null>(null);

    // Load session data
    useEffect(() => {
        const fetchData = async () => {
            if (!sessionId) {
                setError('No session ID provided');
                setLoading(false);
                return;
            }

            const data = await loadSessionData(sessionId);
            if (data && data.cards.length > 0) {
                setSessionData(data);
            } else {
                setError('No data found for this session');
            }
            setLoading(false);
        };

        fetchData();
    }, [sessionId]);

    const handleStartQuiz = (options: QuizOptions) => {
        setQuizOptions(options);
        setQuizPhase('playing');
    };

    const handleFinishQuiz = useCallback((answers: QuizAnswer[], elapsedTime: number) => {
        setQuizResults({ answers, time: elapsedTime });
        setQuizPhase('results');
    }, []);

    const handleRetry = () => {
        setQuizResults(null);
        setQuizPhase('options');
    };

    const handleExit = () => {
        navigate('/');
    };

    if (!user) {
        return (
            <div className="quiz_container">
                <Header />
                <div className="quiz_content">
                    <p>Please <a href="/login">log in</a> to take a quiz.</p>
                </div>
            </div>
        );
    }

    if (loading) {
        return (
            <div className="quiz_container">
                <Header />
                <div className="quiz_content">
                    <p>Loading quiz data...</p>
                </div>
            </div>
        );
    }

    if (error || !sessionData) {
        return (
            <div className="quiz_container">
                <Header />
                <div className="quiz_content">
                    <p>{error || 'Failed to load session'}</p>
                    <a href="/">← Back to Home</a>
                </div>
            </div>
        );
    }

    return (
        <div className="quiz_container">
            <Header />
            <div className="quiz_content">
                {quizPhase === 'options' && (
                    <QuizOptionsScreen
                        headers={sessionData.headers}
                        cardCount={sessionData.cards.length}
                        onStart={handleStartQuiz}
                    />
                )}

                {quizPhase === 'playing' && quizOptions && (
                    <QuizGame
                        sessionData={sessionData}
                        options={quizOptions}
                        onFinish={handleFinishQuiz}
                    />
                )}

                {quizPhase === 'results' && quizResults && (
                    <QuizResults
                        answers={quizResults.answers}
                        elapsedTime={quizResults.time}
                        sessionTitle={sessionData.title}
                        onRetry={handleRetry}
                        onExit={handleExit}
                    />
                )}
            </div>
        </div>
    );
}

export default Quiz;
