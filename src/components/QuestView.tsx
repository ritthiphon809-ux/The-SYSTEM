import { useState } from 'react';
import { Quest, QuestDifficulty, QuestStep } from '../types.ts';
import {
  Play,
  CheckCircle2,
  Sparkles,
  RotateCcw,
  CheckSquare,
  Square,
  ListChecks,
  Timer,
  ChevronDown,
  ChevronUp,
  AlertTriangle,
  Dumbbell
} from 'lucide-react';
import { playUiClick, playWarningSound, triggerHaptic } from '../utils/audio.ts';
import { ActiveWorkoutModal } from './ActiveWorkoutModal.tsx';

interface QuestViewProps {
  quest: Quest;
  onStartQuest: () => void;
  onOpenCompleteModal: () => void;
  onSimulateExpire: () => void;
  onRegenerateQuest: (difficulty?: QuestDifficulty) => Promise<void>;
  isGenerating: boolean;
  onToggleStep?: (stepId: string) => void;
}

export function QuestView({
  quest,
  onStartQuest,
  onOpenCompleteModal,
  onSimulateExpire,
  onRegenerateQuest,
  isGenerating,
  onToggleStep
}: QuestViewProps) {
  const [selectedDifficulty, setSelectedDifficulty] = useState<QuestDifficulty>(quest.difficulty);
  const [activeTimerStep, setActiveTimerStep] = useState<QuestStep | null>(null);
  const [showRecalibrate, setShowRecalibrate] = useState(false);

  const handleDifficultyRegen = (diff: QuestDifficulty) => {
    setSelectedDifficulty(diff);
    playUiClick();
    onRegenerateQuest(diff);
  };

  const hasSteps = Array.isArray(quest.steps) && quest.steps.length > 0;
  const completedStepsCount = hasSteps ? quest.steps!.filter((s) => s.completed).length : 0;
  const totalStepsCount = hasSteps ? quest.steps!.length : 0;
  const allStepsCompleted = hasSteps && completedStepsCount === totalStepsCount;
  const progressPercent = hasSteps && totalStepsCount > 0 ? Math.round((completedStepsCount / totalStepsCount) * 100) : 0;

  return (
    <div className="space-y-4 pb-12 font-sans">
      {/* 1. Main Quest Directive Card */}
      <section className="bg-[#080d1a] border-2 border-cyan-500/40 rounded-sm p-5 system-bracket shadow-lg relative">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-cyan-950/70 pb-3 mb-4 font-mono-system text-xs">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-cyan-400 animate-ping" />
            <span className="text-cyan-400 font-bold uppercase tracking-wider">
              {quest.isPenalty ? 'PENALTY CALIBRATION' : 'ACTIVE SYSTEM QUEST'}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <span className="px-2 py-0.5 rounded bg-slate-900 border border-slate-700 text-slate-300 font-bold">
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
                  : quest.status === 'RESTED'
                  ? 'bg-indigo-950 border-indigo-500/50 text-indigo-300'
                  : 'bg-cyan-950 border-cyan-500/50 text-cyan-400'
              }`}
            >
              {quest.status}
            </span>
          </div>
        </div>

        {/* Quest Title & Description */}
        <div className="my-2">
          <h2 className="text-2xl sm:text-3xl font-black text-white uppercase tracking-wide">
            {quest.title}
          </h2>
          <p className="text-slate-300 text-sm leading-relaxed mt-1.5 max-w-2xl">
            {quest.description}
          </p>
        </div>

        {/* STEP-BY-STEP CHECKLIST */}
        {hasSteps ? (
          <div className="my-4 space-y-3">
            <div className="flex items-center justify-between font-mono-system text-xs">
              <div className="flex items-center gap-1.5 text-cyan-400 font-bold tracking-wider">
                <ListChecks className="w-4 h-4" />
                <span>EXERCISE PROTOCOL CHECKLIST</span>
              </div>
              <div className="text-slate-400">
                <span className={allStepsCompleted ? 'text-emerald-400 font-bold' : 'text-cyan-300 font-bold'}>
                  {completedStepsCount}
                </span>
                <span> / {totalStepsCount} COMPLETED ({progressPercent}%)</span>
              </div>
            </div>

            {/* Progress Bar */}
            <div className="w-full bg-slate-950 rounded-full h-2 overflow-hidden border border-slate-800">
              <div
                className={`h-full transition-all duration-300 ${
                  allStepsCompleted
                    ? 'bg-emerald-400 shadow-[0_0_12px_rgba(52,211,153,0.8)]'
                    : 'bg-gradient-to-r from-cyan-600 to-cyan-400 shadow-[0_0_8px_rgba(56,189,248,0.5)]'
                }`}
                style={{ width: `${progressPercent}%` }}
              />
            </div>

            {/* Checklist Items */}
            <div className="space-y-2 pt-1">
              {quest.steps!.map((step, index) => {
                const isDone = Boolean(step.completed);
                return (
                  <div
                    key={step.id || `step-${index}`}
                    onClick={() => {
                      if (onToggleStep) {
                        playUiClick();
                        triggerHaptic('light');
                        onToggleStep(step.id);
                      }
                    }}
                    className={`p-3 rounded-sm border transition-all cursor-pointer select-none flex items-center justify-between gap-3 ${
                      isDone
                        ? 'bg-emerald-950/30 border-emerald-500/40 text-emerald-300'
                        : 'bg-slate-950/80 border-slate-900 hover:border-cyan-800/80 text-slate-200'
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <button
                        type="button"
                        className="shrink-0 focus:outline-none"
                        onClick={(e) => {
                          e.stopPropagation();
                          if (onToggleStep) {
                            playUiClick();
                            triggerHaptic('light');
                            onToggleStep(step.id);
                          }
                        }}
                      >
                        {isDone ? (
                          <CheckSquare className="w-5 h-5 text-emerald-400 fill-emerald-950/60" />
                        ) : (
                          <Square className="w-5 h-5 text-slate-500 hover:text-cyan-400" />
                        )}
                      </button>

                      <div className="min-w-0">
                        <div
                          className={`text-sm font-bold tracking-wide truncate ${
                            isDone ? 'line-through text-slate-400' : 'text-slate-100'
                          }`}
                        >
                          {step.name}
                        </div>
                        <div className="text-xs text-slate-400 font-mono-system flex items-center gap-2 mt-0.5">
                          <span className="text-cyan-300 font-semibold">
                            {step.targetReps ? `${step.targetReps} REPS` : `${step.targetSeconds || 30}s`}
                          </span>
                          {step.sets && (
                            <span className="text-slate-400">
                              • {step.sets} เซ็ต
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Step Timer Shortcut */}
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        playUiClick();
                        setActiveTimerStep(step);
                      }}
                      className="shrink-0 px-2.5 py-1.5 rounded bg-cyan-950 hover:bg-cyan-900 border border-cyan-500/40 text-cyan-300 text-xs font-mono-system flex items-center gap-1 transition-colors"
                      title="เริ่มจับเวลานับถอยหลังสำหรับท่านี้"
                    >
                      <Timer className="w-3.5 h-3.5 text-cyan-400" />
                      <span className="hidden sm:inline">TIMER</span>
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        ) : (
          <div className="my-4 p-4 bg-slate-950/80 border border-cyan-950 rounded-sm">
            <div className="text-[10px] text-slate-500 uppercase tracking-wider font-mono-system">
              TARGET REQUIREMENT
            </div>
            <div className="text-4xl font-black text-cyan-300 font-mono-system my-1">
              {quest.target} <span className="text-xl text-slate-400 uppercase">{quest.unit}</span>
            </div>
          </div>
        )}

        {/* Concise Spec Strip */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 my-4 font-mono-system text-xs">
          <div className="p-2.5 bg-slate-950/80 border border-slate-900 rounded-sm">
            <div className="text-[10px] text-slate-500 uppercase">XP REWARD</div>
            <div className="text-base font-bold text-cyan-400 mt-0.5">+{quest.xpReward} XP</div>
          </div>

          <div className="p-2.5 bg-slate-950/80 border border-slate-900 rounded-sm">
            <div className="text-[10px] text-slate-500 uppercase">STAT REWARD</div>
            <div className="text-base font-bold text-emerald-400 mt-0.5">
              {Object.entries(quest.statRewards).length > 0
                ? Object.entries(quest.statRewards).map(([k, v]) => `+${v} ${k}`).join(', ')
                : '+1 VIT'}
            </div>
          </div>

          <div className="p-2.5 bg-slate-950/80 border border-slate-900 rounded-sm">
            <div className="text-[10px] text-slate-500 uppercase">DEADLINE</div>
            <div className="text-base font-bold text-rose-400 mt-0.5">{quest.deadline}</div>
          </div>

          <div className="p-2.5 bg-slate-950/80 border border-slate-900 rounded-sm">
            <div className="text-[10px] text-slate-500 uppercase">TYPE</div>
            <div className="text-base font-bold text-slate-300 mt-0.5">{quest.type}</div>
          </div>
        </div>

        {/* Action Controls */}
        <div className="space-y-2 pt-2">
          {quest.status === 'AVAILABLE' && (
            <button
              onClick={() => {
                playUiClick();
                triggerHaptic('medium');
                onStartQuest();
              }}
              className="w-full py-3.5 px-4 rounded-sm bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-mono-system text-xs uppercase font-black tracking-widest flex items-center justify-center gap-2 shadow-[0_0_15px_rgba(56,189,248,0.4)] transition-all"
            >
              <Play className="w-4 h-4 fill-slate-950" />
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
              className={`w-full py-3.5 px-4 rounded-sm font-mono-system text-xs uppercase font-black tracking-widest flex items-center justify-center gap-2 transition-all ${
                allStepsCompleted
                  ? 'bg-emerald-500 hover:bg-emerald-400 text-slate-950 shadow-[0_0_20px_rgba(52,211,153,0.5)]'
                  : 'bg-cyan-500 hover:bg-cyan-400 text-slate-950 shadow-[0_0_15px_rgba(56,189,248,0.3)]'
              }`}
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>
                {allStepsCompleted ? 'ALL STEPS COMPLETED — CLAIM REWARD' : 'CONFIRM COMPLETION (COMPLETE ALL)'}
              </span>
            </button>
          )}

          {quest.status === 'COMPLETED' && (
            <div className="p-3 rounded-sm bg-emerald-950/40 border border-emerald-500/50 text-emerald-300 font-mono-system text-xs text-center font-bold">
              [SYSTEM] OBJECTIVE FULFILLED. XP AND ATTRIBUTES STORED IN DATABASE.
            </div>
          )}

          {quest.status === 'RESTED' && (
            <div className="p-3 rounded-sm bg-indigo-950/40 border border-indigo-500/50 text-indigo-300 font-mono-system text-xs text-center font-bold">
              [SYSTEM: REST DAY ACTIVE] วันพักผ่อนประจำสัปดาห์ — งดเว้นบทลงโทษและรักษา Streak
            </div>
          )}
        </div>
      </section>

      {/* 2. Collapsible AI Quest Recalibration & Testing Tools */}
      <section className="bg-[#070b14] border border-slate-900 rounded-sm p-4 font-mono-system text-xs">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-slate-400">
            <Sparkles className="w-4 h-4 text-cyan-400" />
            <span className="text-[11px] font-bold text-slate-300 uppercase">
              AI QUEST RECALIBRATION & TOOLS
            </span>
          </div>
          <button
            onClick={() => {
              playUiClick();
              setShowRecalibrate(!showRecalibrate);
            }}
            className="text-[11px] text-cyan-400 hover:text-cyan-300 flex items-center gap-1 transition-colors"
          >
            <span>{showRecalibrate ? 'ซ่อน' : 'ปรับเปลี่ยนระดับ'}</span>
            {showRecalibrate ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          </button>
        </div>

        {showRecalibrate && (
          <div className="mt-3 pt-3 border-t border-slate-900 space-y-3 animate-in fade-in duration-200">
            <p className="text-xs text-slate-400 font-sans leading-relaxed">
              เลือกระดับความยากเพื่อให้ Gemini AI คำนวณชุดท่าออกกำลังกายใหม่ที่สอดคล้องกับสภาพร่างกายของคุณ:
            </p>

            <div className="flex flex-wrap items-center gap-2">
              {(['EASY', 'NORMAL', 'HARD', 'ELITE'] as QuestDifficulty[]).map((diff) => (
                <button
                  key={diff}
                  onClick={() => handleDifficultyRegen(diff)}
                  disabled={isGenerating}
                  className={`px-3 py-1.5 rounded text-xs font-mono-system font-bold uppercase transition-all ${
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
                className="ml-auto px-3.5 py-1.5 rounded bg-slate-800 hover:bg-slate-700 text-cyan-300 border border-slate-700 font-mono-system text-xs uppercase flex items-center gap-1.5 disabled:opacity-50"
              >
                <RotateCcw className={`w-3.5 h-3.5 ${isGenerating ? 'animate-spin' : ''}`} />
                <span>{isGenerating ? 'RECALIBRATING...' : 'AI RECALIBRATE'}</span>
              </button>
            </div>

            {/* Test Deadline Expiry */}
            <div className="pt-3 border-t border-slate-900/80 flex items-center justify-between gap-2 text-[11px]">
              <span className="text-slate-400 flex items-center gap-1">
                <AlertTriangle className="w-3.5 h-3.5 text-rose-400" />
                <span>จำลองการหมดเวลา 21:00 น. (ทดสอบ Penalty Zone)</span>
              </span>
              <button
                onClick={() => {
                  playWarningSound();
                  onSimulateExpire();
                }}
                className="px-2.5 py-1 rounded bg-rose-950/60 hover:bg-rose-900 border border-rose-800 text-rose-300"
              >
                SIMULATE EXPIRE
              </button>
            </div>
          </div>
        )}
      </section>

      {/* Interactive Workout & Rest Timer Modal */}
      {activeTimerStep && (
        <ActiveWorkoutModal
          step={activeTimerStep}
          isOpen={Boolean(activeTimerStep)}
          onClose={() => setActiveTimerStep(null)}
          onCompleteStep={(stepId) => {
            if (onToggleStep) {
              onToggleStep(stepId);
            }
            setActiveTimerStep(null);
          }}
        />
      )}
    </div>
  );
}
