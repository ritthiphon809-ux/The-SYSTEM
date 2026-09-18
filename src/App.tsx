/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect } from 'react';
import { Player, Quest, SystemEvent, WorkoutLog, QuestDifficulty } from './types.ts';
import { DEMO_PLAYER_STATE } from './modules/game-engine.ts';
import { SystemHeader } from './components/SystemHeader.tsx';
import { Navigation, NavTab } from './components/Navigation.tsx';
import { DashboardView } from './components/DashboardView.tsx';
import { QuestView } from './components/QuestView.tsx';
import { PlayerStatusView } from './components/PlayerStatusView.tsx';
import { HistoryView } from './components/HistoryView.tsx';
import { SettingsView } from './components/SettingsView.tsx';
import { ConfirmationModal, LevelUpModal, PenaltyZoneModal, EmergencyQuestModal } from './components/SystemEventModal.tsx';
import { HunterOnboardingModal } from './components/HunterOnboardingModal.tsx';
import { playQuestComplete, playLevelUpSound, playWarningSound, playSystemTingSound, playPenaltyAlertSound, playUiClick, triggerHaptic } from './utils/audio.ts';
import { registerServiceWorker } from './utils/pwa.ts';

export default function App() {
  const [currentTab, setCurrentTab] = useState<NavTab>('home');
  const [player, setPlayer] = useState<Player>(DEMO_PLAYER_STATE);
  const [lineOaBasicId, setLineOaBasicId] = useState<string>('');
  const [lineLoginConfigured, setLineLoginConfigured] = useState<boolean>(false);
  const [isOnboardingOpen, setIsOnboardingOpen] = useState(false);
  const [initialLineAuth, setInitialLineAuth] = useState<{
    userId: string;
    displayName: string;
    pictureUrl?: string;
  } | undefined>(undefined);
  const [quest, setQuest] = useState<Quest>({
    id: 'quest-today-1',
    title: 'Squat Protocol (โพรโทคอลสควอท)',
    description: 'ปฏิบัติท่าสควอท 20 ครั้งด้วยฟอร์มที่ถูกต้องและลงลึกสม่ำเสมอ รักษาแนวกระดูกสันหลังให้มั่นคง',
    type: 'STRENGTH',
    difficulty: 'EASY',
    target: 20,
    unit: 'reps',
    xpReward: 50,
    statRewards: { VIT: 1, STR: 1 },
    deadline: '21:00',
    status: 'AVAILABLE',
    createdAt: new Date().toISOString(),
    steps: [
      { id: 'step-1', name: 'สควอทบอดี้เวท (Bodyweight Squats)', targetReps: 10, sets: 2, completed: false },
      { id: 'step-2', name: 'ยืดเหยียดสะโพกและเอ็นร้อยหวาย (Hip Stretch)', targetSeconds: 60, sets: 1, completed: false }
    ]
  });
  const [events, setEvents] = useState<SystemEvent[]>([]);
  const [workouts, setWorkouts] = useState<WorkoutLog[]>([]);
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const [isEmergencyOpen, setIsEmergencyOpen] = useState(false);
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

      if (playerRes.lineOaBasicId) {
        setLineOaBasicId(playerRes.lineOaBasicId);
      }
      if (playerRes.lineLoginConfigured !== undefined) {
        setLineLoginConfigured(playerRes.lineLoginConfigured);
      }

      if (playerRes.player) {
        setPlayer(playerRes.player);
        if (playerRes.player.isEmergencyQuest) {
          setIsEmergencyOpen(true);
        }

        // Check if player has registered, or if first-time user
        const hasRegisteredLocally = localStorage.getItem('the_system_registered') === '1';
        if (!playerRes.player.isRegistered && !hasRegisteredLocally && !playerRes.player.isDemo) {
          setIsOnboardingOpen(true);
        }
      }
      if (questRes.quest) setQuest(questRes.quest);
      if (historyRes.events) setEvents(historyRes.events);
      if (historyRes.workouts) setWorkouts(historyRes.workouts);
    } catch (e) {
      console.warn('Backend sync deferred (offline shell active):', e);
    }
  };

  useEffect(() => {
    registerServiceWorker();

    // Check for LINE OAuth Redirect Query Parameters
    const urlParams = new URLSearchParams(window.location.search);
    const lineAuthSuccess = urlParams.get('line_auth_success');
    const lineUserId = urlParams.get('line_userId');
    const lineName = urlParams.get('line_name');
    const linePic = urlParams.get('line_pic');

    if (lineAuthSuccess && lineUserId) {
      setInitialLineAuth({
        userId: lineUserId,
        displayName: lineName || 'HUNTER',
        pictureUrl: linePic || undefined
      });
      setIsOnboardingOpen(true);
      // Clean up URL query parameters without reloading
      window.history.replaceState({}, document.title, window.location.pathname);
    }

    refreshData();
  }, []);

  // Handle Hunter Onboarding Completion
  const handleCompleteOnboarding = async (profileData: {
    displayName: string;
    fitnessGoal: 'FAT_LOSS' | 'MUSCLE_GAIN' | 'ENDURANCE' | 'SOLO_LEVELING';
    weightKg?: number;
    heightCm?: number;
    lineUserId?: string;
    lineDisplayName?: string;
    linePictureUrl?: string;
  }) => {
    try {
      const res = await fetch('/api/player/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(profileData)
      });
      const data = await res.json();
      if (data.player) {
        setPlayer(data.player);
      }
      localStorage.setItem('the_system_registered', '1');
      setIsOnboardingOpen(false);
      refreshData();
      playLevelUpSound();
      triggerHaptic('success');
    } catch (err) {
      console.error('Failed to register player:', err);
      setIsOnboardingOpen(false);
    }
  };

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

  // 1b. Toggle Quest Step Checklist Item
  const handleToggleStep = async (stepId: string) => {
    if (!quest.steps) return;
    const nextSteps = quest.steps.map((s) =>
      s.id === stepId ? { ...s, completed: !s.completed } : s
    );
    const allCompleted = nextSteps.length > 0 && nextSteps.every((s) => s.completed);

    setQuest((prev) => ({
      ...prev,
      steps: nextSteps,
      status: prev.status === 'AVAILABLE' ? 'IN_PROGRESS' : prev.status
    }));

    playUiClick();
    triggerHaptic('light');

    if (allCompleted && quest.status !== 'COMPLETED') {
      setIsConfirmOpen(true);
    }

    try {
      const res = await fetch('/api/quest/step-toggle', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ stepId })
      });
      const data = await res.json();
      if (data.success && data.quest) {
        setQuest((prev) => ({
          ...data.quest,
          status: prev.status === 'COMPLETED' ? 'COMPLETED' : data.quest.status
        }));
      }
    } catch (err) {
      console.error('Failed to sync step toggle:', err);
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

  // 3. Allocate Stat Point (Solo Leveling)
  const handleAllocateStat = async (stat: 'STR' | 'AGI' | 'VIT' | 'INT') => {
    try {
      const res = await fetch('/api/player/allocate-stat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ stat })
      });
      const data = await res.json();
      if (data.player) {
        setPlayer(data.player);
        playQuestComplete();
        triggerHaptic('success');
      }
      refreshData();
    } catch (err) {
      console.error('Stat allocation failed:', err);
    }
  };

  // 4. Simulate Hourly HP Drain (-5 HP/hr)
  const handleSimulateHpDrain = async (hours = 1) => {
    try {
      const res = await fetch('/api/player/hp-drain', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ hours })
      });
      const data = await res.json();
      if (data.player) {
        setPlayer(data.player);
        if (data.isPenaltyZone || data.player.hp <= 0) {
          playPenaltyAlertSound();
        } else {
          playWarningSound();
        }
      }
      refreshData();
    } catch (err) {
      console.error('HP drain failed:', err);
    }
  };

  // 5. Bio-sensor Telemetry Sync (HealthKit / Google Fit Steps)
  const handleSyncHealth = async (steps: number) => {
    try {
      const res = await fetch('/api/player/sync-health', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ stepsToday: steps })
      });
      const data = await res.json();
      if (data.player) {
        setPlayer(data.player);
        playQuestComplete();
        triggerHaptic('light');
      }
      refreshData();
    } catch (err) {
      console.error('Health sync failed:', err);
    }
  };

  // 6. Trigger Solo Leveling Emergency Quest
  const handleTriggerEmergency = async () => {
    try {
      const res = await fetch('/api/quest/emergency', { method: 'POST' });
      const data = await res.json();
      if (data.quest) setQuest(data.quest);
      if (data.player) setPlayer(data.player);
      setIsEmergencyOpen(true);
      playSystemTingSound();
      triggerHaptic('medium');
      refreshData();
    } catch (err) {
      console.error('Trigger emergency quest failed:', err);
    }
  };

  // 7. Clear Penalty Zone Lockdown
  const handleClearPenalty = async () => {
    try {
      const res = await fetch('/api/penalty/clear', { method: 'POST' });
      const data = await res.json();
      if (data.player) setPlayer(data.player);
      if (data.quest) setQuest(data.quest);
      playQuestComplete();
      triggerHaptic('success');
      refreshData();
    } catch (err) {
      console.error('Clear penalty zone failed:', err);
    }
  };

  // 8. Accept Emergency Quest
  const handleAcceptEmergencyQuest = () => {
    setIsEmergencyOpen(false);
    setCurrentTab('quest');
    handleStartQuest();
  };

  // 9. Complete Emergency Quest
  const handleCompleteEmergencyQuest = async () => {
    setIsEmergencyOpen(false);
    await handleSyncHealth((player.stepsToday || 0) + 500);
    await handleCompleteQuest();
  };

  // 10. Simulate Deadline Expiry / Penalty Quest
  const handleSimulateExpire = async () => {
    try {
      const res = await fetch('/api/quest/expire', { method: 'POST' });
      const data = await res.json();
      if (data.quest) {
        setQuest(data.quest);
      }
      playPenaltyAlertSound();
      refreshData();
    } catch (err) {
      console.error('Expiration simulation error:', err);
    }
  };

  // 11. Regenerate Quest with AI
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
      playSystemTingSound();
      refreshData();
    } catch (e) {
      console.error('Quest generation failed:', e);
      playWarningSound();
    } finally {
      setIsGenerating(false);
    }
  };

  // 12. Send Natural Language Message to System Console
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

  // 13. Reset Demo State
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
      <SystemHeader
        player={player}
        onResetDemo={handleResetDemo}
        onOpenHunterProfile={() => setIsOnboardingOpen(true)}
      />

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
            onTriggerEmergency={handleTriggerEmergency}
            onSimulateHpDrain={handleSimulateHpDrain}
            onSyncHealth={handleSyncHealth}
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
            onToggleStep={handleToggleStep}
          />
        )}

        {currentTab === 'status' && (
          <PlayerStatusView
            player={player}
            onAllocateStat={handleAllocateStat}
          />
        )}

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

      {/* Solo Leveling Emergency Quest Modal */}
      <EmergencyQuestModal
        isOpen={isEmergencyOpen}
        onAccept={handleAcceptEmergencyQuest}
        onSimulateComplete={handleCompleteEmergencyQuest}
        onClose={() => setIsEmergencyOpen(false)}
      />

      {/* Solo Leveling Penalty Zone Full-Screen Lockdown Modal */}
      <PenaltyZoneModal
        isOpen={Boolean(player.isPenaltyZone || (player.hp !== undefined && player.hp <= 0))}
        onSurvive={handleClearPenalty}
      />

      {/* First-Time Hunter Awakening & LINE Connection Onboarding Modal */}
      <HunterOnboardingModal
        isOpen={isOnboardingOpen}
        onCompleteOnboarding={handleCompleteOnboarding}
        initialLineUser={initialLineAuth}
        lineOaBasicId={lineOaBasicId}
        lineLoginConfigured={lineLoginConfigured}
      />
    </div>
  );
}
