// Single source of truth: what will the "Execute" button actually run?
//
// Loaded as a classic <script> BEFORE app.js (defines globalThis.chooseExec) AND
// imported by web/choose-exec.test.ts (via module.exports). Pure — no DOM access.
//
// Why this file exists: the row the UI *displays* as the execution target and the
// row doExecute() *runs* must be the SAME object. When they were computed in two
// places they diverged — the render showed "Execute via xBull" while doExecute
// gated the composite 2-tx flow on the displayed winner, so every selected venue
// opened the 2-tx popup for BLND->EURC. Both render and action now call this.
(function (root) {
  function chooseExec(selectedSource, simResult) {
    var ladder = (simResult && simResult.ladder) || [];
    var winRow = ladder.find(function (r) { return r.winner; }) || null;
    var selRow = selectedSource
      ? (ladder.find(function (r) { return r.sourceId === selectedSource; }) || null)
      : null;
    // Explicit selection wins; otherwise the displayed winner is the target.
    var row = selRow || winRow;
    // Composite EURC via-USDC rows carry a "leg1+leg2" sourceId (and .legs).
    var isComposite = !!(row && row.sourceId && row.sourceId.indexOf('+') !== -1);
    return { row: row, selRow: selRow, winRow: winRow, isComposite: isComposite };
  }
  root.chooseExec = chooseExec;
  if (typeof module !== 'undefined' && module.exports) module.exports = { chooseExec: chooseExec };
})(typeof globalThis !== 'undefined' ? globalThis : this);
