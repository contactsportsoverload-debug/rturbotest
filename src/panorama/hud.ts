// hud.ts — minimal: Double Down + MMR badge
$.Msg("Hud panorama loaded");

/* -------------------- helpers -------------------- */
function byId(id: string): Panel | null {
  return $.GetContextPanel().FindChildTraverse(id);
}
function setMMRBadge(mmr: number): void {
  const label = byId("MMRLabel") as LabelPanel | null;
  if (label) label.text = `MMR: ${mmr}`;
  else $.Schedule(0.05, () => setMMRBadge(mmr));
}

/* -------------------- Double Down -------------------- */
function OnDoubleDownClicked(): void {
  $.Msg("[DOUBLE DOWN] button pressed");
  GameEvents.SendCustomGameEventToServer("double_down_clicked", {});
  const btn = byId("DDAction") as Panel | null;
  if (btn) (btn as any).enabled = false;
  const dd = byId("DoubleDown");
  if (dd) dd.DeleteAsync(0);
}
function OnDoubleDownCloseClicked(): void {
  $.Msg("[DOUBLE DOWN] closed");
  const dd = byId("DoubleDown");
  if (dd) dd.DeleteAsync(0);
}

/* -------------------- MMR badge feed -------------------- */
let startMMR: number | undefined;
GameEvents.Subscribe("mmr_current", (data: { mmr?: number }) => {
  const n = Number(data && data.mmr);
  if (!isNaN(n)) {
    if (startMMR === undefined) startMMR = n;
    setMMRBadge(n);
  }
});

/* -------------------- expose for XML -------------------- */
($.GetContextPanel() as any).OnDoubleDownClicked = OnDoubleDownClicked;
($.GetContextPanel() as any).OnDoubleDownCloseClicked = OnDoubleDownCloseClicked;
