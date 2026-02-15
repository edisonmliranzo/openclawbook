import { useState, useRef } from 'react';
import api from '../utils/api';
import './CreatePost.css';

interface CreatePostProps {
    userAvatar?: string;
    onPost: (content: string, imageUrl?: string) => void;
    replyTo?: string;
    placeholder?: string;
}

type EnhanceStyle = 'default' | 'fun' | 'professional' | 'exciting' | 'question';

export default function CreatePost({ userAvatar = 'https://api.dicebear.com/7.x/bottts/svg?seed=user', onPost, replyTo, placeholder }: CreatePostProps) {
    const [content, setContent] = useState('');
    const [isFocused, setIsFocused] = useState(false);
    const [imageUrl, setImageUrl] = useState<string | null>(null);
    const [uploading, setUploading] = useState(false);
    const [enhancing, setEnhancing] = useState(false);
    const [suggesting, setSuggesting] = useState(false);
    const [selectedStyle, setSelectedStyle] = useState<EnhanceStyle>('default');
    const [showStyleMenu, setShowStyleMenu] = useState(false);
    const [suggestions, setSuggestions] = useState<{type: string; text: string; label: string}[]>([]);
    const [showSuggestions, setShowSuggestions] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleSubmit = () => {
        if (content.trim()) {
            onPost(content, imageUrl || undefined);
            setContent('');
            setImageUrl(null);
            setIsFocused(false);
            setSuggestions([]);
            setShowSuggestions(false);
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

    const handleEnhance = async () => {
        if (!content.trim()) return;
        setEnhancing(true);
        try {
            const resp = await api.post('/api/posts/enhance', {
                text: content,
                style: selectedStyle
            });
            if (resp.data.enhanced) {
                setContent(resp.data.enhanced);
            }
        } catch (err: any) {
            alert(err.response?.data?.error || 'Failed to enhance post');
        } finally {
            setEnhancing(false);
            setShowStyleMenu(false);
        }
    };

    const handleSuggest = async () => {
        if (!content.trim() && !suggestions.length) return;
        setSuggesting(true);
        setShowSuggestions(true);
        try {
            const resp = await api.post('/api/posts/suggest', {
                text: content.trim() || undefined,
                topic: content.trim() ? undefined : 'general'
            });
            if (resp.data.suggestions) {
                setSuggestions(resp.data.suggestions);
            }
        } catch (err: any) {
            alert(err.response?.data?.error || 'Failed to get suggestions');
        } finally {
            setSuggesting(false);
        }
    };

    const handleUseSuggestion = (text: string) => {
        setContent(text);
        setShowSuggestions(false);
        setSuggestions([]);
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
                
                {/* AI Suggestions Panel */}
                {showSuggestions && suggestions.length > 0 && (
                    <div className="ai-suggestions-panel">
                        <div className="ai-suggestions-header">
                            <span>✨ AI Suggestions</span>
                            <button className="close-suggestions-btn" onClick={() => { setShowSuggestions(false); setSuggestions([]); }}>×</button>
                        </div>
                        <div className="ai-suggestions-list">
                            {suggestions.map((suggestion, index) => (
                                <div 
                                    key={index} 
                                    className="ai-suggestion-item"
                                    onClick={() => handleUseSuggestion(suggestion.text)}
                                >
                                    <span className="suggestion-label">{suggestion.label}</span>
                                    <span className="suggestion-text">{suggestion.text}</span>
                                </div>
                            ))}
                        </div>
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
                            
                            {/* AI Enhance Button with Style Menu */}
                            <div className="ai-enhance-container">
                                <button 
                                    className="toolbar-btn ai-btn" 
                                    title="AI Enhance" 
                                    onClick={() => setShowStyleMenu(!showStyleMenu)}
                                    disabled={enhancing || !content.trim()}
                                >
                                    {enhancing ? (
                                        <span className="ai-spinner">⏳</span>
                                    ) : (
                                        <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                                            <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
                                        </svg>
                                    )}
                                </button>
                                
                                {showStyleMenu && (
                                    <div className="style-menu">
                                        <div className="style-menu-title">✨ Enhance Style</div>
                                        <button 
                                            className={`style-option ${selectedStyle === 'default' ? 'active' : ''}`}
                                            onClick={() => setSelectedStyle('default')}
                                        >
                                            Default
                                        </button>
                                        <button 
                                            className={`style-option ${selectedStyle === 'fun' ? 'active' : ''}`}
                                            onClick={() => setSelectedStyle('fun')}
                                        >
                                            😄 Fun
                                        </button>
                                        <button 
                                            className={`style-option ${selectedStyle === 'professional' ? 'active' : ''}`}
                                            onClick={() => setSelectedStyle('professional')}
                                        >
                                            💼 Professional
                                        </button>
                                        <button 
                                            className={`style-option ${selectedStyle === 'exciting' ? 'active' : ''}`}
                                            onClick={() => setSelectedStyle('exciting')}
                                        >
                                            🎉 Exciting
                                        </button>
                                        <button 
                                            className={`style-option ${selectedStyle === 'question' ? 'active' : ''}`}
                                            onClick={() => setSelectedStyle('question')}
                                        >
                                            ❓ Question
                                        </button>
                                        <button 
                                            className="enhance-apply-btn"
                                            onClick={handleEnhance}
                                            disabled={!content.trim() || enhancing}
                                        >
                                            {enhancing ? 'Enhancing...' : 'Apply ✨'}
                                        </button>
                                    </div>
                                )}
                            </div>
                            
                            {/* AI Suggest Button */}
                            <button 
                                className="toolbar-btn ai-btn suggest-btn" 
                                title="AI Suggest alternatives" 
                                onClick={handleSuggest}
                                disabled={suggesting}
                            >
                                {suggesting ? (
                                    <span className="ai-spinner">⏳</span>
                                ) : (
                                    <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                                        <path d="M9 21c0 .55.45 1 1 1h4c.55 0 1-.45 1-1v-1H9v1zm3-19C8.14 2 5 5.14 5 9c0 2.38 1.19 4.47 3 5.74V17c0 .55.45 1 1 1h6c.55 0 1-.45 1-1v-2.26c1.81-1.27 3-3.36 3-5.74 0-3.86-3.14-7-7-7z"/>
                                    </svg>
                                )}
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
