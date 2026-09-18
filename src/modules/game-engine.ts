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
  },

  calculateMaxHp: (vit: number): number => {
    return 100 + (vit || 0) * 10;
  },

  calculateMaxStamina: (agi: number): number => {
    return 100 + (agi || 0) * 5;
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
  hp: 150,
  maxHp: 150,
  stamina: 125,
  maxStamina: 125,
  statPoints: 0,
  lastHpDrainAt: new Date().toISOString(),
  stepsToday: 0,
  heartRate: 72,
  caloriesBurned: 0,
  isPenaltyZone: false,
  streak: 0,
  totalQuestCompleted: 0,
  totalWorkoutMinutes: 0,
  createdAt: new Date().toISOString(),
  lastActiveAt: new Date().toISOString(),
  missedDeadlineStreak: 0,
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
  hp: 195,
  maxHp: 240, // 100 + 14 * 10
  stamina: 120,
  maxStamina: 145, // 100 + 9 * 5
  statPoints: 3, // Ready for user to allocate
  lastHpDrainAt: new Date().toISOString(),
  stepsToday: 4850,
  heartRate: 76,
  caloriesBurned: 345,
  isPenaltyZone: false,
  streak: 7,
  totalQuestCompleted: 14,
  totalWorkoutMinutes: 280,
  createdAt: new Date(Date.now() - 7 * 86400000).toISOString(),
  lastActiveAt: new Date().toISOString(),
  missedDeadlineStreak: 0,
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

  // Feature 3: Active Debuff Check (weakened penalty multiplies XP reward, e.g. 0.5)
  const debuffMult = player.activeDebuff ? player.activeDebuff.xpMultiplier : 1;
  const baseReward = Math.round(quest.xpReward * debuffMult);

  // STR Mechanic: Increases EXP gained from strength workouts (+2.5% per STR point)
  const strBonusMult = quest.type === 'STRENGTH' ? 1 + (player.stats.STR * 0.025) : 1;
  const xpGained = Math.round(baseReward * strBonusMult);
  const statGained = quest.statRewards || {};

  let currentXp = player.xp + xpGained;
  let currentLevel = player.level;
  let maxXp = PROGRESSION_CONFIG.getXpThresholdForLevel(currentLevel);

  let levelUp = false;
  let levelsGained = 0;
  while (currentXp >= maxXp) {
    currentXp -= maxXp;
    currentLevel += 1;
    levelsGained += 1;
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

  // VIT Mechanic: Increases the Max HP bar
  const newMaxHp = PROGRESSION_CONFIG.calculateMaxHp(newStats.VIT);
  const newMaxStamina = PROGRESSION_CONFIG.calculateMaxStamina(newStats.AGI);

  // HP Recovery: Completing physical activity restores HP
  const hpRestored = quest.isPenalty
    ? newMaxHp
    : Math.round(40 + player.stats.AGI * 1.5);
  const updatedHp = quest.isPenalty ? newMaxHp : Math.min(newMaxHp, (player.hp || 0) + hpRestored);

  // Progression: Leveling up grants 3 Stat Points per level gained
  const statPointsEarned = levelsGained * 3;
  const updatedStatPoints = (player.statPoints || 0) + statPointsEarned;

  const newStreak = quest.isPenalty ? player.streak : player.streak + 1;
  const now = new Date().toISOString();

  events.push({
    id: `event-${Date.now()}-1`,
    type: 'QUEST_COMPLETED',
    title: `Quest Completed: ${quest.title}`,
    description: `Target verified. Objective fulfilled. HP Restored (+${hpRestored} HP).`,
    timestamp: now,
    xpChange: xpGained,
    statChange: statGained
  });

  events.push({
    id: `event-${Date.now()}-2`,
    type: 'XP_GAINED',
    title: `+${xpGained} XP Acquired${strBonusMult > 1 ? ` [STR Bonus x${strBonusMult.toFixed(2)}]` : ''}`,
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
      description: `Your body has become stronger. +${statPointsEarned} Stat Points acquired.`,
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

  if (quest.isPenalty) {
    events.push({
      id: `event-${Date.now()}-7`,
      type: 'PENALTY_SURVIVED',
      title: `[PENALTY ZONE ESCAPED]`,
      description: `Biological stasis averted. Vital signs restored to 100%.`,
      timestamp: now
    });
  }

  if (player.activeDebuff) {
    events.push({
      id: `event-${Date.now()}-debuff-cleansed`,
      type: 'STATUS_SYNC',
      title: `[PENALTY CLEANSED: ${player.activeDebuff.name}]`,
      description: `Quest completed under weakened penalty state. Debuff cleansed. Normal 100% XP rate restored.`,
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
    hp: updatedHp,
    maxHp: newMaxHp,
    stamina: Math.min(newMaxStamina, (player.stamina || 0) + 25),
    maxStamina: newMaxStamina,
    statPoints: updatedStatPoints,
    isPenaltyZone: false,
    activeDebuff: undefined,
    missedDeadlineStreak: 0,
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

// 1. Hourly HP Drain Calculation
export function applyHpDrain(player: Player, hours: number = 1): { player: Player; drained: number; enteredPenalty: boolean } {
  // Standard drain: 5 HP per hour (or adjusted by elapsed time)
  const drainAmount = Math.max(1, Math.round(5 * hours));
  const currentHp = player.hp ?? player.maxHp ?? PROGRESSION_CONFIG.calculateMaxHp(player.stats.VIT);
  const newHp = Math.max(0, currentHp - drainAmount);
  const enteredPenalty = newHp === 0;

  const updatedPlayer: Player = {
    ...player,
    hp: newHp,
    maxHp: PROGRESSION_CONFIG.calculateMaxHp(player.stats.VIT),
    isPenaltyZone: enteredPenalty || player.isPenaltyZone,
    lastHpDrainAt: new Date().toISOString()
  };

  return {
    player: updatedPlayer,
    drained: drainAmount,
    enteredPenalty
  };
}

// 2. Stat Points Allocation
export function allocatePlayerStat(
  player: Player,
  stat: keyof PlayerStats,
  points: number = 1
): { player: Player; success: boolean; message: string } {
  if (player.statPoints < points) {
    return { player, success: false, message: 'Insufficient Stat Points available.' };
  }

  const newStats: PlayerStats = {
    ...player.stats,
    [stat]: player.stats[stat] + points
  };

  const newMaxHp = PROGRESSION_CONFIG.calculateMaxHp(newStats.VIT);
  const newMaxStamina = PROGRESSION_CONFIG.calculateMaxStamina(newStats.AGI);

  // If VIT increases, HP pool expands proportionally
  const hpBonus = stat === 'VIT' ? points * 10 : 0;

  const updatedPlayer: Player = {
    ...player,
    stats: newStats,
    statPoints: player.statPoints - points,
    maxHp: newMaxHp,
    hp: Math.min(newMaxHp, (player.hp || 0) + hpBonus),
    maxStamina: newMaxStamina
  };

  return {
    player: updatedPlayer,
    success: true,
    message: `[STAT ALLOCATED]\n+${points} ${stat}. Current: ${newStats[stat]}.`
  };
}

// 3. Apple HealthKit / Google Fit Integration & HP Recovery
// AGI increases HP recovered per step taken
export function syncHealthKitData(
  player: Player,
  data: { steps: number; heartRate?: number; calories?: number }
): { player: Player; hpRecovered: number } {
  const stepsDelta = Math.max(0, data.steps - (player.stepsToday || 0));
  // Recovery formula: Every 200 steps restores (1 + AGI * 0.1) HP
  const hpRecovered = Math.round((stepsDelta / 200) * (1 + (player.stats.AGI || 5) * 0.1));
  const maxHp = player.maxHp || PROGRESSION_CONFIG.calculateMaxHp(player.stats.VIT);
  const newHp = Math.min(maxHp, (player.hp || 0) + hpRecovered);

  const updatedPlayer: Player = {
    ...player,
    stepsToday: data.steps,
    heartRate: data.heartRate || player.heartRate || 74,
    caloriesBurned: (player.caloriesBurned || 0) + (data.calories || 0),
    hp: newHp,
    isPenaltyZone: newHp > 0 ? false : player.isPenaltyZone,
    lastActiveAt: new Date().toISOString()
  };

  return {
    player: updatedPlayer,
    hpRecovered
  };
}

// 4. Emergency Quest Generator
export function createEmergencyQuest(player: Player): Quest {
  return {
    id: `quest-emergency-${Date.now()}`,
    title: 'EMERGENCY QUEST: SURVIVAL SPRINT (วิ่งหนีเอาชีวิตรอด)',
    description: 'ตรวจพบสภาวะร่างกายหยุดนิ่งจนเสี่ยงต่ออันตราย ต้องเดินหรือวิ่งให้ครบ 500 ก้าวภายใน 10 นาทีเพื่อหลีกเลี่ยง Penalty Zone',
    type: 'EMERGENCY',
    difficulty: 'HARD',
    target: 500,
    unit: 'steps',
    xpReward: 120,
    statRewards: { AGI: 2, VIT: 1 },
    deadline: new Date(Date.now() + 10 * 60000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    status: 'AVAILABLE',
    createdAt: new Date().toISOString(),
    isEmergency: true,
    steps: [
      { id: 'em-step-1', name: 'เดินเร็วหรือวิ่งจ๊อกกิ้งเร่งฝีเท้า', targetReps: 500, sets: 1, completed: false }
    ]
  };
}

// 5. Penalty Quest (Solo Leveling Penalty Zone Survival)
export function createPenaltyZoneQuest(): Quest {
  return {
    id: `quest-penalty-${Date.now()}`,
    title: 'PENALTY QUEST: SURVIVE THE CENTIPEDES (เอาชีวิตรอดในโซนลงโทษ)',
    description: 'ค่า HP ลดลงเหลือ 0 คุณถูกเทเลพอร์ตเข้าสู่ Penalty Zone ต้องวิดพื้น 25 ครั้ง และสควอท 25 ครั้ง เพื่อปลดล็อกระบบและฟื้นฟูพลังชีวิต',
    type: 'PENALTY',
    difficulty: 'ELITE',
    target: 50,
    unit: 'reps',
    xpReward: 30,
    statRewards: { STR: 1, VIT: 2 },
    deadline: 'IMMOBILIZED',
    status: 'IN_PROGRESS',
    createdAt: new Date().toISOString(),
    isPenalty: true,
    steps: [
      { id: 'pen-step-1', name: 'วิดพื้นฉุกเฉิน (Survival Push-ups)', targetReps: 25, sets: 1, completed: false },
      { id: 'pen-step-2', name: 'สควอทเร่งด่วน (Emergency Squats)', targetReps: 25, sets: 1, completed: false }
    ]
  };
}

// Fallback Quests when Gemini API is unavailable or offline
export const FALLBACK_DAILY_QUESTS: Omit<Quest, 'id' | 'createdAt' | 'status'>[] = [
  {
    title: 'Squat Protocol (โพรโทคอลสควอท)',
    description: 'ปฏิบัติท่าสควอท 20 ครั้งด้วยฟอร์มที่ถูกต้องและลงลึกสม่ำเสมอ',
    type: 'STRENGTH',
    difficulty: 'EASY',
    target: 20,
    unit: 'reps',
    xpReward: 50,
    statRewards: { VIT: 1, STR: 1 },
    deadline: '21:00',
    steps: [
      { id: 'step-1', name: 'สควอทบอดี้เวท (Bodyweight Squats)', targetReps: 10, sets: 2, completed: false },
      { id: 'step-2', name: 'ยืดเหยียดสะโพก (Hip Opener Stretch)', targetSeconds: 60, sets: 1, completed: false }
    ]
  },
  {
    title: 'Push Protocol (โพรโทคอลวิดพื้น)',
    description: 'ปฏิบัติท่าวิดพื้นมาตรฐาน 20 ครั้ง รักษาแนวลำตัวให้ตรงเหมือนแผ่นไม้',
    type: 'STRENGTH',
    difficulty: 'NORMAL',
    target: 20,
    unit: 'reps',
    xpReward: 60,
    statRewards: { STR: 1 },
    deadline: '21:00',
    steps: [
      { id: 'step-1', name: 'วิดพื้นมาตรฐาน (Standard Push-ups)', targetReps: 10, sets: 2, completed: false },
      { id: 'step-2', name: 'แพลงก์แขนตึง (High Plank)', targetSeconds: 30, sets: 1, completed: false }
    ]
  },
  {
    title: 'Endurance Stasis (ความนิ่งแห่งความอดทน)',
    description: 'เกร็งกล้ามเนื้อแกนกลางลำตัวในท่าแพลงก์ต่อเนื่องเป็นเวลา 60 วินาที',
    type: 'VITALITY',
    difficulty: 'EASY',
    target: 60,
    unit: 'seconds',
    xpReward: 50,
    statRewards: { VIT: 1 },
    deadline: '21:00',
    steps: [
      { id: 'step-1', name: 'แพลงก์บนข้อศอก (Forearm Plank)', targetSeconds: 30, sets: 2, completed: false }
    ]
  },
  {
    title: 'Agility Cadence (จังหวะความคล่องตัว)',
    description: 'กระโดดตบ 50 ครั้งด้วยจังหวะแอโรบิกที่กระฉับกระเฉง',
    type: 'AGILITY',
    difficulty: 'NORMAL',
    target: 50,
    unit: 'reps',
    xpReward: 55,
    statRewards: { AGI: 1 },
    deadline: '21:00',
    steps: [
      { id: 'step-1', name: 'กระโดดตบ (Jumping Jacks)', targetReps: 25, sets: 2, completed: false }
    ]
  },
  {
    title: 'Discipline Hydration & Focus (วินัยน้ำดื่มและสมาธิ)',
    description: 'ดื่มน้ำสะอาด 500 มล. และฝึกควบคุมลมหายใจเข้าลึกออกยาว 5 นาที',
    type: 'DISCIPLINE',
    difficulty: 'EASY',
    target: 5,
    unit: 'minutes',
    xpReward: 40,
    statRewards: { INT: 1 },
    deadline: '21:00',
    steps: [
      { id: 'step-1', name: 'ดื่มน้ำสะอาด 500 มล.', targetReps: 1, sets: 1, completed: false },
      { id: 'step-2', name: 'ฝึกกำหนดลมหายใจเข้า-ออกลึกๆ', targetSeconds: 300, sets: 1, completed: false }
    ]
  }
];

export const PENALTY_QUEST_TEMPLATE: Omit<Quest, 'id' | 'createdAt' | 'status'> = {
  title: 'PENALTY: Recovery Stride (เดินฟื้นฟู)',
  description: 'หมดเวลาปฏิบัติเควสประจำวัน เดินเร็วต่อเนื่อง 5 นาทีเพื่อเชื่อมโยงระบบประสาทและสลายบทลงโทษ',
  type: 'PENALTY',
  difficulty: 'EASY',
  target: 5,
  unit: 'minutes',
  xpReward: 20,
  statRewards: { VIT: 1 },
  deadline: '23:59',
  isPenalty: true,
  steps: [
    { id: 'pen-stride-1', name: 'เดินเร็วต่อเนื่องเพื่อฟื้นฟูระบบ', targetSeconds: 300, sets: 1, completed: false }
  ]
};
