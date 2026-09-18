import { useState } from 'react';
import { Quest, QuestDifficulty } from '../types.ts';
import { Play, CheckCircle2, AlertTriangle, Sparkles, Clock, ShieldAlert, RotateCcw } from 'lucide-react';
import { playUiClick, playWarningSound, triggerHaptic } from '../utils/audio.ts';

interface QuestViewProps {
  quest: Quest;
  onStartQuest: () => void;
  onOpenCompleteModal: () => void;
  onSimulateExpire: () => void;
  onRegenerateQuest: (difficulty?: QuestDifficulty) => Promise<void>;
  isGenerating: boolean;
}

export function QuestView({
  quest,
  onStartQuest,
  onOpenCompleteModal,
  onSimulateExpire,
  onRegenerateQuest,
  isGenerating
}: QuestViewProps) {
  const [selectedDifficulty, setSelectedDifficulty] = useState<QuestDifficulty>(quest.difficulty);

  const handleDifficultyRegen = (diff: QuestDifficulty) => {
    setSelectedDifficulty(diff);
    playUiClick();
    onRegenerateQuest(diff);
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Quest Directive Card */}
      <section className="bg-[#080d1a] border-2 border-cyan-500/50 rounded-sm p-6 system-bracket shadow-[0_0_30px_rgba(56,189,248,0.15)] relative">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-cyan-950 pb-3 mb-4">
          <div className="flex items-center gap-2 font-mono-system text-xs">
            <span className="w-2 h-2 rounded-full bg-cyan-400 animate-ping"></span>
            <span className="text-cyan-400 font-bold uppercase tracking-wider">
              {quest.isPenalty ? 'PENALTY CALIBRATION' : 'ACTIVE SYSTEM QUEST'}
            </span>
          </div>
          <div className="flex items-center gap-2 font-mono-system text-xs">
            <span className="px-2 py-0.5 rounded bg-slate-900 border border-slate-700 text-slate-300">
              {quest.difficulty}
            </span>
            <span
              className={`px-2 py-0.5 rounded border font-bold ${
                quest.status === 'COMPLETED'
                  ? 'bg-emerald-950 border-emerald-500/50 text-emerald-400'
                  : quest.status === 'IN_PROGRESS'
                  ? 'bg-amber-950 border-amber-500/50 text-amber-400'
                  : quest.status === 'EXPIRED'
                  ? 'bg-rose-950 border-rose-500/50 text-rose-400'
                  : 'bg-cyan-950 border-cyan-500/50 text-cyan-400'
              }`}
            >
              {quest.status}
            </span>
          </div>
        </div>

        {/* Quest Title and Giant Target Metric */}
        <div className="my-4">
          <h2 className="text-2xl sm:text-3xl font-black text-white font-sans uppercase tracking-wide">
            {quest.title}
          </h2>
          <div className="text-4xl sm:text-5xl font-black text-cyan-300 font-mono-system my-2 tracking-tight">
            {quest.target} <span className="text-xl text-slate-400 uppercase">{quest.unit}</span>
          </div>
          <p className="text-slate-300 text-sm sm:text-base leading-relaxed mt-2 font-sans max-w-2xl">
            {quest.description}
          </p>
        </div>

        {/* Spec Parameters Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 my-6 font-mono-system text-xs">
          <div className="p-3 bg-slate-950/80 border border-slate-900 rounded-sm">
            <div className="text-[10px] text-slate-500 uppercase">XP REWARD</div>
            <div className="text-lg font-bold text-cyan-400 mt-0.5">+{quest.xpReward} XP</div>
          </div>

          <div className="p-3 bg-slate-950/80 border border-slate-900 rounded-sm">
            <div className="text-[10px] text-slate-500 uppercase">STAT REWARD</div>
            <div className="text-lg font-bold text-emerald-400 mt-0.5">
              {Object.entries(quest.statRewards).length > 0
                ? Object.entries(quest.statRewards).map(([k, v]) => `+${v} ${k}`).join(', ')
                : '+1 VIT'}
            </div>
          </div>

          <div className="p-3 bg-slate-950/80 border border-slate-900 rounded-sm">
            <div className="text-[10px] text-slate-500 uppercase">DEADLINE</div>
            <div className="text-lg font-bold text-rose-400 mt-0.5">{quest.deadline}</div>
          </div>

          <div className="p-3 bg-slate-950/80 border border-slate-900 rounded-sm">
            <div className="text-[10px] text-slate-500 uppercase">DISCIPLINE TYPE</div>
            <div className="text-lg font-bold text-slate-300 mt-0.5">{quest.type}</div>
          </div>
        </div>

        {/* Action Controls */}
        <div className="space-y-3">
          {quest.status === 'AVAILABLE' && (
            <button
              onClick={() => {
                playUiClick();
                triggerHaptic('medium');
                onStartQuest();
              }}
              className="w-full py-3.5 px-4 rounded-sm bg-cyan-950 hover:bg-cyan-900 border border-cyan-400 text-cyan-300 font-mono-system text-sm uppercase font-bold tracking-widest flex items-center justify-center gap-2 transition-all shadow-[0_0_20px_rgba(56,189,248,0.25)]"
            >
              <Play className="w-4 h-4 fill-cyan-400 text-cyan-400" />
              <span>START QUEST // INITIATE REPS</span>
            </button>
          )}

          {quest.status !== 'COMPLETED' && (
            <button
              onClick={() => {
                playUiClick();
                triggerHaptic('medium');
                onOpenCompleteModal();
              }}
              className="w-full py-3.5 px-4 rounded-sm bg-cyan-500 hover:bg-cyan-400 border border-cyan-200 text-slate-950 font-mono-system text-sm uppercase font-extrabold tracking-widest flex items-center justify-center gap-2 transition-all shadow-[0_0_25px_rgba(56,189,248,0.4)]"
            >
              <CheckCircle2 className="w-5 h-5 stroke-[3]" />
              <span>CONFIRM COMPLETION</span>
            </button>
          )}

          {quest.status === 'COMPLETED' && (
            <div className="p-4 rounded-sm bg-emerald-950/30 border border-emerald-500/50 text-emerald-400 font-mono-system text-xs text-center font-bold">
              [SYSTEM] OBJECTIVE FULFILLED. XP AND ATTRIBUTES STORED IN DATABASE.
            </div>
          )}
        </div>
      </section>

      {/* Adaptive Difficulty & AI Quest Generator Controls */}
      <section className="bg-[#070b14] border border-cyan-950 rounded-sm p-5 system-bracket">
        <div className="flex items-center gap-2 mb-3">
          <Sparkles className="w-4 h-4 text-cyan-400" />
          <h3 className="text-xs font-mono-system font-bold text-slate-300 tracking-wider uppercase">
            AI QUEST RECALIBRATION ENGINE (GEMINI)
          </h3>
        </div>

        <p className="text-xs text-slate-400 mb-4 leading-relaxed">
          Request the System AI brain to adapt physical parameters to your current energy and recovery profile.
        </p>

        <div className="flex flex-wrap items-center gap-2 mb-4">
          {(['EASY', 'NORMAL', 'HARD', 'ELITE'] as QuestDifficulty[]).map((diff) => (
            <button
              key={diff}
              onClick={() => handleDifficultyRegen(diff)}
              disabled={isGenerating}
              className={`px-3 py-1.5 rounded text-xs font-mono-system font-semibold uppercase transition-all ${
                selectedDifficulty === diff
                  ? 'bg-cyan-500 text-slate-950 border border-cyan-400'
                  : 'bg-slate-900 text-slate-400 border border-slate-800 hover:text-slate-200'
              }`}
            >
              {diff}
            </button>
          ))}

          <button
            onClick={() => handleDifficultyRegen(selectedDifficulty)}
            disabled={isGenerating}
            className="ml-auto px-4 py-1.5 rounded bg-slate-800 hover:bg-slate-700 text-cyan-300 border border-slate-700 font-mono-system text-xs uppercase flex items-center gap-1.5 disabled:opacity-50"
          >
            <RotateCcw className={`w-3.5 h-3.5 ${isGenerating ? 'animate-spin' : ''}`} />
            <span>{isGenerating ? 'REGENERATING...' : 'AI RECALIBRATE'}</span>
          </button>
        </div>

        {/* Penalty Simulation per Spec #21 */}
        <div className="pt-4 border-t border-slate-900 flex flex-wrap items-center justify-between gap-3">
          <div className="text-xs text-slate-400">
            <span className="text-rose-400 font-mono-system font-bold">[PENALTY TEST]: </span>
            Simulate 21:00 deadline expiration to verify failure protocol.
          </div>
          <button
            onClick={() => {
              playWarningSound();
              onSimulateExpire();
            }}
            className="px-3 py-1.5 rounded bg-rose-950/40 hover:bg-rose-950 border border-rose-800/50 text-rose-300 font-mono-system text-xs uppercase transition-colors"
          >
            SIMULATE DEADLINE EXPIRY
          </button>
        </div>
      </section>
    </div>
  );
}
