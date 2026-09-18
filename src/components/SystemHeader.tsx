import { useState, useEffect } from 'react';
import { Volume2, VolumeX, ShieldAlert, Cpu, Terminal, RefreshCw } from 'lucide-react';
import { toggleAudio, isAudioEnabled, playUiClick } from '../utils/audio.ts';
import { Player } from '../types.ts';

interface SystemHeaderProps {
  player: Player;
  onResetDemo: (mode?: 'demo' | 'new') => void;
  onOpenHunterProfile?: () => void;
}

export function SystemHeader({ player, onResetDemo, onOpenHunterProfile }: SystemHeaderProps) {
  const [audioOn, setAudioOn] = useState(true);
  const [time, setTime] = useState('');

  useEffect(() => {
    setAudioOn(isAudioEnabled());
    const updateTime = () => {
      const now = new Date();
      setTime(now.toTimeString().split(' ')[0]);
    };
    updateTime();
    const timer = setInterval(updateTime, 1000);
    return () => clearInterval(timer);
  }, []);

  const handleAudioToggle = () => {
    const next = toggleAudio();
    setAudioOn(next);
    if (next) playUiClick();
  };

  return (
    <header className="border-b border-cyan-950/60 bg-[#05070a]/90 backdrop-blur-md sticky top-0 z-40 px-4 py-3">
      <div className="max-w-4xl mx-auto flex items-center justify-between">
        {/* Left: Brand / System Status */}
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-sm bg-cyan-950/40 border border-cyan-500/40 flex items-center justify-center text-cyan-400 shadow-[0_0_10px_rgba(56,189,248,0.2)]">
            <Cpu className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-base font-bold tracking-widest text-slate-100 uppercase">
                THE SYSTEM
              </h1>
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-cyan-950/80 border border-cyan-500/30 text-cyan-400 font-mono-system tracking-wider">
                V1.0 MVP
              </span>
            </div>
            <div className="flex items-center gap-1.5 text-[11px] text-slate-400 font-mono-system">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
              <span>SYSTEM ONLINE</span>
              <span className="text-slate-600">|</span>
              <span className="text-slate-400">{time}</span>
            </div>
          </div>
        </div>

        {/* Right Controls: Audio toggle, Hunter Awakening button & Demo indicator */}
        <div className="flex items-center gap-2">
          {onOpenHunterProfile && (
            <button
              onClick={() => {
                playUiClick();
                onOpenHunterProfile();
              }}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded bg-cyan-950/80 hover:bg-cyan-900 border border-cyan-500/50 text-[11px] font-mono-system text-cyan-300 transition-all shadow-[0_0_10px_rgba(56,189,248,0.2)]"
              title="Hunter Profile & LINE Connection"
            >
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
              <span className="font-bold truncate max-w-[90px] sm:max-w-[130px]">
                {player.displayName || 'AWAKEN HUNTER'}
              </span>
            </button>
          )}

          <button
            onClick={() => {
              playUiClick();
              onResetDemo('demo');
            }}
            title="รีเซ็ตข้อมูลตัวละครและเควสต์ (Reset Demo State)"
            className="flex items-center gap-1.5 px-2 py-1 rounded bg-slate-900/90 border border-slate-750 hover:border-cyan-500/60 text-[11px] font-mono-system text-slate-300 hover:text-cyan-300 transition-colors"
          >
            <RefreshCw className="w-3.5 h-3.5 text-cyan-400" />
            <span className="hidden sm:inline">RESET</span>
          </button>

          <button
            onClick={handleAudioToggle}
            className="w-8 h-8 rounded border border-slate-800 bg-slate-900/80 hover:bg-slate-800 text-slate-300 hover:text-cyan-400 flex items-center justify-center transition-colors"
            aria-label="Toggle Sound Effects"
            title={audioOn ? 'Mute System Sounds' : 'Unmute System Sounds'}
          >
            {audioOn ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4 text-slate-500" />}
          </button>
        </div>
      </div>
    </header>
  );
}
