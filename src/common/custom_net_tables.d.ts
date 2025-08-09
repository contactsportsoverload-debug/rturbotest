declare interface CustomNetTableDeclarations {
  player_stats: {
    init: { mmr: number };
    [steamID: string]: { mmr: number } | undefined;
  };
}
