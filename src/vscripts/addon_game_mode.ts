// addon_game_mode.ts — Central entry (state logs + GameMode wiring)
// Responsibility: stay thin; log state transitions, expose lifecycle hooks, and support hot-reload.

import "./lib/timers"; // ⬅️ Ensure Timers library is loaded before anything else.
import { GameMode } from "./GameMode"; // ⬅️ Composition root we delegate to.

// --- Helper: map numeric GameState to readable label (for logs only) ---
function gameStateName(s: GameState): string {
  switch (s) {
    case GameState.INIT: return "INIT";
    case GameState.WAIT_FOR_PLAYERS_TO_LOAD: return "WAIT_FOR_PLAYERS_TO_LOAD";
    case GameState.CUSTOM_GAME_SETUP: return "CUSTOM_GAME_SETUP";
    case GameState.HERO_SELECTION: return "HERO_SELECTION";
    case GameState.STRATEGY_TIME: return "STRATEGY_TIME";
    case GameState.GAME_IN_PROGRESS: return "GAME_IN_PROGRESS";
    case GameState.WAIT_FOR_MAP_TO_LOAD: return "WAIT_FOR_MAP_TO_LOAD";
    case GameState.PRE_GAME: return "PRE_GAME";
    case GameState.POST_GAME: return "POST_GAME";
    case GameState.DISCONNECT: return "DISCONNECT";
    default: return `UNKNOWN(${s})`;
  }
}

// --- Logging: print every rules state change (quick heartbeat for debugging) ---
ListenToGameEvent("game_rules_state_change", () => {
  const st = GameRules.State_Get();
  print(`[STATE] -> ${gameStateName(st)} (${st})`);
}, undefined);

// --- Lifecycle wiring: expose Activate/Precache to the engine environment ---
Object.assign(getfenv(), {
  Activate: GameMode.Activate,
  Precache: GameMode.Precache,
});

// --- Hot-reload: if Addon instance exists (script reloaded), trigger its Reload() ---
if (GameRules.Addon !== undefined) {
  GameRules.Addon.Reload();
}
