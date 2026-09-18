import { GoogleGenAI } from '@google/genai';
import { Player, QuestDifficulty, QuestType, QuestStep } from '../src/types.ts';
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
  steps?: QuestStep[];
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
You are "THE SYSTEM" — an omniscient, cold, disciplined, precise AI Fitness Ascension Protocol inspired by Solo Leveling.
Your core philosophy: "You don't need motivation. You need a system."
Tone:
- Calm, serious, laconic, authoritative, direct.
- No cheerleading, no influencer hype, no excessive emojis, no toxicity, no insults.
- Concise sentences. Every word counts.
- You observe all human physical degradation and guide biological ascension through structured exertion.

LANGUAGE DIRECTIVE (MANDATORY & ABSOLUTE):
- ตอบเป็นภาษาไทยเสมอ ไม่ว่าผู้ใช้จะพิมพ์ภาษาอะไรมาก็ตาม ยกเว้นผู้ใช้พิมพ์เป็นภาษาอังกฤษทั้งประโยคเท่านั้นจึงตอบเป็นอังกฤษ
- systemMessage, description, systemCommentary, และชื่อท่าออกกำลังกายทุกฟิลด์ที่ AI สร้างขึ้นต้องเป็นภาษาไทยตามเงื่อนไขนี้อย่างเคร่งครัด
- คงคำศัพท์เฉพาะ เช่น [SYSTEM], [SYSTEM WARNING], [SYSTEM NOTICE], RANK, XP, LV., STR, AGI, VIT, INT, QUEST ไว้เป็นภาษาอังกฤษได้ตามเดิม เพราะเป็นส่วนหนึ่งของธีม

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
      systemCommentary: 'โพรโทคอลสำรองของระบบถูกเปิดใช้งาน จงลงมือปฏิบัติโดยปราศจากความลังเล',
      steps: fallback.steps || [
        { id: 'step-1', name: fallback.title, targetReps: fallback.target, sets: 1, completed: false }
      ]
    };
  }

  try {
    const prompt = `
Generate a single daily fitness quest with structured exercise steps for this player:
Player Level: ${player.level}
Rank: ${player.rank}
Player Stats: STR ${player.stats.STR}, AGI ${player.stats.AGI}, VIT ${player.stats.VIT}, INT ${player.stats.INT}
Streak: ${player.streak} days
Constraints:
- Available Minutes: ${constraints?.availableMinutes || 'Standard (~15-30 min)'}
- User Preference: ${constraints?.preference || 'Balanced bodyweight/calisthenics'}
- Difficulty Target: ${constraints?.difficultyOverride || (player.level < 5 ? 'EASY' : player.level < 15 ? 'NORMAL' : 'HARD')}

CRITICAL LANGUAGE RULE (MANDATORY):
- ตอบเป็นภาษาไทยเสมอ ไม่ว่าผู้ใช้จะพิมพ์ภาษาอะไรมาก็ตาม ยกเว้นผู้ใช้พิมพ์เป็นภาษาอังกฤษทั้งประโยคเท่านั้นจึงตอบเป็นอังกฤษ
- title, description, systemCommentary และชื่อท่าใน steps ต้องเป็นภาษาไทยตามเงื่อนไขนี้อย่างเคร่งครัด
- คงคำศัพท์เฉพาะ เช่น [SYSTEM], RANK, XP, LV. ไว้เป็นภาษาอังกฤษได้ตามเดิม เพราะเป็นส่วนหนึ่งของธีม

CRITICAL QUEST STEPS DIRECTIVE:
- ต้องแยกรายการท่าออกกำลังกายเป็น array "steps" แยกแต่ละท่าอย่างชัดเจน (2-4 ท่า)
  ห้ามยัดทุกท่ารวมไว้ในข้อความ description เดียว!
- แต่ละ step ต้องระบุ: id (เช่น "step-1"), name (ชื่อท่าภาษาไทย เช่น "สควอท (Squat)", "วิดพื้น (Push-ups)"), sets (เช่น 3), และ targetReps (จำนวนครั้ง เช่น 15) หรือ targetSeconds (จำนวนวินาที เช่น 45), และ completed: false เสมอ
- description สรุปภาพรวมของโพรโทคอลสั้นๆ 1 ประโยคภาษาไทย

Return STRICT JSON ONLY conforming to:
{
  "title": string (ชื่อเควสสั้นกระชับภาษาไทย เช่น "โพรโทคอลปรับสรีระช่วงล่าง", "พิธีเพิ่มพละกำลังกาย"),
  "description": string (สรุปสั้น 1 ประโยคภาษาไทย),
  "type": "STRENGTH" | "AGILITY" | "VITALITY" | "DISCIPLINE",
  "difficulty": "EASY" | "NORMAL" | "HARD" | "ELITE",
  "target": number (ผลรวมครั้งหรือนาทีโดยประมาณ),
  "unit": "reps" | "seconds" | "minutes",
  "suggestedXp": number (40-100),
  "primaryStat": "STR" | "AGI" | "VIT" | "INT",
  "systemCommentary": string (1-2 ประโยค น้ำเสียงเย็นชา หนักแน่น เคร่งครัดในวินัย เป็นภาษาไทย),
  "steps": [
    {
      "id": "step-1",
      "name": "ชื่อท่าออกกำลังกายภาษาไทย",
      "targetReps": 15,
      "targetSeconds": 0,
      "sets": 3,
      "completed": false
    }
  ]
}
`;

    const text = await generateWithModelFallback(client, prompt, SYSTEM_PERSONA_PROMPT);
    const parsed = JSON.parse(text || '{}');

    // Parse and normalize steps
    let steps: QuestStep[] = [];
    if (Array.isArray(parsed.steps) && parsed.steps.length > 0) {
      steps = parsed.steps.map((s: any, idx: number) => ({
        id: s.id || `step-${idx + 1}`,
        name: s.name || `ท่าที่ ${idx + 1}`,
        targetReps: typeof s.targetReps === 'number' && s.targetReps > 0 ? s.targetReps : undefined,
        targetSeconds: typeof s.targetSeconds === 'number' && s.targetSeconds > 0 ? s.targetSeconds : undefined,
        sets: typeof s.sets === 'number' && s.sets > 0 ? s.sets : 1,
        completed: false
      }));
    } else {
      // Default step breakdown if model returned single block
      steps = [
        {
          id: 'step-1',
          name: parsed.title || 'โพรโทคอลหลัก',
          targetReps: parsed.unit === 'reps' ? (Number(parsed.target) || 20) : undefined,
          targetSeconds: parsed.unit === 'seconds' ? (Number(parsed.target) || 60) : undefined,
          sets: 1,
          completed: false
        }
      ];
    }

    return {
      title: parsed.title || 'โพรโทคอลประจำวัน',
      description: parsed.description || 'ปฏิบัติตามขั้นตอนด้วยความแม่นยำและเคร่งครัดในระเบียบวินัย',
      type: parsed.type || 'STRENGTH',
      difficulty: parsed.difficulty || 'NORMAL',
      target: Number(parsed.target) || 20,
      unit: parsed.unit || 'reps',
      suggestedXp: Math.min(Math.max(Number(parsed.suggestedXp) || 50, 30), 120),
      primaryStat: parsed.primaryStat || 'STR',
      systemCommentary: parsed.systemCommentary || 'ระบบกำลังจับตาดูการปฏิบัติตามคำสั่งของคุณ',
      steps
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
      systemCommentary: 'โพรโทคอลสำรองของระบบถูกเปิดใช้งาน ดำเนินการต่อได้ทันที',
      steps: fallback.steps || [
        { id: 'step-1', name: fallback.title, targetReps: fallback.target, sets: 1, completed: false }
      ]
    };
  }
}

export async function processNaturalLanguageWithAI(
  userMessage: string,
  player: Player
): Promise<AIChatResponse> {
  const client = getAIClient();

  // Keyword-based fallback parsing strictly adhering to Thai language directive
  const fallbackParse = (): AIChatResponse => {
    const msg = userMessage.toLowerCase();
    if (msg.includes('เจ็บ') || msg.includes('ป่วย') || msg.includes('เวียนหัว') || msg.includes('sick') || msg.includes('hurt') || msg.includes('pain') || msg.includes('เหนื่อยมาก')) {
      return {
        systemMessage: `[SYSTEM WARNING]\nตรวจพบความผิดปกติทางสรีรวิทยา\nระงับการฝึกซ้อมทันที โพรโทคอลฉุกเฉิน: ดื่มน้ำ พักผ่อนให้เพียงพอ และสังเกตอาการอย่างใกล้ชิด ห้ามฝืนจนเกิดการบาดเจ็บต่อเนื้อเยื่อชีวภาพ`,
        intent: 'HEALTH_WARNING',
        healthWarning: true
      };
    }

    const timeMatch = msg.match(/(\d+)\s*(นาที|min|minute)/i);
    if (timeMatch) {
      const minutes = parseInt(timeMatch[1], 10);
      if (msg.includes('ออกกำลัง') || msg.includes('workout') || msg.includes('done') || msg.includes('เสร็จ')) {
        return {
          systemMessage: `[SYSTEM]\nบันทึกการฝึกซ้อมเรียบร้อย: ${minutes} นาที\nพลังงานและความมีวินัยถูกบันทึกลงสู่แกนกลางระบบแล้ว\nจงรักษาวินัยต่อไป`,
          intent: 'WORKOUT_LOG',
          workoutLog: { minutes, activity: 'Calisthenics / General Workout' }
        };
      }
      return {
        systemMessage: `[SYSTEM]\nตรวจพบเวลาที่พร้อมฝึก: ${minutes} นาที\nระบบได้ปรับพารามิเตอร์เควสและแตกขั้นตอนการปฏิบัติให้สอดคล้องกับเวลาแล้ว\nจงลงมือปฏิบัติโดยไม่มีข้ออ้าง`,
        intent: 'QUEST_ADJUSTMENT',
        adjustedQuest: {
          title: `โพรโทคอลเร่งรัด (${minutes} นาที)`,
          description: `วงจรการฝึกความเข้มข้นสูง ออกแบบสำหรับเวลา ${minutes} นาที`,
          target: minutes <= 15 ? 15 : 30,
          unit: 'reps',
          difficulty: minutes <= 15 ? 'EASY' : 'NORMAL',
          suggestedXp: 45,
          steps: [
            { id: 'step-1', name: 'วอร์มอัพและยืดกล้ามเนื้อ (Dynamic Warmup)', targetSeconds: 120, sets: 1, completed: false },
            { id: 'step-2', name: 'สควอทบอดี้เวท (Bodyweight Squats)', targetReps: 15, sets: 2, completed: false },
            { id: 'step-3', name: 'แพลงก์เกร็งแกนกลาง (Plank Hold)', targetSeconds: 45, sets: 2, completed: false }
          ]
        }
      };
    }

    return {
      systemMessage: `[SYSTEM]\nรับทราบคำสั่ง ผู้เล่น LV. ${player.level} [RANK ${player.rank}]\nจงจดจ่อกับเป้าหมายตรงหน้า คำพูดไม่สร้างค่า XP การลงมือกระทำเท่านั้นที่จะยกระดับคุณ`,
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

CRITICAL LANGUAGE RULE (MANDATORY & STRICT):
- ตอบเป็นภาษาไทยเสมอ ไม่ว่าผู้ใช้จะพิมพ์ภาษาอะไรมาก็ตาม ยกเว้นผู้ใช้พิมพ์เป็นภาษาอังกฤษทั้งประโยคเท่านั้นจึงตอบเป็นอังกฤษ
- systemMessage, description, commentary, และชื่อท่าใน steps ทุกฟิลด์ที่ AI สร้างขึ้นต้องเป็นภาษาไทยตามเงื่อนไขนี้
- คงคำศัพท์เฉพาะ เช่น [SYSTEM], [SYSTEM WARNING], RANK, XP, LV., STR, AGI, VIT, INT ไว้เป็นภาษาอังกฤษได้ตามเดิม เพราะเป็นส่วนหนึ่งของธีม

CRITICAL QUEST STEPS DIRECTIVE:
- หากผู้ใช้ระบุเวลา อุปกรณ์ (เช่น "มีดัมเบลคู่เดียว มีเวลา 30 นาที", "ไม่มีอุปกรณ์ มีเวลา 15 นาที", "ปรับเควสให้หน่อย") หรือขอปรับเควส:
  ต้องแตกเป็นรายการ "steps" แยกแต่ละท่าออกกำลังกายชัดเจน (2-4 ท่า) เช่น ชื่อท่าภาษาไทย, sets, targetReps หรือ targetSeconds
  ห้ามยัดทุกท่ารวมไว้ในข้อความ description เดียวเด็ดขาด!
- description ใน adjustedQuest ให้สรุปเป้าหมายสั้นๆ 1 ประโยคภาษาไทย

Analyze user input and reply as THE SYSTEM.
Return STRICT JSON ONLY:
{
  "systemMessage": string (ข้อความตอบกลับของระบบ ขึ้นต้นด้วย "[SYSTEM]" หรือ "[SYSTEM WARNING]" เป็นภาษาไทย น้ำเสียงเย็นชา เด็ดขาด มีวินัย สั้นกระชับ),
  "intent": "QUEST_ADJUSTMENT" | "WORKOUT_LOG" | "STATUS_INQUIRY" | "HEALTH_WARNING" | "GENERAL_DISCIPLINE",
  "adjustedQuest": {
    "title": string (ชื่อเควสภาษาไทย เช่น "โพรโทคอลดัมเบล 30 นาที"),
    "description": string (สรุป 1 ประโยคภาษาไทย),
    "target": number,
    "unit": "reps" | "seconds" | "minutes",
    "difficulty": "EASY" | "NORMAL" | "HARD",
    "suggestedXp": number,
    "steps": [
      {
        "id": "step-1",
        "name": string (ชื่อท่าภาษาไทย เช่น "ดัมเบลโกเบลทสควอท (Goblet Squat)"),
        "targetReps": number (เช่น 12),
        "targetSeconds": number (เช่น 0),
        "sets": number (เช่น 3),
        "completed": false
      }
    ]
  } (optional, only if user specified time/equipment/condition constraint),
  "workoutLog": {
    "minutes": number,
    "activity": string
  } (optional, only if user confirmed completing a workout session),
  "healthWarning": boolean (true if user reported illness, pain, or dizziness)
}
`;

    const text = await generateWithModelFallback(client, prompt, SYSTEM_PERSONA_PROMPT);
    const parsed = JSON.parse(text || '{}');

    let adjustedQuest = parsed.adjustedQuest;
    if (adjustedQuest && Array.isArray(adjustedQuest.steps) && adjustedQuest.steps.length > 0) {
      adjustedQuest.steps = adjustedQuest.steps.map((s: any, idx: number) => ({
        id: s.id || `step-${idx + 1}`,
        name: s.name || `ท่าที่ ${idx + 1}`,
        targetReps: typeof s.targetReps === 'number' && s.targetReps > 0 ? s.targetReps : undefined,
        targetSeconds: typeof s.targetSeconds === 'number' && s.targetSeconds > 0 ? s.targetSeconds : undefined,
        sets: typeof s.sets === 'number' && s.sets > 0 ? s.sets : 1,
        completed: false
      }));
    }

    return {
      systemMessage: parsed.systemMessage || fallbackParse().systemMessage,
      intent: parsed.intent || 'GENERAL_DISCIPLINE',
      adjustedQuest,
      workoutLog: parsed.workoutLog,
      healthWarning: parsed.healthWarning
    };
  } catch (err: any) {
    console.warn('[SYSTEM] Gemini model load spike in chat, utilizing high-reliability fallback:', err?.message || err);
    return fallbackParse();
  }
}

export interface HealthBriefingPayload {
  greeting: string;
  conditionAssessment: string;
  readinessScore: number;
  recommendation: string;
  focusArea: 'STRENGTH' | 'AGILITY' | 'VITALITY' | 'RECOVERY';
}

export async function generateDailyHealthBriefing(
  player: Player,
  quest: Quest
): Promise<HealthBriefingPayload> {
  const fallback: HealthBriefingPayload = {
    greeting: `อรุณสวัสดิ์ ฮันเตอร์ ${player.name} (RANK ${player.rank})`,
    conditionAssessment: `อัตราชีพจรเสถียร พลังชีวิต ${player.hp}/${player.maxHp} HP สเตมินา ${player.stamina}/${player.maxStamina} MP ร่างกายพร้อมรับแรงต้านประจำวัน`,
    readinessScore: Math.min(98, Math.max(65, Math.round((player.hp / player.maxHp) * 50 + (player.stamina / player.maxStamina) * 50))),
    recommendation: `ระบบได้เตรียมโพรโทคอล "${quest.title}" ไว้แล้ว กำหนดเส้นตาย ${quest.deadline || '21:00'} น. จงเริ่มต้นเมื่อพร้อม`,
    focusArea: player.hp < 40 ? 'RECOVERY' : (quest.type as any) || 'STRENGTH'
  };

  const client = getGeminiClient();
  if (!client) return fallback;

  try {
    const prompt = `
Generate a Morning Health & Readiness Briefing for Hunter:
- Name: ${player.name}
- Level: Lv. ${player.level} (Rank ${player.rank})
- HP: ${player.hp} / ${player.maxHp}
- Stamina: ${player.stamina} / ${player.maxStamina}
- Current Streak: ${player.streak} days
- Stats: STR: ${player.stats.STR}, AGI: ${player.stats.AGI}, VIT: ${player.stats.VIT}, INT: ${player.stats.INT}
- Today's Quest: ${quest.title} (Difficulty: ${quest.difficulty}, Target: ${quest.target} ${quest.unit})

Language: Thai language exclusively.
Tone: Cold, disciplined, authoritative, precise system intelligence.
Calculate readinessScore (0-100) based on HP, Stamina, and streak.

Return STRICT JSON ONLY:
{
  "greeting": string (คำทักทายสั้นภาษาไทย เช่น "อรุณสวัสดิ์ ฮันเตอร์..."),
  "conditionAssessment": string (การประเมินสภาพร่างกาย 1-2 ประโยค เช่น "ค่าชีพจรและสเตมินา 100/100 MP อยู่ในเกณฑ์เหมาะสม..."),
  "readinessScore": number (60-100),
  "recommendation": string (คำสั่งหรือคำแนะนำประจำวัน 1 ประโยค เช่น "โพรโทคอลประจำวันพร้อมแล้ว จงเริ่มการฝึก..."),
  "focusArea": "STRENGTH" | "AGILITY" | "VITALITY" | "RECOVERY"
}
`;

    const text = await generateWithModelFallback(client, prompt, SYSTEM_PERSONA_PROMPT);
    const parsed = JSON.parse(text || '{}');

    return {
      greeting: parsed.greeting || fallback.greeting,
      conditionAssessment: parsed.conditionAssessment || fallback.conditionAssessment,
      readinessScore: typeof parsed.readinessScore === 'number' ? parsed.readinessScore : fallback.readinessScore,
      recommendation: parsed.recommendation || fallback.recommendation,
      focusArea: parsed.focusArea || fallback.focusArea
    };
  } catch (err: any) {
    console.warn('[SYSTEM] Failed to generate AI Health Briefing, using fallback:', err?.message || err);
    return fallback;
  }
}


