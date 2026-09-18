import { SystemEvent, WorkoutLog } from '../types.ts';
import { Clock, CheckCircle, AlertCircle, ArrowUpRight, Zap, Shield, Flame } from 'lucide-react';

interface HistoryViewProps {
  events: SystemEvent[];
  workouts: WorkoutLog[];
}

export function HistoryView({ events, workouts }: HistoryViewProps) {
  // Helper to format timestamps into relative group: TODAY, YESTERDAY, EARLIER
  const getRelativeGroup = (dateStr: string) => {
    const d = new Date(dateStr);
    const now = new Date();
    const diffDays = Math.floor((now.getTime() - d.getTime()) / 86400000);
    if (diffDays === 0) return 'TODAY';
    if (diffDays === 1) return 'YESTERDAY';
    return d.toLocaleDateString();
  };

  // Group events by day
  const groupedEvents: Record<string, SystemEvent[]> = {};
  events.forEach((evt) => {
    const group = getRelativeGroup(evt.timestamp);
    if (!groupedEvents[group]) groupedEvents[group] = [];
    groupedEvents[group].push(evt);
  });

  return (
    <div className="space-y-6 pb-12">
      <div className="flex items-center justify-between border-b border-cyan-950 pb-3">
        <div className="flex items-center gap-2">
          <Clock className="w-4 h-4 text-cyan-400" />
          <h2 className="text-xs font-mono-system font-bold text-slate-200 uppercase tracking-widest">
            ASCENSION EVENT LOG & TIMELINE
          </h2>
        </div>
        <span className="text-[11px] font-mono-system text-slate-500">
          IMMUTABLE SYSTEM RECORD
        </span>
      </div>

      {/* Events Timeline */}
      <div className="space-y-6">
        {Object.entries(groupedEvents).map(([group, dayEvents]) => (
          <div key={group} className="space-y-3">
            {/* Timeline Day Header */}
            <div className="flex items-center gap-3">
              <span className="text-xs font-mono-system font-extrabold text-cyan-400 tracking-wider">
                {group}
              </span>
              <div className="flex-1 h-[1px] bg-gradient-to-r from-cyan-950 to-transparent" />
            </div>

            {/* Event Items */}
            <div className="space-y-2.5 pl-2 border-l border-cyan-950/60">
              {dayEvents.map((evt) => {
                const isLevelUp = evt.type === 'LEVEL_UP';
                const isRankUp = evt.type === 'RANK_UP';
                const isExpired = evt.type === 'QUEST_EXPIRED' || evt.type === 'PENALTY_CREATED';
                const isCompleted = evt.type === 'QUEST_COMPLETED';

                return (
                  <div
                    key={evt.id}
                    className={`p-3 rounded-sm border font-mono-system text-xs transition-colors ${
                      isLevelUp
                        ? 'bg-cyan-950/40 border-cyan-400/60 text-white'
                        : isRankUp
                        ? 'bg-amber-950/40 border-amber-500/50 text-amber-200'
                        : isExpired
                        ? 'bg-rose-950/30 border-rose-900/50 text-rose-300'
                        : isCompleted
                        ? 'bg-slate-950/80 border-slate-900 text-slate-200 hover:border-cyan-950'
                        : 'bg-slate-950/50 border-slate-900/60 text-slate-400'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2 font-bold">
                        {isLevelUp && <ArrowUpRight className="w-3.5 h-3.5 text-cyan-400" />}
                        {isRankUp && <Zap className="w-3.5 h-3.5 text-amber-400" />}
                        {isExpired && <AlertCircle className="w-3.5 h-3.5 text-rose-400" />}
                        {isCompleted && <CheckCircle className="w-3.5 h-3.5 text-emerald-400" />}
                        <span className="tracking-wide uppercase">{evt.title}</span>
                      </div>

                      {evt.xpChange && (
                        <span className="px-2 py-0.5 rounded bg-cyan-950 border border-cyan-500/30 text-cyan-300 font-bold">
                          +{evt.xpChange} XP
                        </span>
                      )}
                    </div>

                    <p className="text-slate-400 text-[11px] font-sans mt-1">
                      {evt.description}
                    </p>

                    <div className="flex items-center justify-between mt-2 pt-2 border-t border-slate-900/80 text-[10px] text-slate-500">
                      <span>TYPE: {evt.type}</span>
                      <span>{new Date(evt.timestamp).toLocaleTimeString()}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {/* Workout Sessions Summary Log */}
      <section className="mt-8 pt-6 border-t border-cyan-950">
        <h3 className="text-xs font-mono-system font-bold text-slate-400 uppercase tracking-wider mb-3">
          WORKOUT PROTOCOL SESSIONS ({workouts.length})
        </h3>
        <div className="space-y-2">
          {workouts.map((w) => (
            <div
              key={w.id}
              className="p-3 bg-slate-950 border border-slate-900 rounded-sm flex items-center justify-between text-xs font-mono-system"
            >
              <div>
                <div className="font-bold text-slate-200">{w.title}</div>
                <div className="text-[11px] text-slate-500 mt-0.5">
                  {new Date(w.date).toLocaleString()} • Via {w.source} Interface
                </div>
              </div>
              <div className="text-right">
                <span className="text-cyan-400 font-bold">+{w.xpEarned} XP</span>
                <div className="text-[10px] text-slate-500">{w.durationMinutes} MIN</div>
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
