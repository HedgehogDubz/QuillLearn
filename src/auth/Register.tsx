import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from './AuthContext';
import './Auth.css';

interface RegisterFormData {
    email: string;
    username: string;
    password: string;
    confirmPassword: string;
}

const Register: React.FC = () => {
    const navigate = useNavigate();
    const { isAuthenticated } = useAuth();
    const [formData, setFormData] = useState<RegisterFormData>({
        email: '',
        username: '',
        password: '',
        confirmPassword: ''
    });
    const [error, setError] = useState<string>('');
    const [loading, setLoading] = useState<boolean>(false);
    const [verificationSent, setVerificationSent] = useState<boolean>(false);
    const [registeredEmail, setRegisteredEmail] = useState<string>('');

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
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');

        // Validate passwords match
        if (formData.password !== formData.confirmPassword) {
            setError('Passwords do not match');
            return;
        }

        setLoading(true);

        try {
            const response = await fetch('/api/auth/register', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                credentials: 'include',
                body: JSON.stringify({
                    email: formData.email,
                    username: formData.username,
                    password: formData.password
                })
            });

            const data = await response.json();

            if (data.success && data.needsVerification) {
                // Show verification message instead of logging in
                setVerificationSent(true);
                setRegisteredEmail(data.email || formData.email);
            } else if (!data.success) {
                setError(data.error || 'Registration failed');
            }
        } catch (err) {
            setError('Network error. Please try again.');
            console.error('Registration error:', err);
        } finally {
            setLoading(false);
        }
    };

    // Show verification sent message
    if (verificationSent) {
        return (
            <div className="auth-container">
                <div className="auth-card">
                    <div className="auth-logo">
                        <img src="/quill-logo.svg" alt="QuillLearn" />
                    </div>
                    <h1 className="auth-title">Check Your Email</h1>
                    <div className="auth-success">
                        <p>We've sent a verification link to:</p>
                        <p className="auth-email-display"><strong>{registeredEmail}</strong></p>
                        <p>Click the link in the email to complete your registration and activate your account.</p>
                    </div>
                    <div className="auth-footer" style={{ marginTop: '24px' }}>
                        <p>
                            Didn't receive the email?{' '}
                            <button
                                onClick={async () => {
                                    setLoading(true);
                                    try {
                                        await fetch('/api/auth/resend-verification', {
                                            method: 'POST',
                                            headers: { 'Content-Type': 'application/json' },
                                            body: JSON.stringify({ email: registeredEmail })
                                        });
                                        setError('');
                                        alert('Verification email resent!');
                                    } catch {
                                        setError('Failed to resend email');
                                    }
                                    setLoading(false);
                                }}
                                className="auth-link"
                                disabled={loading}
                            >
                                Resend Email
                            </button>
                        </p>
                        <p style={{ marginTop: '12px' }}>
                            <button
                                onClick={() => navigate('/login')}
                                className="auth-link"
                            >
                                Go to Login
                            </button>
                        </p>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="auth-container">
            <div className="auth-card">
                <div className="auth-logo">
                    <img src="/quill-logo.svg" alt="QuillLearn" />
                </div>
                <h1 className="auth-title">Create Account</h1>
                <p className="auth-subtitle">Join QuillLearn today</p>

                {error && (
                    <div className="auth-error">
                        {error}
                    </div>
                )}

                <form onSubmit={handleSubmit} className="auth-form">
                    <div className="auth-form-group">
                        <label htmlFor="email">Email</label>
                        <input
                            type="email"
                            id="email"
                            name="email"
                            value={formData.email}
                            onChange={handleChange}
                            required
                            autoComplete="email"
                            placeholder="Enter your email"
                        />
                    </div>

                    <div className="auth-form-group">
                        <label htmlFor="username">Username</label>
                        <input
                            type="text"
                            id="username"
                            name="username"
                            value={formData.username}
                            onChange={handleChange}
                            required
                            autoComplete="username"
                            placeholder="Choose a username"
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
                            autoComplete="new-password"
                            placeholder="Create a password"
                        />
                        <small className="auth-hint">
                            Must be 8+ characters with uppercase, lowercase, and number
                        </small>
                    </div>

                    <div className="auth-form-group">
                        <label htmlFor="confirmPassword">Confirm Password</label>
                        <input
                            type="password"
                            id="confirmPassword"
                            name="confirmPassword"
                            value={formData.confirmPassword}
                            onChange={handleChange}
                            required
                            autoComplete="new-password"
                            placeholder="Confirm your password"
                        />
                    </div>

                    <button
                        type="submit"
                        className="auth-button"
                        disabled={loading}
                    >
                        {loading ? 'Creating Account...' : 'Create Account'}
                    </button>
                </form>

                <div className="auth-footer">
                    <p>
                        Already have an account?{' '}
                        <button
                            onClick={() => navigate('/login')}
                            className="auth-link"
                        >
                            Sign In
                        </button>
                    </p>
                </div>
            </div>
        </div>
    );
};

export default Register;

