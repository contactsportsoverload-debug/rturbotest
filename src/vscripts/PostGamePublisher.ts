// PostGamePublisher.ts
// Publishes per-player end-of-match results to the "postgame" NetTable.
// Keys consumed by Panorama: old, new, name, team, doubledown

export type PostgameKV = {
  old: number;
  new: number;
  name: string;
  team: DotaTeam;
  doubledown: boolean;
};

export class PostGamePublisher {
  /** Optional: wipe any previous values. Call once before publishing. */
  static ClearAll(): void {
    // No direct "clear" API; write a marker to a known key if desired.
    // We won’t rely on clearing—writers will overwrite per-key anyway.
  }

  /** Write one player’s snapshot keyed by PlayerID (as string). */
  static Set(pid: PlayerID, kv: PostgameKV): void {
    try {
      const key = tostring(pid);
      CustomNetTables.SetTableValue("postgame", key, kv as any);
      print(`[POSTGAME] wrote pid=${key} old=${kv.old} new=${kv.new} team=${kv.team} dd=${kv.doubledown ? 1 : 0}`);
    } catch (e) {
      print(`[POSTGAME][ERR] pid=${pid} ${tostring(e)}`);
    }
  }

  /** Convenience: build kv from live game state + provided old/new. */
  static SetFromLive(pid: PlayerID, oldMMR: number, newMMR: number, doubledown: boolean): void {
    const name = PlayerResource.GetPlayerName(pid) || "Player";
    const team = PlayerResource.GetTeam(pid) as DotaTeam;
    PostGamePublisher.Set(pid, { old: oldMMR, new: newMMR, name, team, doubledown });
  }
}
