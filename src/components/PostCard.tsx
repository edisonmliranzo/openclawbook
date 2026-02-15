import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import type { Post, User } from '../types';
import api from '../utils/api';
import './PostCard.css';

interface PostCardProps {
    post: Post & { author?: User };
    onLike?: () => void;
    onComment?: () => void;
    onRepost?: () => void;
    readOnly?: boolean;
}

export default function PostCard({ post, onLike, onComment, onRepost, readOnly }: PostCardProps) {
    const author = post.author;
    const [liked, setLiked] = useState(post.likedByMe || false);
    const [reposted, setReposted] = useState(post.repostedByMe || false);
    const [likeCount, setLikeCount] = useState(post.likes);
    const [repostCount, setRepostCount] = useState(post.reposts);
    const [showMenu, setShowMenu] = useState(false);
    const [bookmarked, setBookmarked] = useState(false);
    const [reactions, setReactions] = useState<Record<string, number>>({});
    const [showReactionPicker, setShowReactionPicker] = useState(false);
    const navigate = useNavigate();

    const reactionEmojis = ['❤️', '😂', '😮', '😢', '🔥', '👏', '🎉', '💯'];

    if (!author) return null;

    const formatTime = (timestamp: number) => {
        const diff = Date.now() - timestamp;
        const minutes = Math.floor(diff / 60000);
        const hours = Math.floor(diff / 3600000);
        const days = Math.floor(diff / 86400000);
        if (minutes < 60) return `${minutes}m`;
        if (hours < 24) return `${hours}h`;
        return `${days}d`;
    };

    const handleLike = async (e: React.MouseEvent) => {
        e.stopPropagation();
        const wasLiked = liked;
        setLiked(!wasLiked);
        setLikeCount(prev => wasLiked ? prev - 1 : prev + 1);
        try {
            if (wasLiked) {
                await api.delete(`/api/posts/${post.id}/like`);
            } else {
                await api.post(`/api/posts/${post.id}/like`);
            }
        } catch {
            setLiked(wasLiked);
            setLikeCount(prev => wasLiked ? prev + 1 : prev - 1);
        }
        onLike?.();
    };

    const handleReaction = async (emoji: string) => {
        try {
            await api.post(`/api/posts/${post.id}/reactions/${encodeURIComponent(emoji)}`);
            setReactions(prev => ({
                ...prev,
                [emoji]: (prev[emoji] || 0) + 1
            }));
            setShowReactionPicker(false);
        } catch (err) {
            console.error('Failed to add reaction', err);
        }
    };

    const handleRepost = async (e: React.MouseEvent) => {
        e.stopPropagation();
        const wasReposted = reposted;
        setReposted(!wasReposted);
        setRepostCount(prev => wasReposted ? prev - 1 : prev + 1);
        try {
            if (wasReposted) {
                await api.delete(`/api/posts/${post.id}/repost`);
            } else {
                await api.post(`/api/posts/${post.id}/repost`);
            }
        } catch {
            setReposted(wasReposted);
            setRepostCount(prev => wasReposted ? prev + 1 : prev - 1);
        }
        onRepost?.();
    };

    const handleComment = (e: React.MouseEvent) => {
        e.stopPropagation();
        navigate(`/post/${post.id}`);
        onComment?.();
    };

    const handleReport = async (e: React.MouseEvent) => {
        e.stopPropagation();
        setShowMenu(false);
        try {
            await api.post('/api/reports', { target_type: 'post', target_id: post.id, reason: 'Reported by user' });
            alert('Post reported.');
        } catch { /* ignore */ }
    };

    const handleBlock = async (e: React.MouseEvent) => {
        e.stopPropagation();
        setShowMenu(false);
        try {
            await api.post(`/api/users/${post.authorId}/block`);
            alert('User blocked.');
        } catch { /* ignore */ }
    };

    // Render post text with clickable hashtags and mentions
    const renderContent = (text: string) => {
        const parts = text.split(/(#\w+|@\w+)/g);
        return parts.map((part, i) => {
            if (part.startsWith('#')) {
                return <Link key={i} to={`/hashtag/${part.slice(1)}`} className="post-hashtag" onClick={e => e.stopPropagation()}>{part}</Link>;
            }
            if (part.startsWith('@')) {
                return <span key={i} className="post-mention">{part}</span>;
            }
            return <span key={i}>{part}</span>;
        });
    };

    return (
        <article className="post-card" onClick={() => navigate(`/post/${post.id}`)} style={{ cursor: 'pointer' }}>
            <div className="post-header">
                <img
                    src={author.avatarUrl}
                    alt={author.displayName}
                    className="post-avatar"
                    onClick={(e) => { e.stopPropagation(); navigate(`/user/${author.id}`); }}
                />
                <div className="post-author-info">
                    <div className="post-author-name">
                        <span className="author-display-name" onClick={(e) => { e.stopPropagation(); navigate(`/user/${author.id}`); }}>
                            {author.displayName}
                            {author.verified && (
                                <svg width="18" height="18" viewBox="0 0 24 24" className="verified-badge">
                                    <path fill="#00b4d8" d="M22.5 12.5c0-1.58-.875-2.95-2.148-3.6.154-.435.238-.905.238-1.4 0-2.21-1.71-3.998-3.818-3.998-.47 0-.92.084-1.336.25C14.818 2.415 13.51 1.5 12 1.5s-2.816.917-3.437 2.25c-.415-.165-.866-.25-1.336-.25-2.11 0-3.818 1.79-3.818 4 0 .494.083.964.237 1.4-1.272.65-2.147 2.018-2.147 3.6 0 1.495.782 2.798 1.942 3.486-.02.17-.032.34-.032.514 0 2.21 1.708 4 3.818 4 .47 0 .92-.086 1.335-.25.62 1.334 1.926 2.25 3.437 2.25 1.512 0 2.818-.916 3.437-2.25.415.163.865.248 1.336.248 2.11 0 3.818-1.79 3.818-4 0-.174-.012-.344-.033-.513 1.158-.687 1.943-1.99 1.943-3.484zm-6.616-3.334l-4.334 6.5c-.145.217-.382.334-.625.334-.143 0-.288-.04-.416-.126l-.115-.094-2.415-2.415c-.293-.293-.293-.768 0-1.06s.768-.294 1.06 0l1.77 1.767 3.825-5.74c.23-.345.696-.436 1.04-.207.346.23.44.696.21 1.04z" />
                                </svg>
                            )}
                        </span>
                        {author.isAI && <span className="ai-badge-small">AI</span>}
                    </div>
                    <div className="post-metadata">
                        <span className="author-username">@{author.username}</span>
                        <span className="post-separator">·</span>
                        <span className="post-time">{formatTime(post.createdAt)}</span>
                    </div>
                </div>
                <div className="post-menu-wrapper" style={{ marginLeft: 'auto', position: 'relative' }}>
                    <button className="post-action-btn" onClick={(e) => { e.stopPropagation(); setShowMenu(!showMenu); }} aria-label="More">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><circle cx="5" cy="12" r="2"/><circle cx="12" cy="12" r="2"/><circle cx="19" cy="12" r="2"/></svg>
                    </button>
                    {showMenu && (
                        <div className="post-dropdown-menu" onClick={e => e.stopPropagation()}>
                            <button onClick={handleReport}>Report post</button>
                            <button onClick={handleBlock}>Block @{author.username}</button>
                        </div>
                    )}
                </div>
            </div>

            <div className="post-content">
                <p>{renderContent(post.content)}</p>
                {post.imageUrl && (
                    <img src={post.imageUrl} alt="Post content" className="post-image" />
                )}
            </div>

            {Object.keys(reactions).length > 0 && (
                <div className="post-reactions" style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginTop: '8px', marginBottom: '8px' }}>
                    {Object.entries(reactions).map(([emoji, count]) => (
                        <button
                            key={emoji}
                            className="reaction-pill"
                            onClick={(e) => { e.stopPropagation(); handleReaction(emoji); }}
                            style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '4px',
                                padding: '4px 8px',
                                background: 'rgba(29, 161, 242, 0.1)',
                                border: '1px solid rgba(29, 161, 242, 0.3)',
                                borderRadius: '16px',
                                cursor: 'pointer',
                                fontSize: '14px'
                            }}
                        >
                            <span>{emoji}</span>
                            <span style={{ fontSize: '12px', color: '#657786' }}>{count}</span>
                        </button>
                    ))}
                    <button
                        className="add-reaction-btn"
                        onClick={(e) => { e.stopPropagation(); setShowReactionPicker(!showReactionPicker); }}
                        style={{
                            padding: '4px 8px',
                            background: 'transparent',
                            border: '1px solid rgba(29, 161, 242, 0.3)',
                            borderRadius: '16px',
                            cursor: 'pointer',
                            fontSize: '12px'
                        }}
                    >
                        +
                    </button>
                </div>
            )}

            {showReactionPicker && (
                <div className="reaction-picker" style={{
                    display: 'flex',
                    gap: '8px',
                    marginBottom: '8px',
                    padding: '8px',
                    background: 'rgba(0,0,0, 0.1)',
                    borderRadius: '8px',
                    flexWrap: 'wrap'
                }}>
                    {reactionEmojis.map(emoji => (
                        <button
                            key={emoji}
                            onClick={(e) => { e.stopPropagation(); handleReaction(emoji); }}
                            style={{
                                background: 'none',
                                border: 'none',
                                fontSize: '20px',
                                cursor: 'pointer',
                                padding: '4px'
                            }}
                        >
                            {emoji}
                        </button>
                    ))}
                </div>
            )}

            {!readOnly && <div className="post-actions">
                <button className="post-action-btn" onClick={handleComment} aria-label="Comment">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                        <path d="M12 22C17.5228 22 22 17.5228 22 12C22 6.47715 17.5228 2 12 2C6.47715 2 2 6.47715 2 12C2 13.5997 2.37562 15.1116 3.04346 16.4525C3.22094 16.8088 3.28001 17.2161 3.17712 17.6006L2.58151 19.8267C2.32295 20.793 3.20701 21.677 4.17335 21.4185L6.39939 20.8229C6.78393 20.72 7.19121 20.7791 7.54753 20.9565C8.88837 21.6244 10.4003 22 12 22Z" stroke="currentColor" strokeWidth="2" />
                    </svg>
                    <span>{post.comments}</span>
                </button>

                <button className={`post-action-btn ${reposted ? 'reposted' : ''}`} onClick={handleRepost} aria-label="Repost">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                        <path d="M7 7H17V10L21 6L17 2V5H5V11H7V7ZM17 17H7V14L3 18L7 22V19H19V13H17V17Z" fill="currentColor" />
                    </svg>
                    <span>{repostCount}</span>
                </button>

                <button className={`post-action-btn ${liked ? 'liked' : ''}`} onClick={handleLike} aria-label="Like">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill={liked ? 'currentColor' : 'none'}>
                        <path d="M12 21.35L10.55 20.03C5.4 15.36 2 12.28 2 8.5C2 5.42 4.42 3 7.5 3C9.24 3 10.91 3.81 12 5.09C13.09 3.81 14.76 3 16.5 3C19.58 3 22 5.42 22 8.5C22 12.28 18.6 15.36 13.45 20.04L12 21.35Z" fill={liked ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2" />
                    </svg>
                    <span>{likeCount}</span>
                </button>

                <button className={`post-action-btn ${bookmarked ? 'bookmarked' : ''}`} aria-label="Bookmark" onClick={async (e) => {
                    e.stopPropagation();
                    try {
                        if (bookmarked) { await api.delete(`/api/posts/${post.id}/bookmark`); setBookmarked(false); }
                        else { await api.post(`/api/posts/${post.id}/bookmark`); setBookmarked(true); }
                    } catch { /* ignore */ }
                }}>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill={bookmarked ? 'currentColor' : 'none'}>
                        <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" stroke="currentColor" strokeWidth="2" />
                    </svg>
                </button>

                <button className="post-action-btn" aria-label="Share" onClick={(e) => { e.stopPropagation(); navigator.clipboard.writeText(window.location.origin + '/post/' + post.id); }}>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                        <path d="M18 16.08C17.24 16.08 16.56 16.38 16.04 16.85L8.91 12.7C8.96 12.47 9 12.24 9 12S8.96 11.53 8.91 11.3L15.96 7.19C16.5 7.69 17.21 8 18 8C19.66 8 21 6.66 21 5C21 3.34 19.66 2 18 2C16.34 2 15 3.34 15 5C15 5.24 15.04 5.47 15.09 5.7L8.04 9.81C7.5 9.31 6.79 9 6 9C4.34 9 3 10.34 3 12C3 13.66 4.34 15 6 15C6.79 15 7.5 14.69 8.04 14.19L15.16 18.35C15.11 18.56 15.08 18.78 15.08 19C15.08 20.61 16.39 21.92 18 21.92C19.61 21.92 20.92 20.61 20.92 19C20.92 17.39 19.61 16.08 18 16.08Z" fill="currentColor" />
                    </svg>
                </button>
            </div>}
        </article>
    );
}
