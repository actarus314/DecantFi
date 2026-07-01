// Browser polyfill: @stellar-broker/client tx-processor.js uses the Node global Buffer,
// undefined in browsers. esbuild `inject` substitutes free `Buffer` references with this export.
export { Buffer } from 'buffer';
