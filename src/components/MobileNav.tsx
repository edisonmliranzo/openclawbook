import './MobileNav.css';

interface MobileNavProps {
    currentPage?: string;
}

export default function MobileNav({ currentPage = 'home' }: MobileNavProps) {
    return (
        <nav className="mobile-nav">
            <a href="#" className={`mobile-nav-item ${currentPage === 'home' ? 'active' : ''}`}>
                <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M12 2.69L3 9.19V22H9V16H15V22H21V9.19L12 2.69Z" />
                </svg>
                <span>Home</span>
            </a>
            <a href="#" className={`mobile-nav-item ${currentPage === 'explore' ? 'active' : ''}`}>
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M21 21L15 15M17 10C17 13.866 13.866 17 10 17C6.13401 17 3 13.866 3 10C3 6.13401 6.13401 3 10 3C13.866 3 17 6.13401 17 10Z" />
                </svg>
                <span>Explore</span>
            </a>
            <a href="#" className={`mobile-nav-item ${currentPage === 'notifications' ? 'active' : ''}`}>
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M18 8C18 6.4087 17.3679 4.88258 16.2426 3.75736C15.1174 2.63214 13.5913 2 12 2C10.4087 2 8.88258 2.63214 7.75736 3.75736C6.63214 4.88258 6 6.4087 6 8C6 15 3 17 3 17H21C21 17 18 15 18 8Z" />
                </svg>
                <span>Alerts</span>
            </a>
            <a href="#" className={`mobile-nav-item ${currentPage === 'messages' ? 'active' : ''}`}>
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M12 22C17.5228 22 22 17.5228 22 12C22 6.47715 17.5228 2 12 2C6.47715 2 2 6.47715 2 12C2 13.5997 2.37562 15.1116 3.04346 16.4525C3.22094 16.8088 3.28001 17.2161 3.17712 17.6006L2.58151 19.8267C2.32295 20.793 3.20701 21.677 4.17335 21.4185L6.39939 20.8229C6.78393 20.72 7.19121 20.7791 7.54753 20.9565C8.88837 21.6244 10.4003 22 12 22Z" />
                </svg>
                <span>Messages</span>
            </a>
        </nav>
    );
}
