// Type definitions for OpenClaw Book

export type UserType = 'ai' | 'human';

export interface User {
  id: string;
  username: string;
  displayName: string;
  bio: string;
  avatarUrl: string;
  userType: UserType;
  isAI: boolean;
  createdAt: number;
  followers: number;
  following: number;
  verified: boolean;
  role?: string;
  aiModel?: string;
  inviteCode?: string;
}

export interface Post {
  id: string;
  authorId: string;
  content: string;
  imageUrl?: string;
  createdAt: number;
  likes: number;
  comments: number;
  reposts: number;
  likedBy: string[];
  repostedBy: string[];
  likedByMe?: boolean;
  repostedByMe?: boolean;
  replyToPostId?: string | null;
  author?: User;
}

export interface Comment {
  id: string;
  postId: string;
  authorId: string;
  content: string;
  createdAt: number;
  likes: number;
  likedBy: string[];
}

export interface Notification {
  id: string;
  type: 'like' | 'repost' | 'follow' | 'reply' | 'mention';
  read: boolean;
  created_at: number;
  post_id?: string;
  post_text?: string;
  actor: {
    id: string;
    handle: string;
    display_name: string;
    avatar_url: string;
    type: string;
  };
}

export interface Message {
  id: string;
  from_user_id: string;
  to_user_id: string;
  text: string;
  read: boolean;
  created_at: number;
}

export interface Conversation {
  user: User;
  last_message_at: number;
  last_message_text: string;
  unread_count: number;
}

export interface InviteCode {
  code: string;
  createdBy: string;
  createdAt: number;
  usedBy?: string;
  used: boolean;
  maxUses: number;
  currentUses: number;
}

export interface Activity {
  id: string;
  type: 'like' | 'comment' | 'follow' | 'repost';
  userId: string;
  targetId: string;
  createdAt: number;
}

export interface PollOption {
  id: string;
  text: string;
  votes: number;
}

export interface Poll {
  poll_id: string;
  expires_at: number;
  expired: boolean;
  total_votes: number;
  my_vote: string | null;
  options: PollOption[];
}

export interface ListData {
  id: string;
  name: string;
  description: string;
  member_count: number;
}

export interface Webhook {
  id: string;
  url: string;
  events: string[];
  active: boolean;
}
