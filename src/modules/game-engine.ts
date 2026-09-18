import { Player, PlayerStats, Rank, Quest, SystemEvent } from '../types.ts';

// Progression Configuration
export const PROGRESSION_CONFIG = {
  // Configurable level threshold table / formula
  getXpThresholdForLevel: (level: number): number => {
    if (level === 1) return 100;
    if (level === 2) return 250;
    if (level === 3) return 500; // Specs: 320 / 500 XP for Lv. 3
    if (level === 4) return 750;
    if (level === 5) return 1050;
    // Generic curve for higher levels
    return Math.round(100 * Math.pow(level, 1.45));
  },

  getRankForLevel: (level: number): Rank => {
    if (level >= 51) return 'S';
    if (level >= 41) return 'A';
    if (level >= 31) return 'B';
    if (level >= 21) return 'C';
    if (level >= 11) return 'D';
    return 'E';
  }
};

// Initial Player template
export const INITIAL_PLAYER_STATE: Player = {
  id: 'player-default',
  displayName: 'ASCENDER 01',
  level: 1,
  xp: 0,
  currentLevelMaxXp: 100,
  rank: 'E',
  stats: {
    STR: 5,
    AGI: 5,
    VIT: 5,
    INT: 5
  },
  streak: 0,
  totalQuestCompleted: 0,
  totalWorkoutMinutes: 0,
  createdAt: new Date().toISOString(),
  lastActiveAt: new Date().toISOString(),
  isDemo: false
};

// Demo Player as strictly requested in specification #35:
// PLAYER: TEST SUBJECT
// LV. 3 | RANK E | XP 320 / 500
// STR 12 | AGI 9 | VIT 14 | INT 7
// STREAK 7
export const DEMO_PLAYER_STATE: Player = {
  id: 'demo-subject',
  displayName: 'TEST SUBJECT',
  level: 3,
  xp: 320,
  currentLevelMaxXp: 500,
  rank: 'E',
  stats: {
    STR: 12,
    AGI: 9,
    VIT: 14,
    INT: 7
  },
  streak: 7,
  totalQuestCompleted: 14,
  totalWorkoutMinutes: 280,
  createdAt: new Date(Date.now() - 7 * 86400000).toISOString(),
  lastActiveAt: new Date().toISOString(),
  isDemo: true
};

export interface CompletionResult {
  player: Player;
  levelUp: boolean;
  rankUp: boolean;
  oldLevel: number;
  newLevel: number;
  oldRank: Rank;
  newRank: Rank;
  xpGained: number;
  statGained: Partial<PlayerStats>;
  systemEvents: SystemEvent[];
}

// Pure backend game engine state transition for Quest Completion
export function processQuestCompletion(player: Player, quest: Quest): CompletionResult {
  const events: SystemEvent[] = [];
  const oldLevel = player.level;
  const oldRank = player.rank;
  const xpGained = quest.xpReward;
  const statGained = quest.statRewards || {};

  let currentXp = player.xp + xpGained;
  let currentLevel = player.level;
  let maxXp = PROGRESSION_CONFIG.getXpThresholdForLevel(currentLevel);

  let levelUp = false;
  while (currentXp >= maxXp) {
    currentXp -= maxXp;
    currentLevel += 1;
    maxXp = PROGRESSION_CONFIG.getXpThresholdForLevel(currentLevel);
    levelUp = true;
  }

  const currentRank = PROGRESSION_CONFIG.getRankForLevel(currentLevel);
  const rankUp = currentRank !== oldRank;

  // Compute new stats
  const newStats: PlayerStats = {
    STR: player.stats.STR + (statGained.STR || 0),
    AGI: player.stats.AGI + (statGained.AGI || 0),
    VIT: player.stats.VIT + (statGained.VIT || 0),
    INT: player.stats.INT + (statGained.INT || 0)
  };

  const newStreak = quest.isPenalty ? player.streak : player.streak + 1;

  // Generate system events
  const now = new Date().toISOString();

  events.push({
    id: `event-${Date.now()}-1`,
    type: 'QUEST_COMPLETED',
    title: `Quest Completed: ${quest.title}`,
    description: `Target verified. Objective fulfilled.`,
    timestamp: now,
    xpChange: xpGained,
    statChange: statGained
  });

  events.push({
    id: `event-${Date.now()}-2`,
    type: 'XP_GAINED',
    title: `+${xpGained} XP Acquired`,
    description: `Assimilation into system matrix.`,
    timestamp: now,
    xpChange: xpGained
  });

  if (Object.keys(statGained).length > 0) {
    const statDesc = Object.entries(statGained)
      .map(([k, v]) => `+${v} ${k}`)
      .join(', ');
    events.push({
      id: `event-${Date.now()}-3`,
      type: 'STAT_INCREASED',
      title: `Physiological Calibration: ${statDesc}`,
      description: `Muscle tissue adapted. Neurological threshold raised.`,
      timestamp: now,
      statChange: statGained
    });
  }

  if (levelUp) {
    events.push({
      id: `event-${Date.now()}-4`,
      type: 'LEVEL_UP',
      title: `LEVEL UP [LV. ${String(oldLevel).padStart(2, '0')} → LV. ${String(currentLevel).padStart(2, '0')}]`,
      description: `Your body has become stronger.`,
      timestamp: now,
      levelChange: { from: oldLevel, to: currentLevel }
    });
  }

  if (rankUp) {
    events.push({
      id: `event-${Date.now()}-5`,
      type: 'RANK_UP',
      title: `RANK ASCENSION [RANK ${oldRank} → RANK ${currentRank}]`,
      description: `System authorization rank elevated.`,
      timestamp: now,
      rankChange: { from: oldRank, to: currentRank }
    });
  }

  if (!quest.isPenalty) {
    events.push({
      id: `event-${Date.now()}-6`,
      type: 'STREAK_INCREASED',
      title: `Streak Maintained: ${newStreak} Days`,
      description: `Discipline is consistency over time.`,
      timestamp: now
    });
  }

  const updatedPlayer: Player = {
    ...player,
    level: currentLevel,
    xp: currentXp,
    currentLevelMaxXp: maxXp,
    rank: currentRank,
    stats: newStats,
    streak: newStreak,
    totalQuestCompleted: player.totalQuestCompleted + 1,
    totalWorkoutMinutes: player.totalWorkoutMinutes + (quest.type === 'VITALITY' ? 25 : 15),
    lastActiveAt: now
  };

  return {
    player: updatedPlayer,
    levelUp,
    rankUp,
    oldLevel,
    newLevel: currentLevel,
    oldRank,
    newRank: currentRank,
    xpGained,
    statGained,
    systemEvents: events
  };
}

// Fallback Quests when Gemini API is unavailable or offline
export const FALLBACK_DAILY_QUESTS: Omit<Quest, 'id' | 'createdAt' | 'status'>[] = [
  {
    title: 'Squat Protocol',
    description: 'Perform 20 controlled squats with full depth.',
    type: 'STRENGTH',
    difficulty: 'EASY',
    target: 20,
    unit: 'reps',
    xpReward: 50,
    statRewards: { VIT: 1, STR: 1 },
    deadline: '21:00'
  },
  {
    title: 'Push Protocol',
    description: 'Complete 20 standard push-ups maintaining strict plank alignment.',
    type: 'STRENGTH',
    difficulty: 'NORMAL',
    target: 20,
    unit: 'reps',
    xpReward: 60,
    statRewards: { STR: 1 },
    deadline: '21:00'
  },
  {
    title: 'Endurance Stasis',
    description: 'Hold a strict isometric plank for 60 seconds.',
    type: 'VITALITY',
    difficulty: 'EASY',
    target: 60,
    unit: 'seconds',
    xpReward: 50,
    statRewards: { VIT: 1 },
    deadline: '21:00'
  },
  {
    title: 'Agility Cadence',
    description: 'Execute 50 jumping jacks at rapid aerobic cadence.',
    type: 'AGILITY',
    difficulty: 'NORMAL',
    target: 50,
    unit: 'reps',
    xpReward: 55,
    statRewards: { AGI: 1 },
    deadline: '21:00'
  },
  {
    title: 'Discipline Hydration & Focus',
    description: 'Drink 500ml water and complete 5 minutes of focused breathing.',
    type: 'DISCIPLINE',
    difficulty: 'EASY',
    target: 5,
    unit: 'minutes',
    xpReward: 40,
    statRewards: { INT: 1 },
    deadline: '21:00'
  }
];

export const PENALTY_QUEST_TEMPLATE: Omit<Quest, 'id' | 'createdAt' | 'status'> = {
  title: 'PENALTY: Recovery Stride',
  description: 'Daily deadline elapsed. Execute a brisk 5-minute walk to re-establish neural connection.',
  type: 'PENALTY',
  difficulty: 'EASY',
  target: 5,
  unit: 'minutes',
  xpReward: 20,
  statRewards: { VIT: 1 },
  deadline: '23:59',
  isPenalty: true
};
