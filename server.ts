import express from 'express';
import path from 'path';
import dotenv from 'dotenv';
import { createServer as createViteServer } from 'vite';
import { Player, Quest, SystemEvent, WorkoutLog } from './src/types.ts';
import {
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
  generateDailyHealthBriefing
} from './server/gemini-service.ts';
import {
  verifyLineSignature,
  createQuestFlexMessage,
  createCompletionFlexMessage,
  createStatusFlexMessage,
  createReminderFlexMessage,
  createBriefingFlexMessage,
  replyLineMessage,
  sendLinePushMessage
} from './server/line-service.ts';

dotenv.config();

// In-Memory State Store for V1 MVP (Synchronized with Game Engine)
const connectedLineUserIds = new Set<string>();
let lastPushDateQuest = '';
let lastPushDateReminder = '';
let lastPushDateBriefing = '';
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

  // 3. Reset to Demo State (Specification #35 Demo Player)
  app.post('/api/player/reset-demo', (_req, res) => {
    currentPlayer = { ...DEMO_PLAYER_STATE };
    currentQuest = {
      id: `quest-${Date.now()}`,
      title: 'Squat Protocol',
      description: 'Perform 20 controlled squats with full depth.',
      type: 'STRENGTH',
      difficulty: 'EASY',
      target: 20,
      unit: 'reps',
      xpReward: 50,
      statRewards: { VIT: 1, STR: 1 },
      deadline: '21:00',
      status: 'AVAILABLE',
      createdAt: new Date().toISOString()
    };
    eventLogs = [
      {
        id: `evt-${Date.now()}`,
        type: 'QUEST_CREATED',
        title: 'Demo Session Reset',
        description: 'Test Subject parameters reloaded (LV. 3 | RANK E | STREAK 7).',
        timestamp: new Date().toISOString()
      }
    ];
    res.json({ success: true, player: currentPlayer, quest: currentQuest });
  });

  // 4. Get Current Daily Quest
  app.get('/api/quest/daily', async (_req, res) => {
    res.json({ quest: currentQuest });
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

    const result = processQuestCompletion(currentPlayer, currentQuest);
    currentPlayer = result.player;

    // Log all system events
    for (const evt of result.systemEvents) {
      eventLogs.unshift(evt);
    }

    // Log workout session
    workoutLogs.unshift({
      id: `wk-${Date.now()}`,
      title: `${currentQuest.title} (${currentQuest.target} ${currentQuest.unit})`,
      durationMinutes: currentQuest.type === 'VITALITY' ? 25 : 15,
      xpEarned: currentQuest.xpReward,
      statsEarned: currentQuest.statRewards,
      date: new Date().toISOString(),
      source: 'WEB'
    });

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

    res.json({
      success: true,
      systemMessage: aiResult.systemMessage,
      intent: aiResult.intent,
      quest: currentQuest,
      player: currentPlayer,
      healthWarning: aiResult.healthWarning
    });
  });

  // 10. History & Activity Timeline
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

        // 1. Check for Quest inquiry
        if (
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
          if (currentQuest.status !== 'COMPLETED') {
            currentQuest.status = 'COMPLETED';
            currentQuest.completedAt = new Date().toISOString();
            if (currentQuest.steps) {
              currentQuest.steps = currentQuest.steps.map((s) => ({ ...s, completed: true }));
            }
            const result = processQuestCompletion(currentPlayer, currentQuest);
            currentPlayer = result.player;

            workoutLogs.unshift({
              id: `wk-line-${Date.now()}`,
              title: `${currentQuest.title} (${currentQuest.target} ${currentQuest.unit})`,
              durationMinutes: 20,
              xpEarned: currentQuest.xpReward,
              statsEarned: currentQuest.statRewards,
              date: new Date().toISOString(),
              source: 'LINE'
            });

            for (const evt of result.systemEvents) {
              eventLogs.unshift(evt);
            }
          }

          const compFlex = createCompletionFlexMessage(currentQuest, currentPlayer);
          if (replyToken) {
            await replyLineMessage(replyToken, [compFlex]);
          }
        }
        // 4. Fallback to Gemini AI natural language engine
        else {
          const aiResponse = await processNaturalLanguageWithAI(text, currentPlayer);

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
          if (currentQuest.status !== 'COMPLETED') {
            currentQuest.status = 'COMPLETED';
            currentQuest.completedAt = new Date().toISOString();
            if (currentQuest.steps) {
              currentQuest.steps = currentQuest.steps.map((s) => ({ ...s, completed: true }));
            }
            const result = processQuestCompletion(currentPlayer, currentQuest);
            currentPlayer = result.player;

            workoutLogs.unshift({
              id: `wk-line-pb-${Date.now()}`,
              title: `${currentQuest.title} (${currentQuest.target} ${currentQuest.unit})`,
              durationMinutes: 20,
              xpEarned: currentQuest.xpReward,
              statsEarned: currentQuest.statRewards,
              date: new Date().toISOString(),
              source: 'LINE'
            });

            for (const evt of result.systemEvents) {
              eventLogs.unshift(evt);
            }
          }

          if (replyToken) {
            const compFlex = createCompletionFlexMessage(currentQuest, currentPlayer);
            await replyLineMessage(replyToken, [compFlex]);
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

    if (action === 'COMPLETE_VIA_LINE') {
      currentQuest.status = 'COMPLETED';
      const result = processQuestCompletion(currentPlayer, currentQuest);
      currentPlayer = result.player;

      const flexMsg = createCompletionFlexMessage(currentQuest, currentPlayer);
      return res.json({
        type: 'flex',
        flexMessage: flexMsg,
        player: currentPlayer,
        quest: currentQuest,
        systemText: `QUEST COMPLETE\n+${currentQuest.xpReward} XP\n${Object.keys(currentQuest.statRewards)[0] || 'VIT'} +1\nSTREAK: ${currentPlayer.streak} DAYS\nKeep going.`
      });
    }

    // Natural text chat through simulated LINE
    const aiResult = await processNaturalLanguageWithAI(message || '', currentPlayer);
    res.json({
      type: 'text',
      systemText: aiResult.systemMessage,
      intent: aiResult.intent,
      quest: currentQuest,
      player: currentPlayer
    });
  });

  // -------------------------------------------------------------
  // SCHEDULED DISPATCHER (07:00 Quest & 20:00 Reminder via LINE Push)
  // -------------------------------------------------------------
  setInterval(async () => {
    if (!process.env.LINE_CHANNEL_ACCESS_TOKEN || connectedLineUserIds.size === 0) return;

    try {
      const now = new Date();
      // Thailand Standard Time UTC+7
      const bangkokTime = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Bangkok' }));
      const hours = bangkokTime.getHours();
      const minutes = bangkokTime.getMinutes();
      const todayStr = bangkokTime.toISOString().slice(0, 10);
      const appUrl = process.env.APP_URL || 'http://localhost:3000';

      // 07:00 Morning Quest Dispatch
      if (hours === 7 && minutes === 0 && lastPushDateQuest !== todayStr) {
        lastPushDateQuest = todayStr;
        console.log(`[THE SYSTEM] 07:00 Auto-Pushing Daily Quest to ${connectedLineUserIds.size} LINE hunters...`);
        const flex = createQuestFlexMessage(currentQuest, appUrl);
        for (const uid of connectedLineUserIds) {
          await sendLinePushMessage(uid, [flex]);
        }
      }

      // 08:00 Morning Health & Readiness Briefing Dispatch
      if (hours === 8 && minutes === 0 && lastPushDateBriefing !== todayStr) {
        lastPushDateBriefing = todayStr;
        console.log(`[THE SYSTEM] 08:00 Auto-Pushing Morning Health Briefing to ${connectedLineUserIds.size} LINE hunters...`);
        const briefing = await generateDailyHealthBriefing(currentPlayer, currentQuest);
        const briefingFlex = createBriefingFlexMessage(briefing, currentPlayer, currentQuest, appUrl);
        for (const uid of connectedLineUserIds) {
          await sendLinePushMessage(uid, [briefingFlex]);
        }
      }

      // 20:00 Evening Deadline Reminder (if quest still incomplete)
      if (hours === 20 && minutes === 0 && lastPushDateReminder !== todayStr) {
        lastPushDateReminder = todayStr;
        if (currentQuest.status !== 'COMPLETED') {
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
