export type Rank = 'E' | 'D' | 'C' | 'B' | 'A' | 'S';

export interface PlayerStats {
  STR: number;
  AGI: number;
  VIT: number;
  INT: number;
}

export interface Player {
  id: string;
  displayName: string;
  photoURL?: string;
  level: number;
  xp: number;
  currentLevelMaxXp: number;
  rank: Rank;
  stats: PlayerStats;
  streak: number;
  totalQuestCompleted: number;
  totalWorkoutMinutes: number;
  createdAt: string;
  lastActiveAt: string;
  isDemo?: boolean;
}

export type QuestDifficulty = 'EASY' | 'NORMAL' | 'HARD' | 'ELITE';

export type QuestStatus = 'AVAILABLE' | 'IN_PROGRESS' | 'COMPLETED' | 'EXPIRED' | 'CANCELLED';

export type QuestType = 'STRENGTH' | 'AGILITY' | 'VITALITY' | 'DISCIPLINE' | 'PENALTY';

export interface Quest {
  id: string;
  title: string;
  description: string;
  type: QuestType;
  difficulty: QuestDifficulty;
  target: number;
  unit: string;
  xpReward: number;
  statRewards: Partial<PlayerStats>;
  deadline: string; // ISO string or time e.g. "21:00"
  status: QuestStatus;
  createdAt: string;
  completedAt?: string;
  isPenalty?: boolean;
}

export type SystemEventType =
  | 'QUEST_CREATED'
  | 'QUEST_STARTED'
  | 'QUEST_COMPLETED'
  | 'QUEST_EXPIRED'
  | 'XP_GAINED'
  | 'LEVEL_UP'
  | 'RANK_UP'
  | 'STAT_INCREASED'
  | 'STREAK_INCREASED'
  | 'STREAK_MAINTAINED'
  | 'SYSTEM_WARNING'
  | 'PENALTY_CREATED';

export interface SystemEvent {
  id: string;
  type: SystemEventType;
  title: string;
  description: string;
  timestamp: string;
  xpChange?: number;
  statChange?: Partial<PlayerStats>;
  levelChange?: { from: number; to: number };
  rankChange?: { from: Rank; to: Rank };
}

export interface WorkoutLog {
  id: string;
  title: string;
  durationMinutes: number;
  xpEarned: number;
  statsEarned: Partial<PlayerStats>;
  date: string;
  source: 'WEB' | 'LINE';
}

export interface SystemLevelUpEvent {
  oldLevel: number;
  newLevel: number;
  oldRank: Rank;
  newRank: Rank;
  message: string;
}

export interface LineFlexMessage {
  type: 'flex';
  altText: string;
  contents: Record<string, any>;
}
