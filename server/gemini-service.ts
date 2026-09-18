import { GoogleGenAI } from '@google/genai';
import { Player, Quest, QuestDifficulty, QuestType, QuestStep } from '../src/types.ts';
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

export interface ReminderRequest {
  remindAt: string; // ISO datetime string
  message: string;
}

export interface AIChatResponse {
  systemMessage: string;
  intent: 'QUEST_ADJUSTMENT' | 'WORKOUT_LOG' | 'STATUS_INQUIRY' | 'HEALTH_WARNING' | 'GENERAL_DISCIPLINE' | 'SET_REMINDER';
  adjustedQuest?: Partial<GeneratedQuestPayload>;
  workoutLog?: {
    minutes: number;
    activity: string;
  };
  healthWarning?: boolean;
  reminderRequest?: ReminderRequest;
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
  player: Player,
  options?: { currentTimeIso?: string }
): Promise<AIChatResponse> {
  const client = getAIClient();

  const now = new Date();
  const currentTimeIso = options?.currentTimeIso || now.toISOString();

  // Formatted Bangkok local time (UTC+7)
  const bangkokFormatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Bangkok',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false
  });
  const parts = bangkokFormatter.formatToParts(now);
  const partMap: Record<string, string> = {};
  for (const p of parts) {
    partMap[p.type] = p.value;
  }
  const bangkokDateStr = `${partMap.year}-${partMap.month}-${partMap.day}`;
  const bangkokTimeStr = `${partMap.hour}:${partMap.minute}`;
  const bangkokFullStr = `${bangkokDateStr} ${bangkokTimeStr}:${partMap.second || '00'} (Asia/Bangkok UTC+7)`;

  // Keyword-based fallback parsing strictly adhering to Thai language directive
  const fallbackParse = (): AIChatResponse => {
    const msg = userMessage.toLowerCase();

    // 0. Check for Reminder intent (SET_REMINDER)
    const isReminderKeyword = msg.includes('เตือน') || msg.includes('remind') || msg.includes('ปลุก') || msg.includes('แจ้งเตือน');
    if (isReminderKeyword) {
      // Relative minutes: "เตือนอีก 10 นาที", "เตือนใน 15 นาที", "อีก 30 นาทีเตือนด้วย"
      const relativeMinMatch = msg.match(/(?:อีก|ในอีก|ใน)?\s*(\d+)\s*(?:นาที|min|minute)/i);
      if (relativeMinMatch) {
        const addMinutes = parseInt(relativeMinMatch[1], 10);
        if (addMinutes > 0) {
          const targetDate = new Date(Date.now() + addMinutes * 60 * 1000);
          const targetIso = targetDate.toISOString();
          const targetTimeFormatted = targetDate.toLocaleTimeString('th-TH', {
            timeZone: 'Asia/Bangkok',
            hour: '2-digit',
            minute: '2-digit'
          });
          return {
            systemMessage: `[SYSTEM NOTICE]\nบันทึกเวลาแจ้งเตือนเรียบร้อย: อีก ${addMinutes} นาที (${targetTimeFormatted} น.)\nระบบจะส่งสัญญาณเตือนผ่าน LINE เมื่อถึงกำหนดเวลา จงเตรียมความพร้อม`,
            intent: 'SET_REMINDER',
            reminderRequest: {
              remindAt: targetIso,
              message: `[SYSTEM REMINDER]\nถึงเวลาที่กำหนดแล้ว: อีก ${addMinutes} นาทีผ่านไป\nจงเริ่มลงมือปฏิบัติตามคำสั่งของระบบ อย่าปล่อยให้ความเฉื่อยชาครอบงำ`
            }
          };
        }
      }

      // Exact clock time: "เตือนตอน 15:46", "เตือน 15:46", "15.46", "7:00", "07:00"
      const exactTimeMatch = msg.match(/(\d{1,2})[:.](\d{2})/);
      if (exactTimeMatch) {
        const h = parseInt(exactTimeMatch[1], 10);
        const m = parseInt(exactTimeMatch[2], 10);
        if (h >= 0 && h < 24 && m >= 0 && m < 60) {
          const currentBkkHour = parseInt(partMap.hour, 10);
          const currentBkkMin = parseInt(partMap.minute, 10);
          let targetDayOffset = 0;
          if (msg.includes('พรุ่งนี้') || (h < currentBkkHour || (h === currentBkkHour && m <= currentBkkMin))) {
            targetDayOffset = 1;
          }
          const targetDate = new Date(Date.now() + targetDayOffset * 86400000);
          const partsT = bangkokFormatter.formatToParts(targetDate);
          const pMap: Record<string, string> = {};
          for (const p of partsT) pMap[p.type] = p.value;
          const targetIso = new Date(`${pMap.year}-${pMap.month}-${pMap.day}T${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:00+07:00`).toISOString();
          const displayTime = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;

          return {
            systemMessage: `[SYSTEM NOTICE]\nบันทึกเวลาแจ้งเตือนเรียบร้อย: ${displayTime} น.${targetDayOffset ? ' (วันพรุ่งนี้)' : ''}\nระบบจะส่งสัญญาณเตือนไปยังอุปกรณ์ของคุณเมื่อถึงเวลาที่กำหนด`,
            intent: 'SET_REMINDER',
            reminderRequest: {
              remindAt: targetIso,
              message: `[SYSTEM REMINDER]\nขณะนี้เวลา ${displayTime} น.\nระบบส่งสัญญาณเตือนตามคำสั่งที่คุณกำหนดไว้ จงเข้าสู่โหมดการฝึกทันที`
            }
          };
        }
      }

      // Thai conversational clock terms: "7 โมง", "7 โมงเช้า", "1 ทุ่ม", "2 ทุ่ม", "บ่าย 2 โมง"
      const thaiClockMatch = msg.match(/(\d{1,2})\s*(โมงเช้า|โมงเย็น|โมง|ทุ่ม)/);
      if (thaiClockMatch) {
        const num = parseInt(thaiClockMatch[1], 10);
        const unit = thaiClockMatch[2];
        let h = num;
        if (unit === 'ทุ่ม') {
          h = 18 + num; // 1 ทุ่ม = 19:00
        } else if (unit === 'โมงเย็น' || msg.includes('บ่าย')) {
          h = num <= 5 ? 12 + num : num;
        } else if (unit === 'โมงเช้า' || msg.includes('เช้า')) {
          h = num;
        }
        if (h >= 0 && h < 24) {
          const currentBkkHour = parseInt(partMap.hour, 10);
          const targetDayOffset = msg.includes('พรุ่งนี้') || h <= currentBkkHour ? 1 : 0;
          const targetDate = new Date(Date.now() + targetDayOffset * 86400000);
          const partsT = bangkokFormatter.formatToParts(targetDate);
          const pMap: Record<string, string> = {};
          for (const p of partsT) pMap[p.type] = p.value;
          const targetIso = new Date(`${pMap.year}-${pMap.month}-${pMap.day}T${String(h).padStart(2, '0')}:00:00+07:00`).toISOString();
          const displayTime = `${String(h).padStart(2, '0')}:00`;

          return {
            systemMessage: `[SYSTEM NOTICE]\nบันทึกเวลาแจ้งเตือนเรียบร้อย: ${displayTime} น.${targetDayOffset ? ' (วันพรุ่งนี้)' : ''}\nระบบจะส่งสัญญาณเตือนไปยังอุปกรณ์ของคุณเมื่อถึงเวลาที่กำหนด`,
            intent: 'SET_REMINDER',
            reminderRequest: {
              remindAt: targetIso,
              message: `[SYSTEM REMINDER]\nขณะนี้เวลา ${displayTime} น.\nระบบส่งสัญญาณเตือนตามคำสั่งที่คุณกำหนดไว้ จงเข้าสู่โหมดการฝึกทันที`
            }
          };
        }
      }

      // Ambiguous / indeterminate time -> Reject explicitly per Requirement 5
      return {
        systemMessage: `[SYSTEM]\nคำสั่งตั้งเวลาเตือนไม่สมบูรณ์: ไม่พบเวลาเป้าหมายที่แน่นอน\nกรุณาระบุเวลาให้ชัดเจน เช่น "เตือนตอน 15:46" หรือ "เตือนอีก 10 นาที" ระบบไม่สามารถลงทะเบียนเวลาที่กำกวมได้`,
        intent: 'SET_REMINDER'
      };
    }

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
Time Reference:
- System UTC ISO: ${currentTimeIso}
- Asia/Bangkok (UTC+7) Local Time: ${bangkokFullStr} (เวลาประเทศไทยปัจจุบัน: วันที่ ${bangkokDateStr} เวลา ${bangkokTimeStr} น.)

CRITICAL LANGUAGE RULE (MANDATORY & STRICT):
- ตอบเป็นภาษาไทยเสมอ ไม่ว่าผู้ใช้จะพิมพ์ภาษาอะไรมาก็ตาม ยกเว้นผู้ใช้พิมพ์เป็นภาษาอังกฤษทั้งประโยคเท่านั้นจึงตอบเป็นอังกฤษ
- systemMessage, description, commentary, และชื่อท่าใน steps ทุกฟิลด์ที่ AI สร้างขึ้นต้องเป็นภาษาไทยตามเงื่อนไขนี้
- คงคำศัพท์เฉพาะ เช่น [SYSTEM], [SYSTEM WARNING], [SYSTEM NOTICE], [SYSTEM REMINDER], RANK, XP, LV., STR, AGI, VIT, INT ไว้เป็นภาษาอังกฤษได้ตามเดิม เพราะเป็นส่วนหนึ่งของธีม

CRITICAL INTENT DIRECTIVES:
1. INTENT "SET_REMINDER":
   - หากผู้ใช้พิมพ์ขอให้เตือนตามเวลา เช่น:
     "เตือนตอน 15:46", "เตือน 20:30", "เตือนพรุ่งนี้เช้า 7 โมง", "เตือนตอน 1 ทุ่ม", "เตือนอีก 10 นาที", "เตือนในอีกครึ่งชั่วโมง"
     ให้ตั้งค่า "intent": "SET_REMINDER"
   - คำนวณเวลาจริงของเป้าหมายให้แม่นยำ โดยอ้างอิงจากเวลาประเทศไทยปัจจุบัน (${bangkokFullStr})
     แปลงเวลาเป้าหมายเป็นรูปแบบ ISO 8601 Datetime String ที่ถูกต้อง (เช่น "2026-09-18T15:46:00.000+07:00" หรือ ISO UTC)
     หากเวลาที่ระบุผ่านไปแล้วในวันนี้ ให้ถือว่าเป็นเวลาของวันพรุ่งนี้
   - ใส่ในฟิลด์ "reminderRequest": {
       "remindAt": "<ISO_DATETIME_STRING>",
       "message": "<ข้อความเตือนของระบบสไตล์ THE SYSTEM สั้น กระชับ ทรงพลัง เช่น '[SYSTEM REMINDER] ขณะนี้เวลา 15:46 น. ถึงเวลาปฏิบัติตามคำสั่งของระบบแล้ว จงลงมือฝึกทันที'>"
     }
   - ใน "systemMessage": ตอบรับคำสั่งสไตล์ THE SYSTEM เป็นภาษาไทยอย่างเฉียบขาด ระบุเวลาที่บันทึกไว้ชัดเจน (เช่น "[SYSTEM NOTICE]\nบันทึกเวลาแจ้งเตือนเรียบร้อย: 15:46 น.\nระบบจะส่งสัญญาณเตือนผ่าน LINE เมื่อถึงกำหนดเวลา จงเตรียมความพร้อม")
   - กฎเหล็กความชัดเจน (MANDATORY - NO FALSE PROMISES):
     หากผู้ใช้พิมพ์ขอเตือน แต่ไม่ระบุเวลา หรือเวลากำกวม ไม่ชัดเจน ไม่สามารถคำนวณชั่วโมง/นาทีที่แน่นอนได้ (เช่น "เตือนด้วยนะ", "เตือนหน่อย", "ช่วยเตือนทีหลัง", "เตือนบ่อยๆ"):
     * ห้ามใส่ฟิลด์ "reminderRequest" เด็ดขาด (ให้ส่งเป็น null หรือละเว้นฟิลด์นี้)
     * ใน "systemMessage" ให้ตอบปฏิเสธอย่างเด็ดขาดและสั่งให้ผู้ใช้ระบุเวลาที่แน่นอน เช่น "[SYSTEM]\nคำสั่งตั้งเวลาเตือนไม่สมบูรณ์: ไม่พบเวลาเป้าหมายที่แน่นอน\nกรุณาระบุเวลาให้ชัดเจน เช่น 'เตือนตอน 15:46' หรือ 'เตือนอีก 10 นาที' ระบบไม่สามารถลงทะเบียนเวลาที่กำกวมได้"
     * ห้ามตอบรับปากว่าจะเตือนเด็ดขาดถ้าไม่มีเวลาที่แท้จริง!

2. INTENT "QUEST_ADJUSTMENT":
   - หากผู้ใช้ระบุเวลา อุปกรณ์ หรือขอปรับเควส:
     ต้องแตกเป็นรายการ "steps" แยกแต่ละท่าออกกำลังกายชัดเจน (2-4 ท่า)
     description สรุปเป้าหมายสั้นๆ 1 ประโยคภาษาไทย

Analyze user input and reply as THE SYSTEM.
Return STRICT JSON ONLY:
{
  "systemMessage": string (ข้อความตอบกลับของระบบ ขึ้นต้นด้วย "[SYSTEM]" หรือ "[SYSTEM NOTICE]" หรือ "[SYSTEM WARNING]" เป็นภาษาไทย น้ำเสียงเย็นชา เด็ดขาด มีวินัย สั้นกระชับ),
  "intent": "QUEST_ADJUSTMENT" | "WORKOUT_LOG" | "STATUS_INQUIRY" | "HEALTH_WARNING" | "GENERAL_DISCIPLINE" | "SET_REMINDER",
  "adjustedQuest": {
    "title": string,
    "description": string,
    "target": number,
    "unit": "reps" | "seconds" | "minutes",
    "difficulty": "EASY" | "NORMAL" | "HARD",
    "suggestedXp": number,
    "steps": [
      {
        "id": "step-1",
        "name": string,
        "targetReps": number,
        "targetSeconds": number,
        "sets": number,
        "completed": false
      }
    ]
  } (optional),
  "workoutLog": {
    "minutes": number,
    "activity": string
  } (optional),
  "healthWarning": boolean,
  "reminderRequest": {
    "remindAt": string (ISO 8601 Datetime string),
    "message": string
  } (optional, ONLY when an exact valid time is determinable. Omit or null if ambiguous)
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

    // Validate reminderRequest
    let reminderRequest = parsed.reminderRequest;
    if (reminderRequest && reminderRequest.remindAt) {
      const parsedDate = new Date(reminderRequest.remindAt);
      if (isNaN(parsedDate.getTime())) {
        reminderRequest = undefined;
      } else {
        reminderRequest.remindAt = parsedDate.toISOString();
        if (!reminderRequest.message) {
          reminderRequest.message = `[SYSTEM REMINDER] ถึงเวลาที่คุณกำหนดไว้แล้ว จงเริ่มการฝึกฝน`;
        }
      }
    } else {
      reminderRequest = undefined;
    }

    let systemMessage = parsed.systemMessage || fallbackParse().systemMessage;
    // Rule 5: If user intended SET_REMINDER but no valid definite time was provided, enforce clarification
    if (parsed.intent === 'SET_REMINDER' && !reminderRequest) {
      systemMessage = `[SYSTEM]\nคำสั่งตั้งเวลาเตือนไม่สมบูรณ์: ไม่พบเวลาเป้าหมายที่แน่นอน\nกรุณาระบุเวลาให้ชัดเจน เช่น "เตือนตอน 15:46" หรือ "เตือนอีก 10 นาที" ระบบไม่สามารถลงทะเบียนเวลาที่กำกวมได้`;
    }

    return {
      systemMessage,
      intent: parsed.intent || 'GENERAL_DISCIPLINE',
      adjustedQuest,
      workoutLog: parsed.workoutLog,
      healthWarning: parsed.healthWarning,
      reminderRequest
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
    greeting: `อรุณสวัสดิ์ ฮันเตอร์ ${player.displayName} (RANK ${player.rank})`,
    conditionAssessment: `อัตราชีพจรเสถียร พลังชีวิต ${player.hp}/${player.maxHp} HP สเตมินา ${player.stamina}/${player.maxStamina} MP ร่างกายพร้อมรับแรงต้านประจำวัน`,
    readinessScore: Math.min(98, Math.max(65, Math.round((player.hp / player.maxHp) * 50 + (player.stamina / player.maxStamina) * 50))),
    recommendation: `ระบบได้เตรียมโพรโทคอล "${quest.title}" ไว้แล้ว กำหนดเส้นตาย ${quest.deadline || '21:00'} น. จงเริ่มต้นเมื่อพร้อม`,
    focusArea: player.hp < 40 ? 'RECOVERY' : (quest.type as any) || 'STRENGTH'
  };

  const client = getAIClient();
  if (!client) return fallback;

  try {
    const prompt = `
Generate a Morning Health & Readiness Briefing for Hunter:
- Name: ${player.displayName}
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

export interface ExcuseAnalysis {
  validExcuse: boolean;
  systemResponse: string;
}

export async function analyzeExcuseWithAI(reason: string): Promise<ExcuseAnalysis> {
  const client = getAIClient();

  const fallback = (): ExcuseAnalysis => {
    const normalized = reason.toLowerCase();
    const valid = /เจ็บ|บาดเจ็บ|ป่วย|ไข้|ไม่สบาย|เวียนหัว|อุบัติเหตุ|ฉุกเฉิน|เข้าโรงพยาบาล|hospital|injur|sick|ill|dizz|emergency|accident|medical/.test(normalized);
    return {
      validExcuse: valid,
      systemResponse: valid
        ? '[SYSTEM] เหตุผลได้รับการยอมรับในฐานะเหตุสุดวิสัยทางกายภาพ บทลงโทษจะไม่ถูกนำมาใช้ในรอบนี้ โปรดพักและฟื้นฟูร่างกายก่อนกลับเข้าสู่ระบบ'
        : '[SYSTEM] เหตุผลไม่เข้าข่ายเหตุสุดวิสัย ระบบจะดำเนินบทลงโทษตามกฎเดิม'
    };
  };

  if (!client) return fallback();

  try {
    const prompt = `
วิเคราะห์เหตุผลที่ผู้เล่นพลาด Daily Quest deadline ของ THE SYSTEM
เหตุผลจากผู้เล่น: "${reason}"

เกณฑ์ตัดสินอย่างเคร่งครัด:
- validExcuse = true เฉพาะกรณีเจ็บป่วย, บาดเจ็บ, อาการผิดปกติทางกายที่ควรหยุดฝึก, หรือเหตุสุดวิสัยร้ายแรงที่อยู่นอกการควบคุมจริง
- validExcuse = false สำหรับขี้เกียจ, ลืม, ไม่มีเวลา, งานทั่วไป, ติดธุระทั่วไป, ไม่อยากทำ หรือเหตุผลที่ยังสามารถจัดเวลา/ปรับเควสได้
- ห้ามแต่งข้อเท็จจริงเพิ่มจากเหตุผลที่ผู้ใช้ให้
- systemResponse ต้องเป็นภาษาไทย สั้น กระชับ โทน THE SYSTEM และอธิบายผลการตัดสิน

Return STRICT JSON ONLY:
{
  "validExcuse": boolean,
  "systemResponse": string
}`;

    const text = await generateWithModelFallback(client, prompt, SYSTEM_PERSONA_PROMPT);
    const parsed = JSON.parse(text || '{}');
    return {
      validExcuse: Boolean(parsed.validExcuse),
      systemResponse: typeof parsed.systemResponse === 'string' && parsed.systemResponse.trim()
        ? parsed.systemResponse.trim()
        : fallback().systemResponse
    };
  } catch (error: any) {
    console.warn('[SYSTEM] Excuse analysis fallback:', error?.message || error);
    return fallback();
  }
}

