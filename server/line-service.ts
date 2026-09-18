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
