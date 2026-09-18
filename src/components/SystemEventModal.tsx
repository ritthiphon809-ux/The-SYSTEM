import { motion, AnimatePresence } from 'motion/react';
import { ShieldCheck, AlertTriangle, ArrowUpRight, Zap, Check, X } from 'lucide-react';
import { playUiClick } from '../utils/audio.ts';

interface ConfirmationModalProps {
  isOpen: boolean;
  title: string;
  message: string;
  questTitle?: string;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmationModal({
  isOpen,
  title,
  message,
  questTitle,
  onConfirm,
  onCancel
}: ConfirmationModalProps) {
  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95 }}
          className="w-full max-w-md bg-[#090e18] border border-cyan-500/40 rounded-sm shadow-[0_0_30px_rgba(14,165,233,0.2)] p-6 system-bracket"
        >
          <div className="flex items-center gap-2 text-cyan-400 font-mono-system text-xs tracking-widest uppercase mb-2">
            <ShieldCheck className="w-4 h-4" />
            <span>[ SYSTEM CONFIRMATION PROTOCOL ]</span>
          </div>

          <h3 className="text-xl font-bold tracking-wider text-slate-100 uppercase mb-2">
            {title}
          </h3>

          {questTitle && (
            <div className="p-3 bg-slate-900/90 border border-slate-800 rounded text-sm text-cyan-300 font-mono-system mb-3">
              TARGET: {questTitle}
            </div>
          )}

          <p className="text-slate-300 text-sm mb-6 leading-relaxed">
            {message}
          </p>

          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={() => {
                playUiClick();
                onCancel();
              }}
              className="flex items-center justify-center gap-2 py-2.5 px-4 rounded border border-slate-700 bg-slate-900 hover:bg-slate-800 text-slate-300 font-mono-system text-xs uppercase tracking-wider transition-colors"
            >
              <X className="w-4 h-4" />
              <span>CANCEL</span>
            </button>
            <button
              onClick={() => {
                playUiClick();
                onConfirm();
              }}
              className="flex items-center justify-center gap-2 py-2.5 px-4 rounded border border-cyan-400 bg-cyan-600 hover:bg-cyan-500 text-slate-950 font-bold font-mono-system text-xs uppercase tracking-wider transition-colors shadow-[0_0_15px_rgba(56,189,248,0.4)]"
            >
              <Check className="w-4 h-4 text-slate-950 stroke-[3]" />
              <span>CONFIRM</span>
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}

interface LevelUpModalProps {
  isOpen: boolean;
  oldLevel: number;
  newLevel: number;
  oldRank: string;
  newRank: string;
  onClose: () => void;
}

export function LevelUpModal({
  isOpen,
  oldLevel,
  newLevel,
  oldRank,
  newRank,
  onClose
}: LevelUpModalProps) {
  if (!isOpen) return null;

  const isRankUp = newRank !== oldRank;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md">
        <motion.div
          initial={{ opacity: 0, scale: 0.9, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.9 }}
          transition={{ type: 'spring', damping: 25, stiffness: 300 }}
          className="w-full max-w-sm bg-[#060a12] border-2 border-cyan-400 rounded-sm p-6 text-center shadow-[0_0_40px_rgba(56,189,248,0.35)] relative overflow-hidden"
        >
          {/* Subtle Cyber scanline effect */}
          <div className="absolute inset-0 pointer-events-none bg-gradient-to-b from-transparent via-cyan-500/5 to-transparent animate-pulse" />

          <div className="inline-block px-3 py-1 rounded bg-cyan-950/80 border border-cyan-500/40 text-cyan-400 text-xs font-mono-system tracking-widest uppercase mb-4">
            [ SYSTEM EVENT ]
          </div>

          <h2 className="text-3xl font-extrabold text-white tracking-widest uppercase mb-1">
            LEVEL UP
          </h2>

          <div className="my-6 py-4 px-3 bg-slate-950/80 border border-cyan-950 rounded flex items-center justify-center gap-4">
            <div className="text-left font-mono-system">
              <div className="text-[10px] text-slate-500">PREVIOUS</div>
              <div className="text-xl font-bold text-slate-400">LV. {String(oldLevel).padStart(2, '0')}</div>
              <div className="text-xs text-slate-400">RANK {oldRank}</div>
            </div>

            <div className="w-8 h-8 rounded-full bg-cyan-950 border border-cyan-500/50 flex items-center justify-center text-cyan-400 animate-bounce">
              <ArrowUpRight className="w-5 h-5" />
            </div>

            <div className="text-left font-mono-system">
              <div className="text-[10px] text-cyan-400">ASCENDED</div>
              <div className="text-2xl font-black text-cyan-300 drop-shadow-[0_0_10px_rgba(56,189,248,0.5)]">
                LV. {String(newLevel).padStart(2, '0')}
              </div>
              <div className="text-xs font-bold text-cyan-400">RANK {newRank}</div>
            </div>
          </div>

          {isRankUp && (
            <div className="mb-4 py-2 px-3 bg-amber-950/40 border border-amber-500/40 rounded text-amber-300 text-xs font-mono-system flex items-center justify-center gap-2">
              <Zap className="w-4 h-4 text-amber-400" />
              <span>RANK ASCENSION: RANK {newRank}</span>
            </div>
          )}

          <p className="text-slate-300 text-sm font-sans tracking-wide mb-6">
            Your body has become stronger. +3 Stat Points acquired.
          </p>

          <button
            onClick={() => {
              playUiClick();
              onClose();
            }}
            className="w-full py-3 px-4 rounded bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold font-mono-system text-xs uppercase tracking-widest transition-colors shadow-[0_0_20px_rgba(56,189,248,0.4)]"
          >
            ACKNOWLEDGE DIRECTIVE
          </button>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}

// -------------------------------------------------------------
// PENALTY ZONE: HP = 0 FULL-SCREEN CRISIS LOCKDOWN
// -------------------------------------------------------------
interface PenaltyZoneModalProps {
  isOpen: boolean;
  onSurvive: () => void;
}

export function PenaltyZoneModal({ isOpen, onSurvive }: PenaltyZoneModalProps) {
  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-rose-950/80 backdrop-blur-md">
        {/* Flashing Red Vignette / Pulse Effect */}
        <div className="fixed inset-0 pointer-events-none border-8 border-rose-600/60 animate-pulse" />

        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.9 }}
          transition={{ type: 'spring', damping: 20, stiffness: 260 }}
          className="w-full max-w-lg bg-[#0e0407] border-2 border-rose-600 rounded-sm p-6 text-center shadow-[0_0_60px_rgba(225,29,72,0.6)] relative overflow-hidden"
        >
          {/* Scanning Hazard Grid */}
          <div className="absolute inset-0 pointer-events-none bg-gradient-to-b from-transparent via-rose-500/10 to-transparent animate-pulse" />

          <div className="inline-flex items-center gap-2 px-3 py-1 rounded bg-rose-950 border border-rose-600/70 text-rose-300 text-xs font-mono-system tracking-widest uppercase mb-4 animate-bounce">
            <AlertTriangle className="w-4 h-4 text-rose-400" />
            <span>[ SYSTEM CRITICAL: HP DEPLETED ]</span>
          </div>

          <h2 className="text-3xl sm:text-4xl font-black text-rose-500 tracking-wider uppercase mb-2 drop-shadow-[0_0_20px_rgba(244,63,94,0.7)]">
            PENALTY ZONE
          </h2>

          <p className="text-xs font-mono-system text-rose-300/80 tracking-widest uppercase mb-4">
            SURVIVAL PROTOCOL ACTIVATED // BIOLOGICAL STASIS IMMINENT
          </p>

          <div className="p-4 bg-black/80 border border-rose-900 rounded text-left font-mono-system text-xs text-rose-200 mb-6 space-y-2">
            <div className="text-rose-400 font-bold border-b border-rose-950 pb-1">
              [ DIRECTIVE: SURVIVE THE CENTIPEDES ]
            </div>
            <p className="leading-relaxed">
              Your Health Points reached 0 due to biological inactivity. You have been transported to the Penalty Zone.
            </p>
            <div className="p-2.5 bg-rose-950/50 border border-rose-900/60 rounded text-rose-100 font-semibold">
              MANDATORY REQUIREMENT: Complete 50 Push-ups, 100 Squats, or 5 minutes of high-intensity survival movement to restart cellular vitality.
            </div>
          </div>

          <div className="space-y-3">
            <button
              onClick={() => {
                playUiClick();
                onSurvive();
              }}
              className="w-full py-3.5 px-4 rounded bg-rose-600 hover:bg-rose-500 text-white font-black font-mono-system text-xs uppercase tracking-widest transition-all shadow-[0_0_25px_rgba(225,29,72,0.8)] flex items-center justify-center gap-2"
            >
              <Zap className="w-4 h-4" />
              <span>EXECUTE SURVIVAL PROTOCOL & REVIVE (100% HP)</span>
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}

// -------------------------------------------------------------
// EMERGENCY QUEST POPUP (SOLO LEVELING SIGNATURE ALERT)
// -------------------------------------------------------------
interface EmergencyQuestModalProps {
  isOpen: boolean;
  onAccept: () => void;
  onSimulateComplete: () => void;
  onClose: () => void;
}

export function EmergencyQuestModal({
  isOpen,
  onAccept,
  onSimulateComplete,
  onClose
}: EmergencyQuestModalProps) {
  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
        <motion.div
          initial={{ opacity: 0, scale: 0.88, y: -20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.9 }}
          transition={{ type: 'spring', damping: 20, stiffness: 280 }}
          className="w-full max-w-md bg-[#050914] border-2 border-cyan-400 rounded-sm p-6 text-center shadow-[0_0_50px_rgba(56,189,248,0.4)] relative overflow-hidden system-bracket"
        >
          {/* Holographic Header Bar */}
          <div className="inline-block px-3 py-1 rounded bg-cyan-950 border border-cyan-400 text-cyan-300 text-xs font-mono-system tracking-widest uppercase mb-3 animate-pulse">
            [ The System has assigned an Emergency Quest. ]
          </div>

          <h2 className="text-2xl font-black text-white tracking-widest uppercase mb-1 drop-shadow-[0_0_15px_rgba(56,189,248,0.5)]">
            EMERGENCY QUEST
          </h2>

          <div className="text-xs font-mono-system text-cyan-400 mb-4 tracking-wider">
            SURVIVAL SPRINT // 10-MINUTE TIME LIMIT
          </div>

          <div className="p-4 bg-slate-950/90 border border-cyan-950 rounded text-left font-mono-system text-xs mb-5 space-y-2">
            <div className="flex justify-between text-slate-400">
              <span>TARGET OBJECTIVE:</span>
              <span className="text-cyan-300 font-bold">500 STEPS</span>
            </div>
            <div className="flex justify-between text-slate-400">
              <span>PENALTY FOR FAILURE:</span>
              <span className="text-rose-400 font-bold">PENALTY ZONE LOCKDOWN</span>
            </div>
            <div className="flex justify-between text-slate-400">
              <span>REWARDS:</span>
              <span className="text-emerald-400 font-bold">+120 XP | +2 AGI | +1 VIT</span>
            </div>
            <p className="pt-2 text-[11px] text-slate-400 border-t border-slate-900">
              Critical inactivity detected. Stand up and commence forward kinetic motion immediately.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={() => {
                playUiClick();
                onAccept();
              }}
              className="py-2.5 px-3 rounded border border-cyan-500/50 bg-cyan-950/70 hover:bg-cyan-900/60 text-cyan-300 font-mono-system text-xs uppercase tracking-wider font-bold transition-colors"
            >
              ACCEPT QUEST
            </button>
            <button
              onClick={() => {
                playUiClick();
                onSimulateComplete();
              }}
              className="py-2.5 px-3 rounded border border-cyan-400 bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-mono-system text-xs uppercase tracking-wider font-black transition-all shadow-[0_0_20px_rgba(56,189,248,0.4)]"
            >
              COMPLETE (500 STEPS)
            </button>
          </div>

          <button
            onClick={() => {
              playUiClick();
              onClose();
            }}
            className="mt-3 text-[11px] font-mono-system text-slate-500 hover:text-slate-300 transition-colors"
          >
            DISMISS ALERT
          </button>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
