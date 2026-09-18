import crypto from 'crypto';
import { Player, Quest, LineFlexMessage } from '../src/types.ts';

export function verifyLineSignature(body: string, signature: string, channelSecret: string): boolean {
  if (!channelSecret || !signature) return false;
  const hash = crypto
    .createHmac('sha256', channelSecret)
    .update(body)
    .digest('base64');
  return hash === signature;
}

// Generate Dark + Neon Blue Minimalist Cyberpunk LINE Flex Message
export function createQuestFlexMessage(quest: Quest, appUrl: string): LineFlexMessage {
  const questUrl = `${appUrl}/quest`;

  // Build step contents for checklist or fallback description
  const cardContents: any[] = [];

  if (quest.steps && quest.steps.length > 0) {
    cardContents.push({
      type: 'text',
      text: `${quest.title.toUpperCase()}`,
      color: '#38bdf8',
      size: 'md',
      weight: 'bold'
    });

    if (quest.description) {
      cardContents.push({
        type: 'text',
        text: quest.description,
        color: '#94a3b8',
        size: 'xs',
        wrap: true,
        margin: 'sm'
      });
    }

    cardContents.push({
      type: 'box',
      layout: 'vertical',
      margin: 'md',
      spacing: 'sm',
      contents: quest.steps.map((step) => {
        const isDone = Boolean(step.completed);
        const icon = isDone ? '☑' : '◯';
        const iconColor = isDone ? '#10b981' : '#38bdf8';
        let details = '';
        if (step.sets && step.sets > 1) {
          details += `${step.sets} เซ็ต `;
        }
        if (step.targetReps) {
          details += `× ${step.targetReps} ครั้ง`;
        } else if (step.targetSeconds) {
          details += `× ${step.targetSeconds} วิ`;
        }
        const fullText = details ? `${step.name} (${details.trim()})` : step.name;

        return {
          type: 'box',
          layout: 'horizontal',
          spacing: 'sm',
          contents: [
            {
              type: 'text',
              text: icon,
              color: iconColor,
              size: 'sm',
              flex: 0,
              weight: 'bold'
            },
            {
              type: 'text',
              text: fullText,
              color: isDone ? '#64748b' : '#f1f5f9',
              size: 'xs',
              wrap: true,
              flex: 1
            }
          ]
        };
      })
    });
  } else {
    // Backward compatibility: original layout for quests without steps
    cardContents.push(
      {
        type: 'text',
        text: `${quest.title.toUpperCase()}`,
        color: '#38bdf8',
        size: 'md',
        weight: 'bold'
      },
      {
        type: 'text',
        text: `${quest.target} ${quest.unit.toUpperCase()}`,
        color: '#f8fafc',
        size: 'xxl',
        weight: 'bold',
        margin: 'sm'
      },
      {
        type: 'text',
        text: quest.description,
        color: '#94a3b8',
        size: 'xs',
        wrap: true,
        margin: 'md'
      }
    );
  }

  return {
    type: 'flex',
    altText: `[SYSTEM] DAILY QUEST: ${quest.title.toUpperCase()}`,
    contents: {
      type: 'bubble',
      size: 'mega',
      header: {
        type: 'box',
        layout: 'vertical',
        backgroundColor: '#05070a',
        paddingAll: '20px',
        contents: [
          {
            type: 'text',
            text: '[SYSTEM NOTICE]',
            color: '#38bdf8',
            size: 'xs',
            weight: 'bold'
          },
          {
            type: 'text',
            text: 'DAILY QUEST GENERATED',
            color: '#ffffff',
            size: 'lg',
            weight: 'bold',
            margin: 'xs'
          }
        ]
      },
      body: {
        type: 'box',
        layout: 'vertical',
        backgroundColor: '#0a0f1d',
        paddingAll: '20px',
        contents: [
          {
            type: 'box',
            layout: 'vertical',
            backgroundColor: '#0f172a',
            cornerRadius: '8px',
            paddingAll: '15px',
            borderColor: '#1e293b',
            borderWidth: '1px',
            contents: cardContents
          },
          {
            type: 'box',
            layout: 'horizontal',
            margin: 'lg',
            contents: [
              {
                type: 'text',
                text: 'REWARD:',
                color: '#64748b',
                size: 'xs',
                flex: 2
              },
              {
                type: 'text',
                text: `+${quest.xpReward} XP`,
                color: '#38bdf8',
                size: 'sm',
                weight: 'bold',
                flex: 3,
                align: 'end'
              }
            ]
          },
          {
            type: 'box',
            layout: 'horizontal',
            margin: 'sm',
            contents: [
              {
                type: 'text',
                text: 'DEADLINE:',
                color: '#64748b',
                size: 'xs',
                flex: 2
              },
              {
                type: 'text',
                text: quest.deadline || '21:00',
                color: '#f43f5e',
                size: 'sm',
                weight: 'bold',
                flex: 3,
                align: 'end'
              }
            ]
          }
        ]
      },
      footer: {
        type: 'box',
        layout: 'vertical',
        backgroundColor: '#05070a',
        paddingAll: '15px',
        spacing: 'sm',
        contents: [
          {
            type: 'button',
            style: 'primary',
            color: '#0284c7',
            height: 'sm',
            action: {
              type: 'uri',
              label: 'VIEW QUEST',
              uri: questUrl
            }
          },
          {
            type: 'button',
            style: 'secondary',
            color: '#1e293b',
            height: 'sm',
            action: {
              type: 'postback',
              label: 'COMPLETE QUEST',
              data: `action=complete&questId=${quest.id}`
            }
          }
        ]
      }
    }
  };
}

// Generate LINE Completion Flex Message
export function createCompletionFlexMessage(quest: Quest, player: Player): LineFlexMessage {
  return {
    type: 'flex',
    altText: `[SYSTEM] QUEST COMPLETE — +${quest.xpReward} XP`,
    contents: {
      type: 'bubble',
      size: 'mega',
      header: {
        type: 'box',
        layout: 'vertical',
        backgroundColor: '#05070a',
        paddingAll: '20px',
        contents: [
          {
            type: 'text',
            text: '[SYSTEM CONFIRMATION]',
            color: '#10b981',
            size: 'xs',
            weight: 'bold'
          },
          {
            type: 'text',
            text: 'QUEST COMPLETE',
            color: '#ffffff',
            size: 'xl',
            weight: 'bold',
            margin: 'xs'
          }
        ]
      },
      body: {
        type: 'box',
        layout: 'vertical',
        backgroundColor: '#0a0f1d',
        paddingAll: '20px',
        spacing: 'md',
        contents: [
          {
            type: 'text',
            text: `+${quest.xpReward} XP ACCRUED`,
            color: '#38bdf8',
            size: 'lg',
            weight: 'bold'
          },
          {
            type: 'text',
            text: `STREAK: ${player.streak} DAYS`,
            color: '#fbbf24',
            size: 'md',
            weight: 'bold'
          },
          {
            type: 'text',
            text: `CURRENT LEVEL: LV. ${player.level} (RANK ${player.rank})`,
            color: '#94a3b8',
            size: 'xs'
          },
          {
            type: 'text',
            text: 'The System records your adherence. Continue.',
            color: '#64748b',
            size: 'xs'
          }
        ]
      }
    }
  };
}

// Generate dramatic Rank-Up announcement Flex Message.
// The previous rank is derived from the rank ladder because the function receives the new rank.
export function createRankUpFlexMessage(newRank: string, player: Player, oldRankOverride?: string): LineFlexMessage {
  const rankOrder = ['E', 'D', 'C', 'B', 'A', 'S'];
  const newIndex = Math.max(0, rankOrder.indexOf(newRank));
  const oldRank = oldRankOverride || rankOrder[Math.max(0, newIndex - 1)] || newRank;

  return {
    type: 'flex',
    altText: `[SYSTEM] RANK UP — ${oldRank} → ${newRank}`,
    contents: {
      type: 'bubble',
      size: 'mega',
      header: {
        type: 'box',
        layout: 'vertical',
        backgroundColor: '#241604',
        paddingAll: '24px',
        contents: [
          {
            type: 'text',
            text: '[SYSTEM AUTHORITY UPDATE]',
            color: '#f8d27a',
            size: 'xs',
            weight: 'bold',
            align: 'center'
          },
          {
            type: 'text',
            text: 'RANK UP',
            color: '#fff7d6',
            size: 'xxl',
            weight: 'bold',
            align: 'center',
            margin: 'md'
          },
          {
            type: 'text',
            text: 'AUTHORIZATION LEVEL ASCENDED',
            color: '#d6b56b',
            size: 'xxs',
            weight: 'bold',
            align: 'center',
            margin: 'xs'
          }
        ]
      },
      body: {
        type: 'box',
        layout: 'vertical',
        backgroundColor: '#0b0a08',
        paddingAll: '24px',
        spacing: 'lg',
        contents: [
          {
            type: 'box',
            layout: 'horizontal',
            justifyContent: 'center',
            alignItems: 'center',
            contents: [
              { type: 'text', text: `RANK ${oldRank}`, color: '#94a3b8', size: 'lg', weight: 'bold', align: 'center', flex: 1 },
              { type: 'text', text: '→', color: '#f8d27a', size: 'xl', weight: 'bold', align: 'center', flex: 0 },
              { type: 'text', text: `RANK ${newRank}`, color: '#f8d27a', size: 'xl', weight: 'bold', align: 'center', flex: 1 }
            ]
          },
          {
            type: 'box',
            layout: 'vertical',
            backgroundColor: '#17130b',
            cornerRadius: '8px',
            paddingAll: '16px',
            borderColor: '#6b4f16',
            borderWidth: '1px',
            contents: [
              { type: 'text', text: player.displayName, color: '#ffffff', size: 'md', weight: 'bold', align: 'center' },
              { type: 'text', text: `LV. ${String(player.level).padStart(2, '0')}`, color: '#f8d27a', size: 'sm', weight: 'bold', align: 'center', margin: 'xs' }
            ]
          },
          {
            type: 'box',
            layout: 'horizontal',
            spacing: 'md',
            contents: [
              {
                type: 'box',
                layout: 'vertical',
                flex: 1,
                contents: [
                  { type: 'text', text: 'STREAK', color: '#64748b', size: 'xxs', align: 'center' },
                  { type: 'text', text: `${player.streak} DAYS`, color: '#fbbf24', size: 'md', weight: 'bold', align: 'center', margin: 'xs' }
                ]
              },
              {
                type: 'box',
                layout: 'vertical',
                flex: 1,
                contents: [
                  { type: 'text', text: 'XP', color: '#64748b', size: 'xxs', align: 'center' },
                  { type: 'text', text: `${player.xp}/${player.currentLevelMaxXp}`, color: '#38bdf8', size: 'md', weight: 'bold', align: 'center', margin: 'xs' }
                ]
              },
              {
                type: 'box',
                layout: 'vertical',
                flex: 1,
                contents: [
                  { type: 'text', text: 'QUESTS', color: '#64748b', size: 'xxs', align: 'center' },
                  { type: 'text', text: `${player.totalQuestCompleted}`, color: '#34d399', size: 'md', weight: 'bold', align: 'center', margin: 'xs' }
                ]
              }
            ]
          },
          {
            type: 'text',
            text: 'ขีดจำกัดเดิมถูกทำลายแล้ว ระดับสิทธิ์ของผู้เล่นได้รับการยกระดับ',
            color: '#cbd5e1',
            size: 'xs',
            wrap: true,
            align: 'center'
          }
        ]
      },
      footer: {
        type: 'box',
        layout: 'vertical',
        backgroundColor: '#0b0a08',
        paddingAll: '16px',
        contents: [
          {
            type: 'text',
            text: '[ SYSTEM RECORD UPDATED ]',
            color: '#a78bfa',
            size: 'xxs',
            weight: 'bold',
            align: 'center'
          }
        ]
      }
    }
  };
}

// Generate the special celebration card used when a Weekly Boss is cleared.
export function createWeeklyBossClearedFlexMessage(quest: Quest, player: Player): LineFlexMessage {
  return {
    type: 'flex',
    altText: `[SYSTEM] WEEKLY BOSS CLEARED — +${quest.xpReward} XP`,
    contents: {
      type: 'bubble',
      size: 'mega',
      header: {
        type: 'box',
        layout: 'vertical',
        backgroundColor: '#241604',
        paddingAll: '24px',
        contents: [
          { type: 'text', text: '[SYSTEM SPECIAL REWARD]', color: '#f8d27a', size: 'xs', weight: 'bold', align: 'center' },
          { type: 'text', text: 'WEEKLY BOSS CLEARED', color: '#fff7d6', size: 'xl', weight: 'bold', align: 'center', margin: 'md' },
          { type: 'text', text: 'TITLE / BADGE UNLOCKED', color: '#d6b56b', size: 'xxs', weight: 'bold', align: 'center', margin: 'xs' }
        ]
      },
      body: {
        type: 'box',
        layout: 'vertical',
        backgroundColor: '#0b0a08',
        paddingAll: '24px',
        spacing: 'md',
        contents: [
          { type: 'text', text: quest.title, color: '#ffffff', size: 'md', weight: 'bold', wrap: true, align: 'center' },
          { type: 'text', text: `+${quest.xpReward} XP`, color: '#f8d27a', size: 'xxl', weight: 'bold', align: 'center', margin: 'sm' },
          { type: 'text', text: `WEEKLY BOSSES CLEARED: ${player.weeklyBossesCleared || 0}`, color: '#fbbf24', size: 'sm', weight: 'bold', align: 'center' },
          {
            type: 'box',
            layout: 'vertical',
            backgroundColor: '#17130b',
            cornerRadius: '8px',
            paddingAll: '14px',
            borderColor: '#6b4f16',
            borderWidth: '1px',
            contents: [
              { type: 'text', text: 'UNLOCKED', color: '#64748b', size: 'xxs', align: 'center' },
              { type: 'text', text: 'WEEKLY BOSS VANQUISHER', color: '#f8d27a', size: 'md', weight: 'bold', align: 'center', margin: 'xs', wrap: true },
              { type: 'text', text: 'TITLE + BADGE', color: '#cbd5e1', size: 'xxs', align: 'center', margin: 'xs' }
            ]
          }
        ]
      }
    }
  };
}

// Compact System Window used by LINE as the player's primary dashboard.
export function createSystemStatusFlexMessage(player: Player, appUrl: string, options?: {
  dailyQuest?: Quest | null;
  emergencyQuest?: Quest | null;
  weeklyBossQuest?: Quest | null;
}): LineFlexMessage {
  const xpPercent = player.currentLevelMaxXp > 0
    ? Math.min(100, Math.round((player.xp / player.currentLevelMaxXp) * 100))
    : 0;
  const status = player.activeDebuff ? 'DEBUFF ACTIVE' : 'NORMAL';
  const statusColor = player.activeDebuff ? '#ef4444' : '#34d399';
  const bar = (percent: number, width = 10) => {
    const filled = Math.round((Math.max(0, Math.min(100, percent)) / 100) * width);
    return '█'.repeat(filled) + '░'.repeat(width - filled);
  };
  const daily = options?.dailyQuest;
  const emergency = options?.emergencyQuest;
  const boss = options?.weeklyBossQuest;

  const questRows: any[] = [];
  if (daily) questRows.push({ type: 'text', text: `DAILY  ${daily.title}`, color: '#e2e8f0', size: 'xs', wrap: true });
  if (emergency) questRows.push({ type: 'text', text: `EMERGENCY  ${emergency.title}`, color: '#fca5a5', size: 'xs', wrap: true, margin: 'xs' });
  if (boss) questRows.push({ type: 'text', text: `BOSS  ${boss.title}`, color: '#f8d27a', size: 'xs', wrap: true, margin: 'xs' });
  if (!questRows.length) questRows.push({ type: 'text', text: 'NO ACTIVE QUEST', color: '#64748b', size: 'xs' });

  return {
    type: 'flex',
    altText: `[SYSTEM] LV.${player.level} RANK ${player.rank} | ${status}`,
    contents: {
      type: 'bubble',
      size: 'mega',
      header: {
        type: 'box', layout: 'vertical', backgroundColor: '#05070a', paddingAll: '20px',
        contents: [
          { type: 'text', text: '[ SYSTEM WINDOW ]', color: '#38bdf8', size: 'xs', weight: 'bold', align: 'center' },
          { type: 'text', text: 'PLAYER STATUS', color: '#ffffff', size: 'xl', weight: 'bold', align: 'center', margin: 'sm' },
          { type: 'text', text: player.displayName, color: '#94a3b8', size: 'xxs', align: 'center', margin: 'xs' }
        ]
      },
      body: {
        type: 'box', layout: 'vertical', backgroundColor: '#0a0f1d', paddingAll: '20px', spacing: 'md',
        contents: [
          { type: 'box', layout: 'horizontal', contents: [
            { type: 'text', text: `LV. ${String(player.level).padStart(2, '0')}`, color: '#ffffff', size: 'lg', weight: 'bold', flex: 1 },
            { type: 'text', text: `RANK ${player.rank}`, color: '#f8d27a', size: 'lg', weight: 'bold', align: 'end', flex: 1 }
          ]},
          { type: 'text', text: `EXP  ${bar(xpPercent)}  ${xpPercent}%`, color: '#38bdf8', size: 'xs', weight: 'bold' },
          { type: 'box', layout: 'horizontal', spacing: 'sm', contents: [
            { type: 'text', text: `HP ${player.hp}/${player.maxHp}`, color: '#cbd5e1', size: 'xxs', flex: 1 },
            { type: 'text', text: `STA ${player.stamina}/${player.maxStamina}`, color: '#cbd5e1', size: 'xxs', flex: 1, align: 'end' }
          ]},
          { type: 'box', layout: 'horizontal', spacing: 'sm', contents: [
            { type: 'text', text: `STR ${player.stats.STR}`, color: '#e2e8f0', size: 'xxs', flex: 1 },
            { type: 'text', text: `AGI ${player.stats.AGI}`, color: '#e2e8f0', size: 'xxs', flex: 1 },
            { type: 'text', text: `VIT ${player.stats.VIT}`, color: '#e2e8f0', size: 'xxs', flex: 1 },
            { type: 'text', text: `INT ${player.stats.INT}`, color: '#e2e8f0', size: 'xxs', flex: 1 }
          ]},
          { type: 'box', layout: 'horizontal', contents: [
            { type: 'text', text: `STREAK  ${player.streak} DAYS`, color: '#fbbf24', size: 'xs', weight: 'bold', flex: 1 },
            { type: 'text', text: status, color: statusColor, size: 'xs', weight: 'bold', align: 'end', flex: 1 }
          ]},
          { type: 'separator', margin: 'sm' },
          { type: 'text', text: 'ACTIVE SYSTEM EVENTS', color: '#64748b', size: 'xxs', weight: 'bold' },
          ...questRows
        ]
      },
      footer: {
        type: 'box', layout: 'horizontal', spacing: 'sm', backgroundColor: '#05070a', paddingAll: '12px',
        contents: [
          { type: 'button', style: 'primary', color: '#0ea5e9', action: { type: 'uri', label: 'QUEST', uri: `${appUrl}/?tab=quest` } },
          { type: 'button', style: 'secondary', action: { type: 'uri', label: 'STATUS', uri: `${appUrl}/?tab=status` } }
        ]
      }
    }
  };
}

export function createEmergencyQuestFlexMessage(quest: Quest, appUrl: string): LineFlexMessage {
  const base = createQuestFlexMessage(quest, appUrl);
  const contents: any = base.contents;
  if (contents.header?.contents?.[0]) contents.header.contents[0].text = '[ SYSTEM ALERT ]';
  if (contents.header?.contents?.[0]) contents.header.contents[0].color = '#ef4444';
  if (contents.body?.contents) {
    contents.body.contents.unshift({ type: 'text', text: 'EMERGENCY PROTOCOL', color: '#fca5a5', size: 'xs', weight: 'bold' });
  }
  base.altText = `[SYSTEM ALERT] EMERGENCY QUEST — ${quest.title}`;
  return base;
}

export function createWeeklyBossQuestFlexMessage(quest: Quest, appUrl: string): LineFlexMessage {
  const base = createQuestFlexMessage(quest, appUrl);
  const contents: any = base.contents;
  if (contents.header?.contents?.[0]) {
    contents.header.contents[0].text = '[ SYSTEM SPECIAL MISSION ]';
    contents.header.contents[0].color = '#f8d27a';
  }
  if (contents.body?.contents) {
    contents.body.contents.unshift({ type: 'text', text: 'WEEKLY BOSS • ELITE', color: '#f8d27a', size: 'xs', weight: 'bold' });
  }
  base.altText = `[SYSTEM] WEEKLY BOSS — ${quest.title}`;
  return base;
}

// Generate LINE Status Flex Message
export function createStatusFlexMessage(player: Player, appUrl: string): LineFlexMessage {
  const xpPercent = Math.min(100, Math.round((player.xp / player.currentLevelMaxXp) * 100));

  return {
    type: 'flex',
    altText: `[SYSTEM] STATUS: LV. ${player.level} (${player.rank}-RANK)`,
    contents: {
      type: 'bubble',
      size: 'mega',
      header: {
        type: 'box',
        layout: 'vertical',
        backgroundColor: '#05070a',
        paddingAll: '20px',
        contents: [
          {
            type: 'text',
            text: '[PLAYER STATUS PROTOCOL]',
            color: '#38bdf8',
            size: 'xs',
            weight: 'bold'
          },
          {
            type: 'text',
            text: `${player.displayName.toUpperCase()}`,
            color: '#ffffff',
            size: 'lg',
            weight: 'bold',
            margin: 'xs'
          }
        ]
      },
      body: {
        type: 'box',
        layout: 'vertical',
        backgroundColor: '#0a0f1d',
        paddingAll: '20px',
        spacing: 'md',
        contents: [
          {
            type: 'box',
            layout: 'horizontal',
            contents: [
              {
                type: 'box',
                layout: 'vertical',
                flex: 1,
                contents: [
                  { type: 'text', text: 'LEVEL', color: '#64748b', size: 'xxs' },
                  { type: 'text', text: `LV. ${player.level}`, color: '#ffffff', size: 'xl', weight: 'bold' }
                ]
              },
              {
                type: 'box',
                layout: 'vertical',
                flex: 1,
                contents: [
                  { type: 'text', text: 'RANK', color: '#64748b', size: 'xxs' },
                  { type: 'text', text: `RANK ${player.rank}`, color: '#38bdf8', size: 'xl', weight: 'bold' }
                ]
              }
            ]
          },
          {
            type: 'box',
            layout: 'vertical',
            margin: 'md',
            contents: [
              {
                type: 'box',
                layout: 'horizontal',
                contents: [
                  { type: 'text', text: 'EXP MATRIX', color: '#94a3b8', size: 'xs' },
                  { type: 'text', text: `${player.xp} / ${player.currentLevelMaxXp} (${xpPercent}%)`, color: '#38bdf8', size: 'xs', align: 'end' }
                ]
              },
              {
                type: 'box',
                layout: 'vertical',
                backgroundColor: '#1e293b',
                height: '6px',
                cornerRadius: '3px',
                margin: 'sm',
                contents: [
                  {
                    type: 'box',
                    layout: 'vertical',
                    backgroundColor: '#38bdf8',
                    height: '6px',
                    width: `${xpPercent}%`,
                    cornerRadius: '3px'
                  }
                ]
              }
            ]
          },
          {
            type: 'box',
            layout: 'horizontal',
            margin: 'md',
            contents: [
              { type: 'text', text: `STR: ${player.stats.STR}`, color: '#fbbf24', size: 'xs', weight: 'bold' },
              { type: 'text', text: `AGI: ${player.stats.AGI}`, color: '#38bdf8', size: 'xs', weight: 'bold' },
              { type: 'text', text: `VIT: ${player.stats.VIT}`, color: '#34d399', size: 'xs', weight: 'bold' },
              { type: 'text', text: `INT: ${player.stats.INT}`, color: '#c084fc', size: 'xs', weight: 'bold' }
            ]
          },
          {
            type: 'box',
            layout: 'horizontal',
            margin: 'sm',
            contents: [
              { type: 'text', text: `🔥 STREAK: ${player.streak} DAYS`, color: '#f59e0b', size: 'xs', weight: 'bold' }
            ]
          },
          ...(player.activeDebuff
            ? [
                {
                  type: 'box',
                  layout: 'vertical',
                  backgroundColor: '#450a0a',
                  borderColor: '#ef4444',
                  borderWidth: '1px',
                  cornerRadius: '4px',
                  paddingAll: '10px',
                  margin: 'md',
                  contents: [
                    {
                      type: 'text',
                      text: `⚠ ${player.activeDebuff.name}`,
                      color: '#f87171',
                      size: 'xs',
                      weight: 'bold'
                    },
                    {
                      type: 'text',
                      text: `${player.activeDebuff.description} (XP ×${player.activeDebuff.xpMultiplier})`,
                      color: '#fca5a5',
                      size: 'xxs',
                      wrap: true,
                      margin: 'xs'
                    }
                  ]
                }
              ]
            : [])
        ]
      },
      footer: {
        type: 'box',
        layout: 'vertical',
        backgroundColor: '#05070a',
        paddingAll: '15px',
        contents: [
          {
            type: 'button',
            style: 'primary',
            color: '#0284c7',
            height: 'sm',
            action: {
              type: 'uri',
              label: 'OPEN DASHBOARD',
              uri: appUrl
            }
          }
        ]
      }
    }
  };
}

// Generate LINE 20:00 Reminder Flex Message
export function createReminderFlexMessage(quest: Quest, appUrl: string): LineFlexMessage {
  return {
    type: 'flex',
    altText: `[SYSTEM WARNING] DEADLINE APPROACHING: ${quest.deadline || '21:00'}`,
    contents: {
      type: 'bubble',
      size: 'mega',
      header: {
        type: 'box',
        layout: 'vertical',
        backgroundColor: '#1c0c14',
        paddingAll: '20px',
        contents: [
          {
            type: 'text',
            text: '[SYSTEM WARNING: 20:00 DIRECTIVE]',
            color: '#f43f5e',
            size: 'xs',
            weight: 'bold'
          },
          {
            type: 'text',
            text: 'DEADLINE APPROACHING',
            color: '#ffffff',
            size: 'lg',
            weight: 'bold',
            margin: 'xs'
          }
        ]
      },
      body: {
        type: 'box',
        layout: 'vertical',
        backgroundColor: '#0e070c',
        paddingAll: '20px',
        spacing: 'sm',
        contents: [
          {
            type: 'text',
            text: `Target: ${quest.title}`,
            color: '#f43f5e',
            size: 'md',
            weight: 'bold'
          },
          {
            type: 'text',
            text: `${quest.target} ${quest.unit.toUpperCase()}`,
            color: '#ffffff',
            size: 'xxl',
            weight: 'bold'
          },
          {
            type: 'text',
            text: `Deadline expires at ${quest.deadline || '21:00'}. Failure results in system penalty directive.`,
            color: '#94a3b8',
            size: 'xs',
            wrap: true,
            margin: 'md'
          }
        ]
      },
      footer: {
        type: 'box',
        layout: 'vertical',
        backgroundColor: '#05070a',
        paddingAll: '15px',
        spacing: 'sm',
        contents: [
          {
            type: 'button',
            style: 'primary',
            color: '#e11d48',
            height: 'sm',
            action: {
              type: 'postback',
              label: 'COMPLETE QUEST NOW',
              data: `action=complete&questId=${quest.id}`
            }
          },
          {
            type: 'button',
            style: 'secondary',
            color: '#1e293b',
            height: 'sm',
            action: {
              type: 'uri',
              label: 'VIEW IN SYSTEM APP',
              uri: `${appUrl}/quest`
            }
          }
        ]
      }
    }
  };
}

// Generate LINE Morning Health & Readiness Briefing Flex Message
export function createBriefingFlexMessage(
  briefing: {
    greeting: string;
    conditionAssessment: string;
    readinessScore: number;
    recommendation: string;
    focusArea: string;
  },
  player: Player,
  quest: Quest,
  appUrl: string
): LineFlexMessage {
  const scoreColor =
    briefing.readinessScore >= 80 ? '#38bdf8' : briefing.readinessScore >= 60 ? '#fbbf24' : '#f43f5e';

  return {
    type: 'flex',
    altText: `[SYSTEM] DAILY HEALTH BRIEFING: READINESS ${briefing.readinessScore}%`,
    contents: {
      type: 'bubble',
      size: 'mega',
      header: {
        type: 'box',
        layout: 'vertical',
        backgroundColor: '#05070a',
        paddingAll: '20px',
        contents: [
          {
            type: 'text',
            text: '[SYSTEM MORNING DIRECTIVE]',
            color: '#38bdf8',
            size: 'xs',
            weight: 'bold'
          },
          {
            type: 'text',
            text: 'DAILY HEALTH BRIEFING',
            color: '#ffffff',
            size: 'lg',
            weight: 'bold',
            margin: 'xs'
          },
          {
            type: 'text',
            text: briefing.greeting,
            color: '#94a3b8',
            size: 'xs',
            margin: 'sm'
          }
        ]
      },
      body: {
        type: 'box',
        layout: 'vertical',
        backgroundColor: '#0a0f1d',
        paddingAll: '20px',
        spacing: 'md',
        contents: [
          // Readiness Gauge Row
          {
            type: 'box',
            layout: 'horizontal',
            alignItems: 'center',
            contents: [
              {
                type: 'box',
                layout: 'vertical',
                flex: 3,
                contents: [
                  {
                    type: 'text',
                    text: 'PHYSICAL READINESS',
                    color: '#64748b',
                    size: 'xxs',
                    weight: 'bold'
                  },
                  {
                    type: 'text',
                    text: `${briefing.readinessScore}%`,
                    color: scoreColor,
                    size: 'xxl',
                    weight: 'bold'
                  }
                ]
              },
              {
                type: 'box',
                layout: 'vertical',
                flex: 4,
                contents: [
                  {
                    type: 'text',
                    text: `HP: ${player.hp}/${player.maxHp}`,
                    color: '#f43f5e',
                    size: 'xs',
                    weight: 'bold'
                  },
                  {
                    type: 'text',
                    text: `MP: ${player.stamina}/${player.maxStamina}`,
                    color: '#38bdf8',
                    size: 'xs',
                    weight: 'bold',
                    margin: 'xs'
                  },
                  {
                    type: 'text',
                    text: `STREAK: ${player.streak} DAYS`,
                    color: '#fbbf24',
                    size: 'xs',
                    margin: 'xs'
                  }
                ]
              }
            ]
          },
          // Assessment
          {
            type: 'box',
            layout: 'vertical',
            backgroundColor: '#05070a',
            cornerRadius: '4px',
            paddingAll: '12px',
            contents: [
              {
                type: 'text',
                text: 'SYSTEM ASSESSMENT:',
                color: '#38bdf8',
                size: 'xxs',
                weight: 'bold'
              },
              {
                type: 'text',
                text: briefing.conditionAssessment,
                color: '#cbd5e1',
                size: 'xs',
                wrap: true,
                margin: 'xs'
              }
            ]
          },
          // Today's Quest Snippet
          {
            type: 'box',
            layout: 'vertical',
            backgroundColor: '#05070a',
            cornerRadius: '4px',
            paddingAll: '12px',
            contents: [
              {
                type: 'text',
                text: 'ACTIVE PROTOCOL:',
                color: '#10b981',
                size: 'xxs',
                weight: 'bold'
              },
              {
                type: 'text',
                text: quest.title,
                color: '#ffffff',
                size: 'xs',
                weight: 'bold',
                margin: 'xs'
              },
              {
                type: 'text',
                text: `เป้าหมาย: ${quest.target} ${quest.unit} (กำหนดส่ง: ${quest.deadline || '21:00'} น.)`,
                color: '#94a3b8',
                size: 'xxs',
                margin: 'xs'
              }
            ]
          },
          // Recommendation
          {
            type: 'text',
            text: briefing.recommendation,
            color: '#38bdf8',
            size: 'xs',
            wrap: true
          }
        ]
      },
      footer: {
        type: 'box',
        layout: 'vertical',
        backgroundColor: '#05070a',
        paddingAll: '15px',
        spacing: 'sm',
        contents: [
          {
            type: 'button',
            style: 'primary',
            color: '#0284c7',
            height: 'sm',
            action: {
              type: 'uri',
              label: 'INITIATE QUEST PROTOCOL',
              uri: `${appUrl}/quest`
            }
          }
        ]
      }
    }
  };
}

// Reply message to LINE user via replyToken
export async function replyLineMessage(replyToken: string, messages: any[]): Promise<boolean> {
  const token = process.env.LINE_CHANNEL_ACCESS_TOKEN;
  if (!token || !replyToken) return false;

  try {
    const res = await fetch('https://api.line.me/v2/bot/message/reply', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify({
        replyToken,
        messages
      })
    });
    if (!res.ok) {
      const errText = await res.text();
      console.error('[LINE] Reply API error:', res.status, errText);
    }
    return res.ok;
  } catch (err) {
    console.error('[LINE] Network error in replyLineMessage:', err);
    return false;
  }
}

// Push message to LINE user if LINE_CHANNEL_ACCESS_TOKEN is present
export async function sendLinePushMessage(userId: string, messages: any[]): Promise<boolean> {
  const token = process.env.LINE_CHANNEL_ACCESS_TOKEN;
  if (!token) {
    console.log('[LINE] Channel token not configured in .env. Notification simulated.');
    return false;
  }

  try {
    const res = await fetch('https://api.line.me/v2/bot/message/push', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify({
        to: userId,
        messages
      })
    });
    if (!res.ok) {
      const errText = await res.text();
      console.error('[LINE] Push API error:', res.status, errText);
    }
    return res.ok;
  } catch (err) {
    console.error('[LINE] Failed to send LINE push message:', err);
    return false;
  }
}

export interface WeeklySummaryData {
  totalQuests: number;
  totalXp: number;
  currentStreak: number;
  missedDeadlines: number;
  totalMinutes: number;
  periodLabel: string;
}

// Generate LINE Weekly Evaluation Summary Flex Message (Sunday 21:30)
export function createWeeklySummaryFlexMessage(
  summary: WeeklySummaryData,
  player: Player,
  appUrl: string
): LineFlexMessage {
  const isHighPerformer = summary.totalQuests >= 5 && summary.missedDeadlines === 0;
  const evaluationTone = isHighPerformer
    ? 'วินัยอยู่ในระดับยอดเยี่ยม ร่างกายปรับตัวเข้ากับโพรโทคอลได้อย่างน่าพึงพอใจ จงรักษามาตรฐานนี้ไว้'
    : summary.missedDeadlines > 0
    ? `ตรวจพบการละเว้นภารกิจ ${summary.missedDeadlines} ครั้ง ความอ่อนแอจะนำไปสู่บทลงโทษ จงปรับปรุงวินัยในสัปดาห์ถัดไป`
    : 'การฝึกฝนดำเนินไปอย่างต่อเนื่อง จงยกระดับขีดจำกัดของตนเองในสัปดาห์ข้างหน้า';

  return {
    type: 'flex',
    altText: `[SYSTEM] WEEKLY EVALUATION: ${summary.totalQuests} เควสสำเร็จ | +${summary.totalXp} XP`,
    contents: {
      type: 'bubble',
      size: 'mega',
      header: {
        type: 'box',
        layout: 'vertical',
        backgroundColor: '#05070a',
        paddingAll: '20px',
        contents: [
          {
            type: 'text',
            text: '[WEEKLY SYSTEM DEBRIEF]',
            color: '#38bdf8',
            size: 'xs',
            weight: 'bold'
          },
          {
            type: 'text',
            text: 'รายงานสรุปผลประจำสัปดาห์',
            color: '#ffffff',
            size: 'lg',
            weight: 'bold',
            margin: 'xs'
          },
          {
            type: 'text',
            text: summary.periodLabel,
            color: '#64748b',
            size: 'xxs',
            margin: 'xs'
          }
        ]
      },
      body: {
        type: 'box',
        layout: 'vertical',
        backgroundColor: '#0a0f1d',
        paddingAll: '20px',
        spacing: 'md',
        contents: [
          {
            type: 'box',
            layout: 'horizontal',
            contents: [
              {
                type: 'box',
                layout: 'vertical',
                flex: 1,
                contents: [
                  { type: 'text', text: 'เควสที่สำเร็จ', color: '#64748b', size: 'xxs' },
                  {
                    type: 'text',
                    text: `${summary.totalQuests} ภารกิจ`,
                    color: '#34d399',
                    size: 'lg',
                    weight: 'bold'
                  }
                ]
              },
              {
                type: 'box',
                layout: 'vertical',
                flex: 1,
                contents: [
                  { type: 'text', text: 'EXP สะสมรวม', color: '#64748b', size: 'xxs' },
                  {
                    type: 'text',
                    text: `+${summary.totalXp} XP`,
                    color: '#38bdf8',
                    size: 'lg',
                    weight: 'bold'
                  }
                ]
              }
            ]
          },
          {
            type: 'box',
            layout: 'horizontal',
            margin: 'sm',
            contents: [
              {
                type: 'box',
                layout: 'vertical',
                flex: 1,
                contents: [
                  { type: 'text', text: 'STREAK ปัจจุบัน', color: '#64748b', size: 'xxs' },
                  {
                    type: 'text',
                    text: `${summary.currentStreak} วัน`,
                    color: '#f59e0b',
                    size: 'md',
                    weight: 'bold'
                  }
                ]
              },
              {
                type: 'box',
                layout: 'vertical',
                flex: 1,
                contents: [
                  { type: 'text', text: 'พลาด DEADLINE', color: '#64748b', size: 'xxs' },
                  {
                    type: 'text',
                    text: `${summary.missedDeadlines} ครั้ง`,
                    color: summary.missedDeadlines > 0 ? '#ef4444' : '#94a3b8',
                    size: 'md',
                    weight: 'bold'
                  }
                ]
              }
            ]
          },
          {
            type: 'box',
            layout: 'vertical',
            backgroundColor: '#0f172a',
            cornerRadius: '4px',
            paddingAll: '12px',
            margin: 'md',
            borderColor: '#1e293b',
            borderWidth: '1px',
            contents: [
              {
                type: 'text',
                text: 'SYSTEM ASSESSMENT',
                color: '#38bdf8',
                size: 'xxs',
                weight: 'bold'
              },
              {
                type: 'text',
                text: evaluationTone,
                color: '#cbd5e1',
                size: 'xs',
                wrap: true,
                margin: 'xs'
              }
            ]
          }
        ]
      },
      footer: {
        type: 'box',
        layout: 'vertical',
        backgroundColor: '#05070a',
        paddingAll: '15px',
        contents: [
          {
            type: 'button',
            style: 'primary',
            color: '#0284c7',
            height: 'sm',
            action: {
              type: 'uri',
              label: 'VIEW SYSTEM LOGS',
              uri: `${appUrl}/history`
            }
          }
        ]
      }
    }
  };
}
