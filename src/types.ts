export type Rank = 'E' | 'D' | 'C' | 'B' | 'A' | 'S';

export interface PlayerStats {
  STR: number;
  AGI: number;
  VIT: number;
  INT: number;
}

export interface ActiveDebuff {
  name: string;
  description: string;
  appliedAt: string;
  xpMultiplier: number;
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
  // Solo Leveling Core Mechanics
  hp: number;
  maxHp: number;
  stamina: number;
  maxStamina: number;
  statPoints: number;
  lastHpDrainAt: string;
  stepsToday: number;
  heartRate: number;
  caloriesBurned: number;
  isPenaltyZone: boolean;
  // System Debuff & Penalty Tracking (Feature 3)
  activeDebuff?: ActiveDebuff;
  missedDeadlineStreak: number;
  // LINE Authentication & Onboarding
  lineUserId?: string;
  lineDisplayName?: string;
  linePictureUrl?: string;
  isLineConnected?: boolean;
  isRegistered?: boolean;
  fitnessGoal?: 'FAT_LOSS' | 'MUSCLE_GAIN' | 'ENDURANCE' | 'SOLO_LEVELING';
  weightKg?: number;
  heightCm?: number;
  // Feature 2: Boss Quest & Achievements
  weeklyBossesCleared?: number;
  titles?: string[];
  badges?: string[];
}

export type QuestDifficulty = 'EASY' | 'NORMAL' | 'HARD' | 'ELITE';

export type QuestStatus = 'AVAILABLE' | 'IN_PROGRESS' | 'COMPLETED' | 'EXPIRED' | 'CANCELLED' | 'RESTED';

export type QuestType = 'STRENGTH' | 'AGILITY' | 'VITALITY' | 'DISCIPLINE' | 'PENALTY' | 'EMERGENCY';

export interface QuestStep {
  id: string;
  name: string;
  targetReps?: number;
  targetSeconds?: number;
  sets?: number;
  completed: boolean;
}

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
  isEmergency?: boolean;
  isWeeklyBoss?: boolean;
  steps?: QuestStep[];
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
  | 'PENALTY_CREATED'
  | 'HP_DRAINED'
  | 'HP_RESTORED'
  | 'PENALTY_SURVIVED'
  | 'STAT_ALLOCATED'
  | 'EMERGENCY_QUEST'
  | 'STATUS_SYNC'
  | 'RANK_DOWN'
  | 'DEBUFF_APPLIED'
  | 'REST_DAY_ACTIVATED'
  | 'EMERGENCY_QUEST_CREATED'
  | 'EMERGENCY_QUEST_COMPLETED'
  | 'BOSS_QUEST_CREATED'
  | 'BOSS_QUEST_COMPLETED'
  | 'RANK_UP_DRAMATIC'
  | 'REFLECTION_EVALUATED';

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

export interface PendingReminder {
  id: string;
  userId: string;
  remindAt: string; // ISO datetime
  message: string;
  sent: boolean;
}
