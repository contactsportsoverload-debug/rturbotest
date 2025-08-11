// TurboRules.ts — Centralized Turbo rules + filters
// Purpose: hold all Turbo-like toggles and the XP/Gold filters; provide a single applyTurboRules() entry.

export const TURBO_SETTINGS = {
  heroSelectionTime: 20, // Lobby: seconds to pick a hero
  strategyTime: 0,       // After pick, before load-in
  showcaseTime: 0,       // Pre-intro showcase
  preGameTime: 300,       // PRE_GAME length (was ~90s)
  respawnTimeScale: 0.5, // Gameplay: halve respawn times
};

// A simple non-null context object for filters (engine requires an object)
const FILTER_CTX: {} = {};

// --- Orchestration: apply all Turbo rules + register filters in one call ---
export function applyTurboRules(): void {
  const gme = GameRules.GetGameModeEntity();

  // --- Core Turbo-like toggles (shop, courier, sell-anywhere, gold on death, same-hero) ---
  GameRules.SetUseUniversalShopMode(true);
  gme.SetCanSellAnywhere(true);
  gme.SetFreeCourierModeEnabled(true);
  gme.SetUseTurboCouriers(true);
  gme.SetLoseGoldOnDeath(false);
  GameRules.SetSameHeroSelectionEnabled(false);

  // --- Pace & runes (respawns and default rune logic) ---
  gme.SetRespawnTimeScale(TURBO_SETTINGS.respawnTimeScale);
  gme.SetUseDefaultDOTARuneSpawnLogic(true);

  // --- Lobby timings (shorter pre-game flow) ---
  GameRules.SetShowcaseTime(TURBO_SETTINGS.showcaseTime);
  GameRules.SetStrategyTime(TURBO_SETTINGS.strategyTime);
  GameRules.SetHeroSelectionTime(TURBO_SETTINGS.heroSelectionTime);
  GameRules.SetPreGameTime(TURBO_SETTINGS.preGameTime);

  // --- Filters (XP/Gold multipliers) ---
  gme.SetModifyExperienceFilter(xpFilter, FILTER_CTX);
  gme.SetModifyGoldFilter(goldFilter, FILTER_CTX);

  print("[RULES] Turbo rules + filters applied");
}

// --- Filters: simple multipliers for XP and Gold ---
function xpFilter(e: any): boolean {
  e.experience = e.experience * 2;
  return true;
}

function goldFilter(e: any): boolean {
  e.gold = e.gold * 2;
  return true;
}
