import { Player, PlayerStats } from '../types.ts';
import { Shield, Zap, Flame, Award, Dumbbell, Activity, Heart, Brain, ChevronRight } from 'lucide-react';
import { motion } from 'motion/react';

interface PlayerStatusViewProps {
  player: Player;
}

export function PlayerStatusView({ player }: PlayerStatusViewProps) {
  const xpPercent = Math.min(100, Math.round((player.xp / player.currentLevelMaxXp) * 100));

  const statsMeta = [
    {
      key: 'STR' as keyof PlayerStats,
      label: 'STRENGTH',
      value: player.stats.STR,
      icon: Dumbbell,
      color: 'text-amber-400',
      barColor: 'from-amber-500 to-amber-400',
      description: 'Physical force output. Enhanced via Push-ups, Squats, Lunges, and Dips.'
    },
    {
      key: 'AGI' as keyof PlayerStats,
      label: 'AGILITY',
      value: player.stats.AGI,
      icon: Activity,
      color: 'text-cyan-400',
      barColor: 'from-cyan-500 to-cyan-400',
      description: 'Speed and kinetic coordination. Enhanced via Sprints, High Knees, and Boxing.'
    },
    {
      key: 'VIT' as keyof PlayerStats,
      label: 'VITALITY',
      value: player.stats.VIT,
      icon: Heart,
      color: 'text-emerald-400',
      barColor: 'from-emerald-500 to-emerald-400',
      description: 'Cardiovascular endurance & core resilience. Enhanced via Planks and Cardio.'
    },
    {
      key: 'INT' as keyof PlayerStats,
      label: 'DISCIPLINE / INT',
      value: player.stats.INT,
      icon: Brain,
      color: 'text-purple-400',
      barColor: 'from-purple-500 to-purple-400',
      description: 'Mental fortitude and habitual adherence. Enhanced via Consistency & Recovery.'
    }
  ];

  // Render ASCII block bar like specification (████████░░ 18)
  const renderAsciiBar = (val: number, maxVal = 30) => {
    const totalSlots = 12;
    const filled = Math.min(totalSlots, Math.round((val / maxVal) * totalSlots));
    const empty = Math.max(0, totalSlots - filled);
    return '█'.repeat(filled) + '░'.repeat(empty);
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Player Primary Identification Terminal */}
      <section className="bg-[#080d1a] border border-cyan-950 rounded-sm p-6 system-bracket shadow-[0_0_25px_rgba(0,0,0,0.5)]">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-cyan-950/70 pb-4">
          <div>
            <div className="text-[10px] text-slate-500 font-mono-system tracking-widest uppercase">
              BIOLOGICAL OPERATOR ID
            </div>
            <h2 className="text-xl sm:text-2xl font-black text-white font-mono-system tracking-wider uppercase">
              {player.displayName}
            </h2>
            <div className="text-xs text-slate-400 font-mono-system mt-0.5">
              REGISTERED: {new Date(player.createdAt).toLocaleDateString()}
            </div>
          </div>

          <div className="flex items-center gap-4">
            <div className="text-right font-mono-system">
              <div className="text-[10px] text-slate-500 uppercase">LEVEL</div>
              <div className="text-3xl font-black text-white">
                LV. {String(player.level).padStart(2, '0')}
              </div>
            </div>

            <div className="w-12 h-12 rounded-sm bg-cyan-950/60 border border-cyan-400/50 flex flex-col items-center justify-center font-mono-system shadow-[0_0_15px_rgba(56,189,248,0.3)]">
              <span className="text-[9px] text-cyan-400 font-bold">RANK</span>
              <span className="text-2xl font-black text-cyan-300 leading-none">
                {player.rank}
              </span>
            </div>
          </div>
        </div>

        {/* XP Progression Bar */}
        <div className="my-6">
          <div className="flex justify-between items-center text-xs font-mono-system mb-2">
            <span className="text-slate-400">ASCENSION PROGRESSION MATRIX</span>
            <span className="text-cyan-300 font-bold">
              {player.xp} / {player.currentLevelMaxXp} XP ({xpPercent}%)
            </span>
          </div>
          <div className="w-full h-3 bg-slate-950 rounded-xs border border-cyan-950 overflow-hidden">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${xpPercent}%` }}
              transition={{ duration: 0.8, ease: 'easeOut' }}
              className="h-full bg-gradient-to-r from-cyan-600 via-cyan-400 to-cyan-300"
            />
          </div>
        </div>

        {/* Quantitative Overview Chips */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 font-mono-system text-xs">
          <div className="p-3 bg-slate-950/80 border border-slate-900 rounded-sm flex items-center gap-3">
            <Flame className="w-5 h-5 text-amber-400 fill-amber-400/20" />
            <div>
              <div className="text-[10px] text-slate-500 uppercase">STREAK</div>
              <div className="text-base font-bold text-slate-200">{player.streak} DAYS</div>
            </div>
          </div>

          <div className="p-3 bg-slate-950/80 border border-slate-900 rounded-sm flex items-center gap-3">
            <Award className="w-5 h-5 text-cyan-400" />
            <div>
              <div className="text-[10px] text-slate-500 uppercase">QUESTS COMPLETED</div>
              <div className="text-base font-bold text-slate-200">{player.totalQuestCompleted} TOTAL</div>
            </div>
          </div>

          <div className="p-3 bg-slate-950/80 border border-slate-900 rounded-sm flex items-center gap-3 col-span-2 sm:col-span-1">
            <Zap className="w-5 h-5 text-emerald-400" />
            <div>
              <div className="text-[10px] text-slate-500 uppercase">WORKOUT MINUTES</div>
              <div className="text-base font-bold text-slate-200">{player.totalWorkoutMinutes} MIN</div>
            </div>
          </div>
        </div>
      </section>

      {/* Physiological Attributes (STR, AGI, VIT, INT) */}
      <section className="bg-[#070b14] border border-cyan-950 rounded-sm p-6 system-bracket">
        <div className="flex items-center gap-2 mb-4">
          <Shield className="w-4 h-4 text-cyan-400" />
          <h3 className="text-xs font-mono-system font-bold text-cyan-400 tracking-wider uppercase">
            PHYSIOLOGICAL ATTRIBUTES & SYSTEM CALIBRATION
          </h3>
        </div>

        <div className="space-y-4">
          {statsMeta.map((s) => {
            const Icon = s.icon;
            return (
              <div
                key={s.key}
                className="p-4 bg-slate-950/90 border border-slate-900 hover:border-cyan-950 rounded-sm transition-colors"
              >
                <div className="flex items-center justify-between font-mono-system mb-1">
                  <div className="flex items-center gap-2">
                    <Icon className={`w-4 h-4 ${s.color}`} />
                    <span className="font-bold text-slate-200 text-sm tracking-wide">{s.label}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-cyan-500/80 tracking-widest text-xs hidden sm:inline">
                      {renderAsciiBar(s.value, 30)}
                    </span>
                    <span className={`text-base font-black ${s.color}`}>
                      {String(s.value).padStart(2, '0')}
                    </span>
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

                <p className="text-xs text-slate-500 font-sans">{s.description}</p>
              </div>
            );
          })}
        </div>
      </section>

      {/* Rank Hierarchy Scale per Spec #7 */}
      <section className="bg-[#070b14] border border-cyan-950 rounded-sm p-5 system-bracket font-mono-system">
        <h3 className="text-xs font-bold text-slate-400 tracking-wider uppercase mb-3">
          RANK AUTHORIZATION PROTOCOL
        </h3>
        <div className="grid grid-cols-6 gap-2 text-center text-xs">
          {[
            { rank: 'E', lv: '1-10' },
            { rank: 'D', lv: '11-20' },
            { rank: 'C', lv: '21-30' },
            { rank: 'B', lv: '31-40' },
            { rank: 'A', lv: '41-50' },
            { rank: 'S', lv: '51+' }
          ].map((r) => {
            const isCurrent = player.rank === r.rank;
            return (
              <div
                key={r.rank}
                className={`py-2 px-1 rounded-sm border ${
                  isCurrent
                    ? 'bg-cyan-950/80 border-cyan-400 text-cyan-300 font-bold shadow-[0_0_10px_rgba(56,189,248,0.3)]'
                    : 'bg-slate-950/50 border-slate-900 text-slate-500'
                }`}
              >
                <div className="text-sm">{r.rank}</div>
                <div className="text-[10px] text-slate-500 mt-0.5">{r.lv}</div>
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}
