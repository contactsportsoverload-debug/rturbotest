// hud.ts
// Purpose: HUD logic.
// - Double Down panel (left edge): logs on click/close, notifies server, disables button, and closes panel.
// - "mmr + icon": always-on MMR badge wired to "mmr_current" from server.
// - Temporary end-of-game overlay (#tempendmmr): shown on "mmr_final" with OLD -> NEW summary.

$.Msg("Hud panorama loaded");

/** ===== Double Down panel ===== */
function OnDoubleDownClicked() {
    $.Msg("[DOUBLE DOWN] button pressed");

    // Notify server that this player opted into double down
    GameEvents.SendCustomGameEventToServer("double_down_clicked", {});

    // Extra-safe: disable the button to avoid double-fires before delete happens
    const btn = $("#DDAction") as Panel | undefined;
    if (btn) btn.enabled = false;

    const dd = $("#DoubleDown") as Panel | undefined;
    if (dd) dd.DeleteAsync(0);
}

function OnDoubleDownCloseClicked() {
    $.Msg("[DOUBLE DOWN] button not pressed");
    const dd = $("#DoubleDown") as Panel | undefined;
    if (dd) dd.DeleteAsync(0);
}
/** ===== /Double Down ===== */


/** ===== (Old) Example Panel logic (kept; not referenced now) ===== */
function OnCloseButtonClicked() {
    $.Msg("Example close button clicked");
    const examplePanel = $("#ExamplePanel");
    examplePanel.DeleteAsync(0);
    GameEvents.SendCustomGameEventToServer("ui_panel_closed", {});
}
/** ===== /Old Example ===== */


/** ===== Utilities kept from template ===== */
function toArray<T>(obj: Record<number, T>): T[] {
    const result: T[] = [];
    let key = 1;
    while (obj[key]) { result.push(obj[key]); key++; }
    return result;
}

async function sleep(time: number): Promise<void> {
    return new Promise<void>((resolve) => $.Schedule(time, resolve));
}
/** ===== /Utilities ===== */


/** ===== "mmr + icon" — Always-on MMR badge =====
 *  - SetMMRBadge(n): updates #MMRLabel (created in hud.xml).
 *  - Subscribe to "mmr_current" for real server payloads: { mmr: number }.
 *  - Cache the first received mmr as startMMR (used by temp end overlay).
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
 *  Shows #tempendmmr and writes summary into #TempStatus when final numbers arrive.
 */
function ShowTempEndOverlay(oldVal: number | undefined, newVal: number): void {
    const overlay = $("#tempendmmr") as Panel | undefined;
    if (!overlay) { $.Schedule(0.05, () => ShowTempEndOverlay(oldVal, newVal)); return; }

    const effectiveOld = typeof oldVal === "number" ? oldVal : (typeof startMMR === "number" ? startMMR : undefined);
    const delta = (typeof effectiveOld === "number") ? newVal - effectiveOld : undefined;

    const status = $("#TempStatus") as LabelPanel | undefined;
    if (status) {
        if (typeof effectiveOld === "number" && typeof delta === "number") {
            const sign = delta > 0 ? "+" : delta < 0 ? "" : "±";
            status.text = `Final MMR: ${effectiveOld} → ${newVal}  (${sign}${delta === 0 ? 0 : delta})`;
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
    const oldVal = (typeof data?.old === "number") ? data!.old! : startMMR;
    const newVal = Number(data?.new);
    if (!isNaN(newVal)) {
        $.Msg("[MMR] HUD received mmr_final:", oldVal, "->", newVal);
        ShowTempEndOverlay(oldVal, newVal);
    } else {
        $.Msg("[MMR] mmr_final payload missing 'new' value");
    }
});
/** ===== /Temporary end-of-game overlay ===== */


/** ===== Example event subscription (unchanged; safe to keep) ===== */
GameEvents.Subscribe("example_event", (data: NetworkedData<ExampleEventData>) => {
    const myNumber = data.myNumber;
    const myString = data.myString;

    const myBoolean = data.myBoolean; // After sending to client this is now type 0 | 1!
    const myArrayObject = data.myArrayOfNumbers; // After sending this is now an object!
    const myArray = toArray(myArrayObject);      // Turn it back into an array ourselves.

    $.Msg("Received example event", myNumber, myString, myBoolean, myArrayObject, myArray);
});
/** ===== /Example subscription ===== */
