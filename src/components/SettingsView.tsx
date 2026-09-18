import { useState, useEffect } from 'react';
import { Player, Quest, LineFlexMessage } from '../types.ts';
import {
  MessageSquare,
  Smartphone,
  Download,
  Terminal,
  Send,
  Bell,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
  ExternalLink,
  ShieldCheck,
  RefreshCw,
  Copy,
  Check,
  Users,
  Radio,
  Activity
} from 'lucide-react';
import { playUiClick, playWarningSound, playLevelUpSound } from '../utils/audio.ts';
import { promptPwaInstall, canInstallPwa } from '../utils/pwa.ts';

interface SettingsViewProps {
  player: Player;
  quest: Quest;
  onResetDemo: () => void;
  onCompleteQuest: () => Promise<void>;
}

interface LineStatus {
  isConfigured: boolean;
  hasSecret: boolean;
  hasToken: boolean;
  connectedUsersCount: number;
  webhookUrl: string;
}

export function SettingsView({ player, quest, onResetDemo, onCompleteQuest }: SettingsViewProps) {
  const [lineSimInput, setLineSimInput] = useState('');
  const [isSimulating, setIsSimulating] = useState(false);
  const [isPushing, setIsPushing] = useState(false);
  const [pushStatusMessage, setPushStatusMessage] = useState<string | null>(null);
  const [copiedWebhook, setCopiedWebhook] = useState(false);
  const [lineStatus, setLineStatus] = useState<LineStatus>({
    isConfigured: false,
    hasSecret: false,
    hasToken: false,
    connectedUsersCount: 0,
    webhookUrl: '/api/line/webhook'
  });

  const [simChatMessages, setSimChatMessages] = useState<
    { sender: 'user' | 'system'; text?: string; flex?: LineFlexMessage }[]
  >([
    {
      sender: 'system',
      text: '[SYSTEM ONLINE]\nPlayer detected: TEST SUBJECT.\nSend message or use commands to test LINE interface.'
    }
  ]);
  const [installAvailable, setInstallAvailable] = useState(canInstallPwa());

  const fetchLineStatus = async () => {
    try {
      const res = await fetch('/api/line/status');
      if (res.ok) {
        const data = await res.json();
        setLineStatus(data);
      }
    } catch (e) {
      console.error('Failed to fetch LINE status:', e);
    }
  };

  useEffect(() => {
    fetchLineStatus();
  }, []);

  const handleCopyWebhook = () => {
    playUiClick();
    const fullUrl =
      typeof window !== 'undefined'
        ? `${window.location.origin}/api/line/webhook`
        : '/api/line/webhook';

    navigator.clipboard.writeText(fullUrl);
    setCopiedWebhook(true);
    setTimeout(() => setCopiedWebhook(false), 2000);
  };

  const handlePushRealLine = async (type: 'quest' | 'reminder' | 'briefing') => {
    playUiClick();
    setIsPushing(true);
    setPushStatusMessage(null);

    try {
      const endpoint =
        type === 'quest'
          ? '/api/line/push-quest'
          : type === 'reminder'
          ? '/api/line/push-reminder'
          : '/api/line/push-briefing';
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({})
      });
      const data = await res.json();

      if (data.success) {
        playLevelUpSound();
        setPushStatusMessage(
          `[SUCCESS] Pushed notification to ${data.results?.length || data.connectedUsersCount} connected LINE hunter(s)!`
        );
      } else {
        playWarningSound();
        setPushStatusMessage(
          data.error ||
            data.message ||
            '[NOTICE] No users connected yet or LINE credentials need activation.'
        );
      }
      fetchLineStatus();
    } catch (e) {
      playWarningSound();
      setPushStatusMessage('[ERROR] Network request failed.');
    } finally {
      setIsPushing(false);
    }
  };

  const handleInstallClick = async () => {
    playUiClick();
    const installed = await promptPwaInstall();
    if (installed) {
      setInstallAvailable(false);
    }
  };

  // Simulate LINE interaction through `/api/line/simulate`
  const triggerLineSimAction = async (action: string, customText?: string) => {
    playUiClick();
    setIsSimulating(true);
    try {
      if (customText) {
        setSimChatMessages((prev) => [...prev, { sender: 'user', text: customText }]);
      }

      const res = await fetch('/api/line/simulate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, message: customText })
      });
      const data = await res.json();

      if (data.type === 'flex' && data.flexMessage) {
        setSimChatMessages((prev) => [
          ...prev,
          { sender: 'system', text: data.systemText, flex: data.flexMessage }
        ]);
      } else {
        setSimChatMessages((prev) => [
          ...prev,
          { sender: 'system', text: data.systemText }
        ]);
      }
    } catch (e) {
      playWarningSound();
      setSimChatMessages((prev) => [
        ...prev,
        { sender: 'system', text: '[SYSTEM ERROR]\nFailed to connect to LINE simulation engine.' }
      ]);
    } finally {
      setIsSimulating(false);
      setLineSimInput('');
    }
  };

  const webhookUrlDisplay =
    typeof window !== 'undefined'
      ? `${window.location.origin}/api/line/webhook`
      : '/api/line/webhook';

  return (
    <div className="space-y-6 pb-12 font-sans">
      {/* 1. LINE Messaging API Architecture & Webhook Configuration */}
      <section className="bg-[#080d1a] border border-cyan-950 rounded-sm p-5 system-bracket">
        <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
          <div className="flex items-center gap-2">
            <MessageSquare className="w-4 h-4 text-emerald-400" />
            <h2 className="text-xs font-mono-system font-bold text-slate-200 tracking-wider uppercase">
              LINE MESSAGING API INTEGRATION PROTOCOL (ข้อ 1: เชื่อมต่อ LINE OFFICIAL ACCOUNT)
            </h2>
          </div>
          <button
            onClick={fetchLineStatus}
            className="text-[10px] font-mono-system text-slate-400 hover:text-cyan-400 flex items-center gap-1 transition-colors"
          >
            <RefreshCw className="w-3 h-3" />
            <span>CHECK STATUS</span>
          </button>
        </div>

        <p className="text-xs text-slate-400 mb-4 leading-relaxed">
          Per architecture specification: <strong className="text-cyan-300">LINE = System Interface</strong>,{' '}
          <strong className="text-cyan-300">WEB APP = Player Dashboard</strong>. เมื่อเชื่อมต่อ LINE Official
          Account จริง ผู้ใช้จะได้รับการแจ้งเตือนเควสต์อัตโนมัติเวลา <strong className="text-white">07:00</strong>{' '}
          และการแจ้งเตือนด่วนเวลา <strong className="text-white">20:00</strong> รวมถึงสามารถส่งข้อความปรับภารกิจ
          และกดสำเร็จเควสต์ผ่านแอป LINE ได้โดยตรง
        </p>

        {/* Live Status Indicators */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4 font-mono-system text-xs">
          <div className="p-3 bg-slate-950 border border-slate-900 rounded">
            <div className="text-[10px] text-slate-500 mb-1">LINE CHANNEL SECRET</div>
            <div className="flex items-center gap-1.5">
              {lineStatus.hasSecret ? (
                <>
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                  <span className="text-emerald-400 font-bold">CONFIGURED</span>
                </>
              ) : (
                <>
                  <AlertCircle className="w-3.5 h-3.5 text-amber-400" />
                  <span className="text-amber-400 font-bold">NOT DETECTED</span>
                </>
              )}
            </div>
          </div>

          <div className="p-3 bg-slate-950 border border-slate-900 rounded">
            <div className="text-[10px] text-slate-500 mb-1">CHANNEL ACCESS TOKEN</div>
            <div className="flex items-center gap-1.5">
              {lineStatus.hasToken ? (
                <>
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                  <span className="text-emerald-400 font-bold">CONFIGURED</span>
                </>
              ) : (
                <>
                  <AlertCircle className="w-3.5 h-3.5 text-amber-400" />
                  <span className="text-amber-400 font-bold">NOT DETECTED</span>
                </>
              )}
            </div>
          </div>

          <div className="p-3 bg-slate-950 border border-slate-900 rounded">
            <div className="text-[10px] text-slate-500 mb-1">CONNECTED LINE HUNTERS</div>
            <div className="flex items-center gap-1.5">
              <Users className="w-3.5 h-3.5 text-cyan-400" />
              <span className="text-cyan-300 font-bold">
                {lineStatus.connectedUsersCount} {lineStatus.connectedUsersCount === 1 ? 'USER' : 'USERS'}
              </span>
            </div>
          </div>
        </div>

        {/* Webhook URL with Copy button */}
        <div className="p-3.5 bg-slate-950 border border-slate-900 rounded font-mono-system text-xs space-y-2 mb-4">
          <div className="flex justify-between items-center text-slate-400 text-[10px]">
            <span className="font-bold tracking-wider text-slate-300 uppercase">
              1. WEBHOOK URL (นำไปใส่ใน LINE DEVELOPERS CONSOLE)
            </span>
            <span className="text-emerald-400 flex items-center gap-1">
              <Radio className="w-3 h-3 animate-pulse" />
              ENDPOINT ACTIVE
            </span>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex-1 p-2 bg-slate-900 border border-slate-800 rounded text-cyan-300 break-all select-all text-xs font-mono">
              {webhookUrlDisplay}
            </div>
            <button
              onClick={handleCopyWebhook}
              className="px-3 py-2 rounded bg-cyan-950 hover:bg-cyan-900 border border-cyan-500/40 text-cyan-300 text-xs flex items-center gap-1 transition-colors whitespace-nowrap"
            >
              {copiedWebhook ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-400" />
                  <span className="text-emerald-400">COPIED!</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5" />
                  <span>COPY URL</span>
                </>
              )}
            </button>
          </div>
          <div className="text-[11px] text-slate-400">
            เปิด <strong>LINE Developers Console</strong> &gt; Channel ของคุณ &gt; แท็บ{' '}
            <strong className="text-white">Messaging API</strong> &gt; หัวข้อ <em>Webhook settings</em> แล้วใส่ URL
            นี้ จากนั้นกด <strong>Verify</strong> และเปิดสวิตช์ <strong className="text-emerald-400">Use webhook</strong>
          </div>
        </div>

        {/* Real LINE Push Notification Test Controls */}
        <div className="p-3.5 bg-slate-950 border border-cyan-950/60 rounded font-mono-system text-xs space-y-3 mb-4">
          <div className="flex items-center justify-between">
            <span className="text-slate-300 font-bold uppercase text-[10px] tracking-wider">
              2. TEST DISPATCH TO REAL LINE (ทดสอบส่งแจ้งเตือนไปยัง LINE จริง)
            </span>
            <span className="text-[10px] text-slate-500">PUSH MESSAGING API</span>
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => handlePushRealLine('briefing')}
              disabled={isPushing}
              className="px-3 py-2 rounded bg-sky-950/80 hover:bg-sky-900 border border-sky-500/50 text-sky-300 font-mono-system text-xs flex items-center gap-1.5 transition-colors disabled:opacity-50"
            >
              <Activity className="w-3.5 h-3.5 text-sky-400" />
              <span>TEST PUSH 08:00 BRIEFING</span>
            </button>

            <button
              onClick={() => handlePushRealLine('quest')}
              disabled={isPushing}
              className="px-3 py-2 rounded bg-cyan-950/80 hover:bg-cyan-900 border border-cyan-500/50 text-cyan-300 font-mono-system text-xs flex items-center gap-1.5 transition-colors disabled:opacity-50"
            >
              <Bell className="w-3.5 h-3.5 text-cyan-400" />
              <span>TEST PUSH 07:00 QUEST</span>
            </button>

            <button
              onClick={() => handlePushRealLine('reminder')}
              disabled={isPushing}
              className="px-3 py-2 rounded bg-rose-950/80 hover:bg-rose-900 border border-rose-500/50 text-rose-300 font-mono-system text-xs flex items-center gap-1.5 transition-colors disabled:opacity-50"
            >
              <AlertCircle className="w-3.5 h-3.5 text-rose-400" />
              <span>TEST PUSH 20:00 REMINDER</span>
            </button>
          </div>

          {pushStatusMessage && (
            <div className="p-2.5 bg-slate-900 border border-slate-800 rounded text-xs text-slate-200">
              {pushStatusMessage}
            </div>
          )}
        </div>

        {/* Step-by-Step Production Guide */}
        <div className="p-4 bg-slate-950/80 border border-slate-900 rounded font-sans text-xs text-slate-400 space-y-3">
          <div className="font-mono-system font-bold text-slate-200 text-xs flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-cyan-400" />
            <span>ขั้นตอนการตั้งค่า LINE Official Account ให้สมบูรณ์แบบ (4 STEPS):</span>
          </div>

          <ol className="space-y-2 list-decimal list-inside leading-relaxed text-[12px]">
            <li>
              เข้าสู่{' '}
              <a
                href="https://developers.line.biz/"
                target="_blank"
                rel="noreferrer"
                className="text-cyan-400 underline hover:text-cyan-300 inline-flex items-center gap-0.5"
              >
                LINE Developers Console <ExternalLink className="w-3 h-3 inline" />
              </a>{' '}
              สร้าง Provider และ Channel ประเภท <strong>Messaging API</strong>
            </li>
            <li>
              ในแท็บ <strong>Messaging API</strong> ใส่ Webhook URL ด้านบน กดปุ่ม <strong>Verify</strong> (ระบบจะตอบรับ 200 OK) แล้วเปิดสวิตช์{' '}
              <strong className="text-emerald-400">Use webhook: ON</strong>
            </li>
            <li>
              คัดลอก <strong>Channel secret</strong> (ในแท็บ Basic settings) และ{' '}
              <strong>Channel access token (long-lived)</strong> (ในแท็บ Messaging API) ไปใส่ใน Environment variables:
              <div className="mt-1 p-2 bg-slate-900 rounded font-mono text-[11px] text-cyan-300">
                LINE_CHANNEL_SECRET=xxx<br />
                LINE_CHANNEL_ACCESS_TOKEN=yyy<br />
                LINE_LOGIN_CHANNEL_ID=zzz<br />
                LINE_LOGIN_CHANNEL_SECRET=aaa<br />
                LINE_OA_BASIC_ID=@yourlineoa
              </div>
            </li>
            <li>
              สำหรับ <strong>LINE Login (สร้างโปรไฟล์และออโต้แอดเพื่อน OA)</strong>:
              สร้าง Channel ชนิด <strong>LINE Login</strong> &gt; ในแท็บ <strong>LINE Login</strong> ใส่ Callback URL:{' '}
              <code className="text-cyan-300 select-all font-mono">{typeof window !== 'undefined' ? `${window.location.origin}/api/auth/line/callback` : '/api/auth/line/callback'}</code>{' '}
              และในหัวข้อ <strong>Linked OA</strong> ให้เลือกเชื่อมต่อกับ LINE Official Account ของคุณ พร้อมตั้งค่า <em>Bot prompt: Aggressive</em> เพื่อให้ผู้เล่นแอด LINE OA ทันทีตอนกดยืนยันล็อกอิน
            </li>
            <li>
              เข้าสู่{' '}
              <a
                href="https://manager.line.biz/"
                target="_blank"
                rel="noreferrer"
                className="text-cyan-400 underline hover:text-cyan-300 inline-flex items-center gap-0.5"
              >
                LINE Official Account Manager <ExternalLink className="w-3 h-3 inline" />
              </a>{' '}
              ไปที่ <em>Settings &gt; Response settings</em> ปิด <strong>Auto-response messages: OFF</strong> และ{' '}
              <strong>Greeting message: OFF</strong> (เพื่อให้ THE SYSTEM ควบคุมการส่งข้อความ Cyberpunk Flex Message เอง 100%)
            </li>
          </ol>
        </div>
      </section>

      {/* 2. Interactive In-App LINE Bot Simulator */}
      <section className="bg-[#090e1b] border-2 border-cyan-500/40 rounded-sm p-5 system-bracket shadow-[0_0_20px_rgba(56,189,248,0.1)]">
        <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
          <div className="flex items-center gap-2">
            <Smartphone className="w-4 h-4 text-cyan-400" />
            <h3 className="text-xs font-mono-system font-bold text-cyan-300 uppercase tracking-wider">
              IN-APP LINE SYSTEM TERMINAL SIMULATOR
            </h3>
          </div>
          <span className="text-[10px] font-mono-system text-slate-400 bg-cyan-950/60 border border-cyan-500/30 px-2 py-0.5 rounded">
            NO CREDENTIALS REQUIRED FOR TESTING
          </span>
        </div>

        {/* Quick Simulated Triggers */}
        <div className="flex flex-wrap gap-2 mb-4">
          <button
            onClick={() => triggerLineSimAction('GET_BRIEFING_FLEX')}
            disabled={isSimulating}
            className="px-3 py-1.5 rounded bg-slate-900 border border-sky-950 hover:border-sky-500 text-sky-300 font-mono-system text-xs flex items-center gap-1.5 transition-colors"
          >
            <Activity className="w-3.5 h-3.5 text-sky-400" />
            <span>08:00 HEALTH BRIEFING</span>
          </button>

          <button
            onClick={() => triggerLineSimAction('GET_QUEST_FLEX')}
            disabled={isSimulating}
            className="px-3 py-1.5 rounded bg-slate-900 border border-cyan-950 hover:border-cyan-500 text-cyan-300 font-mono-system text-xs flex items-center gap-1.5 transition-colors"
          >
            <Bell className="w-3.5 h-3.5 text-cyan-400" />
            <span>DISPATCH QUEST NOTIFICATION</span>
          </button>

          <button
            onClick={() => triggerLineSimAction('GET_REMINDER')}
            disabled={isSimulating}
            className="px-3 py-1.5 rounded bg-slate-900 border border-amber-950 hover:border-amber-500 text-amber-300 font-mono-system text-xs flex items-center gap-1.5 transition-colors"
          >
            <AlertCircle className="w-3.5 h-3.5 text-amber-400" />
            <span>SEND REMINDER</span>
          </button>

          <button
            onClick={() => triggerLineSimAction('COMPLETE_VIA_LINE')}
            disabled={isSimulating}
            className="px-3 py-1.5 rounded bg-slate-900 border border-emerald-950 hover:border-emerald-500 text-emerald-300 font-mono-system text-xs flex items-center gap-1.5 transition-colors"
          >
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
            <span>SIMULATE COMPLETE VIA LINE</span>
          </button>
        </div>

        {/* Simulated Chat Feed */}
        <div className="h-64 overflow-y-auto bg-[#05070a] border border-slate-900 rounded p-4 space-y-3 font-mono-system text-xs">
          {simChatMessages.map((msg, index) => (
            <div
              key={index}
              className={`flex flex-col ${msg.sender === 'user' ? 'items-end' : 'items-start'}`}
            >
              <div
                className={`max-w-[85%] p-3 rounded ${
                  msg.sender === 'user'
                    ? 'bg-emerald-950/80 border border-emerald-500/40 text-emerald-200'
                    : 'bg-slate-950 border border-cyan-950 text-cyan-200'
                }`}
              >
                <div className="text-[9px] text-slate-500 uppercase mb-1">
                  {msg.sender === 'user' ? 'YOU (LINE APP)' : 'THE SYSTEM (LINE BOT)'}
                </div>
                {msg.text && <div className="whitespace-pre-line leading-relaxed">{msg.text}</div>}

                {/* Render Simulated LINE Flex Card */}
                {msg.flex && (
                  <div className="mt-3 p-3 bg-[#0a0f1d] border border-cyan-500/40 rounded text-slate-200 space-y-2 shadow-lg">
                    <div className="text-[10px] text-cyan-400 font-bold tracking-wider uppercase">
                      [LINE FLEX MESSAGE PREVIEW]
                    </div>
                    <div className="font-bold text-sm text-white">{quest.title}</div>
                    <div className="text-xl font-bold text-cyan-300">
                      {quest.target} {quest.unit.toUpperCase()}
                    </div>
                    <div className="text-[11px] text-slate-400">{quest.description}</div>
                    <div className="pt-2 border-t border-slate-800 flex gap-2">
                      <span className="text-[10px] px-2 py-0.5 rounded bg-cyan-950 text-cyan-300 border border-cyan-900">
                        +{quest.xpReward} XP
                      </span>
                      <span className="text-[10px] px-2 py-0.5 rounded bg-rose-950 text-rose-300 border border-rose-900">
                        DL: {quest.deadline}
                      </span>
                    </div>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* Input Bar */}
        <div className="mt-3 flex gap-2">
          <input
            type="text"
            value={lineSimInput}
            onChange={(e) => setLineSimInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') triggerLineSimAction('CHAT', lineSimInput);
            }}
            placeholder="Type LINE message (e.g. 'มีเวลาแค่ 20 นาที')"
            disabled={isSimulating}
            className="flex-1 bg-slate-950 border border-slate-800 rounded px-3 py-2 text-xs text-slate-100 placeholder-slate-600 focus:outline-none focus:border-cyan-500"
          />
          <button
            onClick={() => triggerLineSimAction('CHAT', lineSimInput)}
            disabled={isSimulating || !lineSimInput.trim()}
            className="px-4 py-2 rounded bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold font-mono-system text-xs uppercase flex items-center gap-1.5 disabled:opacity-50"
          >
            <Send className="w-3.5 h-3.5" />
            <span>SEND</span>
          </button>
        </div>
      </section>

      {/* 3. PWA Installation & App Shell Controls */}
      <section className="bg-[#080d1a] border border-cyan-950 rounded-sm p-5 system-bracket">
        <div className="flex items-center gap-2 mb-3">
          <Download className="w-4 h-4 text-cyan-400" />
          <h3 className="text-xs font-mono-system font-bold text-slate-200 uppercase tracking-wider">
            PROGRESSIVE WEB APP (PWA) DEPLOYMENT
          </h3>
        </div>

        <p className="text-xs text-slate-400 mb-4 leading-relaxed">
          THE SYSTEM supports full standalone execution on Android, iOS Safari, and Desktop. Install to your
          home screen to access the full-screen terminal interface with offline shell support.
        </p>

        <div className="flex flex-wrap items-center gap-3">
          <button
            onClick={handleInstallClick}
            className="px-4 py-2.5 rounded bg-cyan-950 hover:bg-cyan-900 border border-cyan-400/50 text-cyan-300 font-mono-system text-xs uppercase font-bold flex items-center gap-2 transition-colors"
          >
            <Download className="w-4 h-4" />
            <span>INSTALL TO HOME SCREEN</span>
          </button>
          <span className="text-xs text-slate-500 font-mono-system">
            Standalone Mode • Service Worker Active
          </span>
        </div>
      </section>

      {/* 4. Demo Mode Reset Control */}
      <section className="bg-[#080d1a] border border-slate-900 rounded-sm p-5 system-bracket">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-xs font-mono-system font-bold text-slate-300 uppercase tracking-wider">
              DEMO MODE MANAGEMENT (SPEC #35)
            </h3>
            <p className="text-xs text-slate-400 mt-1">
              Reset state back to the specified default: TEST SUBJECT, LV. 3, RANK E, XP 320 / 500, STREAK 7.
            </p>
          </div>
          <button
            onClick={() => {
              playUiClick();
              onResetDemo();
            }}
            className="px-4 py-2 rounded bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-300 hover:text-cyan-400 font-mono-system text-xs uppercase flex items-center gap-2 transition-colors"
          >
            <RefreshCw className="w-3.5 h-3.5 text-cyan-400" />
            <span>RESET DEMO DATA</span>
          </button>
        </div>
      </section>
    </div>
  );
}
