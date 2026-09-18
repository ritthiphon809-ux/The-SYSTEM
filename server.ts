import express from 'express';
import path from 'path';
import dotenv from 'dotenv';
import { createServer as createViteServer } from 'vite';
import { Player, Quest, SystemEvent, WorkoutLog, PendingReminder, Rank } from './src/types.ts';
import {
  INITIAL_PLAYER_STATE,
  DEMO_PLAYER_STATE,
  FALLBACK_DAILY_QUESTS,
  PENALTY_QUEST_TEMPLATE,
  processQuestCompletion,
  applyHpDrain,
  allocatePlayerStat,
  syncHealthKitData,
  createEmergencyQuest,
  createPenaltyZoneQuest,
  PROGRESSION_CONFIG
} from './src/modules/game-engine.ts';
import {
  generateDailyQuestWithAI,
  processNaturalLanguageWithAI,
  generateDailyHealthBriefing,
  analyzeExcuseWithAI
} from './server/gemini-service.ts';
import {
  verifyLineSignature,
  createQuestFlexMessage,
  createCompletionFlexMessage,
  createStatusFlexMessage,
  createReminderFlexMessage,
  createBriefingFlexMessage,
  createWeeklySummaryFlexMessage,
  WeeklySummaryData,
  replyLineMessage,
  sendLinePushMessage,
  createRankUpFlexMessage,
  createWeeklyBossClearedFlexMessage
} from './server/line-service.ts';
import { switchToDebuffMenuForUser, switchToNormalMenuForUser } from './server/line-richmenu.ts';

dotenv.config();

// In-Memory State Store for V1 MVP (Synchronized with Game Engine)
const connectedLineUserIds = new Set<string>();
// In-Memory Pending Reminders (User Custom Scheduled Reminders: { id, userId, remindAt, message, sent })
const pendingReminders: PendingReminder[] = [];
let lastPushDateQuest = '';
let lastPushDateReminder = '';
let lastPushDateBriefing = '';
// Feature 1: Escalating Reminders daily flags
let lastPushDateHalfway = '';
let lastPushDate3Hours = '';
let lastPushDate30Min = '';
// Feature 3: Post-deadline penalty daily flag
let lastPushDatePenalty = '';
// Feature 4: Sunday weekly summary daily flag & Rest Day week tracker
let lastPushDateWeeklySummary = '';
let lastRestDayUsedWeek = '';
// Feature 2: Random Surveillance Check-in Tracker
let surveillanceTarget = {
  date: '',
  hour: 0,
  minute: 0,
  executed: false
};
// Feature 6: Daily Emergency Quest scheduler (sampled once per day, max 30%)
let emergencyTarget = {
  date: '',
  scheduled: false,
  hour: 0,
  minute: 0,
  executed: false
};
let emergencyQuest: Quest | null = null;

// Feature 7: Weekly Boss Quest state
let weeklyBossQuest: Quest | null = null;
let weeklyBossWeek = '';

// Feature 8: Reflection gate before applying the normal deadline penalty
let awaitingReflectionFromUserId: string | null = null;
let awaitingReflectionQuestId: string | null = null;

// Helper: Calculate remaining minutes until deadline in Thailand Time (UTC+7)
function getRemainingMinutesToDeadline(deadlineStr: string, bangkokNow: Date): number {
  let targetHours = 21;
  let targetMinutes = 0;
  if (deadlineStr && deadlineStr.includes(':')) {
    const parts = deadlineStr.split(':');
    targetHours = parseInt(parts[0], 10) || 21;
    targetMinutes = parseInt(parts[1], 10) || 0;
  }
  const targetDate = new Date(bangkokNow);
  targetDate.setHours(targetHours, targetMinutes, 0, 0);
  const diffMs = targetDate.getTime() - bangkokNow.getTime();
  return Math.round(diffMs / 60000);
}

// Helper: Calculate ISO Week string (e.g. "2026-W38") to enforce 1 rest day per week
function getWeekIdentifier(date: Date): string {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  return `${d.getUTCFullYear()}-W${weekNo}`;
}

function formatBangkokTime(date: Date): string {
  return date.toLocaleTimeString('en-GB', {
    timeZone: 'Asia/Bangkok',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  });
}

function buildQuestFromGenerated(
  generated: Awaited<ReturnType<typeof generateDailyQuestWithAI>>,
  options: {
    idPrefix: string;
    deadline: string;
    xpMultiplier?: number;
    type?: Quest['type'];
    difficulty?: Quest['difficulty'];
    isEmergency?: boolean;
    isWeeklyBoss?: boolean;
  }
): Quest {
  const multiplier = options.xpMultiplier ?? 1;
  return {
    id: `${options.idPrefix}-${Date.now()}`,
    title: generated.title,
    description: generated.description,
    type: options.type || generated.type,
    difficulty: options.difficulty || generated.difficulty,
    target: generated.target,
    unit: generated.unit,
    xpReward: Math.round(generated.suggestedXp * multiplier),
    statRewards: { [generated.primaryStat]: 1 },
    deadline: options.deadline,
    status: 'AVAILABLE',
    createdAt: new Date().toISOString(),
    steps: generated.steps,
    isEmergency: options.isEmergency,
    isWeeklyBoss: options.isWeeklyBoss
  };
}
let currentPlayer: Player = { ...DEMO_PLAYER_STATE };
let currentQuest: Quest = {
  id: 'quest-today-1',
  title: 'Squat Protocol (โพรโทคอลสควอท)',
  description: 'ปฏิบัติท่าสควอท 20 ครั้งด้วยฟอร์มที่ถูกต้องและลงลึกสม่ำเสมอ รักษาแนวกระดูกสันหลังให้มั่นคง',
  type: 'STRENGTH',
  difficulty: 'EASY',
  target: 20,
  unit: 'reps',
  xpReward: 50,
  statRewards: { VIT: 1, STR: 1 },
  deadline: '21:00',
  status: 'AVAILABLE',
  createdAt: new Date().toISOString(),
  steps: [
    { id: 'step-1', name: 'สควอทบอดี้เวท (Bodyweight Squats)', targetReps: 10, sets: 2, completed: false },
    { id: 'step-2', name: 'ยืดเหยียดสะโพกและเอ็นร้อยหวาย (Hip Stretch)', targetSeconds: 60, sets: 1, completed: false }
  ]
};

let eventLogs: SystemEvent[] = [
  {
    id: 'evt-init-1',
    type: 'QUEST_CREATED',
    title: 'Daily Directive Dispatched: Squat Protocol',
    description: 'System assigned objective for biological calibration.',
    timestamp: new Date(Date.now() - 3600000).toISOString()
  },
  {
    id: 'evt-init-2',
    type: 'STREAK_INCREASED',
    title: 'Streak Maintained: 7 Days',
    description: 'Biological adherence verified over 7 consecutive solar cycles.',
    timestamp: new Date(Date.now() - 86400000).toISOString()
  }
];

let workoutLogs: WorkoutLog[] = [
  {
    id: 'wk-1',
    title: 'Push Protocol Completed',
    durationMinutes: 20,
    xpEarned: 60,
    statsEarned: { STR: 1 },
    date: new Date(Date.now() - 86400000).toISOString(),
    source: 'WEB'
  },
  {
    id: 'wk-2',
    title: 'Aerobic Endurance Sprint',
    durationMinutes: 25,
    xpEarned: 50,
    statsEarned: { VIT: 1 },
    date: new Date(Date.now() - 2 * 86400000).toISOString(),
    source: 'LINE'
  }
];

function calculateWeeklySummaryData(todayStr: string): WeeklySummaryData {
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 3600 * 1000);
  const recentWorkouts = workoutLogs.filter((w) => new Date(w.date).getTime() >= sevenDaysAgo.getTime());
  const recentEvents = eventLogs.filter((e) => new Date(e.timestamp).getTime() >= sevenDaysAgo.getTime());

  const completedCount = recentWorkouts.length || (currentQuest.status === 'COMPLETED' ? 1 : 0);
  const totalXpEarned =
    recentWorkouts.reduce((sum, w) => sum + (w.xpEarned || 0), 0) +
    recentEvents
      .filter((e) => e.type === 'XP_GAINED')
      .reduce((sum, e) => sum + (e.xpChange || 0), 0);
  const missedCount = recentEvents.filter((e) => e.type === 'DEBUFF_APPLIED' || e.type === 'PENALTY_CREATED').length;
  const totalMins =
    recentWorkouts.reduce((sum, w) => sum + (w.durationMinutes || 0), 0) || currentPlayer.totalWorkoutMinutes;

  return {
    totalQuests: Math.max(completedCount, (currentPlayer.totalQuestCompleted % 7) || completedCount || 1),
    totalXp: Math.max(totalXpEarned, 250),
    currentStreak: currentPlayer.streak,
    missedDeadlines: missedCount,
    totalMinutes: totalMins,
    periodLabel: `รอบสัปดาห์สิ้นสุด ${todayStr}`
  };
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Raw body preservation for webhook signature validation
  app.use(
    express.json({
      verify: (req: any, _res, buf) => {
        req.rawBody = buf.toString();
      }
    })
  );

  // -------------------------------------------------------------
  // API ROUTES (Backend / Game Rules Engine)
  // -------------------------------------------------------------

  // 1. Health & System Diagnostic
  app.get('/api/health', (_req, res) => {
    res.json({
      status: 'ONLINE',
      system: 'THE SYSTEM FITNESS ASCENSION PROTOCOL',
      version: '1.0.0-MVP',
      geminiConfigured: Boolean(process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY !== 'MY_GEMINI_API_KEY'),
      lineConfigured: Boolean(process.env.LINE_CHANNEL_ACCESS_TOKEN && process.env.LINE_CHANNEL_SECRET)
    });
  });

  // 2. Get Player State
  app.get('/api/player', (_req, res) => {
    res.json({
      player: currentPlayer,
      lineOaBasicId: process.env.LINE_OA_BASIC_ID || '',
      lineLoginConfigured: Boolean(process.env.LINE_LOGIN_CHANNEL_ID && process.env.LINE_LOGIN_CHANNEL_SECRET)
    });
  });

  // 2.0 Register / Onboard New Hunter Profile (Solo Leveling Awakening)
  app.post('/api/player/register', (req, res) => {
    const { displayName, fitnessGoal, weightKg, heightCm, lineUserId, lineDisplayName, linePictureUrl } = req.body;
    if (!displayName || !displayName.trim()) {
      return res.status(400).json({ error: 'Hunter codename is required.' });
    }

    const baseVit = fitnessGoal === 'ENDURANCE' ? 7 : 5;
    const baseStr = fitnessGoal === 'MUSCLE_GAIN' ? 7 : 5;
    const baseAgi = fitnessGoal === 'FAT_LOSS' ? 7 : 5;
    const baseInt = 5;

    currentPlayer = {
      ...currentPlayer,
      id: lineUserId ? `player-${lineUserId}` : `hunter-${Date.now()}`,
      displayName: displayName.trim().toUpperCase(),
      lineUserId: lineUserId || currentPlayer.lineUserId,
      lineDisplayName: lineDisplayName || currentPlayer.lineDisplayName,
      linePictureUrl: linePictureUrl || currentPlayer.linePictureUrl,
      isLineConnected: Boolean(lineUserId || currentPlayer.isLineConnected),
      isRegistered: true,
      isDemo: false,
      fitnessGoal: fitnessGoal || 'SOLO_LEVELING',
      weightKg: Number(weightKg) || undefined,
      heightCm: Number(heightCm) || undefined,
      level: 1,
      xp: 0,
      currentLevelMaxXp: 100,
      rank: 'E',
      stats: {
        STR: baseStr,
        AGI: baseAgi,
        VIT: baseVit,
        INT: baseInt
      },
      hp: PROGRESSION_CONFIG.calculateMaxHp(baseVit),
      maxHp: PROGRESSION_CONFIG.calculateMaxHp(baseVit),
      stamina: PROGRESSION_CONFIG.calculateMaxStamina(baseAgi),
      maxStamina: PROGRESSION_CONFIG.calculateMaxStamina(baseAgi),
      statPoints: 0,
      streak: 0,
      totalQuestCompleted: 0,
      totalWorkoutMinutes: 0,
      weeklyBossesCleared: 0,
      titles: [],
      badges: [],
      createdAt: new Date().toISOString(),
      lastActiveAt: new Date().toISOString()
    };

    if (lineUserId) {
      connectedLineUserIds.add(lineUserId);
    }

    eventLogs.unshift({
      id: `evt-${Date.now()}-awaken`,
      type: 'RANK_UP',
      title: '[SYSTEM NOTIFICATION: HUNTER AWAKENED]',
      description: `Player [${currentPlayer.displayName}] has been registered into THE SYSTEM as Rank E Hunter. Biological ascension protocol initiated.`,
      timestamp: new Date().toISOString()
    });

    res.json({
      success: true,
      player: currentPlayer,
      message: `Hunter ${currentPlayer.displayName} registered successfully.`
    });
  });

  // 2.0.1 Generate LINE Login URL with bot_prompt to Auto-Add LINE OA as Friend
  app.get('/api/auth/line/login-url', (req, res) => {
    const channelId = process.env.LINE_LOGIN_CHANNEL_ID;
    const appUrl = process.env.APP_URL || `${req.protocol}://${req.get('host')}`;
    const redirectUri = `${appUrl}/api/auth/line/callback`;

    if (!channelId) {
      return res.json({
        available: false,
        message: 'LINE_LOGIN_CHANNEL_ID is not configured in environment.'
      });
    }

    const state = `state_${Date.now()}_${Math.random().toString(36).substring(7)}`;
    const lineAuthUrl =
      `https://access.line.me/oauth2/v2.1/authorize?` +
      `response_type=code` +
      `&client_id=${channelId}` +
      `&redirect_uri=${encodeURIComponent(redirectUri)}` +
      `&state=${state}` +
      `&scope=profile%20openid` +
      `&bot_prompt=aggressive`; // 'aggressive' opens friend addition prompt for THE SYSTEM LINE OA!

    res.json({
      available: true,
      authUrl: lineAuthUrl,
      redirectUri
    });
  });

  // 2.0.2 Handle LINE OAuth Callback (Exchange code for profile)
  app.get('/api/auth/line/callback', async (req, res) => {
    const { code, state, error, error_description } = req.query;
    const appUrl = process.env.APP_URL || `${req.protocol}://${req.get('host')}`;

    if (error) {
      console.warn('[LINE LOGIN] Error received:', error, error_description);
      return res.redirect(`${appUrl}/?line_auth_error=${encodeURIComponent(String(error_description || error))}`);
    }

    if (!code) {
      return res.redirect(`${appUrl}/?line_auth_error=missing_code`);
    }

    const channelId = process.env.LINE_LOGIN_CHANNEL_ID;
    const channelSecret = process.env.LINE_LOGIN_CHANNEL_SECRET;
    const redirectUri = `${appUrl}/api/auth/line/callback`;

    if (!channelId || !channelSecret) {
      return res.redirect(`${appUrl}/?line_auth_error=channel_credentials_missing`);
    }

    try {
      // 1. Exchange authorization code for access token
      const tokenResp = await fetch('https://api.line.me/oauth2/v2.1/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          grant_type: 'authorization_code',
          code: String(code),
          redirect_uri: redirectUri,
          client_id: channelId,
          client_secret: channelSecret
        }).toString()
      });

      const tokenData = await tokenResp.json();
      if (!tokenData.access_token) {
        console.error('[LINE LOGIN] Token exchange failed:', tokenData);
        return res.redirect(`${appUrl}/?line_auth_error=token_exchange_failed`);
      }

      // 2. Fetch User Profile
      const profileResp = await fetch('https://api.line.me/v2/profile', {
        headers: { Authorization: `Bearer ${tokenData.access_token}` }
      });
      const profile = await profileResp.json();

      if (!profile.userId) {
        return res.redirect(`${appUrl}/?line_auth_error=profile_fetch_failed`);
      }

      // Register LINE user in memory
      connectedLineUserIds.add(profile.userId);
      currentPlayer = {
        ...currentPlayer,
        lineUserId: profile.userId,
        lineDisplayName: profile.displayName,
        linePictureUrl: profile.pictureUrl,
        isLineConnected: true
      };

      // Redirect back with profile parameters for onboarding
      const queryParams = new URLSearchParams({
        line_userId: profile.userId,
        line_name: profile.displayName || '',
        line_pic: profile.pictureUrl || '',
        line_auth_success: '1'
      });

      res.redirect(`${appUrl}/?${queryParams.toString()}`);
    } catch (err: any) {
      console.error('[LINE LOGIN] Callback error:', err);
      res.redirect(`${appUrl}/?line_auth_error=server_exception`);
    }
  });

  // 2.1 Allocate Stat Points (STR, AGI, VIT, INT)
  app.post('/api/player/allocate-stat', (req, res) => {
    const { stat, points = 1 } = req.body;
    if (!stat || !['STR', 'AGI', 'VIT', 'INT'].includes(stat)) {
      return res.status(400).json({ error: 'Invalid attribute target. Must be STR, AGI, VIT, or INT.' });
    }

    const result = allocatePlayerStat(currentPlayer, stat, points);
    if (!result.success) {
      return res.status(400).json({ error: result.message });
    }

    currentPlayer = result.player;
    eventLogs.unshift({
      id: `evt-${Date.now()}-stat`,
      type: 'STAT_ALLOCATED',
      title: `[STAT ALLOCATED: +${points} ${stat}]`,
      description: `Attribute amplified. Current ${stat}: ${currentPlayer.stats[stat as keyof typeof currentPlayer.stats]}.`,
      timestamp: new Date().toISOString()
    });

    res.json({ success: true, player: currentPlayer, message: result.message });
  });

  // 2.2 Simulate / Trigger Hourly HP Decay (-5 HP/hr or custom)
  app.post('/api/player/hp-drain', (req, res) => {
    const { hours = 1 } = req.body;
    const result = applyHpDrain(currentPlayer, hours);
    currentPlayer = result.player;

    if (result.enteredPenalty) {
      currentQuest = createPenaltyZoneQuest();
      eventLogs.unshift({
        id: `evt-${Date.now()}-penzone`,
        type: 'PENALTY_CREATED',
        title: '[CRITICAL: HP DEPLETED — PENALTY ZONE]',
        description: 'Vital signs reached 0. Player transported to the Penalty Zone. Survival protocol required.',
        timestamp: new Date().toISOString()
      });
    } else {
      eventLogs.unshift({
        id: `evt-${Date.now()}-hpdrain`,
        type: 'HP_DRAINED',
        title: `[VITAL DECAY: -${result.drained} HP]`,
        description: `Physical inactivity caused cellular degradation. Current HP: ${currentPlayer.hp}/${currentPlayer.maxHp}.`,
        timestamp: new Date().toISOString()
      });
    }

    res.json({
      success: true,
      player: currentPlayer,
      quest: currentQuest,
      drained: result.drained,
      enteredPenalty: result.enteredPenalty
    });
  });

  // 2.3 Apple HealthKit / Google Fit Background Sync
  app.post('/api/player/sync-health', (req, res) => {
    const { steps, heartRate, calories } = req.body;
    if (typeof steps !== 'number') {
      return res.status(400).json({ error: 'Step count is required.' });
    }

    const result = syncHealthKitData(currentPlayer, { steps, heartRate, calories });
    currentPlayer = result.player;

    if (result.hpRecovered > 0) {
      eventLogs.unshift({
        id: `evt-${Date.now()}-hprecov`,
        type: 'HP_RESTORED',
        title: `[HEALTH SYNCHRONIZED: +${result.hpRecovered} HP]`,
        description: `Bio-sensor sync confirmed. Steps: ${currentPlayer.stepsToday}. AGI Multiplier applied.`,
        timestamp: new Date().toISOString()
      });
    }

    res.json({
      success: true,
      player: currentPlayer,
      hpRecovered: result.hpRecovered
    });
  });

  // 2.4 Trigger Emergency Quest (Inactivity or Low HP trigger)
  app.post('/api/quest/emergency', (_req, res) => {
    currentQuest = createEmergencyQuest(currentPlayer);
    eventLogs.unshift({
      id: `evt-${Date.now()}-emq`,
      type: 'EMERGENCY_QUEST',
      title: '[EMERGENCY QUEST DISPATCHED]',
      description: 'The System detected dangerous biological stagnation. Move 500 steps in 10 minutes to avoid penalty.',
      timestamp: new Date().toISOString()
    });

    res.json({
      success: true,
      quest: currentQuest,
      systemMessage: '[The System has issued an Emergency Quest.]'
    });
  });

  // 2.5 Clear Penalty Zone (Survival workout complete)
  app.post('/api/penalty/clear', (_req, res) => {
    const maxHp = currentPlayer.maxHp || PROGRESSION_CONFIG.calculateMaxHp(currentPlayer.stats.VIT);
    currentPlayer = {
      ...currentPlayer,
      hp: maxHp,
      isPenaltyZone: false,
      lastActiveAt: new Date().toISOString()
    };

    currentQuest = {
      id: `quest-${Date.now()}`,
      title: 'Daily Ascension Protocol',
      description: 'Penalty survived. Biological system restored to optimal parameters.',
      type: 'STRENGTH',
      difficulty: 'NORMAL',
      target: 20,
      unit: 'reps',
      xpReward: 60,
      statRewards: { STR: 1, VIT: 1 },
      deadline: '21:00',
      status: 'AVAILABLE',
      createdAt: new Date().toISOString()
    };

    eventLogs.unshift({
      id: `evt-${Date.now()}-survived`,
      type: 'PENALTY_SURVIVED',
      title: '[PENALTY ZONE SURVIVED]',
      description: 'Survival protocol completed. Vital signs replenished to 100%. System unlocked.',
      timestamp: new Date().toISOString()
    });

    res.json({
      success: true,
      player: currentPlayer,
      quest: currentQuest,
      systemMessage: '[The System acknowledges your survival. Vital signs replenished.]'
    });
  });

  // 3. Reset to Demo or New Hunter State
  const executeReset = (mode: string = 'demo') => {
    if (mode === 'new') {
      currentPlayer = {
        ...INITIAL_PLAYER_STATE,
        id: `hunter-${Date.now()}`,
        displayName: 'AWAKENED HUNTER',
        isDemo: false,
        createdAt: new Date().toISOString(),
        lastActiveAt: new Date().toISOString()
      };
    } else {
      currentPlayer = {
        ...DEMO_PLAYER_STATE,
        createdAt: new Date(Date.now() - 7 * 86400000).toISOString(),
        lastActiveAt: new Date().toISOString()
      };
    }

    currentQuest = {
      id: `quest-${Date.now()}`,
      title: 'Squat Protocol (โพรโทคอลสควอท)',
      description: 'ปฏิบัติท่าสควอท 20 ครั้งด้วยฟอร์มที่ถูกต้องและลงลึกสม่ำเสมอ รักษาแนวกระดูกสันหลังให้มั่นคง',
      type: 'STRENGTH',
      difficulty: 'EASY',
      target: 20,
      unit: 'reps',
      xpReward: 50,
      statRewards: { VIT: 1, STR: 1 },
      deadline: '21:00',
      status: 'AVAILABLE',
      createdAt: new Date().toISOString(),
      steps: [
        { id: 'step-1', name: 'สควอทบอดี้เวท (Bodyweight Squats)', targetReps: 10, sets: 2, completed: false },
        { id: 'step-2', name: 'ยืดเหยียดสะโพกและเอ็นร้อยหวาย (Hip Stretch)', targetSeconds: 60, sets: 1, completed: false }
      ]
    };

    eventLogs = [
      {
        id: `evt-${Date.now()}-1`,
        type: 'QUEST_CREATED',
        title: mode === 'new' ? 'System Initialized: New Hunter' : 'Demo Session Reset',
        description:
          mode === 'new'
            ? 'New Hunter calibration complete (LV. 1 | RANK E | XP 0/100).'
            : 'Test Subject parameters reloaded (LV. 3 | RANK E | STREAK 7).',
        timestamp: new Date().toISOString()
      },
      {
        id: `evt-${Date.now()}-2`,
        type: 'STREAK_INCREASED',
        title: mode === 'new' ? 'Day 0: Awakening' : 'Streak Maintained: 7 Days',
        description: mode === 'new' ? 'Hunter awakened into The System.' : 'Biological adherence verified over 7 consecutive solar cycles.',
        timestamp: new Date(Date.now() - 3600000).toISOString()
      }
    ];

    workoutLogs = [
      {
        id: `wk-${Date.now()}`,
        title: 'Calisthenics Conditioning',
        durationMinutes: 20,
        xpEarned: 50,
        statsEarned: { STR: 1 },
        date: new Date(Date.now() - 86400000).toISOString(),
        source: 'WEB'
      }
    ];

    pendingReminders.length = 0;
    emergencyQuest = null;
    weeklyBossQuest = null;
    weeklyBossWeek = '';
    awaitingReflectionFromUserId = null;
    awaitingReflectionQuestId = null;
  };

  // Shared completion finalizer so every real completion path gets identical
  // event logging, debuff cleanup, and immediate dramatic rank-up delivery.
  const finalizeQuestCompletion = async (quest: Quest, source: WorkoutLog['source'], userId?: string) => {
    const result = processQuestCompletion(currentPlayer, quest);
    currentPlayer = result.player;

    workoutLogs.unshift({
      id: `wk-${source.toLowerCase()}-${Date.now()}`,
      title: `${quest.title} (${quest.target} ${quest.unit})`,
      durationMinutes: source === 'WEB' ? (quest.type === 'VITALITY' ? 25 : 15) : 20,
      xpEarned: quest.xpReward,
      statsEarned: quest.statRewards,
      date: new Date().toISOString(),
      source
    });

    for (const evt of result.systemEvents) {
      eventLogs.unshift(evt);
    }

    const targetUserIds = userId
      ? [userId]
      : currentPlayer.lineUserId
        ? [currentPlayer.lineUserId]
        : Array.from(connectedLineUserIds);

    // Completing a normal quest clears an active debuff and restores the normal menu.
    if (!currentPlayer.activeDebuff) {
      for (const uid of targetUserIds) {
        await switchToNormalMenuForUser(uid);
      }
    }

    if (result.rankUp) {
      const rankFlex = createRankUpFlexMessage(result.newRank, currentPlayer);
      for (const uid of targetUserIds) {
        if (uid && process.env.LINE_CHANNEL_ACCESS_TOKEN) {
          await sendLinePushMessage(uid, [rankFlex]);
        }
      }
      eventLogs.unshift({
        id: `evt-${Date.now()}-rank-up-dramatic`,
        type: 'RANK_UP_DRAMATIC',
        title: `[RANK UP] ${result.oldRank} → ${result.newRank}`,
        description: `Dramatic rank-up announcement dispatched immediately after quest completion.`,
        timestamp: new Date().toISOString(),
        rankChange: { from: result.oldRank, to: result.newRank }
      });
    }

    return result;
  };

  const pushToConnectedUsers = async (messages: any[], targetUserId?: string) => {
    const targets = targetUserId ? [targetUserId] : Array.from(connectedLineUserIds);
    if (!process.env.LINE_CHANNEL_ACCESS_TOKEN) return;
    for (const uid of targets) {
      await sendLinePushMessage(uid, messages);
    }
  };

  const completeSpecialQuest = async (quest: Quest, kind: 'EMERGENCY' | 'BOSS', userId?: string) => {
    if (quest.status === 'COMPLETED') return null;
    quest.status = 'COMPLETED';
    quest.completedAt = new Date().toISOString();
    if (quest.steps) {
      quest.steps = quest.steps.map((step) => ({ ...step, completed: true }));
    }

    const result = await finalizeQuestCompletion(quest, 'LINE', userId);

    if (kind === 'EMERGENCY') {
      eventLogs.unshift({
        id: `evt-${Date.now()}-emergency-complete`,
        type: 'EMERGENCY_QUEST_COMPLETED',
        title: '[EMERGENCY QUEST COMPLETED]',
        description: `Emergency protocol '${quest.title}' completed within the 1-hour window.`,
        timestamp: new Date().toISOString()
      });
      emergencyQuest = null;
    } else {
      currentPlayer.weeklyBossesCleared = (currentPlayer.weeklyBossesCleared || 0) + 1;
      currentPlayer.titles = Array.from(new Set([...(currentPlayer.titles || []), 'WEEKLY BOSS VANQUISHER']));
      currentPlayer.badges = Array.from(new Set([...(currentPlayer.badges || []), 'WEEKLY_BOSS_VANQUISHER']));
      eventLogs.unshift({
        id: `evt-${Date.now()}-boss-complete`,
        type: 'BOSS_QUEST_COMPLETED',
        title: '[WEEKLY BOSS VANQUISHED]',
        description: `Weekly Boss cleared. Total Bosses Cleared: ${currentPlayer.weeklyBossesCleared}.`,
        timestamp: new Date().toISOString()
      });
      const bossFlex = createWeeklyBossClearedFlexMessage(quest, currentPlayer);
      const targets = userId
        ? [userId]
        : currentPlayer.lineUserId
          ? [currentPlayer.lineUserId]
          : Array.from(connectedLineUserIds);
      for (const uid of targets) {
        if (uid && process.env.LINE_CHANNEL_ACCESS_TOKEN) {
          await sendLinePushMessage(uid, [bossFlex]);
        }
      }
      weeklyBossQuest = null;
    }

    return result;
  };

  const applyDeadlinePenalty = async (targetUserId?: string) => {
    currentQuest.status = 'EXPIRED';
    currentPlayer.missedDeadlineStreak = (currentPlayer.missedDeadlineStreak || 0) + 1;

    currentPlayer.activeDebuff = {
      name: 'SYSTEM PENALTY: Weakened',
      description: 'XP ที่ได้รับลดลง 50% จนกว่าจะทำเควสถัดไปสำเร็จ',
      appliedAt: new Date().toISOString(),
      xpMultiplier: 0.5
    };

    const rankOrder: Rank[] = ['E', 'D', 'C', 'B', 'A', 'S'];
    let demoted = false;
    const oldRank = currentPlayer.rank;
    if (currentPlayer.missedDeadlineStreak >= 3) {
      const currentIdx = rankOrder.indexOf(currentPlayer.rank);
      if (currentIdx > 0) {
        currentPlayer.rank = rankOrder[currentIdx - 1];
        demoted = true;
      }
      currentPlayer.missedDeadlineStreak = 0;
    }

    eventLogs.unshift({
      id: `evt-${Date.now()}-penalty-applied`,
      type: 'DEBUFF_APPLIED',
      title: '[SYSTEM PENALTY: WEAKENED DEBUFF]',
      description: `Missed quest deadline for ${currentQuest.title}. Weakened debuff activated (XP ×0.5). Missed streak: ${currentPlayer.missedDeadlineStreak}/3.`,
      timestamp: new Date().toISOString()
    });

    if (demoted) {
      eventLogs.unshift({
        id: `evt-${Date.now()}-rank-down`,
        type: 'RANK_DOWN',
        title: `[RANK DEMOTION: RANK ${oldRank} → ${currentPlayer.rank}]`,
        description: 'Disciplinary demotion: Missed quest deadline for 3 consecutive days. Rank downgraded.',
        timestamp: new Date().toISOString()
      });
    }

    const penaltyPushText = demoted
      ? `[SYSTEM PENALTY ENFORCED]\nคุณพลาด Deadline การปฏิบัติภารกิจ (${currentQuest.title})\nบทลงโทษถูกเปิดใช้งาน: ได้รับ Debuff 'Weakened' (XP ที่ได้รับจะลดลง 50% จนกว่าจะทำเควสถัดไปสำเร็จ)\n\n[RANK DEMOTION]\nเนื่องจากคุณพลาดภารกิจติดต่อกันครบ 3 วัน ระบบได้ลดระดับของคุณลงจาก RANK ${oldRank} สู่ RANK ${currentPlayer.rank}`
      : `[SYSTEM PENALTY ENFORCED]\nคุณพลาด Deadline การปฏิบัติภารกิจ (${currentQuest.title})\nบทลงโทษถูกเปิดใช้งาน: ได้รับ Debuff 'Weakened' (XP ที่ได้รับจะลดลง 50% จนกว่าจะทำเควสถัดไปสำเร็จ)`;

    const targetIds = targetUserId
      ? [targetUserId]
      : currentPlayer.lineUserId
        ? [currentPlayer.lineUserId]
        : Array.from(connectedLineUserIds);
    for (const uid of targetIds) {
      await switchToDebuffMenuForUser(uid, process.env.APP_URL || 'http://localhost:3000');
      if (process.env.LINE_CHANNEL_ACCESS_TOKEN) {
        await sendLinePushMessage(uid, [{ type: 'text', text: penaltyPushText }]);
      }
    }

    return { demoted, oldRank, newRank: currentPlayer.rank, message: penaltyPushText };
  };

  const buildCompletionChoiceMessage = () => {
    const items: any[] = [];
    if (currentQuest.status !== 'COMPLETED' && currentQuest.status !== 'EXPIRED' && currentQuest.status !== 'RESTED') {
      items.push({
        type: 'action',
        action: { type: 'message', label: 'เควสปกติ', text: 'เสร็จแล้ว: ปกติ' }
      });
    }
    if (emergencyQuest && emergencyQuest.status !== 'COMPLETED' && emergencyQuest.status !== 'EXPIRED') {
      items.push({
        type: 'action',
        action: { type: 'message', label: 'เควสฉุกเฉิน', text: 'เสร็จแล้ว: ฉุกเฉิน' }
      });
    }
    if (weeklyBossQuest && weeklyBossQuest.status !== 'COMPLETED' && weeklyBossQuest.status !== 'EXPIRED') {
      items.push({
        type: 'action',
        action: { type: 'message', label: 'WEEKLY BOSS', text: 'เสร็จแล้ว: BOSS' }
      });
    }
    return {
      type: 'text',
      text: '[SYSTEM]\nตรวจพบภารกิจที่สามารถบันทึกผลสำเร็จได้มากกว่าหนึ่งรายการ กรุณาเลือกภารกิจที่คุณทำเสร็จแล้ว',
      quickReply: { items }
    };
  };

  app.post('/api/player/reset-demo', (req, res) => {
    const mode = req.body?.mode || 'demo';
    executeReset(mode);
    res.json({
      success: true,
      mode,
      player: currentPlayer,
      quest: currentQuest,
      events: eventLogs,
      workouts: workoutLogs
    });
  });

  app.post('/api/player/reset', (req, res) => {
    const mode = req.body?.mode || 'demo';
    executeReset(mode);
    res.json({
      success: true,
      mode,
      player: currentPlayer,
      quest: currentQuest,
      events: eventLogs,
      workouts: workoutLogs
    });
  });

  // 4. Get Current Daily Quest
  app.get('/api/quest/daily', async (_req, res) => {
    res.json({ quest: currentQuest });
  });

  // Feature 6/7: Special quest state endpoints (read-only; do not replace the daily quest).
  app.get('/api/quest/emergency', (_req, res) => {
    res.json({ quest: emergencyQuest });
  });

  app.get('/api/quest/weekly-boss', (_req, res) => {
    res.json({ quest: weeklyBossQuest });
  });

  // 5. Generate / Adapt Quest via Gemini AI
  app.post('/api/quest/generate', async (req, res) => {
    const { availableMinutes, preference, difficulty } = req.body;
    try {
      const generated = await generateDailyQuestWithAI(currentPlayer, {
        availableMinutes,
        preference,
        difficultyOverride: difficulty
      });

      currentQuest = {
        id: `quest-${Date.now()}`,
        title: generated.title,
        description: generated.description,
        type: generated.type,
        difficulty: generated.difficulty,
        target: generated.target,
        unit: generated.unit,
        xpReward: generated.suggestedXp,
        statRewards: { [generated.primaryStat]: 1 },
        deadline: '21:00',
        status: 'AVAILABLE',
        createdAt: new Date().toISOString(),
        steps: generated.steps
      };

      const newEvent: SystemEvent = {
        id: `evt-${Date.now()}`,
        type: 'QUEST_CREATED',
        title: `Protocol Generated: ${currentQuest.title}`,
        description: generated.systemCommentary || 'Directive formulated by System Intelligence.',
        timestamp: new Date().toISOString()
      };
      eventLogs.unshift(newEvent);

      res.json({
        success: true,
        quest: currentQuest,
        commentary: generated.systemCommentary
      });
    } catch (err: any) {
      res.status(500).json({ error: 'Failed to generate quest', details: err.message });
    }
  });

  // 6. Start Quest
  app.post('/api/quest/start', (req, res) => {
    const { questId } = req.body;
    if (currentQuest.id !== questId) {
      return res.status(404).json({ error: 'Quest target mismatch' });
    }
    currentQuest.status = 'IN_PROGRESS';
    eventLogs.unshift({
      id: `evt-${Date.now()}`,
      type: 'QUEST_STARTED',
      title: `Quest Commenced: ${currentQuest.title}`,
      description: 'Physical exertion initiated. Stop talking. Begin.',
      timestamp: new Date().toISOString()
    });
    res.json({ success: true, quest: currentQuest });
  });

  // 7. Complete Quest (CRITICAL SECURITY RULE: Calculations handled server-side only)
  app.post('/api/quest/complete', async (req, res) => {
    const { questId } = req.body;
    if (currentQuest.id !== questId) {
      return res.status(404).json({ error: 'Active quest not found or already completed.' });
    }
    if (currentQuest.status === 'COMPLETED') {
      return res.status(400).json({ error: 'Quest already completed' });
    }

    currentQuest.status = 'COMPLETED';
    currentQuest.completedAt = new Date().toISOString();
    if (currentQuest.steps) {
      currentQuest.steps = currentQuest.steps.map((s) => ({ ...s, completed: true }));
    }

    const result = await finalizeQuestCompletion(currentQuest, 'WEB', currentPlayer.lineUserId);

    res.json({
      success: true,
      quest: currentQuest,
      player: currentPlayer,
      levelUp: result.levelUp,
      rankUp: result.rankUp,
      oldLevel: result.oldLevel,
      newLevel: result.newLevel,
      oldRank: result.oldRank,
      newRank: result.newRank,
      xpGained: result.xpGained,
      statGained: result.statGained,
      systemMessage: result.levelUp
        ? `[SYSTEM]\nLEVEL UP\nLV. ${String(result.oldLevel).padStart(2, '0')} → LV. ${String(result.newLevel).padStart(2, '0')}\nYour body has become stronger.`
        : `[SYSTEM]\nQUEST COMPLETE.\n+${result.xpGained} XP.\nContinue.`
    });
  });

  // 7b. Toggle Quest Step Checklist Item
  app.post('/api/quest/step-toggle', (req, res) => {
    const { stepId, completed } = req.body;
    if (!currentQuest.steps || currentQuest.steps.length === 0) {
      return res.status(400).json({ error: 'Current quest has no checklist steps' });
    }
    const step = currentQuest.steps.find((s) => s.id === stepId);
    if (!step) {
      return res.status(404).json({ error: 'Step not found' });
    }
    step.completed = typeof completed === 'boolean' ? completed : !step.completed;
    const allCompleted = currentQuest.steps.every((s) => s.completed);

    res.json({
      success: true,
      quest: currentQuest,
      allCompleted
    });
  });

  // 8. Expire Quest & Trigger Penalty Protocol
  app.post('/api/quest/expire', (req, res) => {
    currentQuest.status = 'EXPIRED';

    eventLogs.unshift({
      id: `evt-${Date.now()}-exp`,
      type: 'QUEST_EXPIRED',
      title: 'QUEST EXPIRED',
      description: 'System has registered your failure. The System does not punish you. Your choice does.',
      timestamp: new Date().toISOString()
    });

    // Generate mild penalty quest per specification #21
    currentQuest = {
      id: `penalty-${Date.now()}`,
      ...PENALTY_QUEST_TEMPLATE,
      createdAt: new Date().toISOString(),
      status: 'AVAILABLE'
    };

    eventLogs.unshift({
      id: `evt-${Date.now()}-pen`,
      type: 'PENALTY_CREATED',
      title: 'PENALTY DIRECTIVE ISSUED',
      description: 'System Stability Recovery: 5-minute walk required to re-align neural state.',
      timestamp: new Date().toISOString()
    });

    res.json({
      success: true,
      quest: currentQuest,
      systemMessage: '[SYSTEM]\nQUEST EXPIRED.\nSystem has registered your failure.\nPENALTY QUEST ISSUED: Walk for 5 minutes.'
    });
  });

  // 9. Natural Language Command Processing (Gemini AI + Fallback)
  app.post('/api/ai/chat', async (req, res) => {
    const { message } = req.body;
    if (!message) {
      return res.status(400).json({ error: 'Message required' });
    }

    const aiResult = await processNaturalLanguageWithAI(message, currentPlayer);

    // If AI adjusted the quest based on user available time/condition
    if (aiResult.adjustedQuest && (aiResult.intent === 'QUEST_ADJUSTMENT' || aiResult.adjustedQuest.title)) {
      currentQuest = {
        id: `quest-adj-${Date.now()}`,
        title: aiResult.adjustedQuest.title || 'Recalibrated Protocol',
        description: aiResult.adjustedQuest.description || 'Optimized time-efficient directive.',
        type: 'STRENGTH',
        difficulty: (aiResult.adjustedQuest.difficulty as any) || 'NORMAL',
        target: aiResult.adjustedQuest.target || 20,
        unit: aiResult.adjustedQuest.unit || 'reps',
        xpReward: aiResult.adjustedQuest.suggestedXp || 60,
        statRewards: { STR: 1, VIT: 1 },
        deadline: '21:00',
        status: 'AVAILABLE',
        createdAt: new Date().toISOString(),
        steps: aiResult.adjustedQuest.steps
      };

      eventLogs.unshift({
        id: `evt-${Date.now()}`,
        type: 'QUEST_CREATED',
        title: `Parameters Adapted: ${currentQuest.title}`,
        description: `Natural language directive applied. Time constraint adapted.`,
        timestamp: new Date().toISOString()
      });
    }

    // If user logged workout via text
    if (aiResult.workoutLog) {
      const minutes = aiResult.workoutLog.minutes || 30;
      const xpEarned = Math.round(minutes * 2);
      currentPlayer.totalWorkoutMinutes += minutes;
      currentPlayer.xp += xpEarned;

      workoutLogs.unshift({
        id: `wk-chat-${Date.now()}`,
        title: aiResult.workoutLog.activity || 'Workout Logged via System Command',
        durationMinutes: minutes,
        xpEarned,
        statsEarned: { VIT: 1 },
        date: new Date().toISOString(),
        source: 'WEB'
      });
    }

    // If user scheduled a reminder via natural language (Requirement 1, 2, 3)
    if (aiResult.reminderRequest && aiResult.reminderRequest.remindAt) {
      const remindTime = new Date(aiResult.reminderRequest.remindAt);
      if (!isNaN(remindTime.getTime())) {
        const targetUserId = currentPlayer.lineUserId || Array.from(connectedLineUserIds)[0] || 'local-web-hunter';
        const reminderId = `remind-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
        pendingReminders.push({
          id: reminderId,
          userId: targetUserId,
          remindAt: remindTime.toISOString(),
          message: aiResult.reminderRequest.message || `[SYSTEM REMINDER] ถึงเวลาที่คุณกำหนดไว้แล้ว จงเริ่มการฝึกฝน`,
          sent: false
        });

        const timeFormatted = remindTime.toLocaleTimeString('th-TH', {
          timeZone: 'Asia/Bangkok',
          hour: '2-digit',
          minute: '2-digit'
        });

        eventLogs.unshift({
          id: `evt-${Date.now()}-remind-reg`,
          type: 'STATUS_SYNC',
          title: 'Reminder Protocol Scheduled',
          description: `Target alert set for ${timeFormatted} น.`,
          timestamp: new Date().toISOString()
        });
      }
    }

    res.json({
      success: true,
      systemMessage: aiResult.systemMessage,
      intent: aiResult.intent,
      quest: currentQuest,
      player: currentPlayer,
      healthWarning: aiResult.healthWarning,
      reminderRequest: aiResult.reminderRequest
    });
  });

  // 10. Pending Reminders Query
  app.get('/api/reminders', (_req, res) => {
    res.json({
      reminders: pendingReminders,
      count: pendingReminders.length,
      activeCount: pendingReminders.filter((r) => !r.sent).length
    });
  });

  // 11. History & Activity Timeline
  app.get('/api/history', (_req, res) => {
    res.json({
      events: eventLogs,
      workouts: workoutLogs,
      stats: {
        totalQuests: currentPlayer.totalQuestCompleted,
        totalMinutes: currentPlayer.totalWorkoutMinutes,
        currentStreak: currentPlayer.streak
      }
    });
  });

  // 11. LINE Status & Diagnostic
  app.get('/api/line/status', (_req, res) => {
    const hasSecret = Boolean(process.env.LINE_CHANNEL_SECRET && process.env.LINE_CHANNEL_SECRET.trim().length > 0);
    const hasToken = Boolean(process.env.LINE_CHANNEL_ACCESS_TOKEN && process.env.LINE_CHANNEL_ACCESS_TOKEN.trim().length > 0);
    const appUrl = process.env.APP_URL || '';

    res.json({
      isConfigured: hasSecret && hasToken,
      hasSecret,
      hasToken,
      connectedUsersCount: connectedLineUserIds.size,
      webhookUrl: appUrl ? `${appUrl}/api/line/webhook` : '/api/line/webhook'
    });
  });

  // 11b. Per-user Rich Menu switching (normal/debuff)
  app.post('/api/line/richmenu/switch-debuff/:userId', async (req, res) => {
    const userId = req.params.userId;
    const appUrl = process.env.APP_URL || `${req.protocol}://${req.get('host')}`;
    if (!userId) return res.status(400).json({ success: false, error: 'userId is required' });
    const success = await switchToDebuffMenuForUser(userId, appUrl);
    res.status(success ? 200 : 500).json({ success, userId, mode: 'debuff' });
  });

  app.post('/api/line/richmenu/switch-normal/:userId', async (req, res) => {
    const userId = req.params.userId;
    if (!userId) return res.status(400).json({ success: false, error: 'userId is required' });
    const success = await switchToNormalMenuForUser(userId);
    res.status(success ? 200 : 500).json({ success, userId, mode: 'normal' });
  });

  // 12. Push Quest to Connected LINE Accounts (or test user)
  app.post('/api/line/push-quest', async (req, res) => {
    const appUrl = process.env.APP_URL || 'http://localhost:3000';
    const flexMsg = createQuestFlexMessage(currentQuest, appUrl);
    const token = process.env.LINE_CHANNEL_ACCESS_TOKEN;

    if (!token) {
      return res.status(400).json({
        success: false,
        error: 'LINE_CHANNEL_ACCESS_TOKEN is not configured. Add it in AI Studio Secrets or environment.',
        flexMessage: flexMsg
      });
    }

    const { targetUserId } = req.body;
    const targets = targetUserId ? [targetUserId] : Array.from(connectedLineUserIds);

    if (targets.length === 0) {
      return res.json({
        success: false,
        message: 'No connected LINE users registered yet. Add the LINE bot as friend or send a message to it first!',
        connectedUsersCount: 0,
        flexMessage: flexMsg
      });
    }

    const results = [];
    for (const uid of targets) {
      const ok = await sendLinePushMessage(uid, [flexMsg]);
      results.push({ userId: uid, success: ok });
    }

    eventLogs.unshift({
      id: `evt-push-${Date.now()}`,
      type: 'QUEST_CREATED',
      title: 'LINE Daily Directive Pushed',
      description: `Dispatched daily quest to ${results.filter((r) => r.success).length} hunters.`,
      timestamp: new Date().toISOString()
    });

    res.json({
      success: results.some((r) => r.success),
      results,
      connectedUsersCount: connectedLineUserIds.size
    });
  });

  // 13. Push 20:00 Deadline Reminder to Connected LINE Accounts
  app.post('/api/line/push-reminder', async (req, res) => {
    const appUrl = process.env.APP_URL || 'http://localhost:3000';
    const flexMsg = createReminderFlexMessage(currentQuest, appUrl);
    const token = process.env.LINE_CHANNEL_ACCESS_TOKEN;

    if (!token) {
      return res.status(400).json({
        success: false,
        error: 'LINE_CHANNEL_ACCESS_TOKEN is not configured. Add it in AI Studio Secrets or environment.',
        flexMessage: flexMsg
      });
    }

    const { targetUserId } = req.body;
    const targets = targetUserId ? [targetUserId] : Array.from(connectedLineUserIds);

    if (targets.length === 0) {
      return res.json({
        success: false,
        message: 'No connected LINE users registered yet. Add the LINE bot as friend or send a message to it first!',
        connectedUsersCount: 0,
        flexMessage: flexMsg
      });
    }

    const results = [];
    for (const uid of targets) {
      const ok = await sendLinePushMessage(uid, [flexMsg]);
      results.push({ userId: uid, success: ok });
    }

    eventLogs.unshift({
      id: `evt-remind-${Date.now()}`,
      type: 'SYSTEM_WARNING',
      title: 'LINE Deadline Warning Pushed',
      description: `Dispatched 20:00 urgency reminder to ${results.filter((r) => r.success).length} hunters.`,
      timestamp: new Date().toISOString()
    });

    res.json({
      success: results.some((r) => r.success),
      results,
      connectedUsersCount: connectedLineUserIds.size
    });
  });

  // 13b. Get AI Morning Health Briefing
  app.get('/api/health-briefing', async (_req, res) => {
    try {
      const briefing = await generateDailyHealthBriefing(currentPlayer, currentQuest);
      res.json({
        success: true,
        briefing,
        player: currentPlayer,
        quest: currentQuest
      });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err?.message || 'Briefing error' });
    }
  });

  // 13c. Push Morning Health Briefing via LINE
  app.post('/api/line/push-briefing', async (req, res) => {
    const appUrl = process.env.APP_URL || 'http://localhost:3000';
    const briefing = await generateDailyHealthBriefing(currentPlayer, currentQuest);
    const flexMsg = createBriefingFlexMessage(briefing, currentPlayer, currentQuest, appUrl);
    const token = process.env.LINE_CHANNEL_ACCESS_TOKEN;

    if (!token) {
      return res.status(400).json({
        success: false,
        error: 'LINE_CHANNEL_ACCESS_TOKEN is not configured. Add it in AI Studio Secrets or environment.',
        briefing,
        flexMessage: flexMsg
      });
    }

    const { targetUserId } = req.body;
    const targets = targetUserId ? [targetUserId] : Array.from(connectedLineUserIds);

    if (targets.length === 0) {
      return res.json({
        success: false,
        message: 'No connected LINE users registered yet. Add the LINE bot as friend or send a message to it first!',
        connectedUsersCount: 0,
        briefing,
        flexMessage: flexMsg
      });
    }

    const results = [];
    for (const uid of targets) {
      const ok = await sendLinePushMessage(uid, [flexMsg]);
      results.push({ userId: uid, success: ok });
    }

    eventLogs.unshift({
      id: `evt-briefing-${Date.now()}`,
      type: 'STATUS_SYNC',
      title: 'Morning Health Briefing Dispatched',
      description: `Readiness Score ${briefing.readinessScore}% sent to ${results.filter((r) => r.success).length} hunters.`,
      timestamp: new Date().toISOString()
    });

    res.json({
      success: results.some((r) => r.success),
      results,
      briefing,
      connectedUsersCount: connectedLineUserIds.size
    });
  });

  // 14. LINE Webhook Endpoint (Official LINE Messaging API Spec)
  app.post('/api/line/webhook', async (req: any, res) => {
    const signature = req.headers['x-line-signature'] as string;
    const channelSecret = process.env.LINE_CHANNEL_SECRET;

    // Signature verification if channel secret configured
    if (channelSecret && signature) {
      const isValid = verifyLineSignature(req.rawBody || JSON.stringify(req.body), signature, channelSecret);
      if (!isValid) {
        console.warn('[LINE] Signature verification failed');
        return res.status(401).send('Invalid signature');
      }
    }

    const events = req.body.events || [];
    const appUrl = process.env.APP_URL || 'http://localhost:3000';

    for (const event of events) {
      const userId = event.source?.userId;
      if (userId) {
        connectedLineUserIds.add(userId);
        if (!currentPlayer.lineUserId) {
          currentPlayer.lineUserId = userId;
          currentPlayer.isLineConnected = true;
        }
      }

      const replyToken = event.replyToken;

      // Handle Follow / Friend Add event
      if (event.type === 'follow') {
        eventLogs.unshift({
          id: `evt-line-${Date.now()}`,
          type: 'STREAK_MAINTAINED',
          title: 'LINE Hunter Connected',
          description: 'Hunter established neural link via LINE Messaging API.',
          timestamp: new Date().toISOString()
        });

        if (replyToken) {
          const questFlex = createQuestFlexMessage(currentQuest, appUrl);
          await replyLineMessage(replyToken, [
            {
              type: 'text',
              text: '[SYSTEM DETECTED]\nยินดีต้อนรับ Hunter สู่ THE SYSTEM: Fitness Ascension Protocol.\nระบบได้ทำการเชื่อมต่อสถานะของคุณแล้ว ภารกิจประจำวันของคุณพร้อมแล้ว'
            },
            questFlex
          ]);
        }
      } else if (event.type === 'message' && event.message.type === 'text') {
        const text = event.message.text.trim();
        const lower = text.toLowerCase();

        // Feature 8: Reflection gate. The user's first reply after a missed deadline
        // is treated as the requested explanation and evaluated by Gemini.
        if (awaitingReflectionFromUserId === userId && awaitingReflectionQuestId === currentQuest.id) {
          const reflectionUserId = userId || currentPlayer.lineUserId;
          try {
            const analysis = await analyzeExcuseWithAI(text);
            awaitingReflectionFromUserId = null;
            awaitingReflectionQuestId = null;

            eventLogs.unshift({
              id: `evt-${Date.now()}-reflection`,
              type: 'REFLECTION_EVALUATED',
              title: `[REFLECTION] ${analysis.validExcuse ? 'EXCUSE ACCEPTED' : 'EXCUSE REJECTED'}`,
              description: analysis.systemResponse,
              timestamp: new Date().toISOString()
            });

            if (analysis.validExcuse) {
              currentQuest.status = 'EXPIRED';
              eventLogs.unshift({
                id: `evt-${Date.now()}-reflection-valid`,
                type: 'QUEST_EXPIRED',
                title: '[SYSTEM] PENALTY EXEMPTION GRANTED',
                description: 'Deadline miss was accepted as a serious illness, injury, or force-majeure event. No debuff or demotion applied.',
                timestamp: new Date().toISOString()
              });
              if (replyToken) {
                await replyLineMessage(replyToken, [{
                  type: 'text',
                  text: `${analysis.systemResponse}\n\n[SYSTEM] Debuff และการลด Rank จะไม่ถูกนำมาใช้ในครั้งนี้`
                }]);
              }
            } else {
              const penalty = await applyDeadlinePenalty(reflectionUserId || undefined);
              if (replyToken) {
                await replyLineMessage(replyToken, [{
                  type: 'text',
                  text: `${analysis.systemResponse}\n\n${penalty.message}`
                }]);
              }
            }
          } catch (error: any) {
            awaitingReflectionFromUserId = null;
            awaitingReflectionQuestId = null;
            console.error('[THE SYSTEM] Reflection processing failed:', error?.message || error);
            if (replyToken) {
              await replyLineMessage(replyToken, [{
                type: 'text',
                text: '[SYSTEM] ไม่สามารถประมวลผลเหตุผลได้ในขณะนี้ ระบบจะยังไม่ลงโทษจนกว่าจะสามารถตรวจสอบเหตุผลได้อีกครั้ง'
              }]);
            }
          }
        }
        // Feature 1/7: Explicit completion target selection for overlapping quests.
        else if (lower === 'เสร็จแล้ว: ฉุกเฉิน' || lower === 'complete emergency' || lower === 'emergency complete') {
          if (emergencyQuest && emergencyQuest.status !== 'COMPLETED' && emergencyQuest.status !== 'EXPIRED') {
            const quest = emergencyQuest;
            const result = await completeSpecialQuest(quest, 'EMERGENCY', userId);
            if (replyToken) {
              await replyLineMessage(replyToken, [createCompletionFlexMessage(quest, currentPlayer)]);
            }
          } else if (replyToken) {
            await replyLineMessage(replyToken, [{ type: 'text', text: '[SYSTEM] ไม่พบ Emergency Quest ที่ยัง active อยู่' }]);
          }
        }
        else if (lower === 'เสร็จแล้ว: boss' || lower === 'complete boss' || lower === 'boss complete') {
          if (weeklyBossQuest && weeklyBossQuest.status !== 'COMPLETED' && weeklyBossQuest.status !== 'EXPIRED') {
            const quest = weeklyBossQuest;
            const result = await completeSpecialQuest(quest, 'BOSS', userId);
            if (replyToken) {
              await replyLineMessage(replyToken, [createCompletionFlexMessage(quest, currentPlayer)]);
            }
          } else if (replyToken) {
            await replyLineMessage(replyToken, [{ type: 'text', text: '[SYSTEM] ไม่พบ WEEKLY BOSS ที่ยัง active อยู่' }]);
          }
        }
        // Feature 1: Emergency Quest inquiry
        if (lower === 'emergency' || lower.includes('เควสฉุกเฉิน') || lower.includes('ภารกิจฉุกเฉิน')) {
          if (emergencyQuest && emergencyQuest.status !== 'EXPIRED' && emergencyQuest.status !== 'COMPLETED') {
            if (replyToken) await replyLineMessage(replyToken, [createQuestFlexMessage(emergencyQuest, appUrl)]);
          } else if (replyToken) {
            await replyLineMessage(replyToken, [{ type: 'text', text: '[SYSTEM] ขณะนี้ไม่มี Emergency Quest ที่ active อยู่' }]);
          }
        }
        // Feature 2: Weekly Boss Quest inquiry
        else if (lower === 'boss' || lower === 'weekly boss' || lower.includes('บอสประจำสัปดาห์')) {
          if (weeklyBossQuest && weeklyBossQuest.status !== 'EXPIRED' && weeklyBossQuest.status !== 'COMPLETED') {
            if (replyToken) await replyLineMessage(replyToken, [createQuestFlexMessage(weeklyBossQuest, appUrl)]);
          } else if (replyToken) {
            await replyLineMessage(replyToken, [{ type: 'text', text: '[SYSTEM] ขณะนี้ไม่มี WEEKLY BOSS ที่ active อยู่' }]);
          }
        }
        // 1. Check for Quest inquiry
        else if (
          lower === 'quest' ||
          lower.includes('เควสต์') ||
          lower.includes('ภารกิจ') ||
          lower === 'today' ||
          lower.includes('ขอเควสต์')
        ) {
          const questFlex = createQuestFlexMessage(currentQuest, appUrl);
          if (replyToken) {
            await replyLineMessage(replyToken, [questFlex]);
          }
        }
        // 2. Check for Status inquiry
        else if (
          lower === 'status' ||
          lower.includes('สเตตัส') ||
          lower.includes('เลเวล') ||
          lower === 'rank' ||
          lower === 'level' ||
          lower.includes('พลัง')
        ) {
          const statusFlex = createStatusFlexMessage(currentPlayer, appUrl);
          if (replyToken) {
            await replyLineMessage(replyToken, [statusFlex]);
          }
        }
        // 3. Check for Morning Health Briefing Command
        else if (
          lower === 'briefing' ||
          lower.includes('รายงาน') ||
          lower.includes('สภาพร่างกาย') ||
          lower.includes('สุขภาพ') ||
          lower.includes('ตอนเช้า') ||
          lower === 'morning'
        ) {
          const briefing = await generateDailyHealthBriefing(currentPlayer, currentQuest);
          const briefingFlex = createBriefingFlexMessage(briefing, currentPlayer, currentQuest, appUrl);
          if (replyToken) {
            await replyLineMessage(replyToken, [briefingFlex]);
          }
        }
        // 4. Check for Quick Completion
        else if (
          lower === 'complete' ||
          lower === 'done' ||
          lower.includes('เสร็จแล้ว') ||
          lower === 'สำเร็จ' ||
          lower === 'ทำเสร็จแล้ว'
        ) {
          const hasActiveEmergency = Boolean(emergencyQuest && emergencyQuest.status !== 'COMPLETED' && emergencyQuest.status !== 'EXPIRED');
          const hasActiveBoss = Boolean(weeklyBossQuest && weeklyBossQuest.status !== 'COMPLETED' && weeklyBossQuest.status !== 'EXPIRED');
          const dailyIsCompletable = currentQuest.status !== 'COMPLETED' && currentQuest.status !== 'EXPIRED' && currentQuest.status !== 'RESTED';

          if ((hasActiveEmergency || hasActiveBoss) && dailyIsCompletable) {
            if (replyToken) await replyLineMessage(replyToken, [buildCompletionChoiceMessage()]);
          } else if (hasActiveEmergency && !dailyIsCompletable && !hasActiveBoss) {
            const quest = emergencyQuest!;
            await completeSpecialQuest(quest, 'EMERGENCY', userId);
            if (replyToken) await replyLineMessage(replyToken, [createCompletionFlexMessage(quest, currentPlayer)]);
          } else if (hasActiveBoss && !dailyIsCompletable && !hasActiveEmergency) {
            const quest = weeklyBossQuest!;
            await completeSpecialQuest(quest, 'BOSS', userId);
            if (replyToken) await replyLineMessage(replyToken, [createCompletionFlexMessage(quest, currentPlayer)]);
          } else if (dailyIsCompletable) {
            currentQuest.status = 'COMPLETED';
            currentQuest.completedAt = new Date().toISOString();
            if (currentQuest.steps) {
              currentQuest.steps = currentQuest.steps.map((s) => ({ ...s, completed: true }));
            }
            await finalizeQuestCompletion(currentQuest, 'LINE', userId);
            if (replyToken) {
              await replyLineMessage(replyToken, [createCompletionFlexMessage(currentQuest, currentPlayer)]);
            }
          } else if (replyToken) {
            // Preserve the previous behavior when the daily quest is already completed/rested/expired.
            await replyLineMessage(replyToken, [createCompletionFlexMessage(currentQuest, currentPlayer)]);
          }
        }
        // 5. Rest Day Protocol ("ขอพัก" / "rest day" - Feature 4)
        else if (
          lower === 'ขอพัก' ||
          lower === 'rest day' ||
          lower.includes('ขอพัก') ||
          lower.includes('rest day')
        ) {
          const bangkokNow = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Bangkok' }));
          const currentWeekId = getWeekIdentifier(bangkokNow);

          if (lastRestDayUsedWeek === currentWeekId) {
            const replyMsg = `[SYSTEM NOTICE: REQUEST DENIED]\nโควต้า Rest Day สัปดาห์นี้หมดแล้ว (อนุญาตเพียง 1 ครั้งต่อสัปดาห์)\nระบบปฏิเสธคำขอการพักผ่อน จงกลับไปทำภารกิจ '${currentQuest.title}' อย่าให้ความอ่อนแอเข้าควบคุม`;
            if (replyToken) {
              await replyLineMessage(replyToken, [{ type: 'text', text: replyMsg }]);
            }
          } else {
            lastRestDayUsedWeek = currentWeekId;
            currentQuest.status = 'RESTED';
            eventLogs.unshift({
              id: `evt-${Date.now()}-rest-day`,
              type: 'REST_DAY_ACTIVATED',
              title: '[REST DAY PROTOCOL ACTIVATED]',
              description: 'System approved biological muscle recovery window (1/1 weekly quota). Penalty exemption applied.',
              timestamp: new Date().toISOString()
            });
            const replyMsg = `[SYSTEM NOTICE: REST PROTOCOL APPROVED]\nอนุมัติสิทธิ์พักฟื้นกล้ามเนื้อ (Rest Day) ประจำสัปดาห์ (1/1 ครั้ง)\nสถานะเควสถูกปรับเป็น 'RESTED' จะไม่มีการลงโทษ Debuff หรือลด Rank ในค่ำคืนนี้ จงใช้เวลานี้ฟื้นฟูกล้ามเนื้อและเตรียมพร้อมสำหรับวันพรุ่งนี้`;
            if (replyToken) {
              await replyLineMessage(replyToken, [{ type: 'text', text: replyMsg }]);
            }
          }
        }
        // 6. Surveillance Check-in Responses ("ทำแล้ว", "กำลังทำ", "ยังไม่ทำ" - Feature 2)
        else if (lower === 'ทำแล้ว' || lower === 'ทำเสร็จแล้ว') {
          let replyText = `[SYSTEM VERIFIED]\nบันทึกข้อมูลแล้ว: สถานะภารกิจ '${currentQuest.title}' ได้รับการตรวจสอบ`;
          if (currentQuest.status !== 'COMPLETED') {
            currentQuest.status = 'COMPLETED';
            currentQuest.completedAt = new Date().toISOString();
            if (currentQuest.steps) {
              currentQuest.steps = currentQuest.steps.map((s) => ({ ...s, completed: true }));
            }
            const result = await finalizeQuestCompletion(currentQuest, 'LINE', userId);
            replyText += `\n✓ ยืนยันการบรรลุเป้าหมาย! ได้รับ +${result.xpGained} XP`;
            if (result.levelUp) replyText += `\n★ LEVEL UP! [LV. ${result.newLevel}]`;
          } else {
            replyText += `\nสถานะภารกิจสมบูรณ์แล้ว ร่างกายอยู่ในสภาวะพร้อมรับการเติบโต`;
          }
          if (replyToken) {
            await replyLineMessage(replyToken, [{ type: 'text', text: replyText }]);
          }
        } else if (lower === 'กำลังทำ' || lower.includes('กำลังทำ') || lower.includes('กำลังออกกำลัง')) {
          const bangkokNow = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Bangkok' }));
          const remainMins = getRemainingMinutesToDeadline(currentQuest.deadline, bangkokNow);
          const hoursRem = Math.floor(Math.max(0, remainMins) / 60);
          const minsRem = Math.max(0, remainMins) % 60;
          const timeStr = hoursRem > 0 ? `${hoursRem} ชั่วโมง ${minsRem} นาที` : `${minsRem} นาที`;
          const replyText = `[SYSTEM MONITORED]\nรับทราบ เร่งความเร็วและรักษาฟอร์มการเคลื่อนไหวให้ถูกต้อง\nเหลือเวลาอีกประมาณ ${timeStr} ก่อนที่บทลงโทษและเส้นตาย (${currentQuest.deadline} น.) จะเริ่มทำงาน`;
          if (replyToken) {
            await replyLineMessage(replyToken, [{ type: 'text', text: replyText }]);
          }
        } else if (lower === 'ยังไม่ทำ' || lower.includes('ยังไม่ทำ') || lower.includes('ยังไม่ได้ทำ')) {
          const replyText = `[SYSTEM WARNING]\nคำเตือน: ความเกียจคร้านคือบ่อเกิดของความล้มเหลว โทษทัณฑ์ Debuff 'Weakened' (XP ลด 50%) กำลังรอคุณอยู่หากไม่เริ่มต้นทันที จงขยับร่างกายเดี๋ยวนี้!`;
          if (replyToken) {
            await replyLineMessage(replyToken, [{ type: 'text', text: replyText }]);
          }
        }
        // 7. Weekly Evaluation Summary on demand ("สรุปสัปดาห์" / "weekly summary" - Feature 4)
        else if (
          lower === 'สรุปสัปดาห์' ||
          lower === 'weekly' ||
          lower === 'weekly summary' ||
          lower.includes('สรุปผล') ||
          lower.includes('รายงานสัปดาห์')
        ) {
          const bangkokNow = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Bangkok' }));
          const todayStr = bangkokNow.toISOString().slice(0, 10);
          const summaryData = calculateWeeklySummaryData(todayStr);
          const weeklyFlex = createWeeklySummaryFlexMessage(summaryData, currentPlayer, appUrl);
          if (replyToken) {
            await replyLineMessage(replyToken, [weeklyFlex]);
          }
        }
        // 8. Fallback to Gemini AI natural language engine
        else {
          const aiResponse = await processNaturalLanguageWithAI(text, currentPlayer);

          // Handle Custom User-Scheduled Reminder (Requirement 1, 3, 5)
          if (aiResponse.reminderRequest && aiResponse.reminderRequest.remindAt) {
            const remindTime = new Date(aiResponse.reminderRequest.remindAt);
            if (!isNaN(remindTime.getTime())) {
              const lineUserId = event.source?.userId || userId || 'unknown-hunter';
              const reminderId = `remind-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
              pendingReminders.push({
                id: reminderId,
                userId: lineUserId,
                remindAt: remindTime.toISOString(),
                message: aiResponse.reminderRequest.message || `[SYSTEM REMINDER] ถึงเวลาที่คุณกำหนดไว้แล้ว จงเริ่มการฝึกฝน`,
                sent: false
              });

              console.log(`[THE SYSTEM] Registered PendingReminder [${reminderId}] for LINE user ${lineUserId} at ${remindTime.toISOString()}`);

              const timeFormatted = remindTime.toLocaleTimeString('th-TH', {
                timeZone: 'Asia/Bangkok',
                hour: '2-digit',
                minute: '2-digit'
              });

              eventLogs.unshift({
                id: `evt-${Date.now()}-remind-reg`,
                type: 'STATUS_SYNC',
                title: 'Reminder Protocol Scheduled',
                description: `Target alert set for ${timeFormatted} น. (Hunter: ${lineUserId.slice(0, 10)}...)`,
                timestamp: new Date().toISOString()
              });
            }
          }

          let questFlexToAttach = null;
          if (aiResponse.adjustedQuest && (aiResponse.intent === 'QUEST_ADJUSTMENT' || aiResponse.adjustedQuest.title)) {
            currentQuest = {
              id: `quest-adj-${Date.now()}`,
              title: aiResponse.adjustedQuest.title || 'Recalibrated Protocol',
              description: aiResponse.adjustedQuest.description || 'Optimized time-efficient directive.',
              type: 'STRENGTH',
              difficulty: (aiResponse.adjustedQuest.difficulty as any) || 'NORMAL',
              target: aiResponse.adjustedQuest.target || 20,
              unit: aiResponse.adjustedQuest.unit || 'reps',
              xpReward: aiResponse.adjustedQuest.suggestedXp || 60,
              statRewards: { STR: 1, VIT: 1 },
              deadline: '21:00',
              status: 'AVAILABLE',
              createdAt: new Date().toISOString(),
              steps: aiResponse.adjustedQuest.steps
            };
            questFlexToAttach = createQuestFlexMessage(currentQuest, appUrl);
          }

          if (replyToken) {
            const replyPayload: any[] = [{ type: 'text', text: aiResponse.systemMessage }];
            if (questFlexToAttach) {
              replyPayload.push(questFlexToAttach);
            }
            await replyLineMessage(replyToken, replyPayload);
          }
        }
      } else if (event.type === 'postback') {
        const data = event.postback?.data || '';
        if (data.includes('action=complete')) {
          const hasActiveEmergency = Boolean(emergencyQuest && emergencyQuest.status !== 'COMPLETED' && emergencyQuest.status !== 'EXPIRED');
          const hasActiveBoss = Boolean(weeklyBossQuest && weeklyBossQuest.status !== 'COMPLETED' && weeklyBossQuest.status !== 'EXPIRED');
          const dailyIsCompletable = currentQuest.status !== 'COMPLETED' && currentQuest.status !== 'EXPIRED' && currentQuest.status !== 'RESTED';

          if ((hasActiveEmergency || hasActiveBoss) && dailyIsCompletable) {
            if (replyToken) await replyLineMessage(replyToken, [buildCompletionChoiceMessage()]);
          } else if (hasActiveEmergency && !dailyIsCompletable && !hasActiveBoss) {
            const quest = emergencyQuest!;
            await completeSpecialQuest(quest, 'EMERGENCY', userId);
            if (replyToken) await replyLineMessage(replyToken, [createCompletionFlexMessage(quest, currentPlayer)]);
          } else if (hasActiveBoss && !dailyIsCompletable && !hasActiveEmergency) {
            const quest = weeklyBossQuest!;
            await completeSpecialQuest(quest, 'BOSS', userId);
            if (replyToken) await replyLineMessage(replyToken, [createCompletionFlexMessage(quest, currentPlayer)]);
          } else if (dailyIsCompletable) {
            currentQuest.status = 'COMPLETED';
            currentQuest.completedAt = new Date().toISOString();
            if (currentQuest.steps) {
              currentQuest.steps = currentQuest.steps.map((s) => ({ ...s, completed: true }));
            }
            await finalizeQuestCompletion(currentQuest, 'LINE', userId);

            if (replyToken) {
              const compFlex = createCompletionFlexMessage(currentQuest, currentPlayer);
              await replyLineMessage(replyToken, [compFlex]);
            }
          } else if (replyToken) {
            await replyLineMessage(replyToken, [{ type: 'text', text: '[SYSTEM] ไม่พบภารกิจที่พร้อมบันทึกผลสำเร็จในขณะนี้' }]);
          }
        }
      }
    }

    res.status(200).json({ status: 'success' });
  });

  // 12. LINE In-App Simulator (Allows testing LINE messages and Flex Message preview directly!)
  app.post('/api/line/simulate', async (req, res) => {
    const { message, action } = req.body;
    const appUrl = process.env.APP_URL || 'http://localhost:3000';

    if (action === 'GET_QUEST_FLEX') {
      const flexMsg = createQuestFlexMessage(currentQuest, appUrl);
      return res.json({
        type: 'flex',
        flexMessage: flexMsg,
        systemText: `[SYSTEM]\nPLAYER DETECTED.\nDaily Quest has been generated.\n\n${currentQuest.title.toUpperCase()}\n${currentQuest.target} ${currentQuest.unit.toUpperCase()}\n+${currentQuest.xpReward} XP\nDeadline: ${currentQuest.deadline}`
      });
    }

    if (action === 'GET_BRIEFING_FLEX') {
      const briefing = await generateDailyHealthBriefing(currentPlayer, currentQuest);
      const flexMsg = createBriefingFlexMessage(briefing, currentPlayer, currentQuest, appUrl);
      return res.json({
        type: 'flex',
        flexMessage: flexMsg,
        briefing,
        systemText: `[SYSTEM MORNING DIRECTIVE]\nReadiness: ${briefing.readinessScore}%\n${briefing.greeting}\n${briefing.conditionAssessment}`
      });
    }

    if (action === 'GET_REMINDER') {
      return res.json({
        type: 'text',
        systemText: `[SYSTEM WARNING]\nDaily Quest remains incomplete.\nTime remaining: 02:14:36\nDo not let complacency erode your ascension.`
      });
    }

    if (action === 'GET_WEEKLY_SUMMARY') {
      const bangkokNow = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Bangkok' }));
      const todayStr = bangkokNow.toISOString().slice(0, 10);
      const summaryData = calculateWeeklySummaryData(todayStr);
      const flexMsg = createWeeklySummaryFlexMessage(summaryData, currentPlayer, appUrl);
      return res.json({
        type: 'flex',
        flexMessage: flexMsg,
        summary: summaryData,
        systemText: `[WEEKLY SYSTEM DEBRIEF]\nภารกิจที่สำเร็จ: ${summaryData.totalQuests}\nEXP ที่ได้รับ: +${summaryData.totalXp} XP\nStreak: ${summaryData.currentStreak} วัน\nพลาด Deadline: ${summaryData.missedDeadlines} ครั้ง`
      });
    }

    if (action === 'TRIGGER_SURVEILLANCE') {
      return res.json({
        type: 'text',
        systemText: `[SYSTEM] ตรวจสอบสถานะฉับพลัน (Surveillance Protocol)\nผู้เล่น ${currentPlayer.displayName}: ระบบกำลังตรวจวัดอัตราการเผาผลาญและความคืบหน้าของ Daily Quest '${currentQuest.title}'\nจงรายงานสถานะความคืบหน้าในปัจจุบันทันที: [ทำแล้ว] [กำลังทำ] [ยังไม่ทำ]`,
        quickReplies: ['ทำแล้ว', 'กำลังทำ', 'ยังไม่ทำ']
      });
    }

    if (action === 'TRIGGER_PENALTY') {
      currentQuest.status = 'EXPIRED';
      currentPlayer.missedDeadlineStreak = (currentPlayer.missedDeadlineStreak || 0) + 1;
      currentPlayer.activeDebuff = {
        name: 'SYSTEM PENALTY: Weakened',
        description: 'XP ที่ได้รับลดลง 50% จนกว่าจะทำเควสถัดไปสำเร็จ',
        appliedAt: new Date().toISOString(),
        xpMultiplier: 0.5
      };
      await switchToDebuffMenuForUser(
        currentPlayer.lineUserId || 'simulated-line-hunter',
        process.env.APP_URL || 'http://localhost:3000'
      );

      const rankOrder: Rank[] = ['E', 'D', 'C', 'B', 'A', 'S'];
      let demoted = false;
      const oldRank = currentPlayer.rank;
      if (currentPlayer.missedDeadlineStreak >= 3) {
        const currentIdx = rankOrder.indexOf(currentPlayer.rank);
        if (currentIdx > 0) {
          currentPlayer.rank = rankOrder[currentIdx - 1];
          demoted = true;
        }
        currentPlayer.missedDeadlineStreak = 0;
      }

      eventLogs.unshift({
        id: `evt-${Date.now()}-penalty-sim`,
        type: 'DEBUFF_APPLIED',
        title: '[SYSTEM PENALTY: WEAKENED DEBUFF]',
        description: `Missed quest deadline for ${currentQuest.title}. Weakened debuff activated (XP ×0.5). Missed streak: ${currentPlayer.missedDeadlineStreak}/3.`,
        timestamp: new Date().toISOString()
      });

      if (demoted) {
        eventLogs.unshift({
          id: `evt-${Date.now()}-rank-down-sim`,
          type: 'RANK_DOWN',
          title: `[RANK DEMOTION: RANK ${oldRank} → ${currentPlayer.rank}]`,
          description: `Disciplinary demotion: Missed quest deadline for 3 consecutive days. Rank downgraded.`,
          timestamp: new Date().toISOString()
        });
      }

      let penaltyNotice = `[SYSTEM PENALTY ENFORCED]\nคุณพลาด Deadline การปฏิบัติภารกิจ (${currentQuest.title})\nบทลงโทษถูกเปิดใช้งาน: ได้รับ Debuff 'Weakened' (XP ที่ได้รับจะลดลง 50% จนกว่าจะทำเควสถัดไปสำเร็จ)`;
      if (demoted) {
        penaltyNotice += `\n\n🚨 [RANK DEMOTION]\nเนื่องจากคุณพลาดภารกิจติดต่อกันครบ 3 วัน ระบบได้ลดระดับของคุณลงจาก RANK ${oldRank} สู่ RANK ${currentPlayer.rank}`;
      }

      return res.json({
        type: 'text',
        systemText: penaltyNotice,
        player: currentPlayer,
        quest: currentQuest
      });
    }

    if (action === 'TRIGGER_REST_DAY') {
      const bangkokNow = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Bangkok' }));
      const currentWeekId = getWeekIdentifier(bangkokNow);
      if (lastRestDayUsedWeek === currentWeekId) {
        return res.json({
          type: 'text',
          systemText: `[SYSTEM NOTICE: REQUEST DENIED]\nโควต้า Rest Day สัปดาห์นี้หมดแล้ว (อนุญาตเพียง 1 ครั้งต่อสัปดาห์)\nระบบปฏิเสธคำขอการพักผ่อน จงกลับไปทำภารกิจ '${currentQuest.title}' อย่าให้ความอ่อนแอเข้าควบคุม`,
          player: currentPlayer,
          quest: currentQuest
        });
      } else {
        lastRestDayUsedWeek = currentWeekId;
        currentQuest.status = 'RESTED';
        eventLogs.unshift({
          id: `evt-${Date.now()}-rest-day-sim`,
          type: 'REST_DAY_ACTIVATED',
          title: '[REST DAY PROTOCOL ACTIVATED]',
          description: 'System approved biological muscle recovery window (1/1 weekly quota). Penalty exemption applied.',
          timestamp: new Date().toISOString()
        });
        return res.json({
          type: 'text',
          systemText: `[SYSTEM NOTICE: REST PROTOCOL APPROVED]\nอนุมัติสิทธิ์พักฟื้นกล้ามเนื้อ (Rest Day) ประจำสัปดาห์ (1/1 ครั้ง)\nสถานะเควสถูกปรับเป็น 'RESTED' จะไม่มีการลงโทษ Debuff หรือลด Rank ในค่ำคืนนี้ จงใช้เวลานี้ฟื้นฟูกล้ามเนื้อและเตรียมพร้อมสำหรับวันพรุ่งนี้`,
          player: currentPlayer,
          quest: currentQuest
        });
      }
    }

    if (action === 'COMPLETE_VIA_LINE') {
      currentQuest.status = 'COMPLETED';
      const result = await finalizeQuestCompletion(currentQuest, 'LINE', currentPlayer.lineUserId || undefined);

      const flexMsg = createCompletionFlexMessage(currentQuest, currentPlayer);
      return res.json({
        type: 'flex',
        flexMessage: flexMsg,
        player: currentPlayer,
        quest: currentQuest,
        systemText: `QUEST COMPLETE\n+${currentQuest.xpReward} XP\n${Object.keys(currentQuest.statRewards)[0] || 'VIT'} +1\nSTREAK: ${currentPlayer.streak} DAYS\nKeep going.`
      });
    }

    const simMsgTrimmed = (message || '').trim();
    const simMsgLower = simMsgTrimmed.toLowerCase();

    // Check fast-path commands in simulated LINE
    if (
      simMsgLower === 'ขอพัก' ||
      simMsgLower === 'rest day' ||
      simMsgLower.includes('ขอพัก') ||
      simMsgLower.includes('rest day')
    ) {
      const bangkokNow = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Bangkok' }));
      const currentWeekId = getWeekIdentifier(bangkokNow);
      if (lastRestDayUsedWeek === currentWeekId) {
        return res.json({
          type: 'text',
          systemText: `[SYSTEM NOTICE: REQUEST DENIED]\nโควต้า Rest Day สัปดาห์นี้หมดแล้ว (อนุญาตเพียง 1 ครั้งต่อสัปดาห์)\nระบบปฏิเสธคำขอการพักผ่อน จงกลับไปทำภารกิจ '${currentQuest.title}' อย่าให้ความอ่อนแอเข้าควบคุม`,
          player: currentPlayer,
          quest: currentQuest
        });
      } else {
        lastRestDayUsedWeek = currentWeekId;
        currentQuest.status = 'RESTED';
        eventLogs.unshift({
          id: `evt-${Date.now()}-rest-day-sim`,
          type: 'REST_DAY_ACTIVATED',
          title: '[REST DAY PROTOCOL ACTIVATED]',
          description: 'System approved biological muscle recovery window (1/1 weekly quota). Penalty exemption applied.',
          timestamp: new Date().toISOString()
        });
        return res.json({
          type: 'text',
          systemText: `[SYSTEM NOTICE: REST PROTOCOL APPROVED]\nอนุมัติสิทธิ์พักฟื้นกล้ามเนื้อ (Rest Day) ประจำสัปดาห์ (1/1 ครั้ง)\nสถานะเควสถูกปรับเป็น 'RESTED' จะไม่มีการลงโทษ Debuff หรือลด Rank ในค่ำคืนนี้ จงใช้เวลานี้ฟื้นฟูกล้ามเนื้อและเตรียมพร้อมสำหรับวันพรุ่งนี้`,
          player: currentPlayer,
          quest: currentQuest
        });
      }
    }

    if (simMsgLower === 'ทำแล้ว' || simMsgLower === 'ทำเสร็จแล้ว') {
      let textRes = `[SYSTEM VERIFIED]\nบันทึกข้อมูลแล้ว: สถานะภารกิจ '${currentQuest.title}' ได้รับการตรวจสอบ`;
      if (currentQuest.status !== 'COMPLETED') {
        currentQuest.status = 'COMPLETED';
        currentQuest.completedAt = new Date().toISOString();
        if (currentQuest.steps) {
          currentQuest.steps = currentQuest.steps.map((s) => ({ ...s, completed: true }));
        }
        const result = await finalizeQuestCompletion(currentQuest, 'LINE', currentPlayer.lineUserId || undefined);
        textRes += `\n✓ ยืนยันการบรรลุเป้าหมาย! ได้รับ +${result.xpGained} XP`;
        if (result.levelUp) textRes += `\n★ LEVEL UP! [LV. ${result.newLevel}]`;
      } else {
        textRes += `\nสถานะภารกิจสมบูรณ์แล้ว ร่างกายอยู่ในสภาวะพร้อมรับการเติบโต`;
      }
      return res.json({
        type: 'text',
        systemText: textRes,
        player: currentPlayer,
        quest: currentQuest
      });
    }

    if (simMsgLower === 'กำลังทำ' || simMsgLower.includes('กำลังทำ') || simMsgLower.includes('กำลังออกกำลัง')) {
      const bangkokNow = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Bangkok' }));
      const remainMins = getRemainingMinutesToDeadline(currentQuest.deadline, bangkokNow);
      const hoursRem = Math.floor(Math.max(0, remainMins) / 60);
      const minsRem = Math.max(0, remainMins) % 60;
      const timeStr = hoursRem > 0 ? `${hoursRem} ชั่วโมง ${minsRem} นาที` : `${minsRem} นาที`;
      return res.json({
        type: 'text',
        systemText: `[SYSTEM MONITORED]\nรับทราบ เร่งความเร็วและรักษาฟอร์มการเคลื่อนไหวให้ถูกต้อง\nเหลือเวลาอีกประมาณ ${timeStr} ก่อนที่บทลงโทษและเส้นตาย (${currentQuest.deadline} น.) จะเริ่มทำงาน`,
        player: currentPlayer,
        quest: currentQuest
      });
    }

    if (simMsgLower === 'ยังไม่ทำ' || simMsgLower.includes('ยังไม่ทำ') || simMsgLower.includes('ยังไม่ได้ทำ')) {
      return res.json({
        type: 'text',
        systemText: `[SYSTEM WARNING]\nคำเตือน: ความเกียจคร้านคือบ่อเกิดของความล้มเหลว โทษทัณฑ์ Debuff 'Weakened' (XP ลด 50%) กำลังรอคุณอยู่หากไม่เริ่มต้นทันที จงขยับร่างกายเดี๋ยวนี้!`,
        player: currentPlayer,
        quest: currentQuest
      });
    }

    if (
      simMsgLower === 'สรุปสัปดาห์' ||
      simMsgLower === 'weekly' ||
      simMsgLower === 'weekly summary' ||
      simMsgLower.includes('สรุปผล') ||
      simMsgLower.includes('รายงานสัปดาห์')
    ) {
      const bangkokNow = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Bangkok' }));
      const todayStr = bangkokNow.toISOString().slice(0, 10);
      const summaryData = calculateWeeklySummaryData(todayStr);
      const weeklyFlex = createWeeklySummaryFlexMessage(summaryData, currentPlayer, appUrl);
      return res.json({
        type: 'flex',
        flexMessage: weeklyFlex,
        summary: summaryData,
        systemText: `[WEEKLY SYSTEM DEBRIEF]\nภารกิจที่สำเร็จ: ${summaryData.totalQuests}\nEXP ที่ได้รับ: +${summaryData.totalXp} XP\nStreak: ${summaryData.currentStreak} วัน`
      });
    }

    // Natural text chat through simulated LINE
    const aiResult = await processNaturalLanguageWithAI(message || '', currentPlayer);

    if (aiResult.reminderRequest && aiResult.reminderRequest.remindAt) {
      const remindTime = new Date(aiResult.reminderRequest.remindAt);
      if (!isNaN(remindTime.getTime())) {
        const simUserId = currentPlayer.lineUserId || 'simulated-line-hunter';
        const reminderId = `remind-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
        pendingReminders.push({
          id: reminderId,
          userId: simUserId,
          remindAt: remindTime.toISOString(),
          message: aiResult.reminderRequest.message || `[SYSTEM REMINDER] ถึงเวลาที่คุณกำหนดไว้แล้ว จงเริ่มการฝึกฝน`,
          sent: false
        });

        const timeFormatted = remindTime.toLocaleTimeString('th-TH', {
          timeZone: 'Asia/Bangkok',
          hour: '2-digit',
          minute: '2-digit'
        });

        eventLogs.unshift({
          id: `evt-${Date.now()}-remind-sim`,
          type: 'STATUS_SYNC',
          title: 'Reminder Protocol Scheduled',
          description: `Target alert set for ${timeFormatted} น. (LINE Simulator)`,
          timestamp: new Date().toISOString()
        });
      }
    }

    res.json({
      type: 'text',
      systemText: aiResult.systemMessage,
      intent: aiResult.intent,
      reminderRequest: aiResult.reminderRequest,
      quest: currentQuest,
      player: currentPlayer
    });
  });

  // -------------------------------------------------------------
  // SCHEDULED DISPATCHER (07:00 Quest, 20:00 Deadline & Custom Pending Reminders via LINE Push)
  // -------------------------------------------------------------
  setInterval(async () => {
    try {
      const now = new Date();
      const nowTime = now.getTime();

      // Check and dispatch user-scheduled PendingReminders (Requirement 4)
      const dueReminders = pendingReminders.filter(
        (r) => !r.sent && new Date(r.remindAt).getTime() <= nowTime
      );

      for (const reminder of dueReminders) {
        reminder.sent = true;
        console.log(`[THE SYSTEM] Dispatching scheduled reminder [${reminder.id}] to user ${reminder.userId}...`);

        // Send LINE Push Message if token configured and not a local simulator recipient
        if (
          process.env.LINE_CHANNEL_ACCESS_TOKEN &&
          reminder.userId &&
          !reminder.userId.startsWith('local-') &&
          !reminder.userId.startsWith('sim-')
        ) {
          try {
            await sendLinePushMessage(reminder.userId, [
              {
                type: 'text',
                text: reminder.message
              }
            ]);
            console.log(`[THE SYSTEM] Successfully delivered push reminder to LINE user ${reminder.userId}`);
          } catch (pushErr) {
            console.error(`[THE SYSTEM] Failed to deliver push reminder to ${reminder.userId}:`, pushErr);
          }
        }

        // Add event log so it shows up in system log and history timeline
        eventLogs.unshift({
          id: `evt-${Date.now()}-remind-fired`,
          type: 'STATUS_SYNC',
          title: 'Scheduled Reminder Dispatched',
          description: reminder.message.replace(/\[.*?\]\n?/, '').slice(0, 100),
          timestamp: new Date().toISOString()
        });
      }

      // Thailand Standard Time UTC+7
      const bangkokTime = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Bangkok' }));
      const hours = bangkokTime.getHours();
      const minutes = bangkokTime.getMinutes();
      const todayStr = bangkokTime.toISOString().slice(0, 10);
      const appUrl = process.env.APP_URL || 'http://localhost:3000';
      const hasLinePush = Boolean(process.env.LINE_CHANNEL_ACCESS_TOKEN && connectedLineUserIds.size > 0);

      // Feature 6: Sample the Emergency Quest once at the beginning of each day.
      // The sampled result is stored so subsequent scheduler ticks never re-roll it.
      if (emergencyTarget.date !== todayStr) {
        const shouldSpawn = Math.random() < 0.30;
        const targetTotalMinutes = 9 * 60 + Math.floor(Math.random() * (9 * 60 + 1));
        emergencyTarget = {
          date: todayStr,
          scheduled: shouldSpawn,
          hour: Math.floor(targetTotalMinutes / 60),
          minute: targetTotalMinutes % 60,
          executed: false
        };
        emergencyQuest = null;
        console.log(
          `[THE SYSTEM] Emergency Quest roll for ${todayStr}: ${shouldSpawn ? `SCHEDULED ${emergencyTarget.hour}:${String(emergencyTarget.minute).padStart(2, '0')}` : 'NOT SCHEDULED'}`
        );
      }

      // Feature 6: Spawn the Emergency Quest once at its sampled time (09:00-18:00).
      if (
        emergencyTarget.scheduled &&
        !emergencyTarget.executed &&
        (hours * 60 + minutes) >= (emergencyTarget.hour * 60 + emergencyTarget.minute) &&
        hours <= 18
      ) {
        emergencyTarget.executed = true;
        try {
          const createdAt = new Date();
          const deadlineAt = new Date(createdAt.getTime() + 60 * 60000);
          const generated = await generateDailyQuestWithAI(currentPlayer, {
            availableMinutes: 15,
            preference: 'เควสฉุกเฉินความเข้มข้นสูง เวลาจำกัด'
          });
          emergencyQuest = buildQuestFromGenerated(generated, {
            idPrefix: 'quest-emergency',
            deadline: formatBangkokTime(deadlineAt),
            xpMultiplier: 2,
            type: 'EMERGENCY',
            difficulty: 'ELITE',
            isEmergency: true
          });

          eventLogs.unshift({
            id: `evt-${Date.now()}-emergency-created`,
            type: 'EMERGENCY_QUEST_CREATED',
            title: '[SYSTEM ALERT] ตรวจพบภาวะฉุกเฉิน',
            description: `Emergency Quest created with 15-minute constraint and 1-hour deadline: ${emergencyQuest.title}`,
            timestamp: createdAt.toISOString()
          });

          const emergencyFlex = createQuestFlexMessage(emergencyQuest, appUrl);
          const emergencyAlert = {
            type: 'text',
            text: '[SYSTEM ALERT] ตรวจพบภาวะฉุกเฉิน\nระบบได้สร้าง Emergency Quest แบบเวลาจำกัดขึ้นใหม่\nภารกิจนี้มีเวลา 1 ชั่วโมงในการปฏิบัติ และให้ XP x2 จากค่าปกติ'
          };
          if (hasLinePush) {
            for (const uid of connectedLineUserIds) {
              await sendLinePushMessage(uid, [emergencyAlert, emergencyFlex]);
            }
          }
        } catch (error: any) {
          console.error('[THE SYSTEM] Failed to generate Emergency Quest:', error?.message || error);
          eventLogs.unshift({
            id: `evt-${Date.now()}-emergency-error`,
            type: 'SYSTEM_WARNING',
            title: '[SYSTEM ALERT] Emergency Quest generation failed',
            description: String(error?.message || error),
            timestamp: new Date().toISOString()
          });
        }
      }

      // Feature 7: Weekly Boss Quest appears every Monday at 07:00 and lasts until Sunday 23:59.
      const currentWeekId = getWeekIdentifier(bangkokTime);
      const isMonday = bangkokTime.getDay() === 1;
      if (isMonday && hours === 7 && minutes === 0 && weeklyBossWeek !== currentWeekId) {
        weeklyBossWeek = currentWeekId;
        try {
          const generated = await generateDailyQuestWithAI(currentPlayer, {
            availableMinutes: 45,
            preference: 'Boss Quest รวมหลายท่าความเข้มข้นสูงสุดของสัปดาห์',
            difficultyOverride: 'ELITE'
          });
          weeklyBossQuest = buildQuestFromGenerated(generated, {
            idPrefix: 'quest-weekly-boss',
            deadline: '23:59',
            xpMultiplier: 3,
            difficulty: 'ELITE',
            isWeeklyBoss: true
          });

          eventLogs.unshift({
            id: `evt-${Date.now()}-boss-created`,
            type: 'BOSS_QUEST_CREATED',
            title: '[SYSTEM] ภารกิจประจำสัปดาห์ปรากฏขึ้น',
            description: `Weekly Boss Quest created for ${currentWeekId}: ${weeklyBossQuest.title}`,
            timestamp: new Date().toISOString()
          });

          const bossFlex = createQuestFlexMessage(weeklyBossQuest, appUrl);
          const bossAlert = {
            type: 'text',
            text: '[SYSTEM] ภารกิจประจำสัปดาห์ปรากฏขึ้น\nWEEKLY BOSS: ภารกิจระดับ ELITE พร้อมให้พิชิตแล้ว\nกำหนดส่ง: วันอาทิตย์ 23:59 น. | XP x3'
          };
          if (hasLinePush) {
            for (const uid of connectedLineUserIds) {
              await sendLinePushMessage(uid, [bossAlert, bossFlex]);
            }
          }
        } catch (error: any) {
          console.error('[THE SYSTEM] Failed to generate Weekly Boss Quest:', error?.message || error);
          eventLogs.unshift({
            id: `evt-${Date.now()}-boss-error`,
            type: 'SYSTEM_WARNING',
            title: '[SYSTEM] Weekly Boss generation failed',
            description: String(error?.message || error),
            timestamp: new Date().toISOString()
          });
        }
      }

      // Feature 7: Expire an uncleared Weekly Boss at Sunday 23:59 without penalty.
      const isSundayForBoss = bangkokTime.getDay() === 0;
      if (isSundayForBoss && hours === 23 && minutes === 59 && weeklyBossQuest && weeklyBossQuest.status !== 'COMPLETED') {
        weeklyBossQuest.status = 'EXPIRED';
        eventLogs.unshift({
          id: `evt-${Date.now()}-boss-expired`,
          type: 'QUEST_EXPIRED',
          title: '[SYSTEM] WEEKLY BOSS OPPORTUNITY MISSED',
          description: 'Weekly Boss expired at the end of the week. No penalty or demotion was applied.',
          timestamp: new Date().toISOString()
        });
        if (hasLinePush) {
          for (const uid of connectedLineUserIds) {
            await sendLinePushMessage(uid, [{
              type: 'text',
              text: '[SYSTEM] WEEKLY BOSS หมดเวลาแล้ว\nคุณพลาดโอกาสของรอบนี้ ระบบจะไม่ลงโทษหรือหัก Rank\nภารกิจประจำสัปดาห์จะถูกเคลียร์เพื่อรอรอบใหม่'
            }]);
          }
        }
        weeklyBossQuest = null;
      }

      // Feature 2: Schedule Today's Surveillance Check-in once per day (10:00 - 18:59)
      if (surveillanceTarget.date !== todayStr) {
        surveillanceTarget = {
          date: todayStr,
          hour: 10 + Math.floor(Math.random() * 9),
          minute: Math.floor(Math.random() * 60),
          executed: false
        };
        console.log(`[THE SYSTEM] Surveillance check-in scheduled for ${surveillanceTarget.hour}:${surveillanceTarget.minute.toString().padStart(2, '0')} today`);
      }

      // Feature 2: Execute Random Surveillance Check-in
      if (
        hours === surveillanceTarget.hour &&
        minutes >= surveillanceTarget.minute &&
        !surveillanceTarget.executed
      ) {
        surveillanceTarget.executed = true;
        if (currentQuest.status !== 'COMPLETED' && currentQuest.status !== 'RESTED') {
          console.log(`[THE SYSTEM] Executing Random Surveillance Check-in to ${connectedLineUserIds.size} hunters...`);
          const surveillanceMsg = {
            type: 'text',
            text: `[SYSTEM] ตรวจสอบสถานะ: ปัจจุบันความคืบหน้าของ Daily Quest '${currentQuest.title}' อยู่ในระดับใด? รายงานทันที:`,
            quickReply: {
              items: [
                {
                  type: 'action',
                  action: {
                    type: 'message',
                    label: 'ทำแล้ว',
                    text: 'ทำแล้ว'
                  }
                },
                {
                  type: 'action',
                  action: {
                    type: 'message',
                    label: 'กำลังทำ',
                    text: 'กำลังทำ'
                  }
                },
                {
                  type: 'action',
                  action: {
                    type: 'message',
                    label: 'ยังไม่ทำ',
                    text: 'ยังไม่ทำ'
                  }
                }
              ]
            }
          };

          if (hasLinePush) {
            for (const uid of connectedLineUserIds) {
              await sendLinePushMessage(uid, [surveillanceMsg]);
            }
          }

          eventLogs.unshift({
            id: `evt-${Date.now()}-surv`,
            type: 'STATUS_SYNC',
            title: '[SURVEILLANCE CHECK-IN DISPATCHED]',
            description: 'Dispatched spontaneous metabolic surveillance check via LINE Quick Reply.',
            timestamp: new Date().toISOString()
          });
        }
      }

      // Feature 6: Emergency Quest expiry is isolated from the normal deadline/debuff system.
      if (emergencyQuest && emergencyQuest.status !== 'COMPLETED' && emergencyQuest.status !== 'EXPIRED') {
        const emergencyRemainingMinutes = getRemainingMinutesToDeadline(emergencyQuest.deadline, bangkokTime);
        if (emergencyRemainingMinutes <= 0) {
          emergencyQuest.status = 'EXPIRED';
          eventLogs.unshift({
            id: `evt-${Date.now()}-emergency-expired`,
            type: 'QUEST_EXPIRED',
            title: '[SYSTEM ALERT] EMERGENCY QUEST EXPIRED',
            description: `Emergency Quest '${emergencyQuest.title}' expired after its 1-hour window. No normal deadline miss, debuff, or demotion was applied.`,
            timestamp: new Date().toISOString()
          });
          emergencyQuest = null;
        }
      }

      // Feature 1: Escalating Reminders
      const remainingMinutes = getRemainingMinutesToDeadline(currentQuest.deadline, bangkokTime);

      if (currentQuest.status !== 'COMPLETED' && currentQuest.status !== 'RESTED') {
        // Checkpoint 1: 50% Time Remaining (~420 mins before 21:00 deadline, i.e. 14:00)
        if (remainingMinutes <= 420 && remainingMinutes > 180 && lastPushDateHalfway !== todayStr) {
          lastPushDateHalfway = todayStr;
          console.log(`[THE SYSTEM] 50% Time Remaining Checkpoint Triggered for ${connectedLineUserIds.size} hunters`);
          const halfwayMsg = {
            type: 'text',
            text: `[SYSTEM DIRECTIVE: 50% TIME ELAPSED]\nเวลาสำหรับภารกิจ '${currentQuest.title}' ผ่านไปแล้ว 50%\nระบบยังไม่พบการบันทึกความคืบหน้า อย่าปล่อยให้ความเฉื่อยชาเข้ามาขัดขวางการเติบโต จงจัดสรรเวลาและเริ่มปฏิบัติการ (เส้นตาย: ${currentQuest.deadline} น.)`
          };
          if (hasLinePush) {
            for (const uid of connectedLineUserIds) {
              await sendLinePushMessage(uid, [halfwayMsg]);
            }
          }
          eventLogs.unshift({
            id: `evt-${Date.now()}-escalate-50`,
            type: 'SYSTEM_WARNING',
            title: '[ESCALATING REMINDER: 50% REMAINING]',
            description: 'System triggered cold-tone halfway adherence notification.',
            timestamp: new Date().toISOString()
          });
        }

        // Checkpoint 2: 3 Hours Before Deadline (remainingMinutes <= 180, i.e. 18:00)
        if (remainingMinutes <= 180 && remainingMinutes > 30 && lastPushDate3Hours !== todayStr) {
          lastPushDate3Hours = todayStr;
          console.log(`[THE SYSTEM] 3 Hours Remaining Checkpoint Triggered for ${connectedLineUserIds.size} hunters`);
          const threeHoursMsg = {
            type: 'text',
            text: `[SYSTEM URGENT: 3 HOURS BEFORE DEADLINE]\nเหลือเวลาอีกเพียง 3 ชั่วโมงก่อนเส้นตายภารกิจ '${currentQuest.title}' (${currentQuest.deadline} น.)\nระบบต้องการการยืนยันการปฏิบัติ จงเร่งฝีเท้าและเริ่มทำตามโพรโทคอลเดี๋ยวนี้`
          };
          if (hasLinePush) {
            for (const uid of connectedLineUserIds) {
              await sendLinePushMessage(uid, [threeHoursMsg]);
            }
          }
          eventLogs.unshift({
            id: `evt-${Date.now()}-escalate-3h`,
            type: 'SYSTEM_WARNING',
            title: '[ESCALATING REMINDER: 3 HOURS REMAINING]',
            description: 'System triggered urgent-tone 3-hour deadline notification.',
            timestamp: new Date().toISOString()
          });
        }

        // Checkpoint 3: 30 Minutes Before Deadline (remainingMinutes <= 30 && > 0, i.e. 20:30)
        if (remainingMinutes <= 30 && remainingMinutes > 0 && lastPushDate30Min !== todayStr) {
          lastPushDate30Min = todayStr;
          console.log(`[THE SYSTEM] 30 Minutes Remaining Checkpoint Triggered for ${connectedLineUserIds.size} hunters`);
          const thirtyMinMsg = {
            type: 'text',
            text: `[SYSTEM CRITICAL: 30 MINUTES TO PENALTY]\nคำเตือนขั้นวิกฤต: เหลือเวลาอีกเพียง 30 นาที ภารกิจ '${currentQuest.title}' จะหมดอายุ!\nหากไม่สำเร็จภายใน ${currentQuest.deadline} น. ระบบจะเรียก Reflection ก่อนพิจารณา Debuff/Demotion จงทำภารกิจให้เสร็จสิ้นเดี๋ยวนี้!`
          };
          if (hasLinePush) {
            for (const uid of connectedLineUserIds) {
              await sendLinePushMessage(uid, [thirtyMinMsg]);
            }
          }
          eventLogs.unshift({
            id: `evt-${Date.now()}-escalate-30m`,
            type: 'SYSTEM_WARNING',
            title: '[ESCALATING REMINDER: 30 MINUTES REMAINING]',
            description: 'System triggered severe penalty warning notification.',
            timestamp: new Date().toISOString()
          });
        }
      }

      // Feature 3 + 8: Post-Deadline Check. Ask for a reflection before applying
      // the existing debuff/demotion rules. The penalty is applied only after Gemini evaluates the reason.
      if (remainingMinutes <= 0 && lastPushDatePenalty !== todayStr) {
        lastPushDatePenalty = todayStr;
        if (currentQuest.status !== 'COMPLETED' && currentQuest.status !== 'RESTED') {
          const reflectionTarget = currentPlayer.lineUserId || Array.from(connectedLineUserIds)[0] || null;
          if (reflectionTarget && process.env.LINE_CHANNEL_ACCESS_TOKEN) {
            awaitingReflectionFromUserId = reflectionTarget;
            awaitingReflectionQuestId = currentQuest.id;
            console.log(`[THE SYSTEM] Deadline passed. Reflection requested from LINE user ${reflectionTarget}.`);

            const reflectionMessage = {
              type: 'text',
              text: '[SYSTEM] ตรวจพบการไม่ปฏิบัติตามคำสั่ง เหตุใดจึงไม่ดำเนินการ'
            };
            await sendLinePushMessage(reflectionTarget, [reflectionMessage]);
            eventLogs.unshift({
              id: `evt-${Date.now()}-reflection-request`,
              type: 'SYSTEM_WARNING',
              title: '[SYSTEM] REFLECTION REQUESTED',
              description: `Deadline passed for '${currentQuest.title}'. Penalty is paused pending player reflection.`,
              timestamp: new Date().toISOString()
            });
          } else {
            // No connected LINE account exists, so retain the original penalty behavior for non-LINE operation.
            await applyDeadlinePenalty();
          }
        }
      }

      // Feature 4: Sunday 21:30 Weekly Evaluation Summary Dispatch
      const isSunday = bangkokTime.getDay() === 0;
      if (isSunday && hours === 21 && minutes === 30 && lastPushDateWeeklySummary !== todayStr) {
        lastPushDateWeeklySummary = todayStr;
        console.log(`[THE SYSTEM] Sunday 21:30 Auto-Pushing Weekly Summary to ${connectedLineUserIds.size} LINE hunters...`);
        const weeklyData = calculateWeeklySummaryData(todayStr);
        const flexSummary = createWeeklySummaryFlexMessage(weeklyData, currentPlayer, appUrl);
        if (hasLinePush) {
          for (const uid of connectedLineUserIds) {
            await sendLinePushMessage(uid, [flexSummary]);
          }
        }
        eventLogs.unshift({
          id: `evt-${Date.now()}-weekly-eval`,
          type: 'STATUS_SYNC',
          title: '[WEEKLY SYSTEM DEBRIEF DISPATCHED]',
          description: `Dispatched comprehensive 7-day ascension debrief (${weeklyData.totalQuests} quests fulfilled, +${weeklyData.totalXp} XP).`,
          timestamp: new Date().toISOString()
        });
      }

      // 07:00 Morning Quest Dispatch
      if (hours === 7 && minutes === 0 && lastPushDateQuest !== todayStr) {
        lastPushDateQuest = todayStr;
        if (hasLinePush) {
          console.log(`[THE SYSTEM] 07:00 Auto-Pushing Daily Quest to ${connectedLineUserIds.size} LINE hunters...`);
          const flex = createQuestFlexMessage(currentQuest, appUrl);
          for (const uid of connectedLineUserIds) {
            await sendLinePushMessage(uid, [flex]);
          }
        }
      }

      // 08:00 Morning Health & Readiness Briefing Dispatch
      if (hours === 8 && minutes === 0 && lastPushDateBriefing !== todayStr) {
        lastPushDateBriefing = todayStr;
        if (hasLinePush) {
          console.log(`[THE SYSTEM] 08:00 Auto-Pushing Morning Health Briefing to ${connectedLineUserIds.size} LINE hunters...`);
          const briefing = await generateDailyHealthBriefing(currentPlayer, currentQuest);
          const briefingFlex = createBriefingFlexMessage(briefing, currentPlayer, currentQuest, appUrl);
          for (const uid of connectedLineUserIds) {
            await sendLinePushMessage(uid, [briefingFlex]);
          }
        }
      }

      // 20:00 Evening Deadline Reminder (if quest still incomplete)
      if (hours === 20 && minutes === 0 && lastPushDateReminder !== todayStr) {
        lastPushDateReminder = todayStr;
        if (currentQuest.status !== 'COMPLETED' && currentQuest.status !== 'RESTED' && hasLinePush) {
          console.log(`[THE SYSTEM] 20:00 Auto-Pushing Deadline Reminder to ${connectedLineUserIds.size} LINE hunters...`);
          const flex = createReminderFlexMessage(currentQuest, appUrl);
          for (const uid of connectedLineUserIds) {
            await sendLinePushMessage(uid, [flex]);
          }
        }
      }
    } catch (e) {
      console.error('[THE SYSTEM] Scheduler error:', e);
    }
  }, 60000);

  // -------------------------------------------------------------
  // VITE MIDDLEWARE / STATIC ASSETS
  // -------------------------------------------------------------
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa'
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[THE SYSTEM] Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
