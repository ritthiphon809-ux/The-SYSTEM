# THE SYSTEM: Mobile Architecture & Database Schema Specification
*Inspired by "Solo Leveling" Real-Life RPG Fitness Engine*

---

## 1. High-Level System Architecture

```
+-------------------------------------------------------------------------+
|                         CLIENT LAYER (MOBILE / PWA)                     |
|                                                                         |
|  +---------------------------+       +-------------------------------+  |
|  |  Presentation (UI)        |       |  Local Sensors & Health APIs  |  |
|  |  - Holographic UI Engine  |       |  - Apple HealthKit (iOS)      |  |
|  |  - HP & Stamina Gauges    | <---> |  - Google Fit / Health Connect|  |
|  |  - Web Audio Synthesizer  |       |  - Background Pedometer       |  |
|  |  - Penalty & Alert Modals |       |  - Local Push Notifications   |  |
|  +---------------------------+       +-------------------------------+  |
|               ^                                      ^                  |
|               |                                      |                  |
|               v                                      v                  |
|  +-------------------------------------------------------------------+  |
|  |                    RPG Game Engine State Machine                  |  |
|  |  - HP Decay: -5 HP / inactive hour                                |  |
|  |  - Passive Recovery: +1 HP / 2,000 steps (Boosted by AGI)        |  |
|  |  - Level Scaling: XP = 100 * (1.2 ^ (Level - 1))                  |  |
|  |  - Dynamic Stat Allocator: STR, AGI, VIT, INT                     |  |
|  |  - Emergency Quests & Penalty Zone Lockdown                       |  |
|  +-------------------------------------------------------------------+  |
+-------------------------------------------------------------------------+
                                    |
                                    | HTTPS / WebSocket / REST
                                    v
+-------------------------------------------------------------------------+
|                          BACKEND & AI GATEWAY                           |
|                                                                         |
|  +-------------------------------------------------------------------+  |
|  |  Express / Cloud Functions API Gateway                            |  |
|  |  - /api/player (State & Attributes)                               |  |
|  |  - /api/player/allocate-stat (Point Allocation)                   |  |
|  |  - /api/player/hp-drain & /api/player/sync-health                 |  |
|  |  - /api/quest/daily & /api/quest/emergency                        |  |
|  |  - /api/penalty/clear                                             |  |
|  +-------------------------------------------------------------------+  |
|               |                                      |                  |
|               v                                      v                  |
|  +---------------------------+       +-------------------------------+  |
|  | Gemini 2.5 Flash Engine   |       | LINE Messaging API / Richmenu |  |
|  | - Real-time NLP Recalib.  |       | - System Alerts & Ting! Pushes|  |
|  | - Injury & Fatigue Adjust |       | - Flex Message Quests         |  |
|  +---------------------------+       +-------------------------------+  |
+-------------------------------------------------------------------------+
                                    |
                                    v
+-------------------------------------------------------------------------+
|                           PERSISTENCE LAYER                             |
|  - Cloud Firestore / Relational Database Schema (see Section 2)         |
+-------------------------------------------------------------------------+
```

---

## 2. Database Schema Design (Firestore / Relational)

### Entity 1: `players` (Users Collection)
```json
{
  "id": "player_uuid_101",
  "displayName": "Sung Jin-Woo",
  "level": 3,
  "rank": "E",
  "xp": 140,
  "currentLevelMaxXp": 250,
  "hp": 95,
  "maxHp": 150,
  "stamina": 120,
  "maxStamina": 125,
  "statPoints": 3,
  "stats": {
    "STR": 14,
    "AGI": 12,
    "VIT": 15,
    "INT": 11
  },
  "streak": 5,
  "totalQuestCompleted": 18,
  "totalWorkoutMinutes": 320,
  "lastActivityTimestamp": "2026-09-18T00:10:00Z",
  "stepsToday": 3450,
  "heartRate": 72,
  "caloriesBurned": 380,
  "isPenaltyZone": false,
  "isEmergencyQuest": false,
  "createdAt": "2026-09-01T00:00:00Z",
  "updatedAt": "2026-09-18T00:10:00Z"
}
```

### Entity 2: `quests` (Daily Quests & Emergency Directives)
```json
{
  "id": "quest_daily_20260918",
  "playerId": "player_uuid_101",
  "title": "Daily Quest: Getting Ready to Become Stronger",
  "description": "Perform 20 controlled push-ups. Form must be rigid.",
  "type": "STRENGTH",
  "difficulty": "NORMAL",
  "target": 20,
  "unit": "reps",
  "xpReward": 80,
  "statRewards": {
    "STR": 1,
    "VIT": 1
  },
  "deadline": "22:00",
  "status": "AVAILABLE",
  "isPenalty": false,
  "isEmergency": false,
  "penaltyDirective": "Survival Run: 3,000 steps in 30 minutes",
  "createdAt": "2026-09-18T00:00:00Z"
}
```

### Entity 3: `workout_logs` (Physical Verification History)
```json
{
  "id": "workout_log_902",
  "playerId": "player_uuid_101",
  "questId": "quest_daily_20260918",
  "type": "STRENGTH",
  "durationMinutes": 25,
  "repsOrKm": "20 reps",
  "calories": 95,
  "verifiedBy": "PLAYER_AFFIRMATION",
  "timestamp": "2026-09-18T00:12:00Z"
}
```

### Entity 4: `system_events` (Audit & Notification Log)
```json
{
  "id": "event_771",
  "playerId": "player_uuid_101",
  "type": "LEVEL_UP",
  "title": "[ The System has recognized your growth. ]",
  "description": "Operator ascended to Level 3. +3 Stat Points awarded.",
  "payload": {
    "level": 3,
    "statPoints": 3
  },
  "createdAt": "2026-09-18T00:13:00Z"
}
```

---

## 3. Core Mechanics & Algorithmic Rules

### 1. The HP System (Health Points)
* **Base Formula**: `Max HP = 100 + (VIT * 10)`
* **Hourly Decay**: User loses `-5 HP` per hour of physical inactivity.
* **Passive Recovery**: Walking restores `+1 HP` per 2,000 steps base, amplified by `AGI` attribute (`+ (AGI * 0.1) HP` per 200 steps).
* **Penalty Trigger**: If `HP <= 0`, The System locks into **PENALTY ZONE LOCKDOWN**. Normal UI access is revoked until the user performs emergency rehabilitation.

### 2. The Stamina (MP) System
* **Base Formula**: `Max Stamina = 100 + (AGI * 5)`
* **Consumption**: Executing workouts and emergency quests expends stamina.
* **Recovery**: Replenished by logged hydration and rest periods.

### 3. Stat Allocation Mechanics
* Every Level Up grants `+3 Unallocated Stat Points`.
* **STR (Strength)**: Boosts workout XP yield (`+2.5%` per point).
* **AGI (Agility)**: Increases Max Stamina and accelerates passive step HP regeneration.
* **VIT (Vitality)**: Increases Max HP capacity (+10 per point), providing buffer against hourly inactivity decay.
* **INT (Intelligence)**: Heightens mental stamina and system recalibration adaptation.

### 4. Emergency Quests & Notification Engine
* Triggers when severe inactivity or physiological slump is detected.
* Plays the signature crystal bell **"Ting!"** audio cue.
* Displays a high-urgency modal requiring rapid kinetic activity (e.g., 500 steps in 10 minutes) to prevent immediate Penalty Zone escalation.
