import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import './Auth.css';

const VerifyEmail: React.FC = () => {
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const token = searchParams.get('token');
    
    const [status, setStatus] = useState<'verifying' | 'success' | 'error'>('verifying');
    const [error, setError] = useState('');
    const [resendLoading, setResendLoading] = useState(false);
    const [resendSuccess, setResendSuccess] = useState(false);
    const [email, setEmail] = useState('');

    useEffect(() => {
        const verifyEmail = async () => {
            if (!token) {
                setStatus('error');
                setError('No verification token provided');
                return;
            }

            try {
                const response = await fetch('/api/auth/verify-email', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({ token })
                });

                const data = await response.json();

                if (data.success) {
                    setStatus('success');
                } else {
                    setStatus('error');
                    setError(data.error || 'Failed to verify email');
                }
            } catch (err) {
                setStatus('error');
                setError('Network error. Please try again.');
                console.error('Email verification error:', err);
            }
        };

        verifyEmail();
    }, [token]);

    const handleResendVerification = async () => {
        if (!email) {
            setError('Please enter your email address');
            return;
        }

        setResendLoading(true);
        setError('');

        try {
            const response = await fetch('/api/auth/resend-verification', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ email })
            });

            const data = await response.json();

            if (data.success) {
                setResendSuccess(true);
            } else {
                setError(data.error || 'Failed to resend verification email');
            }
        } catch (err) {
            setError('Network error. Please try again.');
            console.error('Resend verification error:', err);
        } finally {
            setResendLoading(false);
        }
    };

    if (status === 'verifying') {
        return (
            <div className="auth-container">
                <div className="auth-card">
                    <div className="auth-logo">
                        <img src="/logo.png" alt="QuillLearn" />
                    </div>
                    <h1 className="auth-title">Verifying Email...</h1>
                    <p className="auth-subtitle">Please wait while we verify your email address.</p>
                </div>
            </div>
        );
    }

    if (status === 'success') {
        return (
            <div className="auth-container">
                <div className="auth-card">
                    <div className="auth-logo">
                        <img src="/logo.png" alt="QuillLearn" />
                    </div>
                    <h1 className="auth-title">Email Verified!</h1>
                    <p className="auth-subtitle">
                        Your email has been successfully verified.
                        You can now enjoy all features of QuillLearn.
                    </p>
                    <button 
                        onClick={() => navigate('/login')}
                        className="auth-button"
                        style={{ marginTop: '20px' }}
                    >
                        Sign In
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="auth-container">
            <div className="auth-card">
                <div className="auth-logo">
                    <img src="/logo.png" alt="QuillLearn" />
                </div>
                <h1 className="auth-title">Verification Failed</h1>
                <p className="auth-subtitle">{error}</p>

                {!resendSuccess ? (
                    <div style={{ marginTop: '20px' }}>
                        <p className="auth-subtitle">Enter your email to get a new verification link:</p>
                        <div className="auth-form-group" style={{ marginTop: '10px' }}>
                            <input
                                type="email"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                placeholder="Enter your email"
                            />
                        </div>
                        <button 
                            onClick={handleResendVerification}
                            className="auth-button"
                            disabled={resendLoading}
                            style={{ marginTop: '10px' }}
                        >
                            {resendLoading ? 'Sending...' : 'Resend Verification Email'}
                        </button>
                    </div>
                ) : (
                    <p className="auth-subtitle" style={{ color: '#22c55e', marginTop: '20px' }}>
                        A new verification email has been sent. Please check your inbox.
                    </p>
                )}

                <div className="auth-footer">
                    <p>
                        <button 
                            onClick={() => navigate('/login')}
                            className="auth-link"
                        >
                            Back to Login
                        </button>
                    </p>
                </div>
            </div>
        </div>
    );
};

export default VerifyEmail;

