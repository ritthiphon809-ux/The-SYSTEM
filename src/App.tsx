/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect } from 'react';
import { Player, Quest, SystemEvent, WorkoutLog, QuestDifficulty } from './types.ts';
import { DEMO_PLAYER_STATE, FALLBACK_DAILY_QUESTS } from './modules/game-engine.ts';
import { SystemHeader } from './components/SystemHeader.tsx';
import { Navigation, NavTab } from './components/Navigation.tsx';
import { DashboardView } from './components/DashboardView.tsx';
import { QuestView } from './components/QuestView.tsx';
import { PlayerStatusView } from './components/PlayerStatusView.tsx';
import { HistoryView } from './components/HistoryView.tsx';
import { SettingsView } from './components/SettingsView.tsx';
import { ConfirmationModal, LevelUpModal } from './components/SystemEventModal.tsx';
import { playQuestComplete, playLevelUpSound, playWarningSound, triggerHaptic } from './utils/audio.ts';
import { registerServiceWorker } from './utils/pwa.ts';

export default function App() {
  const [currentTab, setCurrentTab] = useState<NavTab>('home');
  const [player, setPlayer] = useState<Player>(DEMO_PLAYER_STATE);
  const [quest, setQuest] = useState<Quest>({
    id: 'quest-today-1',
    title: 'Squat Protocol',
    description: 'Perform 20 controlled squats with full depth. Maintain lumbar neutrality.',
    type: 'STRENGTH',
    difficulty: 'EASY',
    target: 20,
    unit: 'reps',
    xpReward: 50,
    statRewards: { VIT: 1, STR: 1 },
    deadline: '21:00',
    status: 'AVAILABLE',
    createdAt: new Date().toISOString()
  });
  const [events, setEvents] = useState<SystemEvent[]>([]);
  const [workouts, setWorkouts] = useState<WorkoutLog[]>([]);
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);

  // Level Up Modal State
  const [levelUpState, setLevelUpState] = useState<{
    isOpen: boolean;
    oldLevel: number;
    newLevel: number;
    oldRank: string;
    newRank: string;
  }>({
    isOpen: false,
    oldLevel: 1,
    newLevel: 2,
    oldRank: 'E',
    newRank: 'E'
  });

  // Sync initial state from backend
  const refreshData = async () => {
    try {
      const [playerRes, questRes, historyRes] = await Promise.all([
        fetch('/api/player').then((r) => r.json()),
        fetch('/api/quest/daily').then((r) => r.json()),
        fetch('/api/history').then((r) => r.json())
      ]);

      if (playerRes.player) setPlayer(playerRes.player);
      if (questRes.quest) setQuest(questRes.quest);
      if (historyRes.events) setEvents(historyRes.events);
      if (historyRes.workouts) setWorkouts(historyRes.workouts);
    } catch (e) {
      console.warn('Backend sync deferred (offline shell active):', e);
    }
  };

  useEffect(() => {
    registerServiceWorker();
    refreshData();
  }, []);

  // 1. Start Quest
  const handleStartQuest = async () => {
    try {
      const res = await fetch('/api/quest/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ questId: quest.id })
      });
      const data = await res.json();
      if (data.quest) {
        setQuest(data.quest);
      }
      refreshData();
    } catch {
      setQuest((prev) => ({ ...prev, status: 'IN_PROGRESS' }));
    }
  };

  // 2. Complete Quest
  const handleCompleteQuest = async () => {
    setIsConfirmOpen(false);
    try {
      const res = await fetch('/api/quest/complete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ questId: quest.id })
      });
      const data = await res.json();

      if (data.success) {
        setQuest(data.quest);
        setPlayer(data.player);
        playQuestComplete();
        triggerHaptic('success');

        if (data.levelUp) {
          setTimeout(() => {
            playLevelUpSound();
            setLevelUpState({
              isOpen: true,
              oldLevel: data.oldLevel,
              newLevel: data.newLevel,
              oldRank: data.oldRank,
              newRank: data.newRank
            });
          }, 300);
        }

        refreshData();
      }
    } catch (err) {
      console.error('Quest completion failed:', err);
      playWarningSound();
    }
  };

  // 3. Simulate Deadline Expiry / Penalty Quest
  const handleSimulateExpire = async () => {
    try {
      const res = await fetch('/api/quest/expire', { method: 'POST' });
      const data = await res.json();
      if (data.quest) {
        setQuest(data.quest);
      }
      refreshData();
    } catch (err) {
      console.error('Expiration simulation error:', err);
    }
  };

  // 4. Regenerate Quest with AI
  const handleRegenerateQuest = async (difficulty?: QuestDifficulty) => {
    setIsGenerating(true);
    try {
      const res = await fetch('/api/quest/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ difficulty })
      });
      const data = await res.json();
      if (data.quest) {
        setQuest(data.quest);
      }
      refreshData();
    } catch (e) {
      console.error('Quest generation failed:', e);
      playWarningSound();
    } finally {
      setIsGenerating(false);
    }
  };

  // 5. Send Natural Language Message to System Console
  const handleSendMessage = async (message: string): Promise<string | null> => {
    try {
      const res = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message })
      });
      const data = await res.json();
      if (data.quest) setQuest(data.quest);
      if (data.player) setPlayer(data.player);
      refreshData();
      return data.systemMessage || null;
    } catch (err) {
      console.error('AI chat failed:', err);
      return null;
    }
  };

  // 6. Reset Demo State
  const handleResetDemo = async () => {
    try {
      const res = await fetch('/api/player/reset-demo', { method: 'POST' });
      const data = await res.json();
      if (data.player) setPlayer(data.player);
      if (data.quest) setQuest(data.quest);
      refreshData();
    } catch (e) {
      setPlayer(DEMO_PLAYER_STATE);
    }
  };

  return (
    <div className="min-h-screen bg-[#05070a] text-slate-100 bg-grid-pattern relative selection:bg-cyan-500/20 selection:text-cyan-300">
      {/* Top Protocol Header */}
      <SystemHeader player={player} onResetDemo={handleResetDemo} />

      {/* Navigation Tabs Bar */}
      <Navigation
        currentTab={currentTab}
        onSelectTab={setCurrentTab}
        questStatus={quest.status}
      />

      {/* Main Content Area */}
      <main className="max-w-4xl mx-auto px-4 py-6">
        {currentTab === 'home' && (
          <DashboardView
            player={player}
            quest={quest}
            onStartQuest={handleStartQuest}
            onOpenCompleteModal={() => setIsConfirmOpen(true)}
            onSendMessage={handleSendMessage}
            onNavigateToQuest={() => setCurrentTab('quest')}
            onNavigateToStatus={() => setCurrentTab('status')}
          />
        )}

        {currentTab === 'quest' && (
          <QuestView
            quest={quest}
            onStartQuest={handleStartQuest}
            onOpenCompleteModal={() => setIsConfirmOpen(true)}
            onSimulateExpire={handleSimulateExpire}
            onRegenerateQuest={handleRegenerateQuest}
            isGenerating={isGenerating}
          />
        )}

        {currentTab === 'status' && <PlayerStatusView player={player} />}

        {currentTab === 'history' && (
          <HistoryView events={events} workouts={workouts} />
        )}

        {currentTab === 'settings' && (
          <SettingsView
            player={player}
            quest={quest}
            onResetDemo={handleResetDemo}
            onCompleteQuest={handleCompleteQuest}
          />
        )}
      </main>

      {/* System Confirmation Dialog Modal */}
      <ConfirmationModal
        isOpen={isConfirmOpen}
        title="CONFIRM COMPLETION"
        questTitle={`${quest.title} (${quest.target} ${quest.unit.toUpperCase()})`}
        message="Did you actually complete this quest in the physical realm? The System demands absolute integrity."
        onConfirm={handleCompleteQuest}
        onCancel={() => setIsConfirmOpen(false)}
      />

      {/* System Level Up Holographic Overlay Modal */}
      <LevelUpModal
        isOpen={levelUpState.isOpen}
        oldLevel={levelUpState.oldLevel}
        newLevel={levelUpState.newLevel}
        oldRank={levelUpState.oldRank}
        newRank={levelUpState.newRank}
        onClose={() => setLevelUpState((prev) => ({ ...prev, isOpen: false }))}
      />
    </div>
  );
}
