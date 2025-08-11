// events.ts
// Purpose: Type mappings for Panorama custom game events (UI side).
// This fixes 'never' errors for GameEvents.SendCustomGameEventToServer / Subscribe.

export {}; // make this file a module so `declare global` is allowed

declare global {
  interface CustomGameEventDeclarations {
    // UI -> Server
    "double_down_clicked": {};
    "ui_panel_closed": {};

    // Server -> UI
    "mmr_current": { mmr: number };
    "mmr_final": { old: number; new: number };
  }
}
