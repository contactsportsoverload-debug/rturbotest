// hud.ts
// Purpose: HUD logic.
// - Disables Valve endgame UI so our EndScreen can show
// - Double Down panel: logs + notifies server, then hides
// - "mmr + icon": always-on badge updated from server "mmr_current"
// - Temp end overlay support (safe if panel is commented out in XML)

$.Msg("Hud panorama loaded");

// Ensure our EndScreen is allowed/visible even if EndScreen layout hasn't loaded yet.
try {
  GameUI.SetDefaultUIEnabled(DotaDefaultUIElement_t.DOTA_DEFAULT_UI_ENDGAME, false);
  GameUI.SetDefaultUIEnabled(DotaDefaultUIElement_t.DOTA_DEFAULT_UI_ENDGAME_CHAT, false);
  GameUI.SetDefaultUIEnabled(DotaDefaultUIElement_t.DOTA_DEFAULT_UI_FIGHT_RECAP, false);
} catch (e) {
  $.Msg("[HUD] Failed to disable some default UI:", e);
}

/** ===== Double Down panel ===== */
function OnDoubleDownClicked(): void {
  $.Msg("[DOUBLE DOWN] button pressed");
  // Notify server that this player opted into double down
  GameEvents.SendCustomGameEventToServer("double_down_clicked", {});
  // Extra-safe: disable the button to avoid double-fires before delete happens
  const btn = $("#DDAction") as Panel | undefined;
  if (btn) btn.enabled = false;
  const dd = $("#DoubleDown") as Panel | undefined;
  if (dd) dd.DeleteAsync(0);
}

function OnDoubleDownCloseClicked(): void {
  $.Msg("[DOUBLE DOWN] button not pressed");
  const dd = $("#DoubleDown") as Panel | undefined;
  if (dd) dd.DeleteAsync(0);
}
/** ===== /Double Down ===== */

/** ===== (Old) Example Panel logic (kept; not referenced now) ===== */
function OnCloseButtonClicked(): void {
  $.Msg("Example close button clicked");
  const examplePanel = $("#ExamplePanel") as Panel | undefined;
  if (examplePanel) examplePanel.DeleteAsync(0);
  GameEvents.SendCustomGameEventToServer("ui_panel_closed", {});
}
/** ===== /Old Example ===== */

/** ===== Utilities kept from template ===== */
function toArray<T>(obj: Record<number, T>): T[] {
  const result: T[] = [];
  let key = 1;
  while ((obj as any)[key]) {
    result.push((obj as any)[key]);
    key++;
  }
  return result;
}

async function sleep(time: number): Promise<void> {
  return new Promise((resolve) => $.Schedule(time, resolve));
}
/** ===== /Utilities ===== */

/** ===== "mmr + icon" — Always-on MMR badge =====
 * - SetMMRBadge(n): updates #MMRLabel (created in hud.xml).
 * - Subscribe to "mmr_current" for real server payloads: { mmr: number }.
 * - Cache the first received mmr as startMMR (used by temp end overlay).
 */
let startMMR: number | undefined;

function SetMMRBadge(mmr: number): void {
  const label = $("#MMRLabel") as LabelPanel | undefined;
  if (label) {
    label.text = `MMR: ${mmr}`;
    return;
  }
  $.Schedule(0.05, () => SetMMRBadge(mmr));
}

GameEvents.Subscribe("mmr_current", (data: { mmr?: number }) => {
  const n = Number(data && data.mmr);
  if (!isNaN(n)) {
    $.Msg("[MMR] HUD received mmr_current:", n);
    if (startMMR === undefined) startMMR = n;
    SetMMRBadge(n);
  }
});
/** ===== /mmr + icon ===== */

/** ===== Temporary end-of-game overlay (HUD-based) =====
 * Shows #tempendmmr and writes summary into #TempStatus when final numbers arrive.
 * Safe even if the panel is commented out in XML.
 */
function ShowTempEndOverlay(oldVal: number | undefined, newVal: number): void {
  const overlay = $("#tempendmmr") as Panel | undefined;
  if (!overlay) {
    $.Schedule(0.05, () => ShowTempEndOverlay(oldVal, newVal));
    return;
  }
  const effectiveOld =
    typeof oldVal === "number" ? oldVal : typeof startMMR === "number" ? startMMR : undefined;

  const delta = typeof effectiveOld === "number" ? newVal - effectiveOld : undefined;

  const status = $("#TempStatus") as LabelPanel | undefined;
  if (status) {
    if (typeof effectiveOld === "number" && typeof delta === "number") {
      const sign = delta > 0 ? "+" : delta < 0 ? "" : "±";
      status.text = `Final MMR: ${effectiveOld} → ${newVal} (${sign}${delta === 0 ? 0 : delta})`;
    } else {
      status.text = `Final MMR: ${newVal}`;
    }
  }

  overlay.visible = true;

  // Optional: hide DoubleDown panel once overlay is shown
  const dd = $("#DoubleDown") as Panel | undefined;
  if (dd) dd.visible = false;
}

/** Listen for final numbers from server */
GameEvents.Subscribe("mmr_final", (data: { old?: number; new?: number }) => {
  const oldVal = typeof data?.old === "number" ? (data!.old as number) : startMMR;
  const newVal = Number(data?.new);
  if (!isNaN(newVal)) {
    $.Msg("[MMR] HUD received mmr_final:", oldVal, "->", newVal);
    ShowTempEndOverlay(oldVal, newVal);
  } else {
    $.Msg("[MMR] mmr_final payload missing 'new' value");
  }
});
/** ===== /Temporary end-of-game overlay ===== */

/** ===== Example event subscription (typed to satisfy NetworkedData<T>) ===== */
type ExamplePayload = {
  myNumber: number;
  myString: string;
  myBoolean: boolean;
  myArrayOfNumbers: number[];
};

GameEvents.Subscribe("example_event", (data: NetworkedData<ExamplePayload>) => {
  const myNumber = data.myNumber;
  const myString = data.myString;
  const myBoolean = data.myBoolean; // After sending to client this is now type 0 | 1!
  const myArrayObject = data.myArrayOfNumbers; // After sending this is now an object!
  const myArray = toArray(myArrayObject); // Turn it back into an array ourselves.
  $.Msg("Received example event", myNumber, myString, myBoolean, myArrayObject, myArray);
});
/** ===== /Example subscription ===== */

// Expose handlers used by hud.xml buttons
($.GetContextPanel() as any).OnDoubleDownClicked = OnDoubleDownClicked;
($.GetContextPanel() as any).OnDoubleDownCloseClicked = OnDoubleDownCloseClicked;
