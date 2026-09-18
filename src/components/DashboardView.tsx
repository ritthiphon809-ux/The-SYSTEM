import { useState, useEffect } from 'react';
import { Player, Quest } from '../types.ts';
import {
  Flame,
  Play,
  CheckCircle2,
  Send,
  Sparkles,
  ArrowRight,
  Heart,
  BatteryCharging,
  Footprints,
  Activity,
  BellRing,
  PlusCircle,
  RefreshCw,
  Sun,
  ChevronDown,
  ChevronUp,
  Sliders,
  Check
} from 'lucide-react';
import { playUiClick, playWarningSound, playSystemTingSound } from '../utils/audio.ts';

interface DashboardViewProps {
  player: Player;
  quest: Quest;
  onStartQuest: () => void;
  onOpenCompleteModal: () => void;
  onSendMessage: (msg: string) => Promise<string | null>;
  onNavigateToQuest: () => void;
  onNavigateToStatus: () => void;
  onTriggerEmergency?: () => void;
  onSimulateHpDrain?: (hours?: number) => void;
  onSyncHealth?: (steps: number) => void;
}

export function DashboardView({
  player,
  quest,
  onStartQuest,
  onOpenCompleteModal,
  onSendMessage,
  onNavigateToQuest,
  onNavigateToStatus,
  onTriggerEmergency,
  onSimulateHpDrain,
  onSyncHealth
}: DashboardViewProps) {
  const [inputMsg, setInputMsg] = useState('');
  const [isAiProcessing, setIsAiProcessing] = useState(false);
  const [aiFeedback, setAiFeedback] = useState<string | null>(null);
  const [showFullBriefing, setShowFullBriefing] = useState(false);
  const [showSensorsAndSim, setShowSensorsAndSim] = useState(false);

  // AI Morning Health Briefing state
  const [briefing, setBriefing] = useState<{
    date: string;
    readinessScore: number;
    headline: string;
    analysis: string;
    recommendation: string;
    suggestedFocus: string;
  } | null>(null);
  const [isLoadingBriefing, setIsLoadingBriefing] = useState(false);

  const fetchBriefing = async () => {
    setIsLoadingBriefing(true);
    try {
      const res = await fetch('/api/health-briefing');
      const data = await res.json();
      if (data.briefing) {
        setBriefing(data.briefing);
      }
    } catch (e) {
      console.error('Failed to load health briefing', e);
    } finally {
      setIsLoadingBriefing(false);
    }
  };

  useEffect(() => {
    fetchBriefing();
  }, []);

  const xpPercent = Math.min(100, Math.round((player.xp / player.currentLevelMaxXp) * 100));

  // HP & Stamina calculations
  const maxHp = player.maxHp || (100 + (player.stats.VIT || 5) * 10);
  const currentHp = player.hp ?? maxHp;
  const hpPercent = Math.min(100, Math.max(0, Math.round((currentHp / maxHp) * 100)));

  const maxStamina = player.maxStamina || (100 + (player.stats.AGI || 5) * 5);
  const currentStamina = player.stamina ?? maxStamina;
  const staminaPercent = Math.min(100, Math.max(0, Math.round((currentStamina / maxStamina) * 100)));

  const handleSendPrompt = async (textToSend?: string) => {
    const msg = textToSend || inputMsg;
    if (!msg.trim() || isAiProcessing) return;
    playUiClick();
    setIsAiProcessing(true);
    setAiFeedback(null);
    try {
      const response = await onSendMessage(msg);
      if (response) {
        setAiFeedback(response);
      }
      if (!textToSend) setInputMsg('');
    } catch (e) {
      playWarningSound();
      setAiFeedback('[SYSTEM ERROR]\nNeural transmission disrupted. Offline fallback active.');
    } finally {
      setIsAiProcessing(false);
    }
  };

  const quickPrompts = [
    'มีเวลาแค่ 20 นาที',
    'วันนี้ออกกำลังกายมาแล้ว 30 นาที',
    'ขอคำแนะนำท่า Squat'
  ];

  const stepsCompleted = quest.steps?.filter((s) => s.completed).length || 0;
  const totalSteps = quest.steps?.length || 0;

  return (
    <div className="space-y-4 pb-12 font-sans">
      {/* 1. COMPACT HUD HERO BAR: Level, Rank, Vitals & Stat Points */}
      <section className="bg-[#080d1a] border border-cyan-950/80 rounded-sm p-4 system-bracket shadow-lg">
        <div className="flex items-center justify-between gap-3 border-b border-cyan-950/50 pb-3">
          <div className="flex items-center gap-3">
            {/* Rank Badge */}
            <div className="w-11 h-11 rounded bg-cyan-950/80 border border-cyan-400/60 flex flex-col items-center justify-center font-mono-system shadow-[0_0_12px_rgba(56,189,248,0.25)] shrink-0">
              <span className="text-[8px] text-cyan-400 font-bold leading-none">RANK</span>
              <span className="text-xl font-black text-cyan-300 leading-none">{player.rank}</span>
            </div>

            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-mono-system font-bold text-white uppercase tracking-wider">
                  {player.displayName}
                </span>
                <span className="text-[10px] font-mono-system text-cyan-400 bg-cyan-950/60 px-1.5 py-0.5 rounded border border-cyan-800">
                  LV.{String(player.level).padStart(2, '0')}
                </span>
              </div>
              <div className="flex items-center gap-2 text-[11px] font-mono-system text-slate-400 mt-0.5">
                <span className="flex items-center gap-1 text-amber-400 font-semibold">
                  <Flame className="w-3.5 h-3.5 fill-amber-400/30" />
                  {player.streak} วัน
                </span>
                <span>•</span>
                <span>{player.totalQuestCompleted} เควส</span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {player.statPoints > 0 ? (
              <button
                onClick={() => {
                  playUiClick();
                  onNavigateToStatus();
                }}
                className="px-2.5 py-1.5 rounded bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold font-mono-system text-[11px] uppercase tracking-wider flex items-center gap-1 shadow-[0_0_10px_rgba(56,189,248,0.4)] animate-pulse"
              >
                <PlusCircle className="w-3.5 h-3.5" />
                <span>+{player.statPoints} PTS</span>
              </button>
            ) : (
              <button
                onClick={() => {
                  playUiClick();
                  onNavigateToStatus();
                }}
                className="text-[11px] font-mono-system text-slate-400 hover:text-cyan-300 flex items-center gap-1 transition-colors px-2 py-1 rounded bg-slate-900/60 border border-slate-800"
              >
                <span>STATUS</span>
                <ArrowRight className="w-3 h-3" />
              </button>
            )}
          </div>
        </div>

        {/* Streamlined Core Vitals (HP & XP Side-by-Side) */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-3 font-mono-system text-xs">
          {/* Health Points (HP) */}
          <div className="space-y-1">
            <div className="flex justify-between items-center text-[11px]">
              <span className="flex items-center gap-1 text-rose-400 font-semibold">
                <Heart className="w-3 h-3 fill-rose-500/30 animate-pulse" />
                HP (HEALTH)
              </span>
              <span className="text-rose-300 font-bold">
                {currentHp} / {maxHp}
              </span>
            </div>
            <div className="w-full h-2 bg-black rounded-xs border border-rose-950 overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-rose-700 via-rose-500 to-red-400 transition-all duration-300 shadow-[0_0_8px_rgba(244,63,94,0.5)]"
                style={{ width: `${hpPercent}%` }}
              />
            </div>
          </div>

          {/* Experience Progression (XP) */}
          <div className="space-y-1">
            <div className="flex justify-between items-center text-[11px]">
              <span className="text-cyan-400 font-semibold">EXP PROGRESSION</span>
              <span className="text-cyan-300 font-bold">
                {player.xp} / {player.currentLevelMaxXp} XP ({xpPercent}%)
              </span>
            </div>
            <div className="w-full h-2 bg-black rounded-xs border border-cyan-950 overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-cyan-600 via-cyan-500 to-cyan-300 transition-all duration-300 shadow-[0_0_8px_rgba(56,189,248,0.5)]"
                style={{ width: `${xpPercent}%` }}
              />
            </div>
          </div>
        </div>
      </section>

      {/* 2. PROGRESSIVE DISCLOSURE: MORNING HEALTH BRIEFING (Collapsed by Default) */}
      <section className="bg-[#060b16] border border-sky-950/80 rounded-sm p-3 font-mono-system text-xs">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <Sun className="w-4 h-4 text-sky-400 shrink-0 animate-pulse" />
            <span className="text-[11px] font-bold text-sky-300 uppercase tracking-wider shrink-0">
              08:00 BRIEFING:
            </span>
            <span className="text-xs text-slate-300 truncate font-sans">
              {briefing ? briefing.headline : 'กำลังดึงรายงานวิเคราะห์ความพร้อมร่างกาย...'}
            </span>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            {briefing && (
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-sky-950 border border-sky-600/40 text-sky-300 font-bold">
                {briefing.readinessScore}/100
              </span>
            )}
            <button
              onClick={() => {
                playUiClick();
                setShowFullBriefing(!showFullBriefing);
              }}
              className="text-[11px] text-slate-400 hover:text-sky-300 flex items-center gap-0.5 transition-colors p-1"
            >
              <span>{showFullBriefing ? 'ย่อ' : 'อ่านเต็ม'}</span>
              {showFullBriefing ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
            </button>
          </div>
        </div>

        {/* Collapsible Details */}
        {showFullBriefing && briefing && (
          <div className="mt-3 pt-3 border-t border-sky-950/70 space-y-2 text-xs font-sans animate-in fade-in duration-200">
            <p className="text-slate-300 leading-relaxed">{briefing.analysis}</p>
            <div className="p-2.5 bg-slate-950/90 border-l-2 border-sky-400 rounded-r text-slate-200 text-xs">
              <strong className="text-sky-400 block font-mono-system text-[10px] mb-0.5">
                คำสั่งประจำวัน:
              </strong>
              {briefing.recommendation}
            </div>
            <div className="flex justify-between items-center text-[10px] text-slate-500 font-mono-system pt-1">
              <span>โฟกัสหลัก: <strong className="text-sky-300">{briefing.suggestedFocus}</strong></span>
              <button
                onClick={fetchBriefing}
                disabled={isLoadingBriefing}
                className="text-sky-400 hover:text-sky-300 flex items-center gap-1"
              >
                <RefreshCw className={`w-3 h-3 ${isLoadingBriefing ? 'animate-spin' : ''}`} />
                <span>รีเฟรช</span>
              </button>
            </div>
          </div>
        )}
      </section>

      {/* 3. PRIMARY HERO DIRECTIVE: TODAY'S QUEST CARD */}
      <section className="bg-[#090e1b] border-2 border-cyan-500/50 rounded-sm p-5 shadow-[0_0_25px_rgba(56,189,248,0.12)] relative">
        <div className="flex items-center justify-between gap-2 mb-3 font-mono-system text-xs">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-cyan-400 animate-ping" />
            <span className="text-[10px] px-2 py-0.5 rounded bg-cyan-950 border border-cyan-400 text-cyan-300 font-bold tracking-wider uppercase">
              {quest.isPenalty ? 'PENALTY PROTOCOL' : quest.status === 'RESTED' ? 'REST DAY' : "TODAY'S DIRECTIVE"}
            </span>
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-900 border border-slate-800 text-slate-400 uppercase">
              {quest.difficulty}
            </span>
          </div>

          <div className="text-rose-400 text-xs font-bold">
            DL: {quest.deadline}
          </div>
        </div>

        {/* Quest Title & Target */}
        <div className="my-2">
          <h2 className="text-xl sm:text-2xl font-black text-white font-sans uppercase tracking-wide">
            {quest.title}
          </h2>
          <p className="text-slate-300 text-sm leading-relaxed mt-1 line-clamp-2">
            {quest.description}
          </p>
        </div>

        {/* Checklist Progress or Target Summary */}
        <div className="my-3 p-3 bg-slate-950/90 border border-cyan-950 rounded flex items-center justify-between font-mono-system text-xs">
          <div>
            <div className="text-[10px] text-slate-500 uppercase">TARGET REQUIREMENT</div>
            <div className="text-base font-bold text-cyan-300">
              {quest.target} {quest.unit.toUpperCase()}
            </div>
          </div>

          {totalSteps > 0 ? (
            <div className="text-right">
              <div className="text-[10px] text-slate-500 uppercase">CHECKLIST PROGRESS</div>
              <div className="text-sm font-bold text-slate-200">
                <span className={stepsCompleted === totalSteps ? 'text-emerald-400' : 'text-cyan-300'}>
                  {stepsCompleted}
                </span>
                <span> / {totalSteps} ท่าเสร็จแล้ว</span>
              </div>
            </div>
          ) : (
            <div className="text-right">
              <div className="text-[10px] text-slate-500 uppercase">REWARDS</div>
              <div className="text-xs font-bold text-emerald-400">
                +{quest.xpReward} XP
              </div>
            </div>
          )}
        </div>

        {/* Primary Action Button */}
        <div className="flex items-center gap-2 pt-2">
          {quest.status === 'AVAILABLE' && (
            <button
              onClick={() => {
                playUiClick();
                onStartQuest();
              }}
              className="flex-1 py-3 px-4 rounded bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-black font-mono-system text-xs uppercase tracking-widest flex items-center justify-center gap-2 shadow-[0_0_15px_rgba(56,189,248,0.4)] transition-all"
            >
              <Play className="w-4 h-4 fill-slate-950" />
              <span>START PROTOCOL</span>
            </button>
          )}

          {quest.status === 'IN_PROGRESS' && (
            <button
              onClick={() => {
                playUiClick();
                onOpenCompleteModal();
              }}
              className="flex-1 py-3 px-4 rounded bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black font-mono-system text-xs uppercase tracking-widest flex items-center justify-center gap-2 shadow-[0_0_20px_rgba(16,185,129,0.5)] transition-all animate-pulse"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>VERIFY COMPLETION</span>
            </button>
          )}

          {quest.status === 'COMPLETED' && (
            <div className="flex-1 py-3 px-4 rounded bg-emerald-950/40 border border-emerald-500/50 text-emerald-300 font-mono-system text-xs uppercase tracking-wider text-center font-bold">
              [ ภารกิจวันนี้เสร็จสิ้นแล้ว ]
            </div>
          )}

          {quest.status === 'RESTED' && (
            <div className="flex-1 py-3 px-4 rounded bg-indigo-950/40 border border-indigo-500/50 text-indigo-300 font-mono-system text-xs uppercase tracking-wider text-center font-bold">
              [ วันพักผ่อนประจำสัปดาห์ (REST DAY) ]
            </div>
          )}

          <button
            onClick={() => {
              playUiClick();
              onNavigateToQuest();
            }}
            className="py-3 px-4 rounded border border-slate-800 bg-slate-900 hover:bg-slate-800 text-slate-300 font-mono-system text-xs uppercase tracking-wider transition-colors"
          >
            DETAILS
          </button>
        </div>
      </section>

      {/* 4. DISCRETE SENSORS & DEV SIMULATION BAR (Collapsible to prevent clutter) */}
      <section className="bg-[#070b14] border border-slate-900 rounded-sm p-3 font-mono-system text-xs">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-slate-400">
            <Sliders className="w-3.5 h-3.5 text-cyan-400" />
            <span className="text-[11px] font-bold text-slate-300 uppercase">
              TELEMETRY SENSORS & SIMULATION
            </span>
          </div>
          <button
            onClick={() => {
              playUiClick();
              setShowSensorsAndSim(!showSensorsAndSim);
            }}
            className="text-[11px] text-cyan-400 hover:text-cyan-300 flex items-center gap-1 transition-colors"
          >
            <span>{showSensorsAndSim ? 'ซ่อน' : 'เปิดดู'}</span>
            {showSensorsAndSim ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
          </button>
        </div>

        {showSensorsAndSim && (
          <div className="mt-3 pt-3 border-t border-slate-900 space-y-3 animate-in fade-in duration-200">
            <div className="grid grid-cols-3 gap-2 text-center text-[11px]">
              <div className="p-2 bg-slate-950 border border-slate-900 rounded">
                <div className="flex items-center justify-center gap-1 text-slate-500 text-[10px]">
                  <Footprints className="w-3 h-3 text-cyan-400" />
                  <span>ก้าวเดิน</span>
                </div>
                <div className="text-sm font-bold text-white mt-0.5">
                  {(player.stepsToday || 0).toLocaleString()}
                </div>
              </div>

              <div className="p-2 bg-slate-950 border border-slate-900 rounded">
                <div className="flex items-center justify-center gap-1 text-slate-500 text-[10px]">
                  <Heart className="w-3 h-3 text-rose-400" />
                  <span>ชีพจร</span>
                </div>
                <div className="text-sm font-bold text-rose-300 mt-0.5">
                  {player.heartRate || 76} BPM
                </div>
              </div>

              <div className="p-2 bg-slate-950 border border-slate-900 rounded">
                <div className="flex items-center justify-center gap-1 text-slate-500 text-[10px]">
                  <Activity className="w-3 h-3 text-amber-400" />
                  <span>แคลอรี</span>
                </div>
                <div className="text-sm font-bold text-amber-300 mt-0.5">
                  {player.caloriesBurned || 345} KCAL
                </div>
              </div>
            </div>

            {/* Simulation Quick Buttons */}
            <div className="flex flex-wrap items-center gap-2 pt-1 text-[10px]">
              <button
                onClick={() => {
                  playUiClick();
                  onSyncHealth?.((player.stepsToday || 0) + 1000);
                }}
                className="px-2.5 py-1 rounded bg-cyan-950/70 border border-cyan-500/40 text-cyan-300 hover:bg-cyan-900"
              >
                +1,000 STEPS (ฮีล HP)
              </button>
              <button
                onClick={() => {
                  playUiClick();
                  onSimulateHpDrain?.(1);
                }}
                className="px-2.5 py-1 rounded bg-rose-950/60 border border-rose-800/60 text-rose-300 hover:bg-rose-900"
              >
                -5 HP (DRAIN 1H)
              </button>
              <button
                onClick={() => {
                  playSystemTingSound();
                  onTriggerEmergency?.();
                }}
                className="px-2.5 py-1 rounded bg-slate-900 border border-cyan-800 text-cyan-300 hover:bg-cyan-950 flex items-center gap-1"
              >
                <BellRing className="w-3 h-3 text-cyan-400" />
                EMERGENCY ALERT
              </button>
            </div>
          </div>
        )}
      </section>

      {/* 5. MINIMAL NATURAL LANGUAGE AI INPUT (Compact bottom console) */}
      <section className="bg-[#070b14] border border-cyan-950/80 rounded-sm p-3.5">
        <div className="flex items-center gap-1.5 mb-2 text-xs font-mono-system text-cyan-400 font-bold">
          <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
          <span>[ THE SYSTEM CONSOLE // ปรับเปลี่ยนภารกิจด้วย AI ]</span>
        </div>

        {aiFeedback && (
          <div className="mb-2 p-2.5 bg-cyan-950/40 border border-cyan-500/40 rounded text-xs font-mono-system text-cyan-200 whitespace-pre-line leading-relaxed">
            {aiFeedback}
          </div>
        )}

        <div className="flex gap-2">
          <input
            type="text"
            value={inputMsg}
            onChange={(e) => setInputMsg(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSendPrompt()}
            placeholder="เช่น 'มีเวลาแค่ 15 นาที' หรือ 'ปวดเข่า ขอเปลี่ยนท่า'..."
            className="flex-1 bg-slate-950 border border-slate-800 rounded px-3 py-2 text-xs font-mono-system text-slate-100 placeholder:text-slate-600 focus:outline-none focus:border-cyan-500"
          />
          <button
            disabled={isAiProcessing}
            onClick={() => handleSendPrompt()}
            className="px-4 py-2 rounded bg-cyan-500 hover:bg-cyan-400 disabled:opacity-50 text-slate-950 font-bold font-mono-system text-xs flex items-center gap-1 transition-colors"
          >
            <Send className="w-3.5 h-3.5" />
            <span>TRANSMIT</span>
          </button>
        </div>

        <div className="mt-2 flex flex-wrap gap-1.5">
          {quickPrompts.map((p) => (
            <button
              key={p}
              onClick={() => handleSendPrompt(p)}
              className="text-[10px] font-mono-system text-slate-400 hover:text-cyan-300 bg-slate-950 border border-slate-900 rounded px-2 py-0.5 transition-colors"
            >
              {p}
            </button>
          ))}
        </div>
      </section>
    </div>
  );
}
