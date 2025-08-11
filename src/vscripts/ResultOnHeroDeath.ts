// ResultOnHeroDeath.ts — Decide winner on first real-hero death OR Ancient destruction
// Purpose: encapsulate simple win conditions; end the match, then (after delay) run finalize callback.
// Also listens to dota_team_win to finalize even if engine ends game for us.

export class ResultOnHeroDeath {
  private submitted = false;

  constructor(private onResult: (winningTeam: DotaTeam) => void) {}

  // Register listeners; call once per match (e.g., from GameMode).
  register(): void {
    ListenToGameEvent("entity_killed", (ev) => this.handleEntityKilled(ev as any), undefined);
    ListenToGameEvent("dota_team_win", (ev) => this.handleTeamWin(ev as any), undefined);
  }

  // Reset guard at the start of each match if needed.
  reset(): void {
    this.submitted = false;
  }

  // --- Handle entity kills: trigger on first real-hero death OR Ancient (Fort) destruction
  private handleEntityKilled(ev: { entindex_killed?: EntityIndex; entindex_attacker?: EntityIndex; [k: string]: any }): void {
    if (this.submitted) return;

    const killed = ev.entindex_killed != null ? (EntIndexToHScript(ev.entindex_killed) as CDOTA_BaseNPC) : undefined;
    if (!killed) return;

    // Case A: Ancient destroyed (building named *fort*)
    const isBuilding = (killed as any).IsBuilding ? (killed as any).IsBuilding() : false;
    const unitName = (killed as any).GetUnitName ? (killed as any).GetUnitName() as string : "";
    const looksLikeFort = isBuilding && (unitName.indexOf("fort") >= 0 || unitName.indexOf("ancient") >= 0);

    if (looksLikeFort) {
      let winningTeam: DotaTeam;
      const losingTeam = killed.GetTeamNumber() as DotaTeam;
      winningTeam = losingTeam === DotaTeam.GOODGUYS ? DotaTeam.BADGUYS : DotaTeam.GOODGUYS;

      this.submitted = true;

      // End the game explicitly on Ancient kill
      print(`[WIN] Ancient down. SetGameWinner(${winningTeam})`);
      GameRules.SetGameWinner(winningTeam);

      // After delay, run finalize (e.g., MMR)
      Timers.CreateTimer(2.0, () => {
        try { this.onResult(winningTeam); } catch (e) { print(`[ERROR] onResult threw: ${e}`); }
      });
      return;
    }

    // Case B: First real-hero death decides winner (fallback/simple win condition)
    if (!killed.IsRealHero()) return;

    const attacker = ev.entindex_attacker != null ? (EntIndexToHScript(ev.entindex_attacker) as CDOTA_BaseNPC) : undefined;

    let winningTeam: DotaTeam;
    if (attacker && (attacker as any).GetTeamNumber && attacker.GetTeamNumber() !== killed.GetTeamNumber()) {
      winningTeam = attacker.GetTeamNumber() as DotaTeam;
    } else {
      winningTeam = (killed.GetTeamNumber() === DotaTeam.GOODGUYS ? DotaTeam.BADGUYS : DotaTeam.GOODGUYS);
    }

    this.submitted = true;

    print(`[WIN] First hero death. SetGameWinner(${winningTeam})`);
    GameRules.SetGameWinner(winningTeam);

    Timers.CreateTimer(2.0, () => {
      try { this.onResult(winningTeam); } catch (e) { print(`[ERROR] onResult threw: ${e}`); }
    });
  }

  // --- Handle engine-declared wins (Ancient died or other): finalize even if we didn’t call SetGameWinner
  private handleTeamWin(ev: { winner?: DotaTeam; team?: DotaTeam; winningteam?: DotaTeam; [k: string]: any }): void {
    if (this.submitted) return;

    const t = (ev && (ev.winner ?? ev.team ?? ev.winningteam)) as DotaTeam | undefined;
    if (t === undefined) {
      // Unknown payload shape; ignore quietly.
      return;
    }

    this.submitted = true;

    // Game is already ended by engine; just run finalize after our standard delay
    print(`[WIN] dota_team_win detected: team=${t}. Finalizing after delay.`);
    Timers.CreateTimer(2.0, () => {
      try { this.onResult(t); } catch (e) { print(`[ERROR] onResult threw: ${e}`); }
    });
  }
}
