// hud.ts
// Purpose: HUD logic + integrated PostGame panel controller.
// Notes:
// - No '$' shadowing — we use byId()
// - Local types only (no collisions with other files)

$.Msg("Hud panorama loaded");

// Ensure our EndScreen is allowed/visible even if EndScreen layout hasn't loaded yet.
try {
  GameUI.SetDefaultUIEnabled(DotaDefaultUIElement_t.DOTA_DEFAULT_UI_ENDGAME, false);
  GameUI.SetDefaultUIEnabled(DotaDefaultUIElement_t.DOTA_DEFAULT_UI_ENDGAME_CHAT, false);
  GameUI.SetDefaultUIEnabled(DotaDefaultUIElement_t.DOTA_DEFAULT_UI_FIGHT_RECAP, false);
} catch (e) {
  $.Msg("[HUD] Failed to disable some default UI:", e);
}

/** ===== Utilities ===== */
function byId(id: string): Panel | null {
  return $.GetContextPanel().FindChildTraverse(id);
}
function setText(id: string, txt: string): void {
  const p = byId(id) as LabelPanel | null;
  if (p) p.text = txt;
}
function setVisible(id: string, vis: boolean): void {
  const p = byId(id);
  if (p) p.visible = vis;
}
function teamName(team?: DOTATeam_t): string {
  if (team === DOTATeam_t.DOTA_TEAM_GOODGUYS) return "Radiant";
  if (team === DOTATeam_t.DOTA_TEAM_BADGUYS) return "Dire";
  return "";
}
function colorizeDelta(delta: number): void {
  const p = byId("Delta") as LabelPanel | null;
  if (!p) return;
  const color = delta > 0 ? "#7fe07f" : delta < 0 ? "#ff7f7f" : "#9aa3ab";
  (p.style as any).color = color;
}
/** ===== /Utilities ===== */

/** ===== Double Down panel ===== */
function OnDoubleDownClicked(): void {
  $.Msg("[DOUBLE DOWN] button pressed");
  GameEvents.SendCustomGameEventToServer("double_down_clicked", {});
  const btn = byId("DDAction") as Panel | null;
  if (btn) (btn as any).enabled = false;
  const dd = byId("DoubleDown");
  if (dd) dd.DeleteAsync(0);
}

function OnDoubleDownCloseClicked(): void {
  $.Msg("[DOUBLE DOWN] button not pressed");
  const dd = byId("DoubleDown");
  if (dd) dd.DeleteAsync(0);
}
/** ===== /Double Down ===== */

/** ===== Always-on MMR badge ===== */
let startMMR: number | undefined;

function SetMMRBadge(mmr: number): void {
  const label = byId("MMRLabel") as LabelPanel | null;
  if (label) {
    label.text = `MMR: ${mmr}`;
  } else {
    $.Schedule(0.05, () => SetMMRBadge(mmr));
  }
}

GameEvents.Subscribe("mmr_current", (data: { mmr?: number }) => {
  const n = Number(data && data.mmr);
  if (!isNaN(n)) {
    $.Msg("[MMR] HUD received mmr_current:", n);
    if (startMMR === undefined) startMMR = n;
    SetMMRBadge(n);
  }
});
/** ===== /MMR badge ===== */

/** ===== Integrated PostGame panel ===== */
type PGBool = boolean | 0 | 1; // local alias to avoid global collisions
interface PostgameKV {
  old?: number;
  new?: number;
  name?: string;
  team?: DOTATeam_t;
  doubledown?: PGBool;
}

function toBool(v: PGBool | undefined): boolean {
  return v === true || v === 1;
}

function normalizeKV(v: CustomNetTableDeclarations["postgame"][string]): PostgameKV {
  return {
    old: v.old,
    new: v.new,
    name: v.name,
    team: v.team,
    doubledown: v.doubledown as PGBool | undefined,
  };
}

function showPostGame(): void {
  const root = byId("PostGameRoot");
  if (root) {
    root.visible = true;
    (root.style as any).zIndex = "1000";
  }
}

function renderPostGame(kv: PostgameKV, pid: PlayerID): void {
  const name = kv.name && kv.name.length > 0 ? kv.name : Players.GetPlayerName(pid) || "Player";
  const oldVal = typeof kv.old === "number" ? kv.old : startMMR;
  const newVal = typeof kv.new === "number" ? kv.new : undefined;

  setText("PlayerName", name);
  setText("TeamName", teamName(kv.team));

  if (typeof oldVal === "number") setText("OldMMR", String(oldVal));
  if (typeof newVal === "number") setText("NewMMR", String(newVal));

  if (typeof oldVal === "number" && typeof newVal === "number") {
    const delta = newVal - oldVal;
    const sign = delta > 0 ? "+" : delta < 0 ? "" : "±";
    setText("Delta", `${sign}${delta === 0 ? 0 : delta}`);
    colorizeDelta(delta);
  } else {
    setText("Delta", "");
  }

  setVisible("DoubleDownFlag", toBool(kv.doubledown));
  setText("Status", "Final results loaded.");
  showPostGame();
}

function tryFetchAndRenderPostGame(pid: PlayerID): boolean {
  const raw = CustomNetTables.GetTableValue("postgame", String(pid)) as
    | CustomNetTableDeclarations["postgame"][string]
    | undefined;
  if (!raw) return false;
  renderPostGame(normalizeKV(raw), pid);
  return true;
}

function initPostGamePoll(): void {
  const pid = Players.GetLocalPlayer();
  let attempt = 0;

  const tick = () => {
    if (tryFetchAndRenderPostGame(pid)) return;
    attempt++;
    if (attempt <= 40) {
      if (attempt === 1) setText("Status", "Waiting for results…");
      $.Schedule(0.25, tick); // ~10s total
    } else {
      setText("Status", "Waiting for results… (timeout)");
    }
  };
  tick();

  CustomNetTables.SubscribeNetTableListener("postgame", (_table, key, value) => {
    if (key === String(pid) && value) {
      renderPostGame(normalizeKV(value as CustomNetTableDeclarations["postgame"][string]), pid);
    }
  });
}

// Buttons in integrated PostGame panel
function OnPlayAgain(): void {
  Game.EmitSound("ui.button_click");
  GameEvents.SendCustomGameEventToServer("rturbo_play_again", {});
  setText("Status", "Requesting a new match…");
}
function OnExit(): void {
  Game.EmitSound("ui.button_click");
  GameEvents.SendCustomGameEventToServer("rturbo_exit", {});
  setText("Status", "Exiting…");
}

// Expose handlers used by hud.xml buttons
($.GetContextPanel() as any).OnDoubleDownClicked = OnDoubleDownClicked;
($.GetContextPanel() as any).OnDoubleDownCloseClicked = OnDoubleDownCloseClicked;
($.GetContextPanel() as any).OnPlayAgain = OnPlayAgain;
($.GetContextPanel() as any).OnExit = OnExit;

// Kick off PostGame polling
initPostGamePoll();
/** ===== /Integrated PostGame panel ===== */

/** ===== Example event subscription (typed) ===== */
type ExamplePayload = {
  myNumber: number;
  myString: string;
  myBoolean: boolean;
  myArrayOfNumbers: number[];
};
function toArray<T>(obj: Record<number, T>): T[] {
  const result: T[] = [];
  let key = 1;
  while ((obj as any)[key]) {
    result.push((obj as any)[key]);
    key++;
  }
  return result;
}
GameEvents.Subscribe("example_event", (data: NetworkedData<ExamplePayload>) => {
  const myNumber = data.myNumber;
  const myString = data.myString;
  const myBoolean = data.myBoolean; // becomes 0|1 when networked
  const myArrayObject = data.myArrayOfNumbers; // becomes object when networked
  const myArray = toArray(myArrayObject);
  $.Msg("Received example event", myNumber, myString, myBoolean, myArrayObject, myArray);
});
/** ===== /Example subscription ===== */
