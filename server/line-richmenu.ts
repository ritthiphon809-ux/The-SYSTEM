import fs from 'fs';
import path from 'path';

const RICHMENU_IMAGE_PATH = path.join(process.cwd(), 'public', 'richmenu.png');

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

  return { richMenuId };
}

export async function listRichMenus() {
  const res = await lineFetch('https://api.line.me/v2/bot/richmenu/list', { method: 'GET' });
  return res.json();
}

export async function deleteRichMenu(richMenuId: string) {
  await lineFetch(`https://api.line.me/v2/bot/richmenu/${richMenuId}`, { method: 'DELETE' });
}
