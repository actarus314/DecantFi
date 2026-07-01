// Pure decision: how to execute EURC composite leg2.
// Loaded as a classic <script> BEFORE app.js (defines globalThis.chooseLeg2Dispatch).
// Also imported by web/composite-leg2-dispatch.test.ts. No DOM access.
//
// Returns 'stellarbroker' when the composite leg2 was quoted via StellarBroker
// (→ dispatch to Mediator WS flow instead of /api/build; SB is not a valid server venue).
// Returns 'server' for all other leg2 sources (→ /api/build as before).
(function (root) {
  function chooseLeg2Dispatch(comp) {
    return (comp && comp.leg2Source === 'stellarbroker') ? 'stellarbroker' : 'server';
  }
  root.chooseLeg2Dispatch = chooseLeg2Dispatch;
  if (typeof module !== 'undefined' && module.exports) module.exports = { chooseLeg2Dispatch: chooseLeg2Dispatch };
})(typeof globalThis !== 'undefined' ? globalThis : this);
