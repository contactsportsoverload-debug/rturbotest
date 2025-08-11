// Extends CustomNetTableDeclarations with the "postgame" table.
// Must match existing declarations exactly to avoid TS2717 merge errors.
declare global {
  interface CustomNetTableDeclarations {
    postgame: {
      [key: string]: {
        old?: number;
        new?: number;
        name?: string;
        team?: DOTATeam_t;       // DOTA_TEAM_GOODGUYS / DOTA_TEAM_BADGUYS
        doubledown?: boolean;    // may be set later
      };
    };
  }
}
export {};
