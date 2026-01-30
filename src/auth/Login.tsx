import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from './AuthContext';
import './Auth.css';

interface LoginFormData {
    emailOrUsername: string;
    password: string;
}

const Login: React.FC = () => {
    const navigate = useNavigate();
    const { isAuthenticated, login } = useAuth();
    const [formData, setFormData] = useState<LoginFormData>({
        emailOrUsername: '',
        password: ''
    });
    const [error, setError] = useState<string>('');
    const [loading, setLoading] = useState<boolean>(false);
    const [needsVerification, setNeedsVerification] = useState<boolean>(false);
    const [verificationEmail, setVerificationEmail] = useState<string>('');
    const [resendSuccess, setResendSuccess] = useState<boolean>(false);

    // Redirect to home if already authenticated
    useEffect(() => {
        if (isAuthenticated) {
            navigate('/');
        }
    }, [isAuthenticated, navigate]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setFormData({
            ...formData,
            [e.target.name]: e.target.value
        });
        setError(''); // Clear error when user types
        setNeedsVerification(false);
        setResendSuccess(false);
    };

    const handleResendVerification = async () => {
        setLoading(true);
        setResendSuccess(false);
        try {
            const response = await fetch('/api/auth/resend-verification', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email: verificationEmail })
            });
            const data = await response.json();
            if (data.success) {
                setResendSuccess(true);
                setError('');
            } else {
                setError(data.error || 'Failed to resend verification email');
            }
        } catch {
            setError('Failed to resend verification email');
        }
        setLoading(false);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setNeedsVerification(false);
        setResendSuccess(false);
        setLoading(true);

        try {
            const response = await fetch('/api/auth/login', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                credentials: 'include', // Important for cookies
                body: JSON.stringify(formData)
            });

            // Check if response is ok before parsing JSON
            if (!response.ok && response.status >= 500) {
                setError(`Server error (${response.status}). Please try again later.`);
                return;
            }

            const data = await response.json();

            if (data.success) {
                // Update auth context (this will also store in localStorage)
                login(data.user, data.token);

                // Redirect to home or dashboard
                navigate('/');
            } else if (data.needsVerification) {
                // User needs to verify their email
                setNeedsVerification(true);
                setVerificationEmail(data.email || formData.emailOrUsername);
                setError(data.error || 'Please verify your email before logging in.');
            } else {
                setError(data.error || 'Login failed');
            }
        } catch (err) {
            console.error('Login error:', err);
            if (err instanceof TypeError && err.message.includes('fetch')) {
                setError('Cannot connect to server. Please check your internet connection.');
            } else {
                setError('Network error. Please try again.');
            }
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="auth-container">
            <div className="auth-card">
                <div className="auth-logo">
                    <img src="/logo.png" alt="QuillLearn" />
                </div>
                <h1 className="auth-title">Welcome Back</h1>
                <p className="auth-subtitle">Sign in to your QuillLearn account</p>

                {resendSuccess && (
                    <div className="auth-success">
                        Verification email sent! Check your inbox.
                    </div>
                )}

                {error && (
                    <div className="auth-error">
                        {error}
                        {needsVerification && (
                            <div style={{ marginTop: '12px' }}>
                                <button
                                    type="button"
                                    onClick={handleResendVerification}
                                    className="auth-link"
                                    disabled={loading}
                                    style={{ color: 'inherit', textDecoration: 'underline' }}
                                >
                                    {loading ? 'Sending...' : 'Resend Verification Email'}
                                </button>
                            </div>
                        )}
                    </div>
                )}

                <form onSubmit={handleSubmit} className="auth-form">
                    <div className="auth-form-group">
                        <label htmlFor="emailOrUsername">Email or Username</label>
                        <input
                            type="text"
                            id="emailOrUsername"
                            name="emailOrUsername"
                            value={formData.emailOrUsername}
                            onChange={handleChange}
                            required
                            autoComplete="username"
                            placeholder="Enter your email or username"
                        />
                    </div>

                    <div className="auth-form-group">
                        <label htmlFor="password">Password</label>
                        <input
                            type="password"
                            id="password"
                            name="password"
                            value={formData.password}
                            onChange={handleChange}
                            required
                            autoComplete="current-password"
                            placeholder="Enter your password"
                        />
                    </div>

                    <div className="auth-forgot-password">
                        <button
                            type="button"
                            onClick={() => navigate('/forgot-password')}
                            className="auth-link"
                        >
                            Forgot Password?
                        </button>
                    </div>

                    <button
                        type="submit"
                        className="auth-button"
                        disabled={loading}
                    >
                        {loading ? 'Signing in...' : 'Sign In'}
                    </button>
                </form>

                <div className="auth-footer">
                    <p>
                        Don't have an account?{' '}
                        <button 
                            onClick={() => navigate('/register')}
                            className="auth-link"
                        >
                            Create Account
                        </button>
                    </p>
                </div>
            </div>
        </div>
    );
};

export default Login;

