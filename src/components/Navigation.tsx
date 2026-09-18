import { Home, Crosshair, Activity, Clock, Settings } from 'lucide-react';
import { playUiClick } from '../utils/audio.ts';

export type NavTab = 'home' | 'quest' | 'status' | 'history' | 'settings';

interface NavigationProps {
  currentTab: NavTab;
  onSelectTab: (tab: NavTab) => void;
  questStatus?: string;
}

interface TabItem {
  id: NavTab;
  label: string;
  icon: any;
  badge?: string | null;
}

export function Navigation({ currentTab, onSelectTab, questStatus }: NavigationProps) {
  const tabs: TabItem[] = [
    { id: 'home', label: 'HOME', icon: Home },
    {
      id: 'quest',
      label: 'QUEST',
      icon: Crosshair,
      badge: questStatus === 'AVAILABLE' ? '1' : questStatus === 'IN_PROGRESS' ? '•' : null
    },
    { id: 'status', label: 'STATUS', icon: Activity },
    { id: 'history', label: 'HISTORY', icon: Clock },
    { id: 'settings', label: 'SETTINGS', icon: Settings }
  ];

  const handleTabClick = (tabId: NavTab) => {
    playUiClick();
    onSelectTab(tabId);
  };

  return (
    <>
      {/* Desktop Navigation Header Bar */}
      <nav className="hidden sm:block border-b border-slate-800/80 bg-[#070b12]/80 backdrop-blur-sm sticky top-[61px] z-30">
        <div className="max-w-4xl mx-auto flex items-center gap-1 px-4 py-1.5">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = currentTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => handleTabClick(tab.id)}
                className={`relative flex items-center gap-2 px-4 py-2 rounded-sm text-xs font-mono-system font-medium tracking-wider transition-all ${
                  isActive
                    ? 'bg-cyan-950/60 text-cyan-300 border-b-2 border-cyan-400'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/50'
                }`}
              >
                <Icon className={`w-3.5 h-3.5 ${isActive ? 'text-cyan-400' : 'text-slate-500'}`} />
                <span>{tab.label}</span>
                {tab.badge && (
                  <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-ping"></span>
                )}
              </button>
            );
          })}
        </div>
      </nav>

      {/* Mobile Sticky Bottom Navigation Bar */}
      <nav className="sm:hidden fixed bottom-0 left-0 right-0 z-40 bg-[#05070a]/95 border-t border-cyan-950/60 backdrop-blur-lg px-2 py-2 safe-area-bottom">
        <div className="grid grid-cols-5 gap-1">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = currentTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => handleTabClick(tab.id)}
                className={`flex flex-col items-center justify-center py-1.5 px-1 rounded transition-colors ${
                  isActive
                    ? 'text-cyan-400 bg-cyan-950/30'
                    : 'text-slate-400 hover:text-slate-300'
                }`}
              >
                <div className="relative">
                  <Icon className="w-4 h-4" />
                  {tab.badge && (
                    <span className="absolute -top-1 -right-1.5 w-2 h-2 rounded-full bg-cyan-400"></span>
                  )}
                </div>
                <span className="text-[10px] font-mono-system tracking-wider mt-1 font-semibold">
                  {tab.label}
                </span>
              </button>
            );
          })}
        </div>
      </nav>
    </>
  );
}
