import fs from 'fs';
import path from 'path';

const RICHMENU_IMAGE_PATH = path.join(process.cwd(), 'public', 'richmenu.png');
const RICHMENU_DEBUFF_IMAGE_PATH = path.join(process.cwd(), 'public', 'richmenu-debuff.png');

let cachedDefaultRichMenuId: string | null = null;
let cachedDebuffRichMenuId: string | null = null;

// Layout: 2500x1686, 3 columns x 2 rows, matches richmenu.png
function buildAreas(appUrl: string) {
  const W = 2500, H = 1686;
  const CW = Math.floor(W / 3);
  const CH = Math.floor(H / 2);

  const rect = (col: number, row: number) => ({
    x: col * CW,
    y: row * CH,
    width: col === 2 ? W - CW * 2 : CW,
    height: row === 1 ? H - CH : CH
  });

  return [
    { bounds: rect(0, 0), action: { type: 'uri', label: 'HOME', uri: `${appUrl}/?tab=home` } },
    { bounds: rect(1, 0), action: { type: 'uri', label: 'QUEST', uri: `${appUrl}/?tab=quest` } },
    { bounds: rect(2, 0), action: { type: 'uri', label: 'STATUS', uri: `${appUrl}/?tab=status` } },
    { bounds: rect(0, 1), action: { type: 'uri', label: 'HISTORY', uri: `${appUrl}/?tab=history` } },
    {
      bounds: rect(1, 1),
      action: { type: 'postback', label: 'COMPLETE', data: 'action=complete&questId=richmenu', displayText: 'complete' }
    },
    { bounds: rect(2, 1), action: { type: 'uri', label: 'SETTINGS', uri: `${appUrl}/?tab=settings` } }
  ].map((a) => ({
    bounds: a.bounds,
    action: a.action
  }));
}

async function lineFetch(url: string, options: any) {
  const token = process.env.LINE_CHANNEL_ACCESS_TOKEN;
  if (!token) throw new Error('LINE_CHANNEL_ACCESS_TOKEN not configured');
  const res = await fetch(url, {
    ...options,
    headers: {
      Authorization: `Bearer ${token}`,
      ...(options.headers || {})
    }
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`LINE API ${res.status}: ${text}`);
  }
  return res;
}

export async function setupDefaultRichMenu(appUrl: string): Promise<{ richMenuId: string }> {
  if (!fs.existsSync(RICHMENU_IMAGE_PATH)) {
    throw new Error(`richmenu.png not found at ${RICHMENU_IMAGE_PATH}`);
  }

  // 1. Create the rich menu object
  const createRes = await lineFetch('https://api.line.me/v2/bot/richmenu', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      size: { width: 2500, height: 1686 },
      selected: true,
      name: 'THE SYSTEM - Main Menu',
      chatBarText: 'MENU',
      areas: buildAreas(appUrl)
    })
  });
  const { richMenuId } = await createRes.json();

  // 2. Upload the image
  const imageBuffer = fs.readFileSync(RICHMENU_IMAGE_PATH);
  await lineFetch(`https://api-data.line.me/v2/bot/richmenu/${richMenuId}/content`, {
    method: 'POST',
    headers: { 'Content-Type': 'image/png' },
    body: imageBuffer
  });

  // 3. Set as default for all users
  await lineFetch(`https://api.line.me/v2/bot/user/all/richmenu/${richMenuId}`, {
    method: 'POST'
  });

  cachedDefaultRichMenuId = richMenuId;
  return { richMenuId };
}

export async function setupDebuffRichMenu(appUrl: string): Promise<{ richMenuId: string }> {
  const imagePath = fs.existsSync(RICHMENU_DEBUFF_IMAGE_PATH)
    ? RICHMENU_DEBUFF_IMAGE_PATH
    : RICHMENU_IMAGE_PATH;

  if (!fs.existsSync(imagePath)) {
    throw new Error(`Richmenu image not found at ${imagePath}`);
  }

  // 1. Create the debuff rich menu object
  const createRes = await lineFetch('https://api.line.me/v2/bot/richmenu', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      size: { width: 2500, height: 1686 },
      selected: true,
      name: 'THE SYSTEM - Debuff Warning Menu',
      chatBarText: 'DEBUFF ACTIVE',
      areas: buildAreas(appUrl)
    })
  });
  const { richMenuId } = await createRes.json();

  // 2. Upload the debuff image
  const imageBuffer = fs.readFileSync(imagePath);
  await lineFetch(`https://api-data.line.me/v2/bot/richmenu/${richMenuId}/content`, {
    method: 'POST',
    headers: { 'Content-Type': 'image/png' },
    body: imageBuffer
  });

  cachedDebuffRichMenuId = richMenuId;
  return { richMenuId };
}

export async function linkRichMenuToUser(userId: string, richMenuId: string): Promise<boolean> {
  try {
    await lineFetch(`https://api.line.me/v2/bot/user/${userId}/richmenu/${richMenuId}`, {
      method: 'POST'
    });
    return true;
  } catch (err) {
    console.error(`[LINE] Error linking rich menu ${richMenuId} to user ${userId}:`, err);
    return false;
  }
}

export async function unlinkRichMenuFromUser(userId: string): Promise<boolean> {
  try {
    await lineFetch(`https://api.line.me/v2/bot/user/${userId}/richmenu`, {
      method: 'DELETE'
    });
    return true;
  } catch (err) {
    console.error(`[LINE] Error unlinking rich menu from user ${userId}:`, err);
    return false;
  }
}

export async function switchToDebuffMenuForUser(userId: string, appUrl: string): Promise<boolean> {
  if (!process.env.LINE_CHANNEL_ACCESS_TOKEN || !userId) return false;
  try {
    if (!cachedDebuffRichMenuId) {
      const res = await setupDebuffRichMenu(appUrl);
      cachedDebuffRichMenuId = res.richMenuId;
    }
    return await linkRichMenuToUser(userId, cachedDebuffRichMenuId);
  } catch (err) {
    console.error(`[LINE] Failed to switch to debuff menu for ${userId}:`, err);
    return false;
  }
}

export async function switchToNormalMenuForUser(userId: string): Promise<boolean> {
  if (!process.env.LINE_CHANNEL_ACCESS_TOKEN || !userId) return false;
  try {
    return await unlinkRichMenuFromUser(userId);
  } catch (err) {
    console.error(`[LINE] Failed to switch to normal menu for ${userId}:`, err);
    return false;
  }
}

export async function listRichMenus() {
  const res = await lineFetch('https://api.line.me/v2/bot/richmenu/list', { method: 'GET' });
  return res.json();
}

export async function deleteRichMenu(richMenuId: string) {
  await lineFetch(`https://api.line.me/v2/bot/richmenu/${richMenuId}`, { method: 'DELETE' });
}
