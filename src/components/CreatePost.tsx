import { useState } from 'react';
import './CreatePost.css';

interface CreatePostProps {
    userAvatar?: string;
    onPost: (content: string) => void;
}

export default function CreatePost({ userAvatar = 'https://api.dicebear.com/7.x/bottts/svg?seed=user', onPost }: CreatePostProps) {
    const [content, setContent] = useState('');
    const [isFocused, setIsFocused] = useState(false);

    const handleSubmit = () => {
        if (content.trim()) {
            onPost(content);
            setContent('');
            setIsFocused(false);
        }
    };

    const maxLength = 500;
    const remaining = maxLength - content.length;

    return (
        <div className={`create-post ${isFocused ? 'focused' : ''}`}>
            <img src={userAvatar} alt="Your avatar" className="create-post-avatar" />
            <div className="create-post-content">
                <textarea
                    className="create-post-textarea"
                    placeholder="What's happening?"
                    value={content}
                    onChange={(e) => setContent(e.target.value)}
                    onFocus={() => setIsFocused(true)}
                    maxLength={maxLength}
                />
                {isFocused && (
                    <div className="create-post-actions">
                        <div className="create-post-toolbar">
                            <button className="toolbar-btn" title="Add image">
                                <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                                    <path d="M19 3H5C3.9 3 3 3.9 3 5V19C3 20.1 3.9 21 5 21H19C20.1 21 21 20.1 21 19V5C21 3.9 20.1 3 19 3ZM19 19H5V5H19V19ZM13.96 12.29L11.21 15.83L9.25 13.47L6.5 17H17.5L13.96 12.29Z" />
                                </svg>
                            </button>
                            <button className="toolbar-btn" title="Add emoji">
                                <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                                    <path d="M12 2C6.48 2 2 6.48 2 12C2 17.52 6.48 22 12 22C17.52 22 22 17.52 22 12C22 6.48 17.52 2 12 2ZM12 20C7.59 20 4 16.41 4 12C4 7.59 7.59 4 12 4C16.41 4 20 7.59 20 12C20 16.41 16.41 20 12 20ZM15.5 11C16.33 11 17 10.33 17 9.5C17 8.67 16.33 8 15.5 8C14.67 8 14 8.67 14 9.5C14 10.33 14.67 11 15.5 11ZM8.5 11C9.33 11 10 10.33 10 9.5C10 8.67 9.33 8 8.5 8C7.67 8 7 8.67 7 9.5C7 10.33 7.67 11 8.5 11ZM12 17.5C14.33 17.5 16.31 16.04 17.11 14H6.89C7.69 16.04 9.67 17.5 12 17.5Z" />
                                </svg>
                            </button>
                        </div>
                        <div className="create-post-footer">
                            <span className={`char-counter ${remaining < 50 ? 'warning' : ''} ${remaining < 0 ? 'error' : ''}`}>
                                {remaining}
                            </span>
                            <button
                                className="btn btn-primary btn-sm"
                                onClick={handleSubmit}
                                disabled={!content.trim() || remaining < 0}
                            >
                                Post
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
