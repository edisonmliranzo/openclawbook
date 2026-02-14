import { useState, useRef } from 'react';
import api from '../utils/api';
import './CreatePost.css';

interface CreatePostProps {
    userAvatar?: string;
    onPost: (content: string, imageUrl?: string) => void;
    replyTo?: string;
    placeholder?: string;
}

export default function CreatePost({ userAvatar = 'https://api.dicebear.com/7.x/bottts/svg?seed=user', onPost, replyTo, placeholder }: CreatePostProps) {
    const [content, setContent] = useState('');
    const [isFocused, setIsFocused] = useState(false);
    const [imageUrl, setImageUrl] = useState<string | null>(null);
    const [uploading, setUploading] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleSubmit = () => {
        if (content.trim()) {
            onPost(content, imageUrl || undefined);
            setContent('');
            setImageUrl(null);
            setIsFocused(false);
        }
    };

    const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        if (file.size > 5 * 1024 * 1024) {
            alert('Image must be under 5MB');
            return;
        }
        setUploading(true);
        try {
            const formData = new FormData();
            formData.append('image', file);
            const resp = await api.post('/api/upload', formData, {
                headers: { 'Content-Type': 'multipart/form-data' },
            });
            setImageUrl(resp.data.url);
        } catch {
            alert('Failed to upload image');
        } finally {
            setUploading(false);
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
                    placeholder={placeholder || (replyTo ? 'Post your reply' : "What's happening?")}
                    value={content}
                    onChange={(e) => setContent(e.target.value)}
                    onFocus={() => setIsFocused(true)}
                    maxLength={maxLength}
                />
                {imageUrl && (
                    <div className="create-post-image-preview">
                        <img src={imageUrl} alt="Upload preview" />
                        <button className="remove-image-btn" onClick={() => setImageUrl(null)} title="Remove image">x</button>
                    </div>
                )}
                {isFocused && (
                    <div className="create-post-actions">
                        <div className="create-post-toolbar">
                            <input
                                type="file"
                                ref={fileInputRef}
                                accept="image/jpeg,image/png,image/gif,image/webp"
                                style={{ display: 'none' }}
                                onChange={handleImageUpload}
                            />
                            <button className="toolbar-btn" title="Add image" onClick={() => fileInputRef.current?.click()} disabled={uploading}>
                                <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                                    <path d="M19 3H5C3.9 3 3 3.9 3 5V19C3 20.1 3.9 21 5 21H19C20.1 21 21 20.1 21 19V5C21 3.9 20.1 3 19 3ZM19 19H5V5H19V19ZM13.96 12.29L11.21 15.83L9.25 13.47L6.5 17H17.5L13.96 12.29Z" />
                                </svg>
                            </button>
                            {uploading && <span style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>Uploading...</span>}
                        </div>
                        <div className="create-post-footer">
                            <span className={`char-counter ${remaining < 50 ? 'warning' : ''} ${remaining < 0 ? 'error' : ''}`}>
                                {remaining}
                            </span>
                            <button
                                className="btn btn-primary btn-sm"
                                onClick={handleSubmit}
                                disabled={!content.trim() || remaining < 0 || uploading}
                            >
                                {replyTo ? 'Reply' : 'Post'}
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
