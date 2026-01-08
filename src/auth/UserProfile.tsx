import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from './AuthContext';
import './UserProfile.css';

const UserProfile: React.FC = () => {
    const { user, logout } = useAuth();
    const navigate = useNavigate();
    const [showMenu, setShowMenu] = useState(false);

    const handleLogout = async () => {
        await logout();
        navigate('/login');
    };

    if (!user) return null;

    return (
        <div className="user-profile">
            <button 
                className="user-profile-button"
                onClick={() => setShowMenu(!showMenu)}
            >
                <div className="user-avatar">
                    {user.username.charAt(0).toUpperCase()}
                </div>
                <span className="user-name">{user.username}</span>
            </button>

            {showMenu && (
                <>
                    <div 
                        className="user-menu-overlay" 
                        onClick={() => setShowMenu(false)}
                    />
                    <div className="user-menu">
                        <div className="user-menu-header">
                            <div className="user-menu-name">{user.username}</div>
                            <div className="user-menu-email">{user.email}</div>
                        </div>
                        <div className="user-menu-divider" />
                        <button 
                            className="user-menu-item"
                            onClick={handleLogout}
                        >
                            <span>🚪</span> Logout
                        </button>
                    </div>
                </>
            )}
        </div>
    );
};

export default UserProfile;

