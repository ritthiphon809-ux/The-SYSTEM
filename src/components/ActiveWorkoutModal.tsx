import React, { useState, useEffect, useRef } from 'react';
import { Play, Pause, RotateCcw, Volume2, VolumeX, X, Bell, ChevronRight, CheckCircle2 } from 'lucide-react';
import { QuestStep } from '../types.ts';
import {
  playMetronomeTick,
  playCountdownBeep,
  playSystemTingSound,
  playLevelUpSound,
  playUiClick,
  triggerHaptic
} from '../utils/audio.ts';

interface ActiveWorkoutModalProps {
  step: QuestStep;
  isOpen: boolean;
  onClose: () => void;
  onCompleteStep: (stepId: string) => void;
}

type Mode = 'WORKOUT' | 'REST';

export function ActiveWorkoutModal({
  step,
  isOpen,
  onClose,
  onCompleteStep
}: ActiveWorkoutModalProps) {
  const [currentSet, setCurrentSet] = useState(1);
  const totalSets = step.sets || 1;
  const isTimeBased = Boolean(step.targetSeconds && step.targetSeconds > 0);
  const durationTarget = isTimeBased ? step.targetSeconds! : 0;
  const repsTarget = step.targetReps || 10;

  // Mode: WORKOUT or REST
  const [mode, setMode] = useState<Mode>('WORKOUT');
  const [restDuration, setRestDuration] = useState(60); // default 60s rest
  const [timeLeft, setTimeLeft] = useState(isTimeBased ? durationTarget : 0);
  const [restTimeLeft, setRestTimeLeft] = useState(60);
  const [isRunning, setIsRunning] = useState(false);
  const [repsDone, setRepsDone] = useState(0);

  // Metronome cadence for reps (e.g. 2s per rep = 30 bpm)
  const [metronomeEnabled, setMetronomeEnabled] = useState(true);
  const [bpm, setBpm] = useState(30);

  // Interval timer ref
  const timerRef = useRef<any>(null);
  const metronomeRef = useRef<any>(null);

  // Reset when step opens
  useEffect(() => {
    if (isOpen) {
      setCurrentSet(1);
      setMode('WORKOUT');
      setTimeLeft(isTimeBased ? durationTarget : 0);
      setRestTimeLeft(restDuration);
      setIsRunning(false);
      setRepsDone(0);
    }
  }, [isOpen, step.id, durationTarget, isTimeBased, restDuration]);

  // Handle countdown timer (for time-based workout or rest timer)
  useEffect(() => {
    if (!isRunning) {
      clearInterval(timerRef.current);
      return;
    }

    timerRef.current = setInterval(() => {
      if (mode === 'WORKOUT') {
        if (isTimeBased) {
          setTimeLeft((prev) => {
            if (prev <= 1) {
              handleSetFinished();
              return 0;
            }
            if (prev <= 4) {
              playCountdownBeep(false);
            }
            return prev - 1;
          });
        } else {
          // For reps mode, timer counts elapsed time
          setTimeLeft((prev) => prev + 1);
        }
      } else if (mode === 'REST') {
        setRestTimeLeft((prev) => {
          if (prev <= 1) {
            handleRestFinished();
            return 0;
          }
          if (prev <= 4) {
            playCountdownBeep(false);
          }
          return prev - 1;
        });
      }
    }, 1000);

    return () => clearInterval(timerRef.current);
  }, [isRunning, mode, isTimeBased]);

  // Handle Metronome cadence
  useEffect(() => {
    if (isRunning && mode === 'WORKOUT' && !isTimeBased && metronomeEnabled) {
      const intervalMs = (60 / bpm) * 1000;
      let tickCount = 0;
      metronomeRef.current = setInterval(() => {
        tickCount++;
        const isAccent = tickCount % 2 === 1;
        playMetronomeTick(isAccent);
      }, intervalMs);
    } else {
      clearInterval(metronomeRef.current);
    }
    return () => clearInterval(metronomeRef.current);
  }, [isRunning, mode, isTimeBased, metronomeEnabled, bpm]);

  if (!isOpen) return null;

  const handleStartPause = () => {
    playUiClick();
    triggerHaptic('light');
    setIsRunning(!isRunning);
  };

  const handleReset = () => {
    playUiClick();
    setIsRunning(false);
    if (mode === 'WORKOUT') {
      setTimeLeft(isTimeBased ? durationTarget : 0);
      setRepsDone(0);
    } else {
      setRestTimeLeft(restDuration);
    }
  };

  const handleSetFinished = () => {
    playSystemTingSound();
    triggerHaptic('success');
    setIsRunning(false);

    if (currentSet < totalSets) {
      // Transition to REST mode
      setMode('REST');
      setRestTimeLeft(restDuration);
      setIsRunning(true);
    } else {
      // All sets done!
      handleAllSetsFinished();
    }
  };

  const handleRestFinished = () => {
    playCountdownBeep(true);
    playSystemTingSound();
    triggerHaptic('warning');
    setIsRunning(false);
    setCurrentSet((s) => s + 1);
    setMode('WORKOUT');
    setTimeLeft(isTimeBased ? durationTarget : 0);
    setRepsDone(0);
  };

  const handleSkipRest = () => {
    playUiClick();
    handleRestFinished();
  };

  const handleAllSetsFinished = () => {
    playLevelUpSound();
    triggerHaptic('success');
    onCompleteStep(step.id);
    onClose();
  };

  const handleIncrementRep = () => {
    playUiClick();
    triggerHaptic('light');
    const next = repsDone + 1;
    setRepsDone(next);
    if (next >= repsTarget) {
      handleSetFinished();
    }
  };

  // Format seconds to mm:ss
  const formatTime = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-fade-in font-mono-system">
      <div className="w-full max-w-md bg-[#070c17] border-2 border-cyan-500/80 rounded-sm shadow-[0_0_50px_rgba(56,189,248,0.25)] overflow-hidden system-bracket relative">
        {/* Header */}
        <div className="p-4 bg-slate-950 border-b border-cyan-950 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-cyan-400 animate-ping"></span>
            <span className="text-xs font-bold tracking-wider text-cyan-300 uppercase">
              ACTIVE PROTOCOL ENGINE
            </span>
          </div>
          <button
            onClick={() => {
              playUiClick();
              onClose();
            }}
            className="text-slate-400 hover:text-rose-400 p-1 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body Content */}
        <div className="p-6 space-y-6">
          {/* Step Title and Set Tracker */}
          <div className="text-center space-y-1">
            <div className="text-[11px] text-slate-400 tracking-wider uppercase">
              EXERCISE IN EXECUTION
            </div>
            <h2 className="text-lg font-sans font-bold text-white tracking-wide">
              {step.name}
            </h2>
            <div className="inline-flex items-center gap-2 mt-2 px-3 py-1 rounded bg-slate-900 border border-slate-800 text-xs">
              <span className="text-slate-400">SET PROGRESS:</span>
              <span className="text-cyan-400 font-bold">
                SET {currentSet} OF {totalSets}
              </span>
            </div>
          </div>

          {/* Mode Tabs: WORKOUT vs REST */}
          <div className="grid grid-cols-2 gap-2 p-1 bg-slate-950 border border-slate-900 rounded">
            <div
              className={`py-1.5 text-center text-xs font-bold rounded transition-all ${
                mode === 'WORKOUT'
                  ? 'bg-cyan-950 text-cyan-300 border border-cyan-500/50'
                  : 'text-slate-500'
              }`}
            >
              EXERTION PHASE
            </div>
            <div
              className={`py-1.5 text-center text-xs font-bold rounded transition-all ${
                mode === 'REST'
                  ? 'bg-amber-950 text-amber-300 border border-amber-500/50'
                  : 'text-slate-500'
              }`}
            >
              RECOVERY INTERVAL
            </div>
          </div>

          {/* DISPLAY: WORKOUT MODE */}
          {mode === 'WORKOUT' ? (
            <div className="text-center space-y-4">
              {isTimeBased ? (
                // Time-based exercise (e.g. Plank 60s)
                <div className="p-6 bg-slate-950/90 border border-cyan-950 rounded-sm">
                  <div className="text-[10px] text-slate-500 tracking-wider mb-1">
                    COUNTDOWN REMAINING
                  </div>
                  <div className="text-6xl font-black text-cyan-300 tracking-tight font-mono">
                    {formatTime(timeLeft)}
                  </div>
                  <div className="text-xs text-slate-400 mt-2">
                    เป้าหมาย: {durationTarget} วินาที
                  </div>
                </div>
              ) : (
                // Repetition-based exercise (e.g. Squat 15 reps)
                <div className="p-6 bg-slate-950/90 border border-cyan-950 rounded-sm">
                  <div className="text-[10px] text-slate-500 tracking-wider mb-1">
                    REPETITIONS COMPLETED
                  </div>
                  <div className="text-6xl font-black text-cyan-300 tracking-tight font-mono">
                    {repsDone} <span className="text-2xl text-slate-500">/ {repsTarget}</span>
                  </div>
                  <div className="text-xs text-slate-400 mt-2">
                    เวลาที่ใช้: {formatTime(timeLeft)}
                  </div>

                  <button
                    onClick={handleIncrementRep}
                    className="mt-4 w-full py-3 bg-cyan-900/60 hover:bg-cyan-800/80 border border-cyan-500 text-cyan-200 font-bold text-sm rounded shadow-[0_0_15px_rgba(56,189,248,0.2)] active:scale-98 transition-all"
                  >
                    + 1 REP (นับครั้ง)
                  </button>
                </div>
              )}

              {/* Cadence / Metronome Toggle (for reps) */}
              {!isTimeBased && (
                <div className="flex items-center justify-between px-3 py-2 bg-slate-950/60 border border-slate-900 rounded text-xs text-slate-400">
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => {
                        playUiClick();
                        setMetronomeEnabled(!metronomeEnabled);
                      }}
                      className="text-cyan-400 hover:text-cyan-300"
                    >
                      {metronomeEnabled ? (
                        <Volume2 className="w-4 h-4 text-cyan-400" />
                      ) : (
                        <VolumeX className="w-4 h-4 text-slate-500" />
                      )}
                    </button>
                    <span>จังหวะ (Cadence): {bpm} ครั้ง/นาที</span>
                  </div>
                  <div className="flex gap-1">
                    <button
                      onClick={() => setBpm((b) => Math.max(20, b - 5))}
                      className="px-2 py-0.5 rounded bg-slate-900 border border-slate-800 text-slate-300 hover:border-cyan-500"
                    >
                      -
                    </button>
                    <button
                      onClick={() => setBpm((b) => Math.min(60, b + 5))}
                      className="px-2 py-0.5 rounded bg-slate-900 border border-slate-800 text-slate-300 hover:border-cyan-500"
                    >
                      +
                    </button>
                  </div>
                </div>
              )}
            </div>
          ) : (
            /* DISPLAY: REST INTERVAL MODE */
            <div className="text-center space-y-4">
              <div className="p-6 bg-amber-950/20 border border-amber-500/40 rounded-sm">
                <div className="text-[10px] text-amber-400 tracking-wider mb-1">
                  RECOVERY REST TIMER (พักระหว่างเซ็ต)
                </div>
                <div className="text-6xl font-black text-amber-300 tracking-tight font-mono">
                  {formatTime(restTimeLeft)}
                </div>
                <p className="text-xs text-slate-400 mt-3 leading-relaxed">
                  หายใจเข้าลึกๆ ยืดกล้ามเนื้อเบาๆ เมื่อหมดเวลาระบบจะส่งเสียงเตือนเริ่มเซ็ตถัดไป
                </p>
              </div>

              {/* Quick Rest Adjustments */}
              <div className="flex items-center justify-center gap-2 text-xs">
                <span className="text-slate-500">ปรับเวลาพัก:</span>
                {[30, 60, 90].map((sec) => (
                  <button
                    key={sec}
                    onClick={() => {
                      playUiClick();
                      setRestDuration(sec);
                      setRestTimeLeft(sec);
                    }}
                    className={`px-2.5 py-1 rounded border transition-colors ${
                      restDuration === sec
                        ? 'bg-amber-950 border-amber-500 text-amber-300 font-bold'
                        : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-white'
                    }`}
                  >
                    {sec}s
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Primary Action Controls */}
          <div className="space-y-2">
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={handleStartPause}
                className={`py-3 rounded font-bold text-xs flex items-center justify-center gap-2 transition-all ${
                  isRunning
                    ? 'bg-amber-950 hover:bg-amber-900 border border-amber-500/60 text-amber-300'
                    : 'bg-cyan-600 hover:bg-cyan-500 text-black font-black shadow-[0_0_20px_rgba(6,182,212,0.4)]'
                }`}
              >
                {isRunning ? (
                  <>
                    <Pause className="w-4 h-4" />
                    <span>PAUSE (หยุดชั่วคราว)</span>
                  </>
                ) : (
                  <>
                    <Play className="w-4 h-4 fill-black" />
                    <span>START {mode === 'WORKOUT' ? 'SET' : 'REST'}</span>
                  </>
                )}
              </button>

              <button
                onClick={handleReset}
                className="py-3 bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-300 text-xs font-bold rounded flex items-center justify-center gap-1.5 transition-colors"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>RESET</span>
              </button>
            </div>

            {mode === 'REST' ? (
              <button
                onClick={handleSkipRest}
                className="w-full py-2.5 bg-slate-900 hover:bg-cyan-950 border border-slate-800 hover:border-cyan-500 text-cyan-300 text-xs font-bold rounded flex items-center justify-center gap-1.5 transition-colors"
              >
                <span>SKIP REST (เริ่มเซ็ตถัดไปทันที)</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            ) : (
              <button
                onClick={handleSetFinished}
                className="w-full py-2.5 bg-emerald-950/70 hover:bg-emerald-900 border border-emerald-500/50 text-emerald-300 text-xs font-bold rounded flex items-center justify-center gap-1.5 transition-colors"
              >
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>FINISH THIS SET (จบเซ็ตที่ {currentSet})</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
