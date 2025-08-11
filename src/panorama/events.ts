// events.ts
// Purpose: Panorama type mappings so TS knows your custom events & NetTables.
// Fixes "Argument of type '{}' is not assignable to parameter of type 'never'"
// and '"postgame" is not assignable to "player_stats"'.

export {}; // make this file a module so `declare global` is allowed

declare global {
  // ---- Custom game events ----
  interface CustomGameEventDeclarations {
    // UI -> Server
    "double_down_clicked": {};
    "ui_panel_closed": {};
    "rturbo_play_again": {};
    "rturbo_exit": {};

    // Server -> UI
    "mmr_current": { mmr: number };
    "mmr_final": { old: number; new: number };
  }

  // ---- Custom NetTables ----
  interface CustomNetTableDeclarations {
    // Final post-game data keyed by PlayerID or SteamID32 as string
    postgame: {
      [key: string]: {
        old?: number;
        new?: number;
        name?: string;
        team?: DOTATeam_t;     // DOTA_TEAM_GOODGUYS / DOTA_TEAM_BADGUYS
        doubledown?: boolean;
      };
    };
  }
}
