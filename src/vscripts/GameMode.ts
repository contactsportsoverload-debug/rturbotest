import { reloadable } from "./lib/tstl-utils";
//import { modifier_panic } from "./modifiers/modifier_panic";
import { MMRManager } from "./mmr_manager"; // <-- added

// Connection state numeric codes (runtime-safe)
const CONN_CONNECTED = 2;
const CONN_DISCONNECTED = 3;
const CONN_ABANDONED = 4;

const heroSelectionTime = 20;

declare global {
    interface CDOTAGameRules {
        Addon: GameMode;
    }
}

@reloadable
export class GameMode {
    private mmr!: MMRManager; // <-- added
    private resultSubmitted: boolean = false; // <-- added: guard so we only submit once

    public static Precache(this: void, context: CScriptPrecacheContext) {
        PrecacheResource("particle", "particles/units/heroes/hero_meepo/meepo_earthbind_projectile_fx.vpcf", context);
        PrecacheResource("soundfile", "soundevents/game_sounds_heroes/game_sounds_meepo.vsndevts", context);
    }

    public static Activate(this: void) {
        // When the addon activates, create a new instance of this GameMode class.
        GameRules.Addon = new GameMode();
    }

    constructor() {
        this.configure();
        this.setupFilters();
        
        // Register event listeners for dota engine events
        ListenToGameEvent("game_rules_state_change", () => this.OnStateChange(), undefined);
        //ListenToGameEvent("npc_spawned", event => this.OnNpcSpawned(event), undefined);

        // Register event listeners for events from the UI
        CustomGameEventManager.RegisterListener("ui_panel_closed", (_, data) => {
            print(`Player ${data.PlayerID} has closed their UI panel.`);

            // Respond by sending back an example event
            const player = PlayerResource.GetPlayer(data.PlayerID)!;
            CustomGameEventManager.Send_ServerToPlayer(player, "example_event", {
                myNumber: 42,
                myBoolean: true,
                myString: "Hello!",
                myArrayOfNumbers: [1.414, 2.718, 3.142]
            });

            // Also apply the panic modifier to the sending player's hero
            const hero = player.GetAssignedHero();
            if (hero != undefined) { // Hero didn't spawn yet or dead
                //hero.AddNewModifier(hero, undefined, modifier_panic.name, { duration: 5 });
            }
        });

        // --- MMR Manager init ---
        this.mmr = new MMRManager(); // URL is hardcoded inside MMRManager

        // --- Chat command listener (-rank) ---
        ListenToGameEvent("player_chat", (ev) => this.OnPlayerChat(ev as any), undefined); // <-- added

        // --- MMR result submission: listen for win event ---
        ListenToGameEvent("dota_team_win" as any, (ev) => this.OnTeamWin(ev as any), undefined); // <-- added (cast if typings missing)

        // --- One-kill win condition: first real-hero death ends the game ---
        ListenToGameEvent("entity_killed", (ev) => this.OnEntityKilled(ev as any), undefined); // <-- added
    }

    private configure(): void {
        GameRules.SetCustomGameTeamMaxPlayers(DotaTeam.GOODGUYS, 5);
        GameRules.SetCustomGameTeamMaxPlayers(DotaTeam.BADGUYS, 5);
    
        //Turbo game rules
        GameRules.SetUseUniversalShopMode(true)
        GameRules.GetGameModeEntity().SetCanSellAnywhere(true)
        GameRules.GetGameModeEntity().SetFreeCourierModeEnabled(true)
        GameRules.GetGameModeEntity().SetUseTurboCouriers(true)
        GameRules.GetGameModeEntity().SetLoseGoldOnDeath(false)
        GameRules.SetSameHeroSelectionEnabled(false)
        GameRules.GetGameModeEntity().SetRespawnTimeScale(0.5)

        //Rune Rules
        GameRules.GetGameModeEntity().SetUseDefaultDOTARuneSpawnLogic(true)

        GameRules.SetShowcaseTime(0);
        GameRules.SetHeroSelectionTime(heroSelectionTime);


    }
    
    private setupFilters(): void {
        const gme = GameRules.GetGameModeEntity();
        gme.SetModifyExperienceFilter(this.onXPFilter, this);
        gme.SetModifyGoldFilter(this.onGoldFilter, this);
    }

    private onXPFilter(e: any): boolean {
        e.experience = e.experience * 2;
        return true;
    }

    private onGoldFilter(e: any): boolean {
        e.gold = e.gold * 2;
        return true;
    }
    public OnStateChange(): void {
        const state = GameRules.State_Get();

        // // Add 4 bots to lobby in tools
        // if (IsInToolsMode() && state == GameState.CUSTOM_GAME_SETUP) {
        //     for (let i = 0; i < 4; i++) {
        //         Tutorial.AddBot("npc_dota_hero_lina", "", "", false);
        //     }
        // }

         // Add 5 bots to lobby in tools or regular game
        if  (state == GameState.CUSTOM_GAME_SETUP) {
            for (let i = 0; i < 5; i++) {
                Tutorial.AddBot("npc_dota_hero_lina", "", "", false);
            }
        }

        if (state === GameState.CUSTOM_GAME_SETUP) {
            // Automatically skip setup in tools
            if (IsInToolsMode()) {
                Timers.CreateTimer(3, () => {
                    GameRules.FinishCustomGameSetup();
                });
            }
        }

        // Start game once pregame hits
        if (state === GameState.PRE_GAME) {
            Timers.CreateTimer(0.2, () => this.StartGame());
        }
    }

    private StartGame(): void {
        print("Game starting!");

        // Do some stuff here
    }

    // Called on script_reload
    public Reload() {
        print("Script reloaded!");

        // Do some stuff here
    }

    // --- Chat command handler (-rank) ---
    private OnPlayerChat(ev: any): void {
        const text = (ev.text || "").trim().toLowerCase();
        if (text !== "-rank") return;

        const pid = ev.playerid as PlayerID;
        const player = PlayerResource.GetPlayer(pid);
        if (!player) return;

        // Use the 32-bit account ID as the key (consistent with SubmitMatchResults if you use the same)
        const idKey = tostring(PlayerResource.GetSteamAccountID(pid));
        this.mmr.GetPlayerMMRAsync(idKey, (mmr) => {
            Say(player, `[MMR] Your rank: ${mmr}`, false);
            CustomNetTables.SetTableValue("player_stats", idKey, { mmr });
        });
    }

    // --- One-kill win: first real-hero death ends the game in favor of the killer's team ---
    private OnEntityKilled(ev: { entindex_killed?: EntityIndex; entindex_attacker?: EntityIndex; [k: string]: any }): void {
        if (this.resultSubmitted) return; // if we've already ended/submitted, ignore

        const killed = ev.entindex_killed != null ? (EntIndexToHScript(ev.entindex_killed) as CDOTA_BaseNPC) : undefined;
        if (!killed || !killed.IsRealHero()) return; // only count real-hero deaths

        const attacker = ev.entindex_attacker != null ? (EntIndexToHScript(ev.entindex_attacker) as CDOTA_BaseNPC) : undefined;

        // Decide winning team: attacker team if valid and not same as victim; otherwise opponent team
        let winningTeam: DotaTeam;
        if (attacker && attacker.GetTeamNumber && attacker.GetTeamNumber() !== killed.GetTeamNumber()) {
            winningTeam = attacker.GetTeamNumber() as DotaTeam;
        } else {
            winningTeam = (killed.GetTeamNumber() === DotaTeam.GOODGUYS ? DotaTeam.BADGUYS : DotaTeam.GOODGUYS);
        }

        GameRules.SetGameWinner(winningTeam); // will trigger dota_team_win → OnTeamWin handles MMR
    }

    // --- MMR result submission: called when a team wins ---
    private OnTeamWin(ev: { teamnumber: DotaTeam; [k: string]: any }): void {
        if (this.resultSubmitted) return; // guard against double submit
        this.resultSubmitted = true;

        const winningTeam = ev.teamnumber;
        const winners: string[] = [];
        const losers: string[] = [];

        // Gather connected players, split by winning/losing team.
        // We iterate a reasonable playerid range (0..23) for custom games.
        for (let pid = 0 as PlayerID; pid < 24; pid++) {
            if (!PlayerResource.IsValidPlayerID(pid)) continue;

            const conn = PlayerResource.GetConnectionState(pid) as unknown as number;
            if (conn !== CONN_CONNECTED && conn !== CONN_ABANDONED && conn !== CONN_DISCONNECTED) {
                continue;
            }

            const team = PlayerResource.GetTeam(pid);
            const idKey = tostring(PlayerResource.GetSteamAccountID(pid)); // keep consistent with -rank
            if (team === winningTeam) {
                winners.push(idKey);
            } else {
                losers.push(idKey);
            }
        }

        // Submit results (+25 / -25) and mirror to nettable inside the manager
        this.mmr.SubmitMatchResults(winners, losers);
        print(`[MMR] Submitted results. Winners: ${winners.join(", ")} | Losers: ${losers.join(", ")}`);
    }
}

//     private OnNpcSpawned(event: NpcSpawnedEvent) {
//         // After a hero unit spawns, apply modifier_panic for 8 seconds
//         const unit = EntIndexToHScript(event.entindex) as CDOTA_BaseNPC; // Cast to npc since this is the 'npc_spawned' event
//         // Give all real heroes (not illusions) the meepo_earthbind_ts_example spell
//         if (unit.IsRealHero()) {
//             if (!unit.HasAbility("meepo_earthbind_ts_example")) {
//                 // Add lua ability to the unit
//                 unit.AddAbility("meepo_earthbind_ts_example");
//             }
//         }
//     }
// }
