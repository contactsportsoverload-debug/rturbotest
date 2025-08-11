// GameMode.ts — Thin orchestrator (config, state machine, module wiring)
// Purpose: keep business logic out; delegate to DoubleDown, MMRFlow, ResultOnHeroDeath.

import { reloadable } from "./lib/tstl-utils";
import { applyTurboRules } from "./TurboRules";
import { DoubleDown } from "./DoubleDown";
import { MMRFlow } from "./MMRFlow";
import { ResultOnHeroDeath } from "./ResultOnHeroDeath";

// ===== Custom event payload types (Server↔UI contract) =====
declare global {
  interface CustomGameEventDeclarations {
    // Server -> UI
    "mmr_current": { mmr: number };
    "mmr_final": { old: number; new: number };

    // UI -> Server
    "ui_panel_closed": {};
    "double_down_clicked": {};
  }
}
// ===== /Custom event payload types =====

// ===== GameRules augmentation for hot-reload =====
declare global {
  interface CDOTAGameRules {
    Addon: GameMode;
  }
}
// ===== /GameRules augmentation =====

@reloadable
export class GameMode {
  // --- Modules (feature systems) ---
  private readonly doubleDown = new DoubleDown();
  private readonly mmrFlow = new MMRFlow();
  private readonly resultOnHeroDeath = new ResultOnHeroDeath(
    // Callback: finalize MMR using current double-down selections
    (winningTeam) => this.mmrFlow.finalizeAndNotify(winningTeam, (pid) => this.doubleDown.isOptedIn(pid))
  );

  // ===== Lifecycle: static hooks =====
  public static Precache(this: void, context: CScriptPrecacheContext) {
    // Example assets
    PrecacheResource("particle", "particles/units/heroes/hero_meepo/meepo_earthbind_projectile_fx.vpcf", context);
    PrecacheResource("soundfile", "soundevents/game_sounds_heroes/game_sounds_meepo.vsndevts", context);
  }

  public static Activate(this: void) {
    GameRules.Addon = new GameMode();
  }

  // ===== Construction: configure rules + register listeners =====
  constructor() {
    this.configure(); // team sizes + Turbo

    // State machine
    ListenToGameEvent("game_rules_state_change", () => this.onStateChange(), undefined);

    // Feature listeners
    this.doubleDown.register();
    this.resultOnHeroDeath.register();
  }

  // ===== One-time match configuration =====
  private configure(): void {
    GameRules.SetCustomGameTeamMaxPlayers(DotaTeam.GOODGUYS, 5);
    GameRules.SetCustomGameTeamMaxPlayers(DotaTeam.BADGUYS, 5);
    applyTurboRules(); // delegate turbo-like toggles
  }

  // ===== State machine handling =====
  private onStateChange(): void {
    const state = GameRules.State_Get();

    if (state === GameState.CUSTOM_GAME_SETUP) {
      // --- Optional bots for testing ---
      print("[BOTS] Bots Added");
      for (let i = 0; i < 5; i++) {
        Tutorial.AddBot("npc_dota_hero_lina", "", "", false);
      }

      // --- Build local MMR cache for distinct players ---
      this.mmrFlow.buildCacheForCurrentPlayers();
    }

    if (state === GameState.CUSTOM_GAME_SETUP && IsInToolsMode()) {
      // --- Speed up during tools testing ---
      Timers.CreateTimer(3, () => GameRules.FinishCustomGameSetup());
    }

    if (state === GameState.PRE_GAME) {
      // --- Reset per-match selections and push current MMR to clients ---
      this.doubleDown.reset();
      Timers.CreateTimer(0.2, () => this.startGame());
    }
  }

  // ===== Start of game: announce + push current MMR =====
  private startGame(): void {
    print("[ANNOUNCEMENT] Game starting!");
    this.mmrFlow.pushCurrentToClientsAtStart();
  }

  // ===== Hot-reload hook =====
  public Reload() {
    print("Script reloaded!");
  }
}
