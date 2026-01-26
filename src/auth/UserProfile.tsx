import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from './AuthContext';
import './UserProfile.css';
import { LogoutIcon, SettingsIcon } from '../components/Icons';
import '../components/Icons.css';
import PixelAvatar from '../components/PixelAvatar';

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
                <div className="user-avatar pixel-avatar">
                    <PixelAvatar avatarData={user.avatar} userId={user.id} size={36} />
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
                            <div className="user-menu-avatar">
                                <PixelAvatar avatarData={user.avatar} userId={user.id} size={48} />
                            </div>
                            <div className="user-menu-info">
                                <div className="user-menu-name">{user.username}</div>
                                <div className="user-menu-email">{user.email}</div>
                            </div>
                        </div>
                        <div className="user-menu-divider" />
                        <Link
                            to="/profile"
                            className="user-menu-item"
                            onClick={() => setShowMenu(false)}
                        >
                            <SettingsIcon size={14} /> Edit Profile
                        </Link>
                        <button
                            className="user-menu-item"
                            onClick={handleLogout}
                        >
                            <LogoutIcon size={14} /> Logout
                        </button>
                    </div>
                </>
            )}
        </div>
    );
};

export default UserProfile;

