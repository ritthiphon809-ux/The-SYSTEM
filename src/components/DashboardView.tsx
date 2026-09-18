import { useState } from 'react';
import { Player, Quest } from '../types.ts';
import { Flame, Play, CheckCircle2, Send, Sparkles, AlertCircle, ArrowRight, Shield, Heart, BatteryCharging, Footprints, Activity, Flame as FireIcon, BellRing, PlusCircle } from 'lucide-react';
import { playUiClick, playWarningSound, triggerHaptic, playSystemTingSound } from '../utils/audio.ts';

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

  const xpPercent = Math.min(100, Math.round((player.xp / player.currentLevelMaxXp) * 100));

  // HP & Stamina metrics
  const maxHp = player.maxHp || (100 + (player.stats.VIT || 5) * 10);
  const currentHp = player.hp ?? maxHp;
  const hpPercent = Math.min(100, Math.max(0, Math.round((currentHp / maxHp) * 100)));

  const maxStamina = player.maxStamina || (100 + (player.stats.AGI || 5) * 5);
  const currentStamina = player.stamina ?? maxStamina;
  const staminaPercent = Math.min(100, Math.max(0, Math.round((currentStamina / maxStamina) * 100)));

  // ASCII/Unicode Progress Bar generator like the prompt requested (████████████░░░)
  const renderAsciiBar = (percent: number, totalChars = 15) => {
    const filled = Math.round((percent / 100) * totalChars);
    const empty = Math.max(0, totalChars - filled);
    return '█'.repeat(filled) + '░'.repeat(empty);
  };

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
    'วันนี้ผมมีเวลาแค่ 20 นาที',
    'วันนี้ผมออกกำลังมาแล้ว 30 นาที',
    'ขอคำแนะนำการทำ Squat ให้ถูกต้อง'
  ];

  return (
    <div className="space-y-6 pb-12">
      {/* UNALLOCATED STAT POINTS BANNER */}
      {player.statPoints > 0 && (
        <div className="bg-[#0b162c] border-2 border-cyan-400/80 rounded-sm p-3.5 shadow-[0_0_20px_rgba(56,189,248,0.3)] flex flex-col sm:flex-row items-center justify-between gap-3 animate-pulse">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded bg-cyan-950 border border-cyan-400 flex items-center justify-center text-cyan-300">
              <PlusCircle className="w-5 h-5" />
            </div>
            <div>
              <div className="text-xs font-mono-system font-bold text-cyan-300">
                [ THE SYSTEM HAS GRANTED STAT POINTS ]
              </div>
              <div className="text-[11px] text-slate-300 font-mono-system">
                {player.statPoints} unallocated points available. Strengthen your STR, AGI, or VIT.
              </div>
            </div>
          </div>
          <button
            onClick={() => {
              playUiClick();
              onNavigateToStatus();
            }}
            className="w-full sm:w-auto px-4 py-2 rounded bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold font-mono-system text-xs uppercase tracking-wider transition-colors shadow-[0_0_12px_rgba(56,189,248,0.5)]"
          >
            ALLOCATE POINTS
          </button>
        </div>
      )}

      {/* 1. SYSTEM TERMINAL: PLAYER STATUS (SOLO LEVELING THEME) */}
      <section className="bg-[#080d1a] border border-cyan-950 rounded-sm p-5 system-bracket shadow-[0_4px_20px_rgba(0,0,0,0.5)]">
        <div className="flex items-center justify-between border-b border-cyan-950/60 pb-3 mb-4">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-none bg-cyan-400"></span>
            <h2 className="text-xs font-mono-system tracking-widest text-cyan-400 uppercase font-bold">
              PLAYER STATUS // {player.displayName}
            </h2>
          </div>
          <button
            onClick={() => {
              playUiClick();
              onNavigateToStatus();
            }}
            className="text-[11px] font-mono-system text-slate-400 hover:text-cyan-300 flex items-center gap-1 transition-colors"
          >
            <span>FULL ATTRIBUTES</span>
            <ArrowRight className="w-3 h-3" />
          </button>
        </div>

        {/* Level & Rank Display */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 items-end mb-4">
          <div>
            <div className="text-[10px] text-slate-500 font-mono-system tracking-wider uppercase">
              ASCENSION LEVEL
            </div>
            <div className="text-3xl sm:text-4xl font-black text-white font-mono-system tracking-tight">
              LV. {String(player.level).padStart(2, '0')}
            </div>
          </div>

          <div>
            <div className="text-[10px] text-slate-500 font-mono-system tracking-wider uppercase">
              AUTHORIZATION RANK
            </div>
            <div className="text-3xl sm:text-4xl font-black text-cyan-400 font-mono-system tracking-tight">
              RANK {player.rank}
            </div>
          </div>

          <div className="col-span-2">
            <div className="flex justify-between items-center text-xs font-mono-system mb-1">
              <span className="text-slate-400">EXPERIENCE MATRIX</span>
              <span className="text-cyan-300 font-bold">
                {player.xp} / {player.currentLevelMaxXp} XP ({xpPercent}%)
              </span>
            </div>
            <div className="hidden sm:block text-cyan-500/80 font-mono text-sm tracking-widest leading-none mb-1">
              {renderAsciiBar(xpPercent, 20)}
            </div>
            <div className="w-full h-2 bg-slate-950 rounded-xs border border-cyan-950/80 overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-cyan-600 to-cyan-400 transition-all duration-500"
                style={{ width: `${xpPercent}%` }}
              />
            </div>
          </div>
        </div>

        {/* -------------------------------------------------------- */}
        {/* CORE MECHANIC: RED HP BAR & BLUE STAMINA BAR (SOLO LEVELING) */}
        {/* -------------------------------------------------------- */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 py-3 my-2 border-y border-slate-900 font-mono-system">
          {/* RED HP BAR */}
          <div className="p-3 bg-slate-950/80 border border-rose-950/80 rounded-sm">
            <div className="flex items-center justify-between text-xs mb-1.5">
              <div className="flex items-center gap-1.5 text-rose-400 font-bold">
                <Heart className="w-4 h-4 fill-rose-500/30 text-rose-500 animate-pulse" />
                <span>HP (HEALTH POINTS)</span>
              </div>
              <div className="text-rose-300 font-black">
                {currentHp} / {maxHp} <span className="text-[10px] text-rose-400/80">({hpPercent}%)</span>
              </div>
            </div>
            <div className="w-full h-3 bg-black rounded-xs border border-rose-900/60 overflow-hidden relative">
              <div
                className="h-full bg-gradient-to-r from-rose-700 via-rose-500 to-red-400 transition-all duration-500 shadow-[0_0_12px_rgba(244,63,94,0.6)]"
                style={{ width: `${hpPercent}%` }}
              />
            </div>
            <div className="flex justify-between items-center text-[10px] text-slate-500 mt-1.5">
              <span className="text-rose-400/80 flex items-center gap-1">
                DRAIN: -5 HP / HR
              </span>
              <span className={hpPercent <= 25 ? 'text-rose-400 font-bold animate-pulse' : 'text-slate-400'}>
                STATUS: {hpPercent <= 0 ? 'CRITICAL (DEAD)' : hpPercent <= 25 ? 'DANGER (<25%)' : 'STABLE'}
              </span>
            </div>
          </div>

          {/* BLUE STAMINA BAR */}
          <div className="p-3 bg-slate-950/80 border border-cyan-950/80 rounded-sm">
            <div className="flex items-center justify-between text-xs mb-1.5">
              <div className="flex items-center gap-1.5 text-cyan-400 font-bold">
                <BatteryCharging className="w-4 h-4 text-cyan-400" />
                <span>MP / STAMINA</span>
              </div>
              <div className="text-cyan-300 font-black">
                {currentStamina} / {maxStamina} <span className="text-[10px] text-cyan-400/80">({staminaPercent}%)</span>
              </div>
            </div>
            <div className="w-full h-3 bg-black rounded-xs border border-cyan-900/60 overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-blue-600 via-cyan-500 to-cyan-300 transition-all duration-500 shadow-[0_0_12px_rgba(56,189,248,0.5)]"
                style={{ width: `${staminaPercent}%` }}
              />
            </div>
            <div className="flex justify-between items-center text-[10px] text-slate-500 mt-1.5">
              <span className="text-cyan-400/80">RECOVERY: REST + HYDRATION</span>
              <span className="text-slate-400">STATUS: COMBAT READY</span>
            </div>
          </div>
        </div>

        {/* Four Core Stats Strip */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2 font-mono-system">
          <div className="p-2 bg-slate-950/60 border border-slate-900 rounded-sm flex items-center justify-between">
            <div>
              <span className="text-slate-400 text-xs font-bold block">STR</span>
              <span className="text-[9px] text-slate-500">+{(player.stats.STR * 2.5).toFixed(0)}% Workout XP</span>
            </div>
            <span className="text-cyan-300 text-sm font-bold">{String(player.stats.STR).padStart(2, '0')}</span>
          </div>
          <div className="p-2 bg-slate-950/60 border border-slate-900 rounded-sm flex items-center justify-between">
            <div>
              <span className="text-slate-400 text-xs font-bold block">AGI</span>
              <span className="text-[9px] text-slate-500">+{(player.stats.AGI * 0.1).toFixed(1)} HP/200 Steps</span>
            </div>
            <span className="text-cyan-300 text-sm font-bold">{String(player.stats.AGI).padStart(2, '0')}</span>
          </div>
          <div className="p-2 bg-slate-950/60 border border-slate-900 rounded-sm flex items-center justify-between">
            <div>
              <span className="text-slate-400 text-xs font-bold block">VIT</span>
              <span className="text-[9px] text-slate-500">+{player.stats.VIT * 10} Max HP</span>
            </div>
            <span className="text-cyan-300 text-sm font-bold">{String(player.stats.VIT).padStart(2, '0')}</span>
          </div>
          <div className="p-2 bg-slate-950/60 border border-slate-900 rounded-sm flex items-center justify-between">
            <div>
              <span className="text-slate-400 text-xs font-bold block">INT</span>
              <span className="text-[9px] text-slate-500">Cognitive Focus</span>
            </div>
            <span className="text-cyan-300 text-sm font-bold">{String(player.stats.INT).padStart(2, '0')}</span>
          </div>
        </div>

        {/* Streak indicator & Quick Simulation Controls */}
        <div className="mt-3 pt-3 border-t border-slate-900 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 text-xs font-mono-system">
          <div className="flex items-center gap-2 text-amber-400 font-bold bg-amber-950/20 border border-amber-900/30 px-3 py-1.5 rounded-sm">
            <Flame className="w-4 h-4 text-amber-400 fill-amber-400/30" />
            <span>{player.streak} DAY STREAK</span>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => {
                playUiClick();
                onSimulateHpDrain?.(1);
              }}
              title="Simulates 1 hour of inactivity: -5 HP"
              className="px-2.5 py-1 rounded bg-rose-950/60 border border-rose-800/60 text-rose-300 hover:bg-rose-900/60 text-[10px] transition-colors"
            >
              -5 HP (DRAIN 1H)
            </button>
            <button
              onClick={() => {
                playSystemTingSound();
                onTriggerEmergency?.();
              }}
              title="Triggers an Emergency Quest alert"
              className="px-2.5 py-1 rounded bg-cyan-950/80 border border-cyan-500 text-cyan-300 hover:bg-cyan-900 text-[10px] flex items-center gap-1 transition-colors"
            >
              <BellRing className="w-3 h-3 text-cyan-400" />
              EMERGENCY QUEST
            </button>
          </div>
        </div>
      </section>

      {/* 2. APPLE HEALTHKIT & GOOGLE FIT INTEGRATION SENSORS */}
      <section className="bg-[#070b14] border border-cyan-950 rounded-sm p-4 system-bracket">
        <div className="flex items-center justify-between mb-3 border-b border-cyan-950/50 pb-2">
          <div className="flex items-center gap-2 text-xs font-mono-system text-cyan-400 font-bold">
            <Activity className="w-4 h-4 text-cyan-400" />
            <span>[ BIO-SENSOR TELEMETRY: HEALTHKIT / GOOGLE FIT ]</span>
          </div>
          <button
            onClick={() => {
              playUiClick();
              onSyncHealth?.((player.stepsToday || 0) + 1000);
            }}
            className="px-2 py-0.5 rounded bg-cyan-950 border border-cyan-500/50 hover:bg-cyan-900 text-cyan-300 text-[10px] font-mono-system transition-colors"
          >
            +1,000 STEPS (RESTORE HP)
          </button>
        </div>

        <div className="grid grid-cols-3 gap-3 font-mono-system text-center">
          <div className="p-2.5 bg-slate-950 border border-slate-900 rounded-sm">
            <div className="flex items-center justify-center gap-1 text-[10px] text-slate-500 mb-1">
              <Footprints className="w-3.5 h-3.5 text-cyan-400" />
              <span>STEPS TODAY</span>
            </div>
            <div className="text-lg font-bold text-slate-200">
              {(player.stepsToday || 0).toLocaleString()}
            </div>
            <div className="text-[9px] text-cyan-500/80 mt-0.5">
              AGI HP Recovery Active
            </div>
          </div>

          <div className="p-2.5 bg-slate-950 border border-slate-900 rounded-sm">
            <div className="flex items-center justify-center gap-1 text-[10px] text-slate-500 mb-1">
              <Heart className="w-3.5 h-3.5 text-rose-500" />
              <span>HEART RATE</span>
            </div>
            <div className="text-lg font-bold text-rose-400">
              {player.heartRate || 76} <span className="text-[10px] text-slate-500">BPM</span>
            </div>
            <div className="text-[9px] text-slate-500 mt-0.5">
              Resting Pulse Nominal
            </div>
          </div>

          <div className="p-2.5 bg-slate-950 border border-slate-900 rounded-sm">
            <div className="flex items-center justify-center gap-1 text-[10px] text-slate-500 mb-1">
              <FireIcon className="w-3.5 h-3.5 text-amber-400" />
              <span>ACTIVE CALORIES</span>
            </div>
            <div className="text-lg font-bold text-amber-300">
              {player.caloriesBurned || 345} <span className="text-[10px] text-slate-500">KCAL</span>
            </div>
            <div className="text-[9px] text-slate-500 mt-0.5">
              Metabolic Output
            </div>
          </div>
        </div>
      </section>

      {/* 3. TODAY'S QUEST PANEL */}
      <section className="bg-[#090e1b] border-2 border-cyan-500/40 rounded-sm p-5 shadow-[0_0_30px_rgba(56,189,248,0.12)] relative overflow-hidden">
        {/* Subtle holographic glow accent */}
        <div className="absolute top-0 right-0 w-32 h-32 bg-cyan-500/5 rounded-full blur-2xl pointer-events-none" />

        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <span className="text-[10px] px-2 py-0.5 rounded bg-cyan-950 border border-cyan-400 text-cyan-300 font-mono-system font-bold tracking-wider">
              {quest.isPenalty ? 'PENALTY PROTOCOL' : quest.isEmergency ? 'EMERGENCY PROTOCOL' : "TODAY'S DAILY QUEST"}
            </span>
            <span className="text-[10px] px-2 py-0.5 rounded bg-slate-900 border border-slate-800 text-slate-400 font-mono-system uppercase">
              {quest.difficulty}
            </span>
          </div>
          <div className="text-xs font-mono-system text-rose-400 flex items-center gap-1">
            <span>DEADLINE:</span>
            <span className="font-bold">{quest.deadline}</span>
          </div>
        </div>

        {/* Quest Title & Action Target */}
        <div className="my-3">
          <h3 className="text-2xl font-black text-white tracking-wide uppercase font-mono-system mb-2">
            {quest.title}
          </h3>
          <p className="text-slate-300 text-sm leading-relaxed mb-4">
            {quest.description}
          </p>

          <div className="p-3 bg-slate-950/80 border border-cyan-950 rounded flex items-center justify-between font-mono-system">
            <div>
              <div className="text-[10px] text-slate-500 tracking-wider uppercase">REQUIRED TARGET</div>
              <div className="text-lg font-bold text-cyan-300">
                {quest.target} {quest.unit.toUpperCase()}
              </div>
            </div>
            <div className="text-right">
              <div className="text-[10px] text-slate-500 tracking-wider uppercase">REWARDS</div>
              <div className="text-xs font-bold text-emerald-400">
                +{quest.xpReward} XP {quest.statRewards && Object.entries(quest.statRewards).map(([k, v]) => `| +${v} ${k}`)}
              </div>
            </div>
          </div>
        </div>

        {/* Quest Action Buttons */}
        <div className="mt-4 pt-3 border-t border-slate-900 flex items-center gap-3">
          {quest.status === 'AVAILABLE' && (
            <button
              onClick={() => {
                playUiClick();
                onStartQuest();
              }}
              className="flex-1 py-3 px-4 rounded bg-cyan-600 hover:bg-cyan-500 text-slate-950 font-bold font-mono-system text-xs uppercase tracking-wider flex items-center justify-center gap-2 transition-colors shadow-[0_0_15px_rgba(56,189,248,0.4)]"
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
              className="flex-1 py-3 px-4 rounded bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black font-mono-system text-xs uppercase tracking-wider flex items-center justify-center gap-2 transition-colors shadow-[0_0_20px_rgba(16,185,129,0.5)] animate-pulse"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>VERIFY COMPLETION</span>
            </button>
          )}

          {quest.status === 'COMPLETED' && (
            <div className="flex-1 py-3 px-4 rounded bg-slate-900 border border-emerald-900/60 text-emerald-400 font-mono-system text-xs uppercase tracking-wider text-center font-bold">
              [ OBJECTIVE COMPLETED TODAY ]
            </div>
          )}

          <button
            onClick={() => {
              playUiClick();
              onNavigateToQuest();
            }}
            className="py-3 px-4 rounded border border-slate-800 bg-slate-900/80 hover:bg-slate-800 text-slate-300 font-mono-system text-xs uppercase tracking-wider transition-colors"
          >
            DETAILS
          </button>
        </div>
      </section>

      {/* 4. NATURAL LANGUAGE AI CONSOLE */}
      <section className="bg-[#070b14] border border-cyan-950 rounded-sm p-4 system-bracket">
        <div className="flex items-center gap-2 mb-3 text-xs font-mono-system text-cyan-400 font-bold">
          <Sparkles className="w-4 h-4 text-cyan-400" />
          <span>[ THE SYSTEM CONSOLE // NATURAL LANGUAGE RECALIBRATION ]</span>
        </div>

        {aiFeedback && (
          <div className="mb-3 p-3 bg-cyan-950/40 border border-cyan-500/40 rounded text-xs font-mono-system text-cyan-200 whitespace-pre-line leading-relaxed">
            {aiFeedback}
          </div>
        )}

        <div className="flex gap-2">
          <input
            type="text"
            value={inputMsg}
            onChange={(e) => setInputMsg(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSendPrompt()}
            placeholder="เช่น 'วันนี้มีเวลา 15 นาที' หรือ 'ปวดเข่า ขอเปลี่ยนท่า'..."
            className="flex-1 bg-slate-950 border border-slate-800 rounded px-3 py-2 text-xs font-mono-system text-slate-100 placeholder:text-slate-600 focus:outline-none focus:border-cyan-500"
          />
          <button
            disabled={isAiProcessing}
            onClick={() => handleSendPrompt()}
            className="px-4 py-2 rounded bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 text-slate-950 font-bold font-mono-system text-xs flex items-center gap-1 transition-colors"
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
