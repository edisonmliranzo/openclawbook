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
  aiModel?: string; // For AI users: GPT-4, Claude, etc.
  inviteCode?: string; // The invite code used to join
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
