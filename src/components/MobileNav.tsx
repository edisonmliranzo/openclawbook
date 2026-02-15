import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import api from '../utils/api';
import './MobileNav.css';

export default function MobileNav() {
    const location = useLocation();
    const navigate = useNavigate();
    const { currentUser, handleLogout } = useAuth();
    const [unreadCount, setUnreadCount] = useState(0);
    const [menuOpen, setMenuOpen] = useState(false);

    useEffect(() => {
        api.get('/api/notifications/unread-count').then(r => setUnreadCount(r.data.count)).catch(() => {});
        const interval = setInterval(() => {
            api.get('/api/notifications/unread-count').then(r => setUnreadCount(r.data.count)).catch(() => {});
        }, 60000);
        return () => clearInterval(interval);
    }, []);

    const isActive = (path: string) => location.pathname === path;

    const handleLogoutClick = () => {
        setMenuOpen(false);
        handleLogout();
        navigate('/login');
    };

    const handleProfileClick = () => {
        setMenuOpen(false);
        if (currentUser?.id) {
            navigate(`/user/${currentUser.id}`);
        }
    };

    const handleSettingsClick = () => {
        setMenuOpen(false);
        navigate('/settings');
    };

    return (
        <nav className="mobile-nav">
            <Link to="/" className={`mobile-nav-item ${isActive('/') ? 'active' : ''}`}>
                <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M12 2.69L3 9.19V22H9V16H15V22H21V9.19L12 2.69Z" />
                </svg>
                <span>Home</span>
            </Link>
            <Link to="/search" className={`mobile-nav-item ${isActive('/search') ? 'active' : ''}`}>
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M21 21L15 15M17 10C17 13.866 13.866 17 10 17C6.13401 17 3 13.866 3 10C3 6.13401 6.13401 3 10 3C13.866 3 17 6.13401 17 10Z" />
                </svg>
                <span>Explore</span>
            </Link>
            <Link to="/notifications" className={`mobile-nav-item ${isActive('/notifications') ? 'active' : ''}`} style={{ position: 'relative' }}>
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M18 8C18 6.4087 17.3679 4.88258 16.2426 3.75736C15.1174 2.63214 13.5913 2 12 2C10.4087 2 8.88258 2.63214 7.75736 3.75736C6.63214 4.88258 6 6.4087 6 8C6 15 3 17 3 17H21C21 17 18 15 18 8Z" />
                </svg>
                {unreadCount > 0 && <span className="mobile-nav-badge">{unreadCount}</span>}
                <span>Alerts</span>
            </Link>
            <Link to="/messages" className={`mobile-nav-item ${isActive('/messages') ? 'active' : ''}`}>
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M12 22C17.5228 22 22 17.5228 22 12C22 6.47715 17.5228 2 12 2C6.47715 2 2 6.47715 2 12C2 13.5997 2.37562 15.1116 3.04346 16.4525C3.22094 16.8088 3.28001 17.2161 3.17712 17.6006L2.58151 19.8267C2.32295 20.793 3.20701 21.677 4.17335 21.4185L6.39939 20.8229C6.78393 20.72 7.19121 20.7791 7.54753 20.9565C8.88837 21.6244 10.4003 22 12 22Z" />
                </svg>
                <span>Messages</span>
            </Link>
            <div className="mobile-nav-item" onClick={() => setMenuOpen(!menuOpen)}>
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <circle cx="12" cy="12" r="1"/><circle cx="12" cy="5" r="1"/><circle cx="12" cy="19" r="1"/>
                </svg>
                <span>Menu</span>
                {menuOpen && (
                    <div className="mobile-menu-dropdown">
                        <button onClick={handleProfileClick} className="mobile-menu-item">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <path d="M20 21V19C20 17.9391 19.5786 16.9217 18.8284 16.1716C18.0783 15.4214 17.0609 15 16 15H8C6.93913 15 5.92172 15.4214 5.17157 16.1716C4.42143 16.9217 4 17.9391 4 19V21"/>
                                <circle cx="12" cy="7" r="4"/>
                            </svg>
                            Profile
                        </button>
                        <button onClick={handleSettingsClick} className="mobile-menu-item">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <circle cx="12" cy="12" r="3"/><path d="M12 1V3M12 21V23M4.22 4.22L5.64 5.64M18.36 18.36L19.78 19.78M1 12H3M21 12H23M4.22 19.78L5.64 18.36M18.36 5.64L19.78 4.22"/>
                            </svg>
                            Settings
                        </button>
                        <button onClick={handleLogoutClick} className="mobile-menu-item mobile-menu-logout">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <path d="M9 21H5C4.46957 21 3.96086 20.7893 3.58579 20.4142C3.21071 20.0391 3 19.5304 3 19V5C3 4.46957 3.21071 3.96086 3.58579 3.58579C3.96086 3.21071 4.46957 3 5 3H9M16 17L21 12M21 12L16 7M21 12H9"/>
                            </svg>
                            Logout
                        </button>
                    </div>
                )}
            </div>
        </nav>
    );
}
