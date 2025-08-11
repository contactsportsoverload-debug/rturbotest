// MMRFlow.ts — Cache, start push, finalize, and client notify for MMR
// Purpose: centralize all MMR-related flow while delegating storage to MMRManager.

import { MMRManager } from "./mmr_manager";
import { PostGamePublisher } from "./PostGamePublisher";

export class MMRFlow {
  // Service to read/write MMR values
  private mmr = new MMRManager();

  // Local cache: steamID32 -> last-known MMR
  private cache: Record<string, number> = {};

  // ===== Setup: build cache for current lobby players (distinct steamID32) =====
  buildCacheForCurrentPlayers(): void {
    const seen: Record<string, boolean> = {};
    for (let pid = 0 as PlayerID; pid < 24; pid++) {
      if (!PlayerResource.IsValidPlayerID(pid)) continue;

      const id32 = tostring(PlayerResource.GetSteamAccountID(pid));
      if (id32 === "0" || seen[id32]) continue; // skip bots/dupes

      seen[id32] = true;

      this.mmr.GetOrCreatePlayerMMRAsync(id32, (mmr: number) => {
        this.cache[id32] = mmr;
      });
    }
  }

  // ===== Start of game: push current MMR to each client HUD once =====
  pushCurrentToClientsAtStart(): void {
    Timers.CreateTimer(0.5, () => {
      for (let pid = 0 as PlayerID; pid < 24; pid++) {
        if (!PlayerResource.IsValidPlayerID(pid)) continue;

        const id32 = tostring(PlayerResource.GetSteamAccountID(pid));
        if (id32 === "0") continue; // skip bots

        const sendToClient = (mmr: number) => {
          const player = PlayerResource.GetPlayer(pid);
          if (player) {
            CustomGameEventManager.Send_ServerToPlayer(player, "mmr_current", { mmr });
          }
        };

        const cached = this.cache[id32];
        if (cached !== undefined) {
          sendToClient(cached);
        } else {
          this.mmr.GetOrCreatePlayerMMRAsync(id32, (mmr: number) => {
            this.cache[id32] = mmr;
            sendToClient(mmr);
          });
        }
      }
    });
  }

  // ===== Finalization: apply ±25/±50 deltas, verify from Firebase, notify clients & EndScreen =====
  // isDoubleDown: predicate to check per-PlayerID opt-in
  finalizeAndNotify(winningTeam: DotaTeam, isDoubleDown: (pid: PlayerID) => boolean): void {
    const updatedIds: string[] = [];
    const idSet: Record<string, boolean> = {};
    const oldById: Record<string, number> = {};
    const ddByPid: Record<number, boolean> = {};

    // Compute and persist next MMR for each distinct steamID32
    for (let pid = 0 as PlayerID; pid < 24; pid++) {
      if (!PlayerResource.IsValidPlayerID(pid)) continue;

      const id32 = tostring(PlayerResource.GetSteamAccountID(pid));
      if (id32 === "0" || idSet[id32]) continue;

      idSet[id32] = true;

      const current = this.cache[id32] !== undefined ? this.cache[id32] : 500;
      oldById[id32] = current;

      const team = PlayerResource.GetTeam(pid) as DotaTeam;
      const doubled = !!isDoubleDown(pid);
      ddByPid[pid] = doubled;

      // Use ±50 if this player opted in, else ±25
      const base = doubled ? 50 : 25;
      const delta = team === winningTeam ? base : -base;
      const next = current + delta;

      // Persist
      this.mmr.UpdatePlayerMMRAsync(id32, next);
      this.cache[id32] = next;
      updatedIds.push(id32);

      // Publish immediately to the EndScreen NetTable so clients don't wait
      PostGamePublisher.Set(pid, {
        old: current,
        new: next,
        name: PlayerResource.GetPlayerName(pid) || "Player",
        team,
        doubledown: doubled,
      });
    }

    // Pull verified values after a short delay, then inform each player of old→new (client toast/event)
    // NOTE: Reduced to 0.2s so total delay ~= 2.2s after SetGameWinner (2.0s + 0.2s).
    Timers.CreateTimer(0.2, () => {
      for (const id of updatedIds) {
        this.mmr.GetOrCreatePlayerMMRAsync(id, (mmr: number) => {
          print(`[MMR] id=${id} mmr=${mmr}`);

          for (let pid = 0 as PlayerID; pid < 24; pid++) {
            if (!PlayerResource.IsValidPlayerID(pid)) continue;

            const id32 = tostring(PlayerResource.GetSteamAccountID(pid));
            if (id32 !== id) continue;

            const player = PlayerResource.GetPlayer(pid);
            if (player) {
              // Client-side toast/event
              CustomGameEventManager.Send_ServerToPlayer(player, "mmr_final", {
                old: oldById[id],
                new: mmr,
              });

              // Also update EndScreen NetTable with the verified value (in case it changed)
              const team = PlayerResource.GetTeam(pid) as DotaTeam;
              PostGamePublisher.Set(pid, {
                old: oldById[id],
                new: mmr,
                name: PlayerResource.GetPlayerName(pid) || "Player",
                team,
                doubledown: !!ddByPid[pid],
              });
            }
          }
        });
      }
    });
  }
}
