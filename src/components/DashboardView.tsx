import { useState } from 'react';
import { Player, Quest } from '../types.ts';
import { Flame, Play, CheckCircle2, Send, Sparkles, AlertCircle, ArrowRight, Shield } from 'lucide-react';
import { playUiClick, playWarningSound, triggerHaptic } from '../utils/audio.ts';

interface DashboardViewProps {
  player: Player;
  quest: Quest;
  onStartQuest: () => void;
  onOpenCompleteModal: () => void;
  onSendMessage: (msg: string) => Promise<string | null>;
  onNavigateToQuest: () => void;
  onNavigateToStatus: () => void;
}

export function DashboardView({
  player,
  quest,
  onStartQuest,
  onOpenCompleteModal,
  onSendMessage,
  onNavigateToQuest,
  onNavigateToStatus
}: DashboardViewProps) {
  const [inputMsg, setInputMsg] = useState('');
  const [isAiProcessing, setIsAiProcessing] = useState(false);
  const [aiFeedback, setAiFeedback] = useState<string | null>(null);

  const xpPercent = Math.min(100, Math.round((player.xp / player.currentLevelMaxXp) * 100));

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
      {/* 1. UX Principle: Question 1 — ฉันอยู่ Level ไหน? */}
      {/* SYSTEM TERMINAL: PLAYER STATUS */}
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
            {/* Visual ASCII Bar & Hardware Bar */}
            <div className="hidden sm:block text-cyan-500/80 font-mono text-sm tracking-widest leading-none mb-1">
              {renderAsciiBar(xpPercent, 20)}
            </div>
            <div className="w-full h-2.5 bg-slate-950 rounded-xs border border-cyan-950/80 overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-cyan-600 to-cyan-400 transition-all duration-500"
                style={{ width: `${xpPercent}%` }}
              />
            </div>
          </div>
        </div>

        {/* Four Core Stats Strip */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-3 border-t border-slate-900 font-mono-system">
          <div className="p-2 bg-slate-950/60 border border-slate-900 rounded-sm flex items-center justify-between">
            <span className="text-slate-400 text-xs font-bold">STR</span>
            <span className="text-cyan-300 text-sm font-bold">{String(player.stats.STR).padStart(2, '0')}</span>
          </div>
          <div className="p-2 bg-slate-950/60 border border-slate-900 rounded-sm flex items-center justify-between">
            <span className="text-slate-400 text-xs font-bold">AGI</span>
            <span className="text-cyan-300 text-sm font-bold">{String(player.stats.AGI).padStart(2, '0')}</span>
          </div>
          <div className="p-2 bg-slate-950/60 border border-slate-900 rounded-sm flex items-center justify-between">
            <span className="text-slate-400 text-xs font-bold">VIT</span>
            <span className="text-cyan-300 text-sm font-bold">{String(player.stats.VIT).padStart(2, '0')}</span>
          </div>
          <div className="p-2 bg-slate-950/60 border border-slate-900 rounded-sm flex items-center justify-between">
            <span className="text-slate-400 text-xs font-bold">INT</span>
            <span className="text-cyan-300 text-sm font-bold">{String(player.stats.INT).padStart(2, '0')}</span>
          </div>
        </div>

        {/* Streak indicator */}
        <div className="mt-3 flex items-center justify-between text-xs font-mono-system text-slate-400 bg-amber-950/20 border border-amber-900/30 px-3 py-2 rounded-sm">
          <div className="flex items-center gap-2 text-amber-400 font-bold">
            <Flame className="w-4 h-4 text-amber-400 fill-amber-400/30" />
            <span>{player.streak} DAY STREAK</span>
          </div>
          <span className="text-[11px] text-slate-400">Biological adherence verified</span>
        </div>
      </section>

      {/* 2. UX Principle: Question 2 & 3 — วันนี้ต้องทำอะไร? และถ้าทำแล้ว ฉันได้อะไร? */}
      {/* TODAY'S QUEST PANEL */}
      <section className="bg-[#090e1b] border-2 border-cyan-500/40 rounded-sm p-5 shadow-[0_0_30px_rgba(56,189,248,0.12)] relative overflow-hidden">
        {/* Subtle holographic glow accent */}
        <div className="absolute top-0 right-0 w-32 h-32 bg-cyan-500/5 rounded-full blur-2xl pointer-events-none" />

        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <span className="text-[10px] px-2 py-0.5 rounded bg-cyan-950 border border-cyan-400 text-cyan-300 font-mono-system font-bold tracking-wider">
              {quest.isPenalty ? 'PENALTY PROTOCOL' : "TODAY'S DAILY QUEST"}
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
          <h3 className="text-xl sm:text-2xl font-black text-white tracking-wide font-sans uppercase">
            {quest.title}
          </h3>
          <div className="text-2xl sm:text-3xl font-black text-cyan-300 font-mono-system my-1">
            {quest.target} {quest.unit.toUpperCase()}
          </div>
          <p className="text-slate-400 text-sm leading-relaxed mt-1">
            {quest.description}
          </p>
        </div>

        {/* Rewards Breakdown (Question 3 Answer) */}
        <div className="my-4 py-3 px-3 bg-[#05070a] border border-cyan-950/80 rounded-sm flex flex-wrap items-center justify-between gap-3 text-xs font-mono-system">
          <div>
            <div className="text-[10px] text-slate-500 uppercase tracking-wider">REWARD GUARANTEE</div>
            <div className="text-cyan-400 font-bold text-base flex items-center gap-2">
              <span>+{quest.xpReward} XP</span>
              {Object.entries(quest.statRewards).map(([k, v]) => (
                <span key={k} className="text-emerald-400 text-xs">
                  +{v} {k}
                </span>
              ))}
            </div>
          </div>

          <div className="text-right">
            <div className="text-[10px] text-slate-500 uppercase tracking-wider">STATUS</div>
            <div
              className={`font-bold uppercase ${
                quest.status === 'COMPLETED'
                  ? 'text-emerald-400'
                  : quest.status === 'IN_PROGRESS'
                  ? 'text-amber-400'
                  : quest.status === 'EXPIRED'
                  ? 'text-rose-400'
                  : 'text-cyan-300'
              }`}
            >
              [{quest.status}]
            </div>
          </div>
        </div>

        {/* Quest Action Buttons */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-4">
          {quest.status === 'AVAILABLE' && (
            <button
              onClick={() => {
                playUiClick();
                triggerHaptic('medium');
                onStartQuest();
              }}
              className="w-full py-3 px-4 rounded-sm bg-cyan-950 hover:bg-cyan-900 border border-cyan-500/60 text-cyan-300 font-mono-system text-xs uppercase font-bold tracking-widest flex items-center justify-center gap-2 transition-all shadow-[0_0_15px_rgba(56,189,248,0.2)]"
            >
              <Play className="w-4 h-4 fill-cyan-400 text-cyan-400" />
              <span>START QUEST</span>
            </button>
          )}

          {quest.status !== 'COMPLETED' && (
            <button
              onClick={() => {
                playUiClick();
                triggerHaptic('medium');
                onOpenCompleteModal();
              }}
              className="w-full py-3 px-4 rounded-sm bg-cyan-500 hover:bg-cyan-400 border border-cyan-300 text-slate-950 font-mono-system text-xs uppercase font-extrabold tracking-widest flex items-center justify-center gap-2 transition-all shadow-[0_0_20px_rgba(56,189,248,0.4)]"
            >
              <CheckCircle2 className="w-4 h-4 stroke-[3]" />
              <span>CONFIRM COMPLETION</span>
            </button>
          )}

          {quest.status === 'COMPLETED' && (
            <div className="sm:col-span-2 py-3 px-4 rounded-sm bg-emerald-950/40 border border-emerald-500/40 text-emerald-400 font-mono-system text-xs font-bold uppercase tracking-widest flex items-center justify-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              <span>OBJECTIVE COMPLETED // REWARD ASSIMILATED</span>
            </div>
          )}

          <button
            onClick={() => {
              playUiClick();
              onNavigateToQuest();
            }}
            className="w-full py-3 px-4 rounded-sm bg-slate-900/90 hover:bg-slate-800 border border-slate-800 text-slate-300 font-mono-system text-xs uppercase font-medium tracking-wider flex items-center justify-center gap-2 transition-colors"
          >
            <span>VIEW QUEST DETAILS & TIMER</span>
          </button>
        </div>
      </section>

      {/* 3. NATURAL LANGUAGE INTERACTION / SYSTEM CONSOLE */}
      <section className="bg-[#070b14] border border-cyan-950 rounded-sm p-4 system-bracket">
        <div className="flex items-center gap-2 mb-3">
          <Sparkles className="w-4 h-4 text-cyan-400" />
          <h3 className="text-xs font-mono-system font-bold text-slate-300 tracking-wider uppercase">
            SYSTEM CONSOLE // NATURAL LANGUAGE DIRECTIVE
          </h3>
        </div>

        <p className="text-xs text-slate-400 mb-3">
          Communicate schedule constraints or logs. The System intelligence adapts your daily quest immediately.
        </p>

        {/* Quick prompt chips */}
        <div className="flex flex-wrap gap-1.5 mb-3">
          {quickPrompts.map((p, idx) => (
            <button
              key={idx}
              onClick={() => handleSendPrompt(p)}
              disabled={isAiProcessing}
              className="text-[11px] px-2.5 py-1 rounded bg-slate-900 border border-slate-800 hover:border-cyan-500/40 text-slate-300 hover:text-cyan-300 transition-colors disabled:opacity-50"
            >
              «{p}»
            </button>
          ))}
        </div>

        {/* Input Bar */}
        <div className="flex gap-2">
          <input
            type="text"
            value={inputMsg}
            onChange={(e) => setInputMsg(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleSendPrompt();
            }}
            placeholder="e.g. วันนี้ผมมีเวลาแค่ 20 นาที หรือ วันนี้ออกกำลังไป 45 นาที"
            disabled={isAiProcessing}
            className="flex-1 bg-slate-950 border border-slate-800 rounded px-3 py-2 text-xs text-slate-100 placeholder-slate-600 focus:outline-none focus:border-cyan-500 font-sans"
          />
          <button
            onClick={() => handleSendPrompt()}
            disabled={isAiProcessing || !inputMsg.trim()}
            className="px-4 py-2 rounded bg-cyan-600 hover:bg-cyan-500 text-slate-950 font-bold font-mono-system text-xs uppercase flex items-center gap-1.5 disabled:opacity-50 transition-colors"
          >
            <Send className="w-3.5 h-3.5" />
            <span>{isAiProcessing ? 'COMPUTING...' : 'TRANSMIT'}</span>
          </button>
        </div>

        {/* System AI Output Display */}
        {aiFeedback && (
          <div className="mt-3 p-3 bg-slate-950 border-l-2 border-cyan-400 rounded-r text-xs font-mono-system text-cyan-300 whitespace-pre-line leading-relaxed shadow-inner">
            {aiFeedback}
          </div>
        )}
      </section>
    </div>
  );
}
