// ponytail: compteur global de process. Le collecteur exécute UN tick à la fois (scheduler
// séquentiel) → reset au début / read à la fin = sûr. En process web, un refresh manuel
// concurrent à un /api/quote peut gonfler le compte (rare, plafond accepté).
let n = 0;
export function bumpRpc(): void { n++; }
export function readRpc(): number { return n; }
export function resetRpc(): void { n = 0; }
