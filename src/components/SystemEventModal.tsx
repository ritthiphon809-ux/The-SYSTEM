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
            Your body has become stronger.
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
