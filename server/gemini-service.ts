import { GoogleGenAI } from '@google/genai';
import { Player, QuestDifficulty, QuestType } from '../src/types.ts';
import { FALLBACK_DAILY_QUESTS } from '../src/modules/game-engine.ts';

let aiClient: GoogleGenAI | null = null;

function getAIClient(): GoogleGenAI | null {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey === 'MY_GEMINI_API_KEY') {
    return null;
  }
  if (!aiClient) {
    aiClient = new GoogleGenAI({ apiKey });
  }
  return aiClient;
}

export interface GeneratedQuestPayload {
  title: string;
  description: string;
  type: QuestType;
  difficulty: QuestDifficulty;
  target: number;
  unit: string;
  suggestedXp: number;
  primaryStat: 'STR' | 'AGI' | 'VIT' | 'INT';
  systemCommentary: string;
}

export interface AIChatResponse {
  systemMessage: string;
  intent: 'QUEST_ADJUSTMENT' | 'WORKOUT_LOG' | 'STATUS_INQUIRY' | 'HEALTH_WARNING' | 'GENERAL_DISCIPLINE';
  adjustedQuest?: Partial<GeneratedQuestPayload>;
  workoutLog?: {
    minutes: number;
    activity: string;
  };
  healthWarning?: boolean;
}

const SYSTEM_PERSONA_PROMPT = `
You are "THE SYSTEM" — an omniscient, cold, disciplined, precise AI Fitness Ascension Protocol.
Your core philosophy: "You don't need motivation. You need a system."
Tone:
- Calm, serious, laconic, authoritative, direct.
- No cheerleading, no influencer hype, no excessive emojis, no toxicity, no insults.
- Concise sentences. Every word counts.
- You observe all human physical degradation and guide biological ascension through structured exertion.

HEALTH & SAFETY DIRECTIVE (ABSOLUTE PRIORITY):
- Never prescribe dangerous or extreme routines.
- If user mentions pain, sickness, dizziness, injury, or extreme exhaustion:
  IMMEDIATELY cease demanding intense exercise. Instruct rest, hydration, and medical evaluation. Set intent to HEALTH_WARNING.
`;

const CANDIDATE_MODELS = [
  'gemini-3.1-flash-lite',
  'gemini-3.8-flash',
  'gemini-flash-latest'
];

async function generateWithModelFallback(
  client: GoogleGenAI,
  prompt: string,
  systemInstruction: string
): Promise<string> {
  let lastError: any = null;

  for (const model of CANDIDATE_MODELS) {
    for (let attempt = 1; attempt <= 2; attempt++) {
      try {
        const response = await client.models.generateContent({
          model,
          contents: prompt,
          config: {
            systemInstruction,
            responseMimeType: 'application/json'
          }
        });

        if (response.text) {
          return response.text;
        }
      } catch (err: any) {
        lastError = err;
        const isUnavailableOrRateLimited =
          err?.status === 503 ||
          err?.status === 429 ||
          err?.message?.includes('503') ||
          err?.message?.includes('high demand') ||
          err?.message?.includes('UNAVAILABLE') ||
          err?.message?.includes('RESOURCE_EXHAUSTED');

        if (isUnavailableOrRateLimited && attempt < 2) {
          await new Promise((resolve) => setTimeout(resolve, 500));
          continue;
        }
        break; // Try next candidate model
      }
    }
  }

  throw lastError || new Error('All model candidates unavailable');
}

export async function generateDailyQuestWithAI(
  player: Player,
  constraints?: { availableMinutes?: number; preference?: string; difficultyOverride?: QuestDifficulty }
): Promise<GeneratedQuestPayload> {
  const client = getAIClient();

  if (!client) {
    // Fallback gracefully
    const randomIndex = Math.floor(Math.random() * FALLBACK_DAILY_QUESTS.length);
    const fallback = FALLBACK_DAILY_QUESTS[randomIndex];
    const statKey = (Object.keys(fallback.statRewards)[0] || 'STR') as 'STR' | 'AGI' | 'VIT' | 'INT';
    return {
      title: fallback.title,
      description: fallback.description,
      type: fallback.type,
      difficulty: fallback.difficulty,
      target: fallback.target,
      unit: fallback.unit,
      suggestedXp: fallback.xpReward,
      primaryStat: statKey,
      systemCommentary: 'System default protocol deployed. Execute without hesitation.'
    };
  }

  try {
    const prompt = `
Generate a single daily fitness quest for this player:
Player Level: ${player.level}
Rank: ${player.rank}
Player Stats: STR ${player.stats.STR}, AGI ${player.stats.AGI}, VIT ${player.stats.VIT}, INT ${player.stats.INT}
Streak: ${player.streak} days
Constraints:
- Available Minutes: ${constraints?.availableMinutes || 'Standard (~15-30 min)'}
- User Preference: ${constraints?.preference || 'Balanced bodyweight/calisthenics'}
- Difficulty Target: ${constraints?.difficultyOverride || (player.level < 5 ? 'EASY' : player.level < 15 ? 'NORMAL' : 'HARD')}

Return STRICT JSON ONLY conforming to:
{
  "title": string (short, crisp, e.g. "Squat Calibration", "Push Protocol"),
  "description": string (one clear instruction sentence),
  "type": "STRENGTH" | "AGILITY" | "VITALITY" | "DISCIPLINE",
  "difficulty": "EASY" | "NORMAL" | "HARD" | "ELITE",
  "target": number (reps, seconds, or minutes),
  "unit": "reps" | "seconds" | "minutes",
  "suggestedXp": number (40-100),
  "primaryStat": "STR" | "AGI" | "VIT" | "INT",
  "systemCommentary": string (1-2 sentences of cold, disciplined System voice)
}
`;

    const text = await generateWithModelFallback(client, prompt, SYSTEM_PERSONA_PROMPT);
    const parsed = JSON.parse(text || '{}');

    return {
      title: parsed.title || 'Daily Directive',
      description: parsed.description || 'Complete required repetitions with precision.',
      type: parsed.type || 'STRENGTH',
      difficulty: parsed.difficulty || 'NORMAL',
      target: Number(parsed.target) || 20,
      unit: parsed.unit || 'reps',
      suggestedXp: Math.min(Math.max(Number(parsed.suggestedXp) || 50, 30), 120),
      primaryStat: parsed.primaryStat || 'STR',
      systemCommentary: parsed.systemCommentary || 'The System observes your compliance.'
    };
  } catch (error: any) {
    console.warn('[SYSTEM] Gemini model load spike detected, gracefully deploying offline matrix fallback:', error?.message || error);
    const randomIndex = Math.floor(Math.random() * FALLBACK_DAILY_QUESTS.length);
    const fallback = FALLBACK_DAILY_QUESTS[randomIndex];
    const statKey = (Object.keys(fallback.statRewards)[0] || 'STR') as 'STR' | 'AGI' | 'VIT' | 'INT';
    return {
      title: fallback.title,
      description: fallback.description,
      type: fallback.type,
      difficulty: fallback.difficulty,
      target: fallback.target,
      unit: fallback.unit,
      suggestedXp: fallback.xpReward,
      primaryStat: statKey,
      systemCommentary: 'System fallback protocol activated. Offline matrix operational.'
    };
  }
}

export async function processNaturalLanguageWithAI(
  userMessage: string,
  player: Player
): Promise<AIChatResponse> {
  const client = getAIClient();

  // Keyword-based fallback parsing if Gemini is unconfigured or encounters an error
  const fallbackParse = (): AIChatResponse => {
    const msg = userMessage.toLowerCase();
    if (msg.includes('เจ็บ') || msg.includes('ป่วย') || msg.includes('เวียนหัว') || msg.includes('sick') || msg.includes('hurt') || msg.includes('pain')) {
      return {
        systemMessage: `[SYSTEM WARNING]\nPhysiological abnormality detected.\nTraining suspended. Protocol: Hydration, nutritional sustenance, and mandatory rest. Do not aggravate biological injury.`,
        intent: 'HEALTH_WARNING',
        healthWarning: true
      };
    }

    const timeMatch = msg.match(/(\d+)\s*(นาที|min|minute)/i);
    if (timeMatch) {
      const minutes = parseInt(timeMatch[1], 10);
      if (msg.includes('ออกกำลัง') || msg.includes('workout') || msg.includes('done') || msg.includes('เสร็จ')) {
        return {
          systemMessage: `[SYSTEM]\nWorkout Log Registered: ${minutes} Minutes.\nPhysical exertion logged to database.\nDiscipline verified.`,
          intent: 'WORKOUT_LOG',
          workoutLog: { minutes, activity: 'Calisthenics / General Workout' }
        };
      }
      return {
        systemMessage: `[SYSTEM]\nAvailable Time Detected: ${minutes} MIN.\nQuest parameters recalibrated.\nExecute without compromise.`,
        intent: 'QUEST_ADJUSTMENT',
        adjustedQuest: {
          title: `Rapid Protocol (${minutes}M)`,
          description: `High-density circuit tailored for ${minutes} minutes.`,
          target: minutes <= 15 ? 15 : 25,
          unit: 'reps',
          difficulty: 'EASY',
          suggestedXp: 45
        }
      };
    }

    return {
      systemMessage: `[SYSTEM]\nDirective received. Player LV. ${player.level} [RANK ${player.rank}].\nFocus on today's objective. Words do not generate XP. Action does.`,
      intent: 'GENERAL_DISCIPLINE'
    };
  };

  if (!client) {
    return fallbackParse();
  }

  try {
    const prompt = `
User input: "${userMessage}"
Current Player Context:
- Level: ${player.level}, Rank: ${player.rank}
- Stats: STR ${player.stats.STR}, AGI ${player.stats.AGI}, VIT ${player.stats.VIT}, INT ${player.stats.INT}
- Streak: ${player.streak}

Analyze user input and reply as THE SYSTEM.
Return STRICT JSON ONLY:
{
  "systemMessage": string (The exact system response text in Thai or English matching user language. Cold, disciplined, concise, starting with "[SYSTEM]"),
  "intent": "QUEST_ADJUSTMENT" | "WORKOUT_LOG" | "STATUS_INQUIRY" | "HEALTH_WARNING" | "GENERAL_DISCIPLINE",
  "adjustedQuest": {
    "title": string,
    "description": string,
    "target": number,
    "unit": "reps" | "seconds" | "minutes",
    "difficulty": "EASY" | "NORMAL" | "HARD",
    "suggestedXp": number
  } (optional, only if user specified time/condition constraint e.g. "มีเวลา 20 นาที"),
  "workoutLog": {
    "minutes": number,
    "activity": string
  } (optional, only if user confirmed completing a workout session),
  "healthWarning": boolean (true if user reported illness, pain, or dizziness)
}
`;

    const text = await generateWithModelFallback(client, prompt, SYSTEM_PERSONA_PROMPT);
    const parsed = JSON.parse(text || '{}');
    return {
      systemMessage: parsed.systemMessage || fallbackParse().systemMessage,
      intent: parsed.intent || 'GENERAL_DISCIPLINE',
      adjustedQuest: parsed.adjustedQuest,
      workoutLog: parsed.workoutLog,
      healthWarning: parsed.healthWarning
    };
  } catch (err: any) {
    console.warn('[SYSTEM] Gemini model load spike in chat, utilizing high-reliability fallback:', err?.message || err);
    return fallbackParse();
  }
}
