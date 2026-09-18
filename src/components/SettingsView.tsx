import { useState, useEffect } from 'react';
import { Player, Quest, LineFlexMessage, PendingReminder } from '../types.ts';
import {
  MessageSquare,
  Smartphone,
  Download,
  Terminal,
  Send,
  Bell,
  CheckCircle2,
  AlertCircle,
  ExternalLink,
  ShieldCheck,
  RefreshCw,
  Copy,
  Check,
  Users,
  Radio,
  Activity,
  Clock,
  Settings as SettingsIcon,
  ChevronDown,
  ChevronUp
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
  const [activeTab, setActiveTab] = useState<'line_setup' | 'simulator' | 'preferences'>('line_setup');
  const [lineSimInput, setLineSimInput] = useState('');
  const [isSimulating, setIsSimulating] = useState(false);
  const [isPushing, setIsPushing] = useState(false);
  const [pushStatusMessage, setPushStatusMessage] = useState<string | null>(null);
  const [copiedWebhook, setCopiedWebhook] = useState(false);
  const [showSetupSteps, setShowSetupSteps] = useState(false);
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
  const [reminders, setReminders] = useState<PendingReminder[]>([]);

  const fetchReminders = async () => {
    try {
      const res = await fetch('/api/reminders');
      if (res.ok) {
        const data = await res.json();
        setReminders(data.reminders || []);
      }
    } catch (e) {
      console.error('Failed to fetch reminders:', e);
    }
  };

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
    fetchReminders();
    const interval = setInterval(fetchReminders, 15000);
    return () => clearInterval(interval);
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
      fetchReminders();
      onCompleteQuest();
    }
  };

  const webhookUrlDisplay =
    typeof window !== 'undefined'
      ? `${window.location.origin}/api/line/webhook`
      : '/api/line/webhook';

  return (
    <div className="space-y-4 pb-12 font-sans">
      {/* Tab Navigation Pill Bar */}
      <div className="flex items-center gap-1.5 p-1 bg-[#060b16] border border-cyan-950 rounded-sm font-mono-system text-xs overflow-x-auto">
        <button
          onClick={() => {
            playUiClick();
            setActiveTab('line_setup');
          }}
          className={`flex-1 py-2 px-3 rounded flex items-center justify-center gap-1.5 whitespace-nowrap transition-colors font-bold ${
            activeTab === 'line_setup'
              ? 'bg-cyan-500 text-slate-950 shadow-[0_0_10px_rgba(56,189,248,0.4)]'
              : 'text-slate-400 hover:text-cyan-300'
          }`}
        >
          <MessageSquare className="w-3.5 h-3.5" />
          <span>1. LINE SETUP</span>
        </button>

        <button
          onClick={() => {
            playUiClick();
            setActiveTab('simulator');
          }}
          className={`flex-1 py-2 px-3 rounded flex items-center justify-center gap-1.5 whitespace-nowrap transition-colors font-bold ${
            activeTab === 'simulator'
              ? 'bg-cyan-500 text-slate-950 shadow-[0_0_10px_rgba(56,189,248,0.4)]'
              : 'text-slate-400 hover:text-cyan-300'
          }`}
        >
          <Terminal className="w-3.5 h-3.5" />
          <span>2. SIMULATOR & QUEUE</span>
        </button>

        <button
          onClick={() => {
            playUiClick();
            setActiveTab('preferences');
          }}
          className={`flex-1 py-2 px-3 rounded flex items-center justify-center gap-1.5 whitespace-nowrap transition-colors font-bold ${
            activeTab === 'preferences'
              ? 'bg-cyan-500 text-slate-950 shadow-[0_0_10px_rgba(56,189,248,0.4)]'
              : 'text-slate-400 hover:text-cyan-300'
          }`}
        >
          <SettingsIcon className="w-3.5 h-3.5" />
          <span>3. PREFERENCES</span>
        </button>
      </div>

      {/* TAB 1: LINE SETUP & WEBHOOK */}
      {activeTab === 'line_setup' && (
        <div className="space-y-4 animate-in fade-in duration-200">
          <section className="bg-[#080d1a] border border-cyan-950/80 rounded-sm p-4 system-bracket">
            <div className="flex items-center justify-between gap-2 border-b border-cyan-950/60 pb-3 mb-3">
              <div className="flex items-center gap-2">
                <MessageSquare className="w-4 h-4 text-emerald-400" />
                <h2 className="text-xs font-mono-system font-bold text-slate-200 uppercase tracking-wider">
                  LINE MESSAGING API STATUS
                </h2>
              </div>
              <button
                onClick={fetchLineStatus}
                className="text-[11px] font-mono-system text-slate-400 hover:text-cyan-300 flex items-center gap-1 transition-colors"
              >
                <RefreshCw className="w-3 h-3" />
                <span>CHECK STATUS</span>
              </button>
            </div>

            {/* Live Status Indicators */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 mb-4 font-mono-system text-xs">
              <div className="p-2.5 bg-slate-950 border border-slate-900 rounded">
                <div className="text-[10px] text-slate-500 uppercase">CHANNEL SECRET</div>
                <div className="flex items-center gap-1.5 mt-1">
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

              <div className="p-2.5 bg-slate-950 border border-slate-900 rounded">
                <div className="text-[10px] text-slate-500 uppercase">ACCESS TOKEN</div>
                <div className="flex items-center gap-1.5 mt-1">
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

              <div className="p-2.5 bg-slate-950 border border-slate-900 rounded">
                <div className="text-[10px] text-slate-500 uppercase">CONNECTED USERS</div>
                <div className="flex items-center gap-1.5 mt-1">
                  <Users className="w-3.5 h-3.5 text-cyan-400" />
                  <span className="text-cyan-300 font-bold">
                    {lineStatus.connectedUsersCount} {lineStatus.connectedUsersCount === 1 ? 'USER' : 'USERS'}
                  </span>
                </div>
              </div>
            </div>

            {/* Webhook URL with Copy button */}
            <div className="p-3 bg-slate-950 border border-slate-900 rounded font-mono-system text-xs space-y-2 mb-3">
              <div className="flex justify-between items-center text-[10px]">
                <span className="font-bold text-slate-300 uppercase">
                  WEBHOOK URL FOR LINE DEVELOPERS
                </span>
                <span className="text-emerald-400 flex items-center gap-1">
                  <Radio className="w-3 h-3 animate-pulse" />
                  ACTIVE
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
                      <span className="text-emerald-400">COPIED</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5" />
                      <span>COPY</span>
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* Push Test Controls */}
            <div className="p-3 bg-slate-950 border border-cyan-950/60 rounded font-mono-system text-xs space-y-2">
              <div className="text-[10px] text-slate-400 font-bold uppercase">
                TEST PUSH DISPATCH TO REAL LINE USERS:
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() => handlePushRealLine('briefing')}
                  disabled={isPushing}
                  className="px-2.5 py-1.5 rounded bg-sky-950 hover:bg-sky-900 border border-sky-500/40 text-sky-300 text-xs flex items-center gap-1"
                >
                  <Activity className="w-3 h-3 text-sky-400" />
                  <span>08:00 BRIEFING</span>
                </button>
                <button
                  onClick={() => handlePushRealLine('quest')}
                  disabled={isPushing}
                  className="px-2.5 py-1.5 rounded bg-cyan-950 hover:bg-cyan-900 border border-cyan-500/40 text-cyan-300 text-xs flex items-center gap-1"
                >
                  <Bell className="w-3 h-3 text-cyan-400" />
                  <span>07:00 QUEST</span>
                </button>
                <button
                  onClick={() => handlePushRealLine('reminder')}
                  disabled={isPushing}
                  className="px-2.5 py-1.5 rounded bg-rose-950 hover:bg-rose-900 border border-rose-500/40 text-rose-300 text-xs flex items-center gap-1"
                >
                  <AlertCircle className="w-3 h-3 text-rose-400" />
                  <span>20:00 REMINDER</span>
                </button>
              </div>

              {pushStatusMessage && (
                <div className="p-2 bg-slate-900 border border-slate-800 rounded text-xs text-slate-200 mt-2">
                  {pushStatusMessage}
                </div>
              )}
            </div>
          </section>

          {/* Collapsible 4-Step Setup Guide */}
          <section className="bg-[#070b14] border border-slate-900 rounded-sm p-4 font-mono-system text-xs">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5 text-slate-300 font-bold">
                <ShieldCheck className="w-4 h-4 text-cyan-400" />
                <span>คู่มือการเชื่อมต่อ LINE OFFICIAL ACCOUNT (4 ขั้นตอน)</span>
              </div>
              <button
                onClick={() => {
                  playUiClick();
                  setShowSetupSteps(!showSetupSteps);
                }}
                className="text-[11px] text-cyan-400 hover:text-cyan-300 flex items-center gap-1"
              >
                <span>{showSetupSteps ? 'ย่อคู่มือ' : 'อ่านคู่มือ'}</span>
                {showSetupSteps ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
              </button>
            </div>

            {showSetupSteps && (
              <ol className="mt-3 pt-3 border-t border-slate-900 space-y-2.5 list-decimal list-inside leading-relaxed text-slate-300 font-sans text-xs animate-in fade-in duration-200">
                <li>
                  ไปที่{' '}
                  <a
                    href="https://developers.line.biz/"
                    target="_blank"
                    rel="noreferrer"
                    className="text-cyan-400 underline inline-flex items-center gap-0.5"
                  >
                    LINE Developers Console <ExternalLink className="w-3 h-3" />
                  </a>{' '}
                  สร้าง Channel ประเภท <strong>Messaging API</strong>
                </li>
                <li>
                  ในแท็บ <strong>Messaging API</strong> ใส่ Webhook URL ด้านบน กดปุ่ม <strong>Verify</strong> แล้วเปิดสวิตช์{' '}
                  <strong className="text-emerald-400">Use webhook: ON</strong>
                </li>
                <li>
                  คัดลอก <strong>Channel secret</strong> และ <strong>Channel access token (long-lived)</strong> ใส่ใน Environment variables:
                  <div className="mt-1 p-2 bg-slate-950 border border-slate-900 rounded font-mono text-[11px] text-cyan-300">
                    LINE_CHANNEL_SECRET=xxx<br />
                    LINE_CHANNEL_ACCESS_TOKEN=yyy<br />
                    APP_URL={webhookUrlDisplay.replace('/api/line/webhook', '')}
                  </div>
                </li>
                <li>
                  ใน{' '}
                  <a
                    href="https://manager.line.biz/"
                    target="_blank"
                    rel="noreferrer"
                    className="text-cyan-400 underline inline-flex items-center gap-0.5"
                  >
                    LINE Official Account Manager <ExternalLink className="w-3 h-3" />
                  </a>{' '}
                  &gt; Settings &gt; Response settings ปิด <strong>Auto-response messages: OFF</strong> และ{' '}
                  <strong>Greeting message: OFF</strong> เพื่อให้ระบบส่ง Flex Message อัตโนมัติ 100%
                </li>
              </ol>
            )}
          </section>
        </div>
      )}

      {/* TAB 2: TERMINAL SIMULATOR & REMINDERS QUEUE */}
      {activeTab === 'simulator' && (
        <div className="space-y-4 animate-in fade-in duration-200">
          <section className="bg-[#090e1b] border-2 border-cyan-500/40 rounded-sm p-4 system-bracket">
            <div className="flex items-center justify-between gap-2 mb-3">
              <div className="flex items-center gap-2">
                <Smartphone className="w-4 h-4 text-cyan-400" />
                <h3 className="text-xs font-mono-system font-bold text-cyan-300 uppercase tracking-wider">
                  LINE SYSTEM TERMINAL SIMULATOR
                </h3>
              </div>
              <span className="text-[10px] font-mono-system text-slate-400 bg-cyan-950/60 border border-cyan-500/30 px-2 py-0.5 rounded">
                SIMULATION SANDBOX
              </span>
            </div>

            {/* Action Simulator Buttons */}
            <div className="flex flex-wrap gap-1.5 mb-3 font-mono-system text-[11px]">
              <button
                onClick={() => triggerLineSimAction('GET_BRIEFING_FLEX')}
                disabled={isSimulating}
                className="px-2.5 py-1 rounded bg-slate-900 border border-sky-800 text-sky-300 hover:bg-sky-950"
              >
                08:00 BRIEFING
              </button>
              <button
                onClick={() => triggerLineSimAction('GET_QUEST_FLEX')}
                disabled={isSimulating}
                className="px-2.5 py-1 rounded bg-slate-900 border border-cyan-800 text-cyan-300 hover:bg-cyan-950"
              >
                07:00 QUEST
              </button>
              <button
                onClick={() => triggerLineSimAction('COMPLETE_VIA_LINE')}
                disabled={isSimulating}
                className="px-2.5 py-1 rounded bg-slate-900 border border-emerald-800 text-emerald-300 hover:bg-emerald-950"
              >
                COMPLETE QUEST
              </button>
              <button
                onClick={() => triggerLineSimAction('TRIGGER_SURVEILLANCE')}
                disabled={isSimulating}
                className="px-2.5 py-1 rounded bg-slate-900 border border-purple-800 text-purple-300 hover:bg-purple-950"
              >
                SURVEILLANCE CHECK
              </button>
              <button
                onClick={() => triggerLineSimAction('TRIGGER_PENALTY')}
                disabled={isSimulating}
                className="px-2.5 py-1 rounded bg-slate-900 border border-rose-800 text-rose-300 hover:bg-rose-950"
              >
                PENALTY DEBUFF
              </button>
              <button
                onClick={() => triggerLineSimAction('TRIGGER_REST_DAY')}
                disabled={isSimulating}
                className="px-2.5 py-1 rounded bg-slate-900 border border-indigo-800 text-indigo-300 hover:bg-indigo-950"
              >
                REQUEST REST DAY
              </button>
            </div>

            {/* Simulated Chat Feed */}
            <div className="h-56 overflow-y-auto bg-[#05070a] border border-slate-900 rounded p-3 space-y-2.5 font-mono-system text-xs">
              {simChatMessages.map((msg, index) => (
                <div
                  key={index}
                  className={`flex flex-col ${msg.sender === 'user' ? 'items-end' : 'items-start'}`}
                >
                  <div
                    className={`max-w-[85%] p-2.5 rounded ${
                      msg.sender === 'user'
                        ? 'bg-emerald-950/80 border border-emerald-500/40 text-emerald-200'
                        : 'bg-slate-950 border border-cyan-950 text-cyan-200'
                    }`}
                  >
                    <div className="text-[9px] text-slate-500 uppercase mb-1">
                      {msg.sender === 'user' ? 'YOU (LINE)' : 'THE SYSTEM (BOT)'}
                    </div>
                    {msg.text && <div className="whitespace-pre-line leading-relaxed">{msg.text}</div>}

                    {msg.flex && (
                      <div className="mt-2 p-2.5 bg-[#0a0f1d] border border-cyan-500/40 rounded text-slate-200 space-y-1.5 shadow-lg">
                        <div className="text-[9px] text-cyan-400 font-bold uppercase">
                          [LINE FLEX CARD PREVIEW]
                        </div>
                        <div className="font-bold text-xs text-white">{quest.title}</div>
                        <div className="text-base font-bold text-cyan-300">
                          {quest.target} {quest.unit.toUpperCase()}
                        </div>
                        <div className="pt-1 border-t border-slate-800 flex gap-2 text-[10px]">
                          <span className="text-cyan-300">+{quest.xpReward} XP</span>
                          <span className="text-rose-300">DL: {quest.deadline}</span>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {/* Input Bar */}
            <div className="mt-2.5 flex gap-2">
              <input
                type="text"
                value={lineSimInput}
                onChange={(e) => setLineSimInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') triggerLineSimAction('CHAT', lineSimInput);
                }}
                placeholder="พิมพ์ข้อความทดสอบ (เช่น 'เตือนอีก 10 นาที', 'ทำแล้ว')..."
                disabled={isSimulating}
                className="flex-1 bg-slate-950 border border-slate-800 rounded px-3 py-2 text-xs text-slate-100 placeholder-slate-600 focus:outline-none focus:border-cyan-500 font-mono-system"
              />
              <button
                onClick={() => triggerLineSimAction('CHAT', lineSimInput)}
                disabled={isSimulating || !lineSimInput.trim()}
                className="px-4 py-2 rounded bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold font-mono-system text-xs uppercase flex items-center gap-1 disabled:opacity-50"
              >
                <Send className="w-3.5 h-3.5" />
                <span>SEND</span>
              </button>
            </div>

            {/* Quick Command Chips */}
            <div className="mt-2.5 flex flex-wrap gap-1.5 text-[10px] font-mono-system">
              {['เตือนอีก 10 นาที', 'เตือนตอน 15:46', 'ทำแล้ว', 'กำลังทำ', 'ยังไม่ทำ', 'ขอพัก', 'สรุปสัปดาห์'].map(
                (cmd) => (
                  <button
                    key={cmd}
                    onClick={() => triggerLineSimAction('CHAT', cmd)}
                    disabled={isSimulating}
                    className="px-2 py-0.5 rounded bg-slate-950 border border-slate-800 text-slate-400 hover:text-cyan-300 hover:border-cyan-800"
                  >
                    "{cmd}"
                  </button>
                )
              )}
            </div>
          </section>

          {/* Pending Reminders Queue */}
          <section className="bg-[#070b14] border border-slate-900 rounded-sm p-3.5 font-mono-system text-xs">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-1.5 font-bold text-slate-300">
                <Clock className="w-3.5 h-3.5 text-cyan-400" />
                <span>SCHEDULED REMINDERS QUEUE ({reminders.filter((r) => !r.sent).length} PENDING)</span>
              </div>
              <button
                onClick={fetchReminders}
                className="text-[10px] text-cyan-400 hover:text-cyan-300 flex items-center gap-1"
              >
                <RefreshCw className="w-3 h-3" /> REFRESH
              </button>
            </div>

            {reminders.length === 0 ? (
              <div className="text-[11px] text-slate-500 italic py-1">
                ยังไม่มีการตั้งเตือนในคิว
              </div>
            ) : (
              <div className="space-y-1 max-h-36 overflow-y-auto pr-1">
                {reminders.map((rem) => {
                  const remindDate = new Date(rem.remindAt);
                  const timeStr = remindDate.toLocaleTimeString('th-TH', {
                    timeZone: 'Asia/Bangkok',
                    hour: '2-digit',
                    minute: '2-digit'
                  });
                  return (
                    <div
                      key={rem.id}
                      className="flex items-center justify-between text-[11px] p-1.5 rounded bg-slate-950 border border-slate-900"
                    >
                      <div className="flex items-center gap-2 truncate">
                        <span
                          className={`px-1 py-0.2 text-[9px] rounded font-bold ${
                            rem.sent ? 'text-slate-500' : 'text-cyan-400'
                          }`}
                        >
                          {rem.sent ? 'SENT' : 'PENDING'}
                        </span>
                        <span className="text-slate-200 font-semibold">{timeStr} น.</span>
                        <span className="text-slate-400 truncate">{rem.message}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        </div>
      )}

      {/* TAB 3: PREFERENCES & SYSTEM */}
      {activeTab === 'preferences' && (
        <div className="space-y-4 animate-in fade-in duration-200">
          {/* PWA App Shell Deployment */}
          <section className="bg-[#080d1a] border border-cyan-950/80 rounded-sm p-4 system-bracket">
            <div className="flex items-center gap-2 mb-2">
              <Download className="w-4 h-4 text-cyan-400" />
              <h3 className="text-xs font-mono-system font-bold text-slate-200 uppercase tracking-wider">
                PROGRESSIVE WEB APP (PWA)
              </h3>
            </div>
            <p className="text-xs text-slate-400 mb-3 leading-relaxed">
              ติดตั้งแอปไปยังหน้าจอหลักเพื่อใช้งานแบบ Fullscreen Standalone เสมือนแอปมือถือแท้
            </p>
            <button
              onClick={handleInstallClick}
              className="px-3.5 py-2 rounded bg-cyan-950 hover:bg-cyan-900 border border-cyan-400/50 text-cyan-300 font-mono-system text-xs uppercase font-bold flex items-center gap-1.5 transition-colors"
            >
              <Download className="w-3.5 h-3.5" />
              <span>INSTALL TO HOME SCREEN</span>
            </button>
          </section>

          {/* Reset Demo Data */}
          <section className="bg-[#080d1a] border border-slate-900 rounded-sm p-4 system-bracket">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-xs font-mono-system font-bold text-slate-300 uppercase tracking-wider">
                  RESET DATA TO DEFAULT
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  รีเซ็ตข้อมูลตัวละครเป็น LV. 3, Rank E, XP 320/500
                </p>
              </div>
              <button
                onClick={() => {
                  playUiClick();
                  onResetDemo();
                }}
                className="px-3 py-1.5 rounded bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-300 hover:text-cyan-400 font-mono-system text-xs uppercase flex items-center gap-1.5"
              >
                <RefreshCw className="w-3 h-3 text-cyan-400" />
                <span>RESET DEMO</span>
              </button>
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
