/**
 * post_game.ts
 * Purpose: Client-side logic for the custom End Screen. Reads final MMR results
 *          from Custom NetTable "postgame" keyed by PlayerID and updates UI.
 *
 * Build: Compile to JS and emit at:
 *   resources/scripts/custom_game/post_game.js
 *
 * Data contract (from server/VScript):
 *   CustomNetTables.SetTableValue("postgame", tostring(playerID), {
 *     old: number,
 *     new: number,
 *     name: string,        // optional; fallback to Players.GetPlayerName
 *     team: number,        // 2 Radiant, 3 Dire
 *     doubledown: boolean  // optional
 *   });
 */

// -------- Types --------
interface PostgameKV {
  old?: number;
  new?: number;
  name?: string;
  team?: number;
  doubledown?: boolean;
}

// -------- Helpers --------
function $(id: string): Panel {
  // Find by ID anywhere under this layout
  return $.GetContextPanel().FindChildTraverse(id) as Panel;
}

function setText(id: string, txt: string): void {
  const p = $(id) as Label;
  if (p) (p as Label).text = txt;
}

function setVisible(id: string, vis: boolean): void {
  const p = $(id);
  if (p) p.visible = vis;
}

function teamName(team?: number): string {
  if (team === 2) return "Radiant";
  if (team === 3) return "Dire";
  return "";
}

function colorizeDelta(label: Label, delta: number): void {
  // Green for gain, red for loss, neutral gray for zero
  const style = delta > 0 ? "#7fe07f" : delta < 0 ? "#ff7f7f" : "#9aa3ab";
  label.style.color = style;
}

// -------- Rendering --------
function renderFromKV(kv: PostgameKV, pid: PlayerID): void {
  const name =
    kv.name && kv.name.length > 0 ? kv.name : Players.GetPlayerName(pid) || "Player";
  const oldVal = typeof kv.old === "number" ? kv.old : undefined;
  const newVal = typeof kv.new === "number" ? kv.new : undefined;

  // Header + who/where
  setText("PlayerName", name);
  setText("TeamName", teamName(kv.team));

  // Numbers
  if (oldVal !== undefined) setText("OldMMR", String(oldVal));
  if (newVal !== undefined) setText("NewMMR", String(newVal));

  // Delta (only if both present)
  if (oldVal !== undefined && newVal !== undefined) {
    const delta = newVal - oldVal;
    const sign = delta > 0 ? "+" : delta < 0 ? "" : "±";
    setText("Delta", `${sign}${delta === 0 ? 0 : delta}`);
    colorizeDelta($("#Delta") as Label, delta);
  } else {
    setText("Delta", "");
  }

  // Doubledown badge
  setVisible("DoubleDownFlag", !!kv.doubledown);

  // Status
  setText("Status", "Final results loaded.");
}

// -------- Data fetch / retry --------
function tryFetchAndRender(pid: PlayerID): boolean {
  const key = String(pid);
  const kv = CustomNetTables.GetTableValue("postgame", key) as PostgameKV | undefined;
  if (!kv) return false;
  renderFromKV(kv, pid);
  return true;
}

function init(): void {
  const pid = Players.GetLocalPlayer();
  let attempt = 0;

  // Immediate attempt + short retry loop to cover race conditions
  const tick = function tick(): void {
    if (tryFetchAndRender(pid)) return;
    attempt++;
    if (attempt <= 40) {
      // ~10 seconds total if 0.25s cadence
      if (attempt === 1) setText("Status", "Waiting for results…");
      $.Schedule(0.25, tick);
    } else {
      setText("Status", "Waiting for results… (timeout)");
    }
  };
  tick();

  // Live updates if the server writes after we start listening
  CustomNetTables.SubscribeNetTableListener(
    "postgame",
    (_tableName: string, key: string, data: PostgameKV) => {
      if (key === String(pid) && data) {
        renderFromKV(data, pid);
      }
    }
  );
}

// -------- Button handlers (wire server or local actions as you prefer) --------
function OnPlayAgain(): void {
  // Send a signal to the server; handle there (e.g., return to lobby or restart)
  Game.EmitSound("ui.button_click");
  GameEvents.SendCustomGameEventToServer("rturbo_play_again", {});
  setText("Status", "Requesting a new match…");
}

function OnExit(): void {
  // Let the server decide how to handle exit/return
  Game.EmitSound("ui.button_click");
  GameEvents.SendCustomGameEventToServer("rturbo_exit", {});
  setText("Status", "Exiting…");
}

// Expose handlers to XML (Panorama looks up globals by name)
($.GetContextPanel() as any).OnPlayAgain = OnPlayAgain;
($.GetContextPanel() as any).OnExit = OnExit;

// Kick off
(function () {
  init();
})();
