import { useState } from 'react';
import { Player, PlayerStats } from '../types.ts';
import { Shield, Dumbbell, Activity, Heart, Brain, PlusCircle, BatteryCharging, ChevronDown, ChevronUp, RefreshCw } from 'lucide-react';
import { motion } from 'motion/react';
import { playUiClick } from '../utils/audio.ts';

interface PlayerStatusViewProps {
  player: Player;
  onAllocateStat?: (stat: 'STR' | 'AGI' | 'VIT' | 'INT') => void;
  onResetDemo?: (mode?: 'demo' | 'new') => void;
}

export function PlayerStatusView({ player, onAllocateStat, onResetDemo }: PlayerStatusViewProps) {
  const [showRankDetails, setShowRankDetails] = useState(false);

  const xpPercent = Math.min(100, Math.round((player.xp / player.currentLevelMaxXp) * 100));

  const maxHp = player.maxHp || (100 + (player.stats.VIT || 5) * 10);
  const currentHp = player.hp ?? maxHp;
  const hpPercent = Math.min(100, Math.max(0, Math.round((currentHp / maxHp) * 100)));

  const maxStamina = player.maxStamina || (100 + (player.stats.AGI || 5) * 5);
  const currentStamina = player.stamina ?? maxStamina;
  const staminaPercent = Math.min(100, Math.max(0, Math.round((currentStamina / maxStamina) * 100)));

  const statsMeta = [
    {
      key: 'STR' as keyof PlayerStats,
      label: 'STRENGTH (STR)',
      value: player.stats.STR,
      icon: Dumbbell,
      color: 'text-amber-400',
      barColor: 'from-amber-500 to-amber-400',
      effect: `+${(player.stats.STR * 2.5).toFixed(1)}% EXP จากเวิร์กเอาต์`,
      description: 'พลังกล้ามเนื้อ เพิ่มผ่าน Push-ups, Squats, Lunges'
    },
    {
      key: 'AGI' as keyof PlayerStats,
      label: 'AGILITY (AGI)',
      value: player.stats.AGI,
      icon: Activity,
      color: 'text-cyan-400',
      barColor: 'from-cyan-500 to-cyan-400',
      effect: `+${(player.stats.AGI * 0.1).toFixed(1)} HP / 200 ก้าว`,
      description: 'ความคล่องตัว เพิ่มผ่าน Sprints, High Knees'
    },
    {
      key: 'VIT' as keyof PlayerStats,
      label: 'VITALITY (VIT)',
      value: player.stats.VIT,
      icon: Heart,
      color: 'text-emerald-400',
      barColor: 'from-emerald-500 to-emerald-400',
      effect: `+${player.stats.VIT * 10} Max HP (ทนต่อการลด HP)`,
      description: 'ความอึดของร่างกาย เพิ่มผ่าน Planks, Cardio'
    },
    {
      key: 'INT' as keyof PlayerStats,
      label: 'DISCIPLINE (INT)',
      value: player.stats.INT,
      icon: Brain,
      color: 'text-purple-400',
      barColor: 'from-purple-500 to-purple-400',
      effect: 'สมาธิและวินัยการรักษาวงรอบการฝึก',
      description: 'ความสม่ำเสมอ เพิ่มผ่านการทำเควสต่อเนื่อง'
    }
  ];

  return (
    <div className="space-y-4 pb-12 font-sans">
      {/* 1. Header Profile & Rank */}
      <section className="bg-[#080d1a] border border-cyan-950/80 rounded-sm p-5 system-bracket shadow-lg">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-cyan-950/60 pb-4">
          <div>
            <div className="text-[10px] text-slate-500 font-mono-system tracking-widest uppercase">
              OPERATOR IDENTIFICATION
            </div>
            <h2 className="text-xl sm:text-2xl font-black text-white font-mono-system tracking-wide uppercase">
              {player.displayName}
            </h2>
            <div className="flex flex-wrap items-center gap-3 text-xs text-slate-400 font-mono-system mt-1">
              <span>เป้าหมาย: <strong className="text-slate-200">{player.fitnessGoal || 'General Fitness'}</strong></span>
              {player.weightKg && <span>• {player.weightKg} KG</span>}
              {player.heightCm && <span>• {player.heightCm} CM</span>}
              {player.lineUserId && (
                <span className="text-emerald-400 font-semibold flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                  LINE LINKED
                </span>
              )}
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="text-right font-mono-system">
              <div className="text-[10px] text-slate-500 uppercase">LEVEL</div>
              <div className="text-3xl font-black text-white">
                LV.{String(player.level).padStart(2, '0')}
              </div>
            </div>

            <div className="w-12 h-12 rounded bg-cyan-950/80 border border-cyan-400/60 flex flex-col items-center justify-center font-mono-system shadow-[0_0_15px_rgba(56,189,248,0.3)]">
              <span className="text-[9px] text-cyan-400 font-bold">RANK</span>
              <span className="text-2xl font-black text-cyan-300 leading-none">
                {player.rank}
              </span>
            </div>
          </div>
        </div>

        {/* EXP Progression */}
        <div className="my-4">
          <div className="flex justify-between items-center text-xs font-mono-system mb-1.5">
            <span className="text-slate-400">EXPERIENCE MATRIX</span>
            <span className="text-cyan-300 font-bold">
              {player.xp} / {player.currentLevelMaxXp} XP ({xpPercent}%)
            </span>
          </div>
          <div className="w-full h-2.5 bg-black rounded-xs border border-cyan-950 overflow-hidden">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${xpPercent}%` }}
              transition={{ duration: 0.8, ease: 'easeOut' }}
              className="h-full bg-gradient-to-r from-cyan-600 via-cyan-400 to-cyan-300"
            />
          </div>
        </div>

        {/* HP & Stamina Vitals */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-3 border-t border-slate-900 font-mono-system text-xs">
          <div className="p-3 bg-slate-950/80 border border-rose-950 rounded">
            <div className="flex items-center justify-between text-xs mb-1">
              <span className="flex items-center gap-1.5 text-rose-400 font-bold">
                <Heart className="w-3.5 h-3.5 fill-rose-500/30 text-rose-500 animate-pulse" />
                HP (HEALTH)
              </span>
              <span className="text-rose-300 font-bold">
                {currentHp} / {maxHp} ({hpPercent}%)
              </span>
            </div>
            <div className="w-full h-2 bg-black rounded-xs border border-rose-900/60 overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-rose-700 via-rose-500 to-red-400"
                style={{ width: `${hpPercent}%` }}
              />
            </div>
            <div className="text-[10px] text-slate-500 mt-1">
              Max HP = 100 + (VIT × 10) | ลด -5 HP/ชม. เมื่อไม่ออกกำลัง
            </div>
          </div>

          <div className="p-3 bg-slate-950/80 border border-cyan-950 rounded">
            <div className="flex items-center justify-between text-xs mb-1">
              <span className="flex items-center gap-1.5 text-cyan-400 font-bold">
                <BatteryCharging className="w-3.5 h-3.5 text-cyan-400" />
                STAMINA (MP)
              </span>
              <span className="text-cyan-300 font-bold">
                {currentStamina} / {maxStamina} ({staminaPercent}%)
              </span>
            </div>
            <div className="w-full h-2 bg-black rounded-xs border border-cyan-900/60 overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-blue-600 via-cyan-500 to-cyan-300"
                style={{ width: `${staminaPercent}%` }}
              />
            </div>
            <div className="text-[10px] text-slate-500 mt-1">
              ฟื้นฟูตามเวลาและการพักผ่อน (Rest Day)
            </div>
          </div>
        </div>
      </section>

      {/* 2. Stat Points Allocation Banner (Prominent only when available) */}
      {player.statPoints > 0 && (
        <section className="bg-[#0b162c] border-2 border-cyan-400/80 rounded-sm p-3.5 shadow-[0_0_20px_rgba(56,189,248,0.25)] flex items-center justify-between gap-3 animate-pulse">
          <div className="flex items-center gap-2.5">
            <PlusCircle className="w-5 h-5 text-cyan-300 shrink-0" />
            <div className="text-xs font-mono-system">
              <span className="font-bold text-cyan-300 block">
                [ คุณมี {player.statPoints} แต้ม STAT POINTS ที่ยังไม่ได้จัดสรร ]
              </span>
              <span className="text-slate-300 text-[11px]">
                กดปุ่ม "+1 ALLOCATE" บนค่าพลังที่ต้องการด้านล่างเพื่ออัปเกรด
              </span>
            </div>
          </div>
          <span className="text-xs font-mono-system font-black px-2.5 py-1 rounded bg-cyan-400 text-slate-950 shrink-0">
            {player.statPoints} PTS
          </span>
        </section>
      )}

      {/* 3. Sleek 2x2 Grid for 4 Core Stats */}
      <section className="bg-[#070b14] border border-cyan-950/80 rounded-sm p-4 system-bracket">
        <div className="flex items-center justify-between mb-3 border-b border-cyan-950/60 pb-2">
          <div className="flex items-center gap-1.5">
            <Shield className="w-4 h-4 text-cyan-400" />
            <h3 className="text-xs font-mono-system font-bold text-cyan-400 tracking-wider uppercase">
              PHYSIOLOGICAL ATTRIBUTES
            </h3>
          </div>
          <span className="text-[11px] font-mono-system text-slate-500">
            BASE 4-PILLAR ATTRIBUTES
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {statsMeta.map((s) => {
            const Icon = s.icon;
            return (
              <div
                key={s.key}
                className="p-3.5 bg-slate-950/90 border border-slate-900 hover:border-cyan-900/60 rounded-sm transition-all flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between font-mono-system mb-1.5">
                    <div className="flex items-center gap-2">
                      <Icon className={`w-4 h-4 ${s.color}`} />
                      <span className="font-bold text-slate-200 text-xs tracking-wide">
                        {s.label}
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      <span className={`text-lg font-black ${s.color}`}>
                        {String(s.value).padStart(2, '0')}
                      </span>
                      {player.statPoints > 0 && onAllocateStat && (
                        <button
                          onClick={() => {
                            playUiClick();
                            onAllocateStat(s.key as any);
                          }}
                          className="px-2 py-0.5 rounded bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-mono-system text-[11px] font-black uppercase transition-all shadow-[0_0_8px_rgba(56,189,248,0.4)]"
                        >
                          +1
                        </button>
                      )}
                    </div>
                  </div>

                  <div className="w-full h-1.5 bg-slate-900 rounded-xs overflow-hidden my-2">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${Math.min(100, (s.value / 30) * 100)}%` }}
                      transition={{ duration: 0.6, ease: 'easeOut' }}
                      className={`h-full bg-gradient-to-r ${s.barColor}`}
                    />
                  </div>
                </div>

                <div className="pt-1">
                  <div className="text-[11px] font-mono-system text-cyan-400/90 font-medium">
                    {s.effect}
                  </div>
                  <div className="text-[10px] text-slate-500 mt-0.5 font-sans">
                    {s.description}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* 4. Collapsible Rank Hierarchy */}
      <section className="bg-[#070b14] border border-slate-900 rounded-sm p-3.5 font-mono-system text-xs">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-slate-400">
            <span className="text-[11px] font-bold text-slate-300 uppercase">
              RANK AUTHORIZATION SCALE (E → S)
            </span>
          </div>
          <button
            onClick={() => {
              playUiClick();
              setShowRankDetails(!showRankDetails);
            }}
            className="text-[11px] text-cyan-400 hover:text-cyan-300 flex items-center gap-1 transition-colors"
          >
            <span>{showRankDetails ? 'ซ่อน' : 'ดูเกณฑ์ Rank'}</span>
            {showRankDetails ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          </button>
        </div>

        {showRankDetails && (
          <div className="mt-3 pt-3 border-t border-slate-900 grid grid-cols-3 sm:grid-cols-6 gap-2 text-center text-xs animate-in fade-in duration-200">
            {[
              { rank: 'E', lv: 'LV.01-04', label: 'Awakened' },
              { rank: 'D', lv: 'LV.05-09', label: 'Cadet' },
              { rank: 'C', lv: 'LV.10-14', label: 'Operator' },
              { rank: 'B', lv: 'LV.15-19', label: 'Elite' },
              { rank: 'A', lv: 'LV.20-24', label: 'Master' },
              { rank: 'S', lv: 'LV.25+', label: 'Monarch' }
            ].map((r) => {
              const isCurrent = player.rank === r.rank;
              return (
                <div
                  key={r.rank}
                  className={`p-2 rounded border ${
                    isCurrent
                      ? 'bg-cyan-950/70 border-cyan-400 text-cyan-300 font-bold shadow-[0_0_10px_rgba(56,189,248,0.3)]'
                      : 'bg-slate-950/60 border-slate-900 text-slate-500'
                  }`}
                >
                  <div className="text-sm font-black">RANK {r.rank}</div>
                  <div className="text-[10px] mt-0.5">{r.lv}</div>
                  <div className="text-[9px] uppercase tracking-wider mt-0.5 text-slate-400">
                    {r.label}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* Quick Reset Option for Sandbox Testing */}
      {onResetDemo && (
        <section className="flex flex-wrap items-center justify-between gap-2 p-3 bg-[#060a14] border border-slate-900 rounded-sm font-mono-system text-xs text-slate-400">
          <div className="flex items-center gap-2">
            <RefreshCw className="w-3.5 h-3.5 text-cyan-400" />
            <span>ต้องการรีเซ็ตค่าสเตตัส / ความคืบหน้ากลับสู่ค่าเริ่มต้น?</span>
          </div>
          <button
            onClick={() => {
              playUiClick();
              onResetDemo('demo');
            }}
            className="px-2.5 py-1 rounded bg-slate-900 hover:bg-slate-800 border border-slate-700 hover:border-cyan-500/50 text-cyan-300 transition-colors"
          >
            RESET DEMO
          </button>
        </section>
      )}
    </div>
  );
}
