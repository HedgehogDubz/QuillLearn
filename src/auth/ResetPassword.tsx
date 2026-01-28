import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import './Auth.css';

const ResetPassword: React.FC = () => {
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const token = searchParams.get('token');
    
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [error, setError] = useState('');
    const [success, setSuccess] = useState(false);
    const [loading, setLoading] = useState(false);
    const [validatingToken, setValidatingToken] = useState(true);
    const [tokenValid, setTokenValid] = useState(false);

    useEffect(() => {
        const validateToken = async () => {
            if (!token) {
                setValidatingToken(false);
                return;
            }

            try {
                const response = await fetch(`/api/auth/verify-reset-token/${token}`);
                const data = await response.json();
                setTokenValid(data.valid);
            } catch (err) {
                console.error('Token validation error:', err);
                setTokenValid(false);
            } finally {
                setValidatingToken(false);
            }
        };

        validateToken();
    }, [token]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');

        if (password !== confirmPassword) {
            setError('Passwords do not match');
            return;
        }

        if (password.length < 8) {
            setError('Password must be at least 8 characters long');
            return;
        }

        setLoading(true);

        try {
            const response = await fetch('/api/auth/reset-password', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ token, password })
            });

            const data = await response.json();

            if (data.success) {
                setSuccess(true);
            } else {
                setError(data.error || 'Failed to reset password');
            }
        } catch (err) {
            setError('Network error. Please try again.');
            console.error('Reset password error:', err);
        } finally {
            setLoading(false);
        }
    };

    if (validatingToken) {
        return (
            <div className="auth-container">
                <div className="auth-card">
                    <div className="auth-logo">
                        <img src="/logo.png" alt="QuillLearn" />
                    </div>
                    <h1 className="auth-title">Validating...</h1>
                    <p className="auth-subtitle">Please wait while we verify your reset link.</p>
                </div>
            </div>
        );
    }

    if (!token || !tokenValid) {
        return (
            <div className="auth-container">
                <div className="auth-card">
                    <div className="auth-logo">
                        <img src="/logo.png" alt="QuillLearn" />
                    </div>
                    <h1 className="auth-title">Invalid Link</h1>
                    <p className="auth-subtitle">
                        This password reset link is invalid or has expired.
                        Please request a new one.
                    </p>
                    <div className="auth-footer">
                        <p>
                            <button 
                                onClick={() => navigate('/forgot-password')}
                                className="auth-link"
                            >
                                Request New Link
                            </button>
                        </p>
                    </div>
                </div>
            </div>
        );
    }

    if (success) {
        return (
            <div className="auth-container">
                <div className="auth-card">
                    <div className="auth-logo">
                        <img src="/logo.png" alt="QuillLearn" />
                    </div>
                    <h1 className="auth-title">Password Reset!</h1>
                    <p className="auth-subtitle">
                        Your password has been successfully reset.
                        You can now sign in with your new password.
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
                <h1 className="auth-title">Reset Password</h1>
                <p className="auth-subtitle">Enter your new password</p>

                {error && <div className="auth-error">{error}</div>}

                <form onSubmit={handleSubmit} className="auth-form">
                    <div className="auth-form-group">
                        <label htmlFor="password">New Password</label>
                        <input
                            type="password"
                            id="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            required
                            autoComplete="new-password"
                            placeholder="Enter new password"
                        />
                        <span className="auth-hint">
                            Must be at least 8 characters with uppercase, lowercase, and number
                        </span>
                    </div>
                    <div className="auth-form-group">
                        <label htmlFor="confirmPassword">Confirm Password</label>
                        <input
                            type="password"
                            id="confirmPassword"
                            value={confirmPassword}
                            onChange={(e) => setConfirmPassword(e.target.value)}
                            required
                            autoComplete="new-password"
                            placeholder="Confirm new password"
                        />
                    </div>
                    <button type="submit" className="auth-button" disabled={loading}>
                        {loading ? 'Resetting...' : 'Reset Password'}
                    </button>
                </form>
            </div>
        </div>
    );
};

export default ResetPassword;

