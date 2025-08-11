// DoubleDown.ts — Handle opt-ins from UI and simple announce
// Purpose: keep Double Down logic isolated (tracking + listener + announce).

// ===== State =====
export class DoubleDown {
  // Per-match memory: PlayerID -> opted-in?
  private optedIn: Partial<Record<PlayerID, boolean>> = {};

  // ===== Lifecycle =====
  // Register the UI event listener. Call once per match (e.g., from GameMode constructor).
  register(): void {
    CustomGameEventManager.RegisterListener(
      "double_down_clicked",
      (_src, data) => this.onClicked(data as { PlayerID?: PlayerID } & Record<string, any>)
    );
  }

  // Reset selections at the start of each match.
  reset(): void {
    this.optedIn = {};
  }

  // ===== Query API =====
  // Check if a given PlayerID opted in.
  isOptedIn(pid: PlayerID): boolean {
    return !!this.optedIn[pid];
  }

  // ===== Internal handlers =====
  // Handle a click event from the UI.
  private onClicked(event: { PlayerID?: PlayerID } & Record<string, any>): void {
    const pid = event?.PlayerID;
    if (pid === undefined || !PlayerResource.IsValidPlayerID(pid)) return;

    this.optedIn[pid] = true;

    // Minimal logs + announce as if in all chat
    print(`[DOUBLE DOWN] pid=${pid} opted in`);
    const name = PlayerResource.GetPlayerName(pid);
    GameRules.SendCustomMessage(`${name}: I doubled down!`, 0, 0);
  }
}
