// hud.ts — HUD + integrated PostGame controller (merged, clean)
$.Msg("Hud panorama loaded");

// Make sure Valve endgame UI won't block ours
try {
  GameUI.SetDefaultUIEnabled(DotaDefaultUIElement_t.DOTA_DEFAULT_UI_ENDGAME, false);
  GameUI.SetDefaultUIEnabled(DotaDefaultUIElement_t.DOTA_DEFAULT_UI_ENDGAME_CHAT, false);
  GameUI.SetDefaultUIEnabled(DotaDefaultUIElement_t.DOTA_DEFAULT_UI_FIGHT_RECAP, false);
} catch (e) {
  $.Msg("[HUD] Failed to disable some default UI:", e);
}

/* -------------------- Utilities -------------------- */
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
  (p.style as any).color = delta > 0 ? "#7fe07f" : delta < 0 ? "#ff7f7f" : "#9aa3ab";
}

/* -------------------- Double Down (HUD) -------------------- */
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

/* -------------------- Always-on MMR badge -------------------- */
let startMMR: number | undefined;
function SetMMRBadge(mmr: number): void {
  const label = byId("MMRLabel") as LabelPanel | null;
  if (label) label.text = `MMR: ${mmr}`;
  else $.Schedule(0.05, () => SetMMRBadge(mmr));
}

/* -------------------- Integrated PostGame -------------------- */
type PGBool = boolean | 0 | 1;
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

/* -------------------- Buttons in PostGame -------------------- */
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

/* -------------------- Init -------------------- */
function init(): void {
  // HUD badge feed
  GameEvents.Subscribe("mmr_current", (data: { mmr?: number }) => {
    const n = Number(data && data.mmr);
    if (!isNaN(n)) {
      $.Msg("[MMR] HUD received mmr_current:", n);
      if (startMMR === undefined) startMMR = n;
      SetMMRBadge(n);
    }
  });

  // PostGame polling + listener
  const pid = Players.GetLocalPlayer();
  let attempt = 0;
  const tick = () => {
    if (tryFetchAndRenderPostGame(pid)) return;
    attempt++;
    if (attempt <= 40) {
      if (attempt === 1) setText("Status", "Waiting for results…");
      $.Schedule(0.25, tick); // ~10s
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

  // Expose button handlers for XML
  (($.GetContextPanel() as any)).OnDoubleDownClicked = OnDoubleDownClicked;
  (($.GetContextPanel() as any)).OnDoubleDownCloseClicked = OnDoubleDownCloseClicked;
  (($.GetContextPanel() as any)).OnPlayAgain = OnPlayAgain;
  (($.GetContextPanel() as any)).OnExit = OnExit;
}

(() => init())();
