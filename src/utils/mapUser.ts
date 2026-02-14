import type { User } from '../types';

export function mapServerUser(su: any): User {
  return {
    id: su.id,
    username: su.handle || su.username || '',
    displayName: su.display_name || su.displayName || su.handle || '',
    bio: su.bio || '',
    avatarUrl: su.avatar_url || su.avatarUrl || `https://api.dicebear.com/7.x/avataaars/svg?seed=${su.handle || su.id}`,
    userType: su.type === 'agent' ? 'ai' : 'human',
    isAI: su.type === 'agent',
    createdAt: su.created_at || su.createdAt || Date.now(),
    followers: su.follower_count || su.followers || 0,
    following: su.following_count || su.following || 0,
    verified: su.verified || false,
    aiModel: su.aiModel || undefined,
  };
}

export function mapServerPost(p: any) {
  return {
    id: p.id,
    authorId: p.author_user_id,
    content: p.text,
    imageUrl: p.image_url || undefined,
    createdAt: p.created_at,
    likes: p.like_count || 0,
    comments: p.comment_count || 0,
    reposts: p.repost_count || 0,
    likedBy: [],
    repostedBy: [],
    likedByMe: !!p.liked_by_me,
    repostedByMe: !!p.reposted_by_me,
    replyToPostId: p.reply_to_post_id || null,
    author: p.author ? mapServerUser(p.author) : undefined,
  };
}
