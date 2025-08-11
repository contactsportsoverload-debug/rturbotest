/**
 * end_screen.ts
 * Static End Screen logic: reads NetTable "postgame" and fills labels in post_game.xml.
 * This version avoids overriding `$` and avoids dynamic CreatePanel calls.
 *
 * Output JS: resources/scripts/custom_game/end_screen.js
 * If you use this filename, update post_game.xml to:
 *   <include src="file://{resources}/scripts/custom_game/end_screen.js" />
 */

/* -------- minimal shims (remove if you use @moddota/panorama-types) -------- */
type PlayerID = number;
type Panel = any;
type Label = any;
declare const $: any;
declare const Players: any;
declare const CustomNetTables: any;
declare const Game: any;
declare const GameEvents: any;
/* -------------------------------------------------------------------------- */

interface PostgameKV {
  old?: number;
  new?: number;
  name?: string;
  team?: number;       // 2 Radiant, 3 Dire
  doubledown?: boolean;
}

const root: Panel = $.GetContextPanel();

function byId(id: string): Panel | undefined {
  return root.FindChildTraverse(id) as Panel | undefined;
}

function setText(id: string, txt: string): void {
  const p = byId(id) as Label | undefined;
  if (p) (p as any).text = txt;
}

function setVisible(id: string, vis: boolean): void {
  const p = byId(id);
  if (p) p.visible = vis;
}

function teamName(team?: number): string {
  if (team === 2) return "Radiant";
  if (team === 3) return "Dire";
  return "";
}

function colorizeDelta(delta: number): void {
  const p = byId("Delta") as Label | undefined;
  if (!p) return;
  const color = delta > 0 ? "#7fe07f" : delta < 0 ? "#ff7f7f" : "#9aa3ab";
  (p as any).style.color = color;
}

function renderFromKV(kv: PostgameKV, pid: PlayerID): void {
  const name =
    kv.name && kv.name.length > 0 ? kv.name : Players.GetPlayerName(pid) || "Player";
  const oldVal = typeof kv.old === "number" ? kv.old : undefined;
  const newVal = typeof kv.new === "number" ? kv.new : undefined;

  setText("PlayerName", name);
  setText("TeamName", teamName(kv.team));

  if (oldVal !== undefined) setText("OldMMR", String(oldVal));
  if (newVal !== undefined) setText("NewMMR", String(newVal));

  if (oldVal !== undefined && newVal !== undefined) {
    const delta = newVal - oldVal;
    const sign = delta > 0 ? "+" : delta < 0 ? "" : "±";
    setText("Delta", `${sign}${delta === 0 ? 0 : delta}`);
    colorizeDelta(delta);
  } else {
    setText("Delta", "");
  }

  setVisible("DoubleDownFlag", !!kv.doubledown);
  setText("Status", "Final results loaded.");
}

function tryFetchAndRender(pid: PlayerID): boolean {
  const kv = CustomNetTables.GetTableValue("postgame", String(pid)) as PostgameKV | undefined;
  if (!kv) return false;
  renderFromKV(kv, pid);
  return true;
}

function init(): void {
  const pid: PlayerID = Players.GetLocalPlayer();
  let attempt = 0;

  const tick = () => {
    if (tryFetchAndRender(pid)) return;
    attempt++;
    if (attempt <= 40) {
      if (attempt === 1) setText("Status", "Waiting for results…");
      $.Schedule(0.25, tick); // ~10s total
    } else {
      setText("Status", "Waiting for results… (timeout)");
    }
  };
  tick();

  CustomNetTables.SubscribeNetTableListener(
    "postgame",
    (_tableName: string, key: string, data: PostgameKV) => {
      if (key === String(pid) && data) {
        renderFromKV(data, pid);
      }
    }
  );
}

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

// expose handlers for XML
(root as any).OnPlayAgain = OnPlayAgain;
(root as any).OnExit = OnExit;

(() => init())();
