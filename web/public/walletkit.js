var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __require = /* @__PURE__ */ ((x4) => typeof require !== "undefined" ? require : typeof Proxy !== "undefined" ? new Proxy(x4, {
  get: (a5, b4) => (typeof require !== "undefined" ? require : a5)[b4]
}) : x4)(function(x4) {
  if (typeof require !== "undefined") return require.apply(this, arguments);
  throw Error('Dynamic require of "' + x4 + '" is not supported');
});
var __commonJS = (cb, mod) => function __require2() {
  try {
    return mod || (0, cb[__getOwnPropNames(cb)[0]])((mod = { exports: {} }).exports, mod), mod.exports;
  } catch (e5) {
    throw mod = 0, e5;
  }
};
var __copyProps = (to, from2, except, desc) => {
  if (from2 && typeof from2 === "object" || typeof from2 === "function") {
    for (let key of __getOwnPropNames(from2))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from2[key], enumerable: !(desc = __getOwnPropDesc(from2, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));

// (disabled):crypto
var require_crypto = __commonJS({
  "(disabled):crypto"() {
  }
});

// node_modules/tweetnacl/nacl-fast.js
var require_nacl_fast = __commonJS({
  "node_modules/tweetnacl/nacl-fast.js"(exports, module) {
    (function(nacl) {
      "use strict";
      var gf = function(init) {
        var i6, r7 = new Float64Array(16);
        if (init) for (i6 = 0; i6 < init.length; i6++) r7[i6] = init[i6];
        return r7;
      };
      var randombytes = function() {
        throw new Error("no PRNG");
      };
      var _0 = new Uint8Array(16);
      var _9 = new Uint8Array(32);
      _9[0] = 9;
      var gf0 = gf(), gf1 = gf([1]), _121665 = gf([56129, 1]), D3 = gf([30883, 4953, 19914, 30187, 55467, 16705, 2637, 112, 59544, 30585, 16505, 36039, 65139, 11119, 27886, 20995]), D22 = gf([61785, 9906, 39828, 60374, 45398, 33411, 5274, 224, 53552, 61171, 33010, 6542, 64743, 22239, 55772, 9222]), X = gf([54554, 36645, 11616, 51542, 42930, 38181, 51040, 26924, 56412, 64982, 57905, 49316, 21502, 52590, 14035, 8553]), Y = gf([26200, 26214, 26214, 26214, 26214, 26214, 26214, 26214, 26214, 26214, 26214, 26214, 26214, 26214, 26214, 26214]), I2 = gf([41136, 18958, 6951, 50414, 58488, 44335, 6150, 12099, 55207, 15867, 153, 11085, 57099, 20417, 9344, 11139]);
      function ts64(x4, i6, h5, l5) {
        x4[i6] = h5 >> 24 & 255;
        x4[i6 + 1] = h5 >> 16 & 255;
        x4[i6 + 2] = h5 >> 8 & 255;
        x4[i6 + 3] = h5 & 255;
        x4[i6 + 4] = l5 >> 24 & 255;
        x4[i6 + 5] = l5 >> 16 & 255;
        x4[i6 + 6] = l5 >> 8 & 255;
        x4[i6 + 7] = l5 & 255;
      }
      function vn(x4, xi, y5, yi, n5) {
        var i6, d5 = 0;
        for (i6 = 0; i6 < n5; i6++) d5 |= x4[xi + i6] ^ y5[yi + i6];
        return (1 & d5 - 1 >>> 8) - 1;
      }
      function crypto_verify_16(x4, xi, y5, yi) {
        return vn(x4, xi, y5, yi, 16);
      }
      function crypto_verify_32(x4, xi, y5, yi) {
        return vn(x4, xi, y5, yi, 32);
      }
      function core_salsa20(o4, p5, k3, c4) {
        var j0 = c4[0] & 255 | (c4[1] & 255) << 8 | (c4[2] & 255) << 16 | (c4[3] & 255) << 24, j1 = k3[0] & 255 | (k3[1] & 255) << 8 | (k3[2] & 255) << 16 | (k3[3] & 255) << 24, j22 = k3[4] & 255 | (k3[5] & 255) << 8 | (k3[6] & 255) << 16 | (k3[7] & 255) << 24, j32 = k3[8] & 255 | (k3[9] & 255) << 8 | (k3[10] & 255) << 16 | (k3[11] & 255) << 24, j4 = k3[12] & 255 | (k3[13] & 255) << 8 | (k3[14] & 255) << 16 | (k3[15] & 255) << 24, j5 = c4[4] & 255 | (c4[5] & 255) << 8 | (c4[6] & 255) << 16 | (c4[7] & 255) << 24, j6 = p5[0] & 255 | (p5[1] & 255) << 8 | (p5[2] & 255) << 16 | (p5[3] & 255) << 24, j7 = p5[4] & 255 | (p5[5] & 255) << 8 | (p5[6] & 255) << 16 | (p5[7] & 255) << 24, j8 = p5[8] & 255 | (p5[9] & 255) << 8 | (p5[10] & 255) << 16 | (p5[11] & 255) << 24, j9 = p5[12] & 255 | (p5[13] & 255) << 8 | (p5[14] & 255) << 16 | (p5[15] & 255) << 24, j10 = c4[8] & 255 | (c4[9] & 255) << 8 | (c4[10] & 255) << 16 | (c4[11] & 255) << 24, j11 = k3[16] & 255 | (k3[17] & 255) << 8 | (k3[18] & 255) << 16 | (k3[19] & 255) << 24, j12 = k3[20] & 255 | (k3[21] & 255) << 8 | (k3[22] & 255) << 16 | (k3[23] & 255) << 24, j13 = k3[24] & 255 | (k3[25] & 255) << 8 | (k3[26] & 255) << 16 | (k3[27] & 255) << 24, j14 = k3[28] & 255 | (k3[29] & 255) << 8 | (k3[30] & 255) << 16 | (k3[31] & 255) << 24, j15 = c4[12] & 255 | (c4[13] & 255) << 8 | (c4[14] & 255) << 16 | (c4[15] & 255) << 24;
        var x0 = j0, x1 = j1, x22 = j22, x32 = j32, x4 = j4, x5 = j5, x6 = j6, x7 = j7, x8 = j8, x9 = j9, x10 = j10, x11 = j11, x12 = j12, x13 = j13, x14 = j14, x15 = j15, u4;
        for (var i6 = 0; i6 < 20; i6 += 2) {
          u4 = x0 + x12 | 0;
          x4 ^= u4 << 7 | u4 >>> 32 - 7;
          u4 = x4 + x0 | 0;
          x8 ^= u4 << 9 | u4 >>> 32 - 9;
          u4 = x8 + x4 | 0;
          x12 ^= u4 << 13 | u4 >>> 32 - 13;
          u4 = x12 + x8 | 0;
          x0 ^= u4 << 18 | u4 >>> 32 - 18;
          u4 = x5 + x1 | 0;
          x9 ^= u4 << 7 | u4 >>> 32 - 7;
          u4 = x9 + x5 | 0;
          x13 ^= u4 << 9 | u4 >>> 32 - 9;
          u4 = x13 + x9 | 0;
          x1 ^= u4 << 13 | u4 >>> 32 - 13;
          u4 = x1 + x13 | 0;
          x5 ^= u4 << 18 | u4 >>> 32 - 18;
          u4 = x10 + x6 | 0;
          x14 ^= u4 << 7 | u4 >>> 32 - 7;
          u4 = x14 + x10 | 0;
          x22 ^= u4 << 9 | u4 >>> 32 - 9;
          u4 = x22 + x14 | 0;
          x6 ^= u4 << 13 | u4 >>> 32 - 13;
          u4 = x6 + x22 | 0;
          x10 ^= u4 << 18 | u4 >>> 32 - 18;
          u4 = x15 + x11 | 0;
          x32 ^= u4 << 7 | u4 >>> 32 - 7;
          u4 = x32 + x15 | 0;
          x7 ^= u4 << 9 | u4 >>> 32 - 9;
          u4 = x7 + x32 | 0;
          x11 ^= u4 << 13 | u4 >>> 32 - 13;
          u4 = x11 + x7 | 0;
          x15 ^= u4 << 18 | u4 >>> 32 - 18;
          u4 = x0 + x32 | 0;
          x1 ^= u4 << 7 | u4 >>> 32 - 7;
          u4 = x1 + x0 | 0;
          x22 ^= u4 << 9 | u4 >>> 32 - 9;
          u4 = x22 + x1 | 0;
          x32 ^= u4 << 13 | u4 >>> 32 - 13;
          u4 = x32 + x22 | 0;
          x0 ^= u4 << 18 | u4 >>> 32 - 18;
          u4 = x5 + x4 | 0;
          x6 ^= u4 << 7 | u4 >>> 32 - 7;
          u4 = x6 + x5 | 0;
          x7 ^= u4 << 9 | u4 >>> 32 - 9;
          u4 = x7 + x6 | 0;
          x4 ^= u4 << 13 | u4 >>> 32 - 13;
          u4 = x4 + x7 | 0;
          x5 ^= u4 << 18 | u4 >>> 32 - 18;
          u4 = x10 + x9 | 0;
          x11 ^= u4 << 7 | u4 >>> 32 - 7;
          u4 = x11 + x10 | 0;
          x8 ^= u4 << 9 | u4 >>> 32 - 9;
          u4 = x8 + x11 | 0;
          x9 ^= u4 << 13 | u4 >>> 32 - 13;
          u4 = x9 + x8 | 0;
          x10 ^= u4 << 18 | u4 >>> 32 - 18;
          u4 = x15 + x14 | 0;
          x12 ^= u4 << 7 | u4 >>> 32 - 7;
          u4 = x12 + x15 | 0;
          x13 ^= u4 << 9 | u4 >>> 32 - 9;
          u4 = x13 + x12 | 0;
          x14 ^= u4 << 13 | u4 >>> 32 - 13;
          u4 = x14 + x13 | 0;
          x15 ^= u4 << 18 | u4 >>> 32 - 18;
        }
        x0 = x0 + j0 | 0;
        x1 = x1 + j1 | 0;
        x22 = x22 + j22 | 0;
        x32 = x32 + j32 | 0;
        x4 = x4 + j4 | 0;
        x5 = x5 + j5 | 0;
        x6 = x6 + j6 | 0;
        x7 = x7 + j7 | 0;
        x8 = x8 + j8 | 0;
        x9 = x9 + j9 | 0;
        x10 = x10 + j10 | 0;
        x11 = x11 + j11 | 0;
        x12 = x12 + j12 | 0;
        x13 = x13 + j13 | 0;
        x14 = x14 + j14 | 0;
        x15 = x15 + j15 | 0;
        o4[0] = x0 >>> 0 & 255;
        o4[1] = x0 >>> 8 & 255;
        o4[2] = x0 >>> 16 & 255;
        o4[3] = x0 >>> 24 & 255;
        o4[4] = x1 >>> 0 & 255;
        o4[5] = x1 >>> 8 & 255;
        o4[6] = x1 >>> 16 & 255;
        o4[7] = x1 >>> 24 & 255;
        o4[8] = x22 >>> 0 & 255;
        o4[9] = x22 >>> 8 & 255;
        o4[10] = x22 >>> 16 & 255;
        o4[11] = x22 >>> 24 & 255;
        o4[12] = x32 >>> 0 & 255;
        o4[13] = x32 >>> 8 & 255;
        o4[14] = x32 >>> 16 & 255;
        o4[15] = x32 >>> 24 & 255;
        o4[16] = x4 >>> 0 & 255;
        o4[17] = x4 >>> 8 & 255;
        o4[18] = x4 >>> 16 & 255;
        o4[19] = x4 >>> 24 & 255;
        o4[20] = x5 >>> 0 & 255;
        o4[21] = x5 >>> 8 & 255;
        o4[22] = x5 >>> 16 & 255;
        o4[23] = x5 >>> 24 & 255;
        o4[24] = x6 >>> 0 & 255;
        o4[25] = x6 >>> 8 & 255;
        o4[26] = x6 >>> 16 & 255;
        o4[27] = x6 >>> 24 & 255;
        o4[28] = x7 >>> 0 & 255;
        o4[29] = x7 >>> 8 & 255;
        o4[30] = x7 >>> 16 & 255;
        o4[31] = x7 >>> 24 & 255;
        o4[32] = x8 >>> 0 & 255;
        o4[33] = x8 >>> 8 & 255;
        o4[34] = x8 >>> 16 & 255;
        o4[35] = x8 >>> 24 & 255;
        o4[36] = x9 >>> 0 & 255;
        o4[37] = x9 >>> 8 & 255;
        o4[38] = x9 >>> 16 & 255;
        o4[39] = x9 >>> 24 & 255;
        o4[40] = x10 >>> 0 & 255;
        o4[41] = x10 >>> 8 & 255;
        o4[42] = x10 >>> 16 & 255;
        o4[43] = x10 >>> 24 & 255;
        o4[44] = x11 >>> 0 & 255;
        o4[45] = x11 >>> 8 & 255;
        o4[46] = x11 >>> 16 & 255;
        o4[47] = x11 >>> 24 & 255;
        o4[48] = x12 >>> 0 & 255;
        o4[49] = x12 >>> 8 & 255;
        o4[50] = x12 >>> 16 & 255;
        o4[51] = x12 >>> 24 & 255;
        o4[52] = x13 >>> 0 & 255;
        o4[53] = x13 >>> 8 & 255;
        o4[54] = x13 >>> 16 & 255;
        o4[55] = x13 >>> 24 & 255;
        o4[56] = x14 >>> 0 & 255;
        o4[57] = x14 >>> 8 & 255;
        o4[58] = x14 >>> 16 & 255;
        o4[59] = x14 >>> 24 & 255;
        o4[60] = x15 >>> 0 & 255;
        o4[61] = x15 >>> 8 & 255;
        o4[62] = x15 >>> 16 & 255;
        o4[63] = x15 >>> 24 & 255;
      }
      function core_hsalsa20(o4, p5, k3, c4) {
        var j0 = c4[0] & 255 | (c4[1] & 255) << 8 | (c4[2] & 255) << 16 | (c4[3] & 255) << 24, j1 = k3[0] & 255 | (k3[1] & 255) << 8 | (k3[2] & 255) << 16 | (k3[3] & 255) << 24, j22 = k3[4] & 255 | (k3[5] & 255) << 8 | (k3[6] & 255) << 16 | (k3[7] & 255) << 24, j32 = k3[8] & 255 | (k3[9] & 255) << 8 | (k3[10] & 255) << 16 | (k3[11] & 255) << 24, j4 = k3[12] & 255 | (k3[13] & 255) << 8 | (k3[14] & 255) << 16 | (k3[15] & 255) << 24, j5 = c4[4] & 255 | (c4[5] & 255) << 8 | (c4[6] & 255) << 16 | (c4[7] & 255) << 24, j6 = p5[0] & 255 | (p5[1] & 255) << 8 | (p5[2] & 255) << 16 | (p5[3] & 255) << 24, j7 = p5[4] & 255 | (p5[5] & 255) << 8 | (p5[6] & 255) << 16 | (p5[7] & 255) << 24, j8 = p5[8] & 255 | (p5[9] & 255) << 8 | (p5[10] & 255) << 16 | (p5[11] & 255) << 24, j9 = p5[12] & 255 | (p5[13] & 255) << 8 | (p5[14] & 255) << 16 | (p5[15] & 255) << 24, j10 = c4[8] & 255 | (c4[9] & 255) << 8 | (c4[10] & 255) << 16 | (c4[11] & 255) << 24, j11 = k3[16] & 255 | (k3[17] & 255) << 8 | (k3[18] & 255) << 16 | (k3[19] & 255) << 24, j12 = k3[20] & 255 | (k3[21] & 255) << 8 | (k3[22] & 255) << 16 | (k3[23] & 255) << 24, j13 = k3[24] & 255 | (k3[25] & 255) << 8 | (k3[26] & 255) << 16 | (k3[27] & 255) << 24, j14 = k3[28] & 255 | (k3[29] & 255) << 8 | (k3[30] & 255) << 16 | (k3[31] & 255) << 24, j15 = c4[12] & 255 | (c4[13] & 255) << 8 | (c4[14] & 255) << 16 | (c4[15] & 255) << 24;
        var x0 = j0, x1 = j1, x22 = j22, x32 = j32, x4 = j4, x5 = j5, x6 = j6, x7 = j7, x8 = j8, x9 = j9, x10 = j10, x11 = j11, x12 = j12, x13 = j13, x14 = j14, x15 = j15, u4;
        for (var i6 = 0; i6 < 20; i6 += 2) {
          u4 = x0 + x12 | 0;
          x4 ^= u4 << 7 | u4 >>> 32 - 7;
          u4 = x4 + x0 | 0;
          x8 ^= u4 << 9 | u4 >>> 32 - 9;
          u4 = x8 + x4 | 0;
          x12 ^= u4 << 13 | u4 >>> 32 - 13;
          u4 = x12 + x8 | 0;
          x0 ^= u4 << 18 | u4 >>> 32 - 18;
          u4 = x5 + x1 | 0;
          x9 ^= u4 << 7 | u4 >>> 32 - 7;
          u4 = x9 + x5 | 0;
          x13 ^= u4 << 9 | u4 >>> 32 - 9;
          u4 = x13 + x9 | 0;
          x1 ^= u4 << 13 | u4 >>> 32 - 13;
          u4 = x1 + x13 | 0;
          x5 ^= u4 << 18 | u4 >>> 32 - 18;
          u4 = x10 + x6 | 0;
          x14 ^= u4 << 7 | u4 >>> 32 - 7;
          u4 = x14 + x10 | 0;
          x22 ^= u4 << 9 | u4 >>> 32 - 9;
          u4 = x22 + x14 | 0;
          x6 ^= u4 << 13 | u4 >>> 32 - 13;
          u4 = x6 + x22 | 0;
          x10 ^= u4 << 18 | u4 >>> 32 - 18;
          u4 = x15 + x11 | 0;
          x32 ^= u4 << 7 | u4 >>> 32 - 7;
          u4 = x32 + x15 | 0;
          x7 ^= u4 << 9 | u4 >>> 32 - 9;
          u4 = x7 + x32 | 0;
          x11 ^= u4 << 13 | u4 >>> 32 - 13;
          u4 = x11 + x7 | 0;
          x15 ^= u4 << 18 | u4 >>> 32 - 18;
          u4 = x0 + x32 | 0;
          x1 ^= u4 << 7 | u4 >>> 32 - 7;
          u4 = x1 + x0 | 0;
          x22 ^= u4 << 9 | u4 >>> 32 - 9;
          u4 = x22 + x1 | 0;
          x32 ^= u4 << 13 | u4 >>> 32 - 13;
          u4 = x32 + x22 | 0;
          x0 ^= u4 << 18 | u4 >>> 32 - 18;
          u4 = x5 + x4 | 0;
          x6 ^= u4 << 7 | u4 >>> 32 - 7;
          u4 = x6 + x5 | 0;
          x7 ^= u4 << 9 | u4 >>> 32 - 9;
          u4 = x7 + x6 | 0;
          x4 ^= u4 << 13 | u4 >>> 32 - 13;
          u4 = x4 + x7 | 0;
          x5 ^= u4 << 18 | u4 >>> 32 - 18;
          u4 = x10 + x9 | 0;
          x11 ^= u4 << 7 | u4 >>> 32 - 7;
          u4 = x11 + x10 | 0;
          x8 ^= u4 << 9 | u4 >>> 32 - 9;
          u4 = x8 + x11 | 0;
          x9 ^= u4 << 13 | u4 >>> 32 - 13;
          u4 = x9 + x8 | 0;
          x10 ^= u4 << 18 | u4 >>> 32 - 18;
          u4 = x15 + x14 | 0;
          x12 ^= u4 << 7 | u4 >>> 32 - 7;
          u4 = x12 + x15 | 0;
          x13 ^= u4 << 9 | u4 >>> 32 - 9;
          u4 = x13 + x12 | 0;
          x14 ^= u4 << 13 | u4 >>> 32 - 13;
          u4 = x14 + x13 | 0;
          x15 ^= u4 << 18 | u4 >>> 32 - 18;
        }
        o4[0] = x0 >>> 0 & 255;
        o4[1] = x0 >>> 8 & 255;
        o4[2] = x0 >>> 16 & 255;
        o4[3] = x0 >>> 24 & 255;
        o4[4] = x5 >>> 0 & 255;
        o4[5] = x5 >>> 8 & 255;
        o4[6] = x5 >>> 16 & 255;
        o4[7] = x5 >>> 24 & 255;
        o4[8] = x10 >>> 0 & 255;
        o4[9] = x10 >>> 8 & 255;
        o4[10] = x10 >>> 16 & 255;
        o4[11] = x10 >>> 24 & 255;
        o4[12] = x15 >>> 0 & 255;
        o4[13] = x15 >>> 8 & 255;
        o4[14] = x15 >>> 16 & 255;
        o4[15] = x15 >>> 24 & 255;
        o4[16] = x6 >>> 0 & 255;
        o4[17] = x6 >>> 8 & 255;
        o4[18] = x6 >>> 16 & 255;
        o4[19] = x6 >>> 24 & 255;
        o4[20] = x7 >>> 0 & 255;
        o4[21] = x7 >>> 8 & 255;
        o4[22] = x7 >>> 16 & 255;
        o4[23] = x7 >>> 24 & 255;
        o4[24] = x8 >>> 0 & 255;
        o4[25] = x8 >>> 8 & 255;
        o4[26] = x8 >>> 16 & 255;
        o4[27] = x8 >>> 24 & 255;
        o4[28] = x9 >>> 0 & 255;
        o4[29] = x9 >>> 8 & 255;
        o4[30] = x9 >>> 16 & 255;
        o4[31] = x9 >>> 24 & 255;
      }
      function crypto_core_salsa20(out, inp, k3, c4) {
        core_salsa20(out, inp, k3, c4);
      }
      function crypto_core_hsalsa20(out, inp, k3, c4) {
        core_hsalsa20(out, inp, k3, c4);
      }
      var sigma = new Uint8Array([101, 120, 112, 97, 110, 100, 32, 51, 50, 45, 98, 121, 116, 101, 32, 107]);
      function crypto_stream_salsa20_xor(c4, cpos, m5, mpos, b4, n5, k3) {
        var z3 = new Uint8Array(16), x4 = new Uint8Array(64);
        var u4, i6;
        for (i6 = 0; i6 < 16; i6++) z3[i6] = 0;
        for (i6 = 0; i6 < 8; i6++) z3[i6] = n5[i6];
        while (b4 >= 64) {
          crypto_core_salsa20(x4, z3, k3, sigma);
          for (i6 = 0; i6 < 64; i6++) c4[cpos + i6] = m5[mpos + i6] ^ x4[i6];
          u4 = 1;
          for (i6 = 8; i6 < 16; i6++) {
            u4 = u4 + (z3[i6] & 255) | 0;
            z3[i6] = u4 & 255;
            u4 >>>= 8;
          }
          b4 -= 64;
          cpos += 64;
          mpos += 64;
        }
        if (b4 > 0) {
          crypto_core_salsa20(x4, z3, k3, sigma);
          for (i6 = 0; i6 < b4; i6++) c4[cpos + i6] = m5[mpos + i6] ^ x4[i6];
        }
        return 0;
      }
      function crypto_stream_salsa20(c4, cpos, b4, n5, k3) {
        var z3 = new Uint8Array(16), x4 = new Uint8Array(64);
        var u4, i6;
        for (i6 = 0; i6 < 16; i6++) z3[i6] = 0;
        for (i6 = 0; i6 < 8; i6++) z3[i6] = n5[i6];
        while (b4 >= 64) {
          crypto_core_salsa20(x4, z3, k3, sigma);
          for (i6 = 0; i6 < 64; i6++) c4[cpos + i6] = x4[i6];
          u4 = 1;
          for (i6 = 8; i6 < 16; i6++) {
            u4 = u4 + (z3[i6] & 255) | 0;
            z3[i6] = u4 & 255;
            u4 >>>= 8;
          }
          b4 -= 64;
          cpos += 64;
        }
        if (b4 > 0) {
          crypto_core_salsa20(x4, z3, k3, sigma);
          for (i6 = 0; i6 < b4; i6++) c4[cpos + i6] = x4[i6];
        }
        return 0;
      }
      function crypto_stream(c4, cpos, d5, n5, k3) {
        var s5 = new Uint8Array(32);
        crypto_core_hsalsa20(s5, n5, k3, sigma);
        var sn = new Uint8Array(8);
        for (var i6 = 0; i6 < 8; i6++) sn[i6] = n5[i6 + 16];
        return crypto_stream_salsa20(c4, cpos, d5, sn, s5);
      }
      function crypto_stream_xor(c4, cpos, m5, mpos, d5, n5, k3) {
        var s5 = new Uint8Array(32);
        crypto_core_hsalsa20(s5, n5, k3, sigma);
        var sn = new Uint8Array(8);
        for (var i6 = 0; i6 < 8; i6++) sn[i6] = n5[i6 + 16];
        return crypto_stream_salsa20_xor(c4, cpos, m5, mpos, d5, sn, s5);
      }
      var poly1305 = function(key) {
        this.buffer = new Uint8Array(16);
        this.r = new Uint16Array(10);
        this.h = new Uint16Array(10);
        this.pad = new Uint16Array(8);
        this.leftover = 0;
        this.fin = 0;
        var t0, t1, t22, t32, t42, t52, t62, t7;
        t0 = key[0] & 255 | (key[1] & 255) << 8;
        this.r[0] = t0 & 8191;
        t1 = key[2] & 255 | (key[3] & 255) << 8;
        this.r[1] = (t0 >>> 13 | t1 << 3) & 8191;
        t22 = key[4] & 255 | (key[5] & 255) << 8;
        this.r[2] = (t1 >>> 10 | t22 << 6) & 7939;
        t32 = key[6] & 255 | (key[7] & 255) << 8;
        this.r[3] = (t22 >>> 7 | t32 << 9) & 8191;
        t42 = key[8] & 255 | (key[9] & 255) << 8;
        this.r[4] = (t32 >>> 4 | t42 << 12) & 255;
        this.r[5] = t42 >>> 1 & 8190;
        t52 = key[10] & 255 | (key[11] & 255) << 8;
        this.r[6] = (t42 >>> 14 | t52 << 2) & 8191;
        t62 = key[12] & 255 | (key[13] & 255) << 8;
        this.r[7] = (t52 >>> 11 | t62 << 5) & 8065;
        t7 = key[14] & 255 | (key[15] & 255) << 8;
        this.r[8] = (t62 >>> 8 | t7 << 8) & 8191;
        this.r[9] = t7 >>> 5 & 127;
        this.pad[0] = key[16] & 255 | (key[17] & 255) << 8;
        this.pad[1] = key[18] & 255 | (key[19] & 255) << 8;
        this.pad[2] = key[20] & 255 | (key[21] & 255) << 8;
        this.pad[3] = key[22] & 255 | (key[23] & 255) << 8;
        this.pad[4] = key[24] & 255 | (key[25] & 255) << 8;
        this.pad[5] = key[26] & 255 | (key[27] & 255) << 8;
        this.pad[6] = key[28] & 255 | (key[29] & 255) << 8;
        this.pad[7] = key[30] & 255 | (key[31] & 255) << 8;
      };
      poly1305.prototype.blocks = function(m5, mpos, bytes) {
        var hibit = this.fin ? 0 : 1 << 11;
        var t0, t1, t22, t32, t42, t52, t62, t7, c4;
        var d0, d1, d22, d32, d42, d5, d6, d7, d8, d9;
        var h0 = this.h[0], h1 = this.h[1], h22 = this.h[2], h32 = this.h[3], h42 = this.h[4], h5 = this.h[5], h6 = this.h[6], h7 = this.h[7], h8 = this.h[8], h9 = this.h[9];
        var r0 = this.r[0], r1 = this.r[1], r22 = this.r[2], r32 = this.r[3], r42 = this.r[4], r52 = this.r[5], r62 = this.r[6], r7 = this.r[7], r8 = this.r[8], r9 = this.r[9];
        while (bytes >= 16) {
          t0 = m5[mpos + 0] & 255 | (m5[mpos + 1] & 255) << 8;
          h0 += t0 & 8191;
          t1 = m5[mpos + 2] & 255 | (m5[mpos + 3] & 255) << 8;
          h1 += (t0 >>> 13 | t1 << 3) & 8191;
          t22 = m5[mpos + 4] & 255 | (m5[mpos + 5] & 255) << 8;
          h22 += (t1 >>> 10 | t22 << 6) & 8191;
          t32 = m5[mpos + 6] & 255 | (m5[mpos + 7] & 255) << 8;
          h32 += (t22 >>> 7 | t32 << 9) & 8191;
          t42 = m5[mpos + 8] & 255 | (m5[mpos + 9] & 255) << 8;
          h42 += (t32 >>> 4 | t42 << 12) & 8191;
          h5 += t42 >>> 1 & 8191;
          t52 = m5[mpos + 10] & 255 | (m5[mpos + 11] & 255) << 8;
          h6 += (t42 >>> 14 | t52 << 2) & 8191;
          t62 = m5[mpos + 12] & 255 | (m5[mpos + 13] & 255) << 8;
          h7 += (t52 >>> 11 | t62 << 5) & 8191;
          t7 = m5[mpos + 14] & 255 | (m5[mpos + 15] & 255) << 8;
          h8 += (t62 >>> 8 | t7 << 8) & 8191;
          h9 += t7 >>> 5 | hibit;
          c4 = 0;
          d0 = c4;
          d0 += h0 * r0;
          d0 += h1 * (5 * r9);
          d0 += h22 * (5 * r8);
          d0 += h32 * (5 * r7);
          d0 += h42 * (5 * r62);
          c4 = d0 >>> 13;
          d0 &= 8191;
          d0 += h5 * (5 * r52);
          d0 += h6 * (5 * r42);
          d0 += h7 * (5 * r32);
          d0 += h8 * (5 * r22);
          d0 += h9 * (5 * r1);
          c4 += d0 >>> 13;
          d0 &= 8191;
          d1 = c4;
          d1 += h0 * r1;
          d1 += h1 * r0;
          d1 += h22 * (5 * r9);
          d1 += h32 * (5 * r8);
          d1 += h42 * (5 * r7);
          c4 = d1 >>> 13;
          d1 &= 8191;
          d1 += h5 * (5 * r62);
          d1 += h6 * (5 * r52);
          d1 += h7 * (5 * r42);
          d1 += h8 * (5 * r32);
          d1 += h9 * (5 * r22);
          c4 += d1 >>> 13;
          d1 &= 8191;
          d22 = c4;
          d22 += h0 * r22;
          d22 += h1 * r1;
          d22 += h22 * r0;
          d22 += h32 * (5 * r9);
          d22 += h42 * (5 * r8);
          c4 = d22 >>> 13;
          d22 &= 8191;
          d22 += h5 * (5 * r7);
          d22 += h6 * (5 * r62);
          d22 += h7 * (5 * r52);
          d22 += h8 * (5 * r42);
          d22 += h9 * (5 * r32);
          c4 += d22 >>> 13;
          d22 &= 8191;
          d32 = c4;
          d32 += h0 * r32;
          d32 += h1 * r22;
          d32 += h22 * r1;
          d32 += h32 * r0;
          d32 += h42 * (5 * r9);
          c4 = d32 >>> 13;
          d32 &= 8191;
          d32 += h5 * (5 * r8);
          d32 += h6 * (5 * r7);
          d32 += h7 * (5 * r62);
          d32 += h8 * (5 * r52);
          d32 += h9 * (5 * r42);
          c4 += d32 >>> 13;
          d32 &= 8191;
          d42 = c4;
          d42 += h0 * r42;
          d42 += h1 * r32;
          d42 += h22 * r22;
          d42 += h32 * r1;
          d42 += h42 * r0;
          c4 = d42 >>> 13;
          d42 &= 8191;
          d42 += h5 * (5 * r9);
          d42 += h6 * (5 * r8);
          d42 += h7 * (5 * r7);
          d42 += h8 * (5 * r62);
          d42 += h9 * (5 * r52);
          c4 += d42 >>> 13;
          d42 &= 8191;
          d5 = c4;
          d5 += h0 * r52;
          d5 += h1 * r42;
          d5 += h22 * r32;
          d5 += h32 * r22;
          d5 += h42 * r1;
          c4 = d5 >>> 13;
          d5 &= 8191;
          d5 += h5 * r0;
          d5 += h6 * (5 * r9);
          d5 += h7 * (5 * r8);
          d5 += h8 * (5 * r7);
          d5 += h9 * (5 * r62);
          c4 += d5 >>> 13;
          d5 &= 8191;
          d6 = c4;
          d6 += h0 * r62;
          d6 += h1 * r52;
          d6 += h22 * r42;
          d6 += h32 * r32;
          d6 += h42 * r22;
          c4 = d6 >>> 13;
          d6 &= 8191;
          d6 += h5 * r1;
          d6 += h6 * r0;
          d6 += h7 * (5 * r9);
          d6 += h8 * (5 * r8);
          d6 += h9 * (5 * r7);
          c4 += d6 >>> 13;
          d6 &= 8191;
          d7 = c4;
          d7 += h0 * r7;
          d7 += h1 * r62;
          d7 += h22 * r52;
          d7 += h32 * r42;
          d7 += h42 * r32;
          c4 = d7 >>> 13;
          d7 &= 8191;
          d7 += h5 * r22;
          d7 += h6 * r1;
          d7 += h7 * r0;
          d7 += h8 * (5 * r9);
          d7 += h9 * (5 * r8);
          c4 += d7 >>> 13;
          d7 &= 8191;
          d8 = c4;
          d8 += h0 * r8;
          d8 += h1 * r7;
          d8 += h22 * r62;
          d8 += h32 * r52;
          d8 += h42 * r42;
          c4 = d8 >>> 13;
          d8 &= 8191;
          d8 += h5 * r32;
          d8 += h6 * r22;
          d8 += h7 * r1;
          d8 += h8 * r0;
          d8 += h9 * (5 * r9);
          c4 += d8 >>> 13;
          d8 &= 8191;
          d9 = c4;
          d9 += h0 * r9;
          d9 += h1 * r8;
          d9 += h22 * r7;
          d9 += h32 * r62;
          d9 += h42 * r52;
          c4 = d9 >>> 13;
          d9 &= 8191;
          d9 += h5 * r42;
          d9 += h6 * r32;
          d9 += h7 * r22;
          d9 += h8 * r1;
          d9 += h9 * r0;
          c4 += d9 >>> 13;
          d9 &= 8191;
          c4 = (c4 << 2) + c4 | 0;
          c4 = c4 + d0 | 0;
          d0 = c4 & 8191;
          c4 = c4 >>> 13;
          d1 += c4;
          h0 = d0;
          h1 = d1;
          h22 = d22;
          h32 = d32;
          h42 = d42;
          h5 = d5;
          h6 = d6;
          h7 = d7;
          h8 = d8;
          h9 = d9;
          mpos += 16;
          bytes -= 16;
        }
        this.h[0] = h0;
        this.h[1] = h1;
        this.h[2] = h22;
        this.h[3] = h32;
        this.h[4] = h42;
        this.h[5] = h5;
        this.h[6] = h6;
        this.h[7] = h7;
        this.h[8] = h8;
        this.h[9] = h9;
      };
      poly1305.prototype.finish = function(mac, macpos) {
        var g4 = new Uint16Array(10);
        var c4, mask, f4, i6;
        if (this.leftover) {
          i6 = this.leftover;
          this.buffer[i6++] = 1;
          for (; i6 < 16; i6++) this.buffer[i6] = 0;
          this.fin = 1;
          this.blocks(this.buffer, 0, 16);
        }
        c4 = this.h[1] >>> 13;
        this.h[1] &= 8191;
        for (i6 = 2; i6 < 10; i6++) {
          this.h[i6] += c4;
          c4 = this.h[i6] >>> 13;
          this.h[i6] &= 8191;
        }
        this.h[0] += c4 * 5;
        c4 = this.h[0] >>> 13;
        this.h[0] &= 8191;
        this.h[1] += c4;
        c4 = this.h[1] >>> 13;
        this.h[1] &= 8191;
        this.h[2] += c4;
        g4[0] = this.h[0] + 5;
        c4 = g4[0] >>> 13;
        g4[0] &= 8191;
        for (i6 = 1; i6 < 10; i6++) {
          g4[i6] = this.h[i6] + c4;
          c4 = g4[i6] >>> 13;
          g4[i6] &= 8191;
        }
        g4[9] -= 1 << 13;
        mask = (c4 ^ 1) - 1;
        for (i6 = 0; i6 < 10; i6++) g4[i6] &= mask;
        mask = ~mask;
        for (i6 = 0; i6 < 10; i6++) this.h[i6] = this.h[i6] & mask | g4[i6];
        this.h[0] = (this.h[0] | this.h[1] << 13) & 65535;
        this.h[1] = (this.h[1] >>> 3 | this.h[2] << 10) & 65535;
        this.h[2] = (this.h[2] >>> 6 | this.h[3] << 7) & 65535;
        this.h[3] = (this.h[3] >>> 9 | this.h[4] << 4) & 65535;
        this.h[4] = (this.h[4] >>> 12 | this.h[5] << 1 | this.h[6] << 14) & 65535;
        this.h[5] = (this.h[6] >>> 2 | this.h[7] << 11) & 65535;
        this.h[6] = (this.h[7] >>> 5 | this.h[8] << 8) & 65535;
        this.h[7] = (this.h[8] >>> 8 | this.h[9] << 5) & 65535;
        f4 = this.h[0] + this.pad[0];
        this.h[0] = f4 & 65535;
        for (i6 = 1; i6 < 8; i6++) {
          f4 = (this.h[i6] + this.pad[i6] | 0) + (f4 >>> 16) | 0;
          this.h[i6] = f4 & 65535;
        }
        mac[macpos + 0] = this.h[0] >>> 0 & 255;
        mac[macpos + 1] = this.h[0] >>> 8 & 255;
        mac[macpos + 2] = this.h[1] >>> 0 & 255;
        mac[macpos + 3] = this.h[1] >>> 8 & 255;
        mac[macpos + 4] = this.h[2] >>> 0 & 255;
        mac[macpos + 5] = this.h[2] >>> 8 & 255;
        mac[macpos + 6] = this.h[3] >>> 0 & 255;
        mac[macpos + 7] = this.h[3] >>> 8 & 255;
        mac[macpos + 8] = this.h[4] >>> 0 & 255;
        mac[macpos + 9] = this.h[4] >>> 8 & 255;
        mac[macpos + 10] = this.h[5] >>> 0 & 255;
        mac[macpos + 11] = this.h[5] >>> 8 & 255;
        mac[macpos + 12] = this.h[6] >>> 0 & 255;
        mac[macpos + 13] = this.h[6] >>> 8 & 255;
        mac[macpos + 14] = this.h[7] >>> 0 & 255;
        mac[macpos + 15] = this.h[7] >>> 8 & 255;
      };
      poly1305.prototype.update = function(m5, mpos, bytes) {
        var i6, want;
        if (this.leftover) {
          want = 16 - this.leftover;
          if (want > bytes)
            want = bytes;
          for (i6 = 0; i6 < want; i6++)
            this.buffer[this.leftover + i6] = m5[mpos + i6];
          bytes -= want;
          mpos += want;
          this.leftover += want;
          if (this.leftover < 16)
            return;
          this.blocks(this.buffer, 0, 16);
          this.leftover = 0;
        }
        if (bytes >= 16) {
          want = bytes - bytes % 16;
          this.blocks(m5, mpos, want);
          mpos += want;
          bytes -= want;
        }
        if (bytes) {
          for (i6 = 0; i6 < bytes; i6++)
            this.buffer[this.leftover + i6] = m5[mpos + i6];
          this.leftover += bytes;
        }
      };
      function crypto_onetimeauth(out, outpos, m5, mpos, n5, k3) {
        var s5 = new poly1305(k3);
        s5.update(m5, mpos, n5);
        s5.finish(out, outpos);
        return 0;
      }
      function crypto_onetimeauth_verify(h5, hpos, m5, mpos, n5, k3) {
        var x4 = new Uint8Array(16);
        crypto_onetimeauth(x4, 0, m5, mpos, n5, k3);
        return crypto_verify_16(h5, hpos, x4, 0);
      }
      function crypto_secretbox(c4, m5, d5, n5, k3) {
        var i6;
        if (d5 < 32) return -1;
        crypto_stream_xor(c4, 0, m5, 0, d5, n5, k3);
        crypto_onetimeauth(c4, 16, c4, 32, d5 - 32, c4);
        for (i6 = 0; i6 < 16; i6++) c4[i6] = 0;
        return 0;
      }
      function crypto_secretbox_open(m5, c4, d5, n5, k3) {
        var i6;
        var x4 = new Uint8Array(32);
        if (d5 < 32) return -1;
        crypto_stream(x4, 0, 32, n5, k3);
        if (crypto_onetimeauth_verify(c4, 16, c4, 32, d5 - 32, x4) !== 0) return -1;
        crypto_stream_xor(m5, 0, c4, 0, d5, n5, k3);
        for (i6 = 0; i6 < 32; i6++) m5[i6] = 0;
        return 0;
      }
      function set25519(r7, a5) {
        var i6;
        for (i6 = 0; i6 < 16; i6++) r7[i6] = a5[i6] | 0;
      }
      function car25519(o4) {
        var i6, v4, c4 = 1;
        for (i6 = 0; i6 < 16; i6++) {
          v4 = o4[i6] + c4 + 65535;
          c4 = Math.floor(v4 / 65536);
          o4[i6] = v4 - c4 * 65536;
        }
        o4[0] += c4 - 1 + 37 * (c4 - 1);
      }
      function sel25519(p5, q3, b4) {
        var t7, c4 = ~(b4 - 1);
        for (var i6 = 0; i6 < 16; i6++) {
          t7 = c4 & (p5[i6] ^ q3[i6]);
          p5[i6] ^= t7;
          q3[i6] ^= t7;
        }
      }
      function pack25519(o4, n5) {
        var i6, j4, b4;
        var m5 = gf(), t7 = gf();
        for (i6 = 0; i6 < 16; i6++) t7[i6] = n5[i6];
        car25519(t7);
        car25519(t7);
        car25519(t7);
        for (j4 = 0; j4 < 2; j4++) {
          m5[0] = t7[0] - 65517;
          for (i6 = 1; i6 < 15; i6++) {
            m5[i6] = t7[i6] - 65535 - (m5[i6 - 1] >> 16 & 1);
            m5[i6 - 1] &= 65535;
          }
          m5[15] = t7[15] - 32767 - (m5[14] >> 16 & 1);
          b4 = m5[15] >> 16 & 1;
          m5[14] &= 65535;
          sel25519(t7, m5, 1 - b4);
        }
        for (i6 = 0; i6 < 16; i6++) {
          o4[2 * i6] = t7[i6] & 255;
          o4[2 * i6 + 1] = t7[i6] >> 8;
        }
      }
      function neq25519(a5, b4) {
        var c4 = new Uint8Array(32), d5 = new Uint8Array(32);
        pack25519(c4, a5);
        pack25519(d5, b4);
        return crypto_verify_32(c4, 0, d5, 0);
      }
      function par25519(a5) {
        var d5 = new Uint8Array(32);
        pack25519(d5, a5);
        return d5[0] & 1;
      }
      function unpack25519(o4, n5) {
        var i6;
        for (i6 = 0; i6 < 16; i6++) o4[i6] = n5[2 * i6] + (n5[2 * i6 + 1] << 8);
        o4[15] &= 32767;
      }
      function A3(o4, a5, b4) {
        for (var i6 = 0; i6 < 16; i6++) o4[i6] = a5[i6] + b4[i6];
      }
      function Z(o4, a5, b4) {
        for (var i6 = 0; i6 < 16; i6++) o4[i6] = a5[i6] - b4[i6];
      }
      function M(o4, a5, b4) {
        var v4, c4, t0 = 0, t1 = 0, t22 = 0, t32 = 0, t42 = 0, t52 = 0, t62 = 0, t7 = 0, t8 = 0, t9 = 0, t10 = 0, t11 = 0, t12 = 0, t13 = 0, t14 = 0, t15 = 0, t16 = 0, t17 = 0, t18 = 0, t19 = 0, t20 = 0, t21 = 0, t222 = 0, t23 = 0, t24 = 0, t25 = 0, t26 = 0, t27 = 0, t28 = 0, t29 = 0, t30 = 0, b0 = b4[0], b1 = b4[1], b22 = b4[2], b32 = b4[3], b42 = b4[4], b5 = b4[5], b6 = b4[6], b7 = b4[7], b8 = b4[8], b9 = b4[9], b10 = b4[10], b11 = b4[11], b12 = b4[12], b13 = b4[13], b14 = b4[14], b15 = b4[15];
        v4 = a5[0];
        t0 += v4 * b0;
        t1 += v4 * b1;
        t22 += v4 * b22;
        t32 += v4 * b32;
        t42 += v4 * b42;
        t52 += v4 * b5;
        t62 += v4 * b6;
        t7 += v4 * b7;
        t8 += v4 * b8;
        t9 += v4 * b9;
        t10 += v4 * b10;
        t11 += v4 * b11;
        t12 += v4 * b12;
        t13 += v4 * b13;
        t14 += v4 * b14;
        t15 += v4 * b15;
        v4 = a5[1];
        t1 += v4 * b0;
        t22 += v4 * b1;
        t32 += v4 * b22;
        t42 += v4 * b32;
        t52 += v4 * b42;
        t62 += v4 * b5;
        t7 += v4 * b6;
        t8 += v4 * b7;
        t9 += v4 * b8;
        t10 += v4 * b9;
        t11 += v4 * b10;
        t12 += v4 * b11;
        t13 += v4 * b12;
        t14 += v4 * b13;
        t15 += v4 * b14;
        t16 += v4 * b15;
        v4 = a5[2];
        t22 += v4 * b0;
        t32 += v4 * b1;
        t42 += v4 * b22;
        t52 += v4 * b32;
        t62 += v4 * b42;
        t7 += v4 * b5;
        t8 += v4 * b6;
        t9 += v4 * b7;
        t10 += v4 * b8;
        t11 += v4 * b9;
        t12 += v4 * b10;
        t13 += v4 * b11;
        t14 += v4 * b12;
        t15 += v4 * b13;
        t16 += v4 * b14;
        t17 += v4 * b15;
        v4 = a5[3];
        t32 += v4 * b0;
        t42 += v4 * b1;
        t52 += v4 * b22;
        t62 += v4 * b32;
        t7 += v4 * b42;
        t8 += v4 * b5;
        t9 += v4 * b6;
        t10 += v4 * b7;
        t11 += v4 * b8;
        t12 += v4 * b9;
        t13 += v4 * b10;
        t14 += v4 * b11;
        t15 += v4 * b12;
        t16 += v4 * b13;
        t17 += v4 * b14;
        t18 += v4 * b15;
        v4 = a5[4];
        t42 += v4 * b0;
        t52 += v4 * b1;
        t62 += v4 * b22;
        t7 += v4 * b32;
        t8 += v4 * b42;
        t9 += v4 * b5;
        t10 += v4 * b6;
        t11 += v4 * b7;
        t12 += v4 * b8;
        t13 += v4 * b9;
        t14 += v4 * b10;
        t15 += v4 * b11;
        t16 += v4 * b12;
        t17 += v4 * b13;
        t18 += v4 * b14;
        t19 += v4 * b15;
        v4 = a5[5];
        t52 += v4 * b0;
        t62 += v4 * b1;
        t7 += v4 * b22;
        t8 += v4 * b32;
        t9 += v4 * b42;
        t10 += v4 * b5;
        t11 += v4 * b6;
        t12 += v4 * b7;
        t13 += v4 * b8;
        t14 += v4 * b9;
        t15 += v4 * b10;
        t16 += v4 * b11;
        t17 += v4 * b12;
        t18 += v4 * b13;
        t19 += v4 * b14;
        t20 += v4 * b15;
        v4 = a5[6];
        t62 += v4 * b0;
        t7 += v4 * b1;
        t8 += v4 * b22;
        t9 += v4 * b32;
        t10 += v4 * b42;
        t11 += v4 * b5;
        t12 += v4 * b6;
        t13 += v4 * b7;
        t14 += v4 * b8;
        t15 += v4 * b9;
        t16 += v4 * b10;
        t17 += v4 * b11;
        t18 += v4 * b12;
        t19 += v4 * b13;
        t20 += v4 * b14;
        t21 += v4 * b15;
        v4 = a5[7];
        t7 += v4 * b0;
        t8 += v4 * b1;
        t9 += v4 * b22;
        t10 += v4 * b32;
        t11 += v4 * b42;
        t12 += v4 * b5;
        t13 += v4 * b6;
        t14 += v4 * b7;
        t15 += v4 * b8;
        t16 += v4 * b9;
        t17 += v4 * b10;
        t18 += v4 * b11;
        t19 += v4 * b12;
        t20 += v4 * b13;
        t21 += v4 * b14;
        t222 += v4 * b15;
        v4 = a5[8];
        t8 += v4 * b0;
        t9 += v4 * b1;
        t10 += v4 * b22;
        t11 += v4 * b32;
        t12 += v4 * b42;
        t13 += v4 * b5;
        t14 += v4 * b6;
        t15 += v4 * b7;
        t16 += v4 * b8;
        t17 += v4 * b9;
        t18 += v4 * b10;
        t19 += v4 * b11;
        t20 += v4 * b12;
        t21 += v4 * b13;
        t222 += v4 * b14;
        t23 += v4 * b15;
        v4 = a5[9];
        t9 += v4 * b0;
        t10 += v4 * b1;
        t11 += v4 * b22;
        t12 += v4 * b32;
        t13 += v4 * b42;
        t14 += v4 * b5;
        t15 += v4 * b6;
        t16 += v4 * b7;
        t17 += v4 * b8;
        t18 += v4 * b9;
        t19 += v4 * b10;
        t20 += v4 * b11;
        t21 += v4 * b12;
        t222 += v4 * b13;
        t23 += v4 * b14;
        t24 += v4 * b15;
        v4 = a5[10];
        t10 += v4 * b0;
        t11 += v4 * b1;
        t12 += v4 * b22;
        t13 += v4 * b32;
        t14 += v4 * b42;
        t15 += v4 * b5;
        t16 += v4 * b6;
        t17 += v4 * b7;
        t18 += v4 * b8;
        t19 += v4 * b9;
        t20 += v4 * b10;
        t21 += v4 * b11;
        t222 += v4 * b12;
        t23 += v4 * b13;
        t24 += v4 * b14;
        t25 += v4 * b15;
        v4 = a5[11];
        t11 += v4 * b0;
        t12 += v4 * b1;
        t13 += v4 * b22;
        t14 += v4 * b32;
        t15 += v4 * b42;
        t16 += v4 * b5;
        t17 += v4 * b6;
        t18 += v4 * b7;
        t19 += v4 * b8;
        t20 += v4 * b9;
        t21 += v4 * b10;
        t222 += v4 * b11;
        t23 += v4 * b12;
        t24 += v4 * b13;
        t25 += v4 * b14;
        t26 += v4 * b15;
        v4 = a5[12];
        t12 += v4 * b0;
        t13 += v4 * b1;
        t14 += v4 * b22;
        t15 += v4 * b32;
        t16 += v4 * b42;
        t17 += v4 * b5;
        t18 += v4 * b6;
        t19 += v4 * b7;
        t20 += v4 * b8;
        t21 += v4 * b9;
        t222 += v4 * b10;
        t23 += v4 * b11;
        t24 += v4 * b12;
        t25 += v4 * b13;
        t26 += v4 * b14;
        t27 += v4 * b15;
        v4 = a5[13];
        t13 += v4 * b0;
        t14 += v4 * b1;
        t15 += v4 * b22;
        t16 += v4 * b32;
        t17 += v4 * b42;
        t18 += v4 * b5;
        t19 += v4 * b6;
        t20 += v4 * b7;
        t21 += v4 * b8;
        t222 += v4 * b9;
        t23 += v4 * b10;
        t24 += v4 * b11;
        t25 += v4 * b12;
        t26 += v4 * b13;
        t27 += v4 * b14;
        t28 += v4 * b15;
        v4 = a5[14];
        t14 += v4 * b0;
        t15 += v4 * b1;
        t16 += v4 * b22;
        t17 += v4 * b32;
        t18 += v4 * b42;
        t19 += v4 * b5;
        t20 += v4 * b6;
        t21 += v4 * b7;
        t222 += v4 * b8;
        t23 += v4 * b9;
        t24 += v4 * b10;
        t25 += v4 * b11;
        t26 += v4 * b12;
        t27 += v4 * b13;
        t28 += v4 * b14;
        t29 += v4 * b15;
        v4 = a5[15];
        t15 += v4 * b0;
        t16 += v4 * b1;
        t17 += v4 * b22;
        t18 += v4 * b32;
        t19 += v4 * b42;
        t20 += v4 * b5;
        t21 += v4 * b6;
        t222 += v4 * b7;
        t23 += v4 * b8;
        t24 += v4 * b9;
        t25 += v4 * b10;
        t26 += v4 * b11;
        t27 += v4 * b12;
        t28 += v4 * b13;
        t29 += v4 * b14;
        t30 += v4 * b15;
        t0 += 38 * t16;
        t1 += 38 * t17;
        t22 += 38 * t18;
        t32 += 38 * t19;
        t42 += 38 * t20;
        t52 += 38 * t21;
        t62 += 38 * t222;
        t7 += 38 * t23;
        t8 += 38 * t24;
        t9 += 38 * t25;
        t10 += 38 * t26;
        t11 += 38 * t27;
        t12 += 38 * t28;
        t13 += 38 * t29;
        t14 += 38 * t30;
        c4 = 1;
        v4 = t0 + c4 + 65535;
        c4 = Math.floor(v4 / 65536);
        t0 = v4 - c4 * 65536;
        v4 = t1 + c4 + 65535;
        c4 = Math.floor(v4 / 65536);
        t1 = v4 - c4 * 65536;
        v4 = t22 + c4 + 65535;
        c4 = Math.floor(v4 / 65536);
        t22 = v4 - c4 * 65536;
        v4 = t32 + c4 + 65535;
        c4 = Math.floor(v4 / 65536);
        t32 = v4 - c4 * 65536;
        v4 = t42 + c4 + 65535;
        c4 = Math.floor(v4 / 65536);
        t42 = v4 - c4 * 65536;
        v4 = t52 + c4 + 65535;
        c4 = Math.floor(v4 / 65536);
        t52 = v4 - c4 * 65536;
        v4 = t62 + c4 + 65535;
        c4 = Math.floor(v4 / 65536);
        t62 = v4 - c4 * 65536;
        v4 = t7 + c4 + 65535;
        c4 = Math.floor(v4 / 65536);
        t7 = v4 - c4 * 65536;
        v4 = t8 + c4 + 65535;
        c4 = Math.floor(v4 / 65536);
        t8 = v4 - c4 * 65536;
        v4 = t9 + c4 + 65535;
        c4 = Math.floor(v4 / 65536);
        t9 = v4 - c4 * 65536;
        v4 = t10 + c4 + 65535;
        c4 = Math.floor(v4 / 65536);
        t10 = v4 - c4 * 65536;
        v4 = t11 + c4 + 65535;
        c4 = Math.floor(v4 / 65536);
        t11 = v4 - c4 * 65536;
        v4 = t12 + c4 + 65535;
        c4 = Math.floor(v4 / 65536);
        t12 = v4 - c4 * 65536;
        v4 = t13 + c4 + 65535;
        c4 = Math.floor(v4 / 65536);
        t13 = v4 - c4 * 65536;
        v4 = t14 + c4 + 65535;
        c4 = Math.floor(v4 / 65536);
        t14 = v4 - c4 * 65536;
        v4 = t15 + c4 + 65535;
        c4 = Math.floor(v4 / 65536);
        t15 = v4 - c4 * 65536;
        t0 += c4 - 1 + 37 * (c4 - 1);
        c4 = 1;
        v4 = t0 + c4 + 65535;
        c4 = Math.floor(v4 / 65536);
        t0 = v4 - c4 * 65536;
        v4 = t1 + c4 + 65535;
        c4 = Math.floor(v4 / 65536);
        t1 = v4 - c4 * 65536;
        v4 = t22 + c4 + 65535;
        c4 = Math.floor(v4 / 65536);
        t22 = v4 - c4 * 65536;
        v4 = t32 + c4 + 65535;
        c4 = Math.floor(v4 / 65536);
        t32 = v4 - c4 * 65536;
        v4 = t42 + c4 + 65535;
        c4 = Math.floor(v4 / 65536);
        t42 = v4 - c4 * 65536;
        v4 = t52 + c4 + 65535;
        c4 = Math.floor(v4 / 65536);
        t52 = v4 - c4 * 65536;
        v4 = t62 + c4 + 65535;
        c4 = Math.floor(v4 / 65536);
        t62 = v4 - c4 * 65536;
        v4 = t7 + c4 + 65535;
        c4 = Math.floor(v4 / 65536);
        t7 = v4 - c4 * 65536;
        v4 = t8 + c4 + 65535;
        c4 = Math.floor(v4 / 65536);
        t8 = v4 - c4 * 65536;
        v4 = t9 + c4 + 65535;
        c4 = Math.floor(v4 / 65536);
        t9 = v4 - c4 * 65536;
        v4 = t10 + c4 + 65535;
        c4 = Math.floor(v4 / 65536);
        t10 = v4 - c4 * 65536;
        v4 = t11 + c4 + 65535;
        c4 = Math.floor(v4 / 65536);
        t11 = v4 - c4 * 65536;
        v4 = t12 + c4 + 65535;
        c4 = Math.floor(v4 / 65536);
        t12 = v4 - c4 * 65536;
        v4 = t13 + c4 + 65535;
        c4 = Math.floor(v4 / 65536);
        t13 = v4 - c4 * 65536;
        v4 = t14 + c4 + 65535;
        c4 = Math.floor(v4 / 65536);
        t14 = v4 - c4 * 65536;
        v4 = t15 + c4 + 65535;
        c4 = Math.floor(v4 / 65536);
        t15 = v4 - c4 * 65536;
        t0 += c4 - 1 + 37 * (c4 - 1);
        o4[0] = t0;
        o4[1] = t1;
        o4[2] = t22;
        o4[3] = t32;
        o4[4] = t42;
        o4[5] = t52;
        o4[6] = t62;
        o4[7] = t7;
        o4[8] = t8;
        o4[9] = t9;
        o4[10] = t10;
        o4[11] = t11;
        o4[12] = t12;
        o4[13] = t13;
        o4[14] = t14;
        o4[15] = t15;
      }
      function S3(o4, a5) {
        M(o4, a5, a5);
      }
      function inv25519(o4, i6) {
        var c4 = gf();
        var a5;
        for (a5 = 0; a5 < 16; a5++) c4[a5] = i6[a5];
        for (a5 = 253; a5 >= 0; a5--) {
          S3(c4, c4);
          if (a5 !== 2 && a5 !== 4) M(c4, c4, i6);
        }
        for (a5 = 0; a5 < 16; a5++) o4[a5] = c4[a5];
      }
      function pow2523(o4, i6) {
        var c4 = gf();
        var a5;
        for (a5 = 0; a5 < 16; a5++) c4[a5] = i6[a5];
        for (a5 = 250; a5 >= 0; a5--) {
          S3(c4, c4);
          if (a5 !== 1) M(c4, c4, i6);
        }
        for (a5 = 0; a5 < 16; a5++) o4[a5] = c4[a5];
      }
      function crypto_scalarmult(q3, n5, p5) {
        var z3 = new Uint8Array(32);
        var x4 = new Float64Array(80), r7, i6;
        var a5 = gf(), b4 = gf(), c4 = gf(), d5 = gf(), e5 = gf(), f4 = gf();
        for (i6 = 0; i6 < 31; i6++) z3[i6] = n5[i6];
        z3[31] = n5[31] & 127 | 64;
        z3[0] &= 248;
        unpack25519(x4, p5);
        for (i6 = 0; i6 < 16; i6++) {
          b4[i6] = x4[i6];
          d5[i6] = a5[i6] = c4[i6] = 0;
        }
        a5[0] = d5[0] = 1;
        for (i6 = 254; i6 >= 0; --i6) {
          r7 = z3[i6 >>> 3] >>> (i6 & 7) & 1;
          sel25519(a5, b4, r7);
          sel25519(c4, d5, r7);
          A3(e5, a5, c4);
          Z(a5, a5, c4);
          A3(c4, b4, d5);
          Z(b4, b4, d5);
          S3(d5, e5);
          S3(f4, a5);
          M(a5, c4, a5);
          M(c4, b4, e5);
          A3(e5, a5, c4);
          Z(a5, a5, c4);
          S3(b4, a5);
          Z(c4, d5, f4);
          M(a5, c4, _121665);
          A3(a5, a5, d5);
          M(c4, c4, a5);
          M(a5, d5, f4);
          M(d5, b4, x4);
          S3(b4, e5);
          sel25519(a5, b4, r7);
          sel25519(c4, d5, r7);
        }
        for (i6 = 0; i6 < 16; i6++) {
          x4[i6 + 16] = a5[i6];
          x4[i6 + 32] = c4[i6];
          x4[i6 + 48] = b4[i6];
          x4[i6 + 64] = d5[i6];
        }
        var x32 = x4.subarray(32);
        var x16 = x4.subarray(16);
        inv25519(x32, x32);
        M(x16, x16, x32);
        pack25519(q3, x16);
        return 0;
      }
      function crypto_scalarmult_base(q3, n5) {
        return crypto_scalarmult(q3, n5, _9);
      }
      function crypto_box_keypair(y5, x4) {
        randombytes(x4, 32);
        return crypto_scalarmult_base(y5, x4);
      }
      function crypto_box_beforenm(k3, y5, x4) {
        var s5 = new Uint8Array(32);
        crypto_scalarmult(s5, x4, y5);
        return crypto_core_hsalsa20(k3, _0, s5, sigma);
      }
      var crypto_box_afternm = crypto_secretbox;
      var crypto_box_open_afternm = crypto_secretbox_open;
      function crypto_box(c4, m5, d5, n5, y5, x4) {
        var k3 = new Uint8Array(32);
        crypto_box_beforenm(k3, y5, x4);
        return crypto_box_afternm(c4, m5, d5, n5, k3);
      }
      function crypto_box_open(m5, c4, d5, n5, y5, x4) {
        var k3 = new Uint8Array(32);
        crypto_box_beforenm(k3, y5, x4);
        return crypto_box_open_afternm(m5, c4, d5, n5, k3);
      }
      var K2 = [
        1116352408,
        3609767458,
        1899447441,
        602891725,
        3049323471,
        3964484399,
        3921009573,
        2173295548,
        961987163,
        4081628472,
        1508970993,
        3053834265,
        2453635748,
        2937671579,
        2870763221,
        3664609560,
        3624381080,
        2734883394,
        310598401,
        1164996542,
        607225278,
        1323610764,
        1426881987,
        3590304994,
        1925078388,
        4068182383,
        2162078206,
        991336113,
        2614888103,
        633803317,
        3248222580,
        3479774868,
        3835390401,
        2666613458,
        4022224774,
        944711139,
        264347078,
        2341262773,
        604807628,
        2007800933,
        770255983,
        1495990901,
        1249150122,
        1856431235,
        1555081692,
        3175218132,
        1996064986,
        2198950837,
        2554220882,
        3999719339,
        2821834349,
        766784016,
        2952996808,
        2566594879,
        3210313671,
        3203337956,
        3336571891,
        1034457026,
        3584528711,
        2466948901,
        113926993,
        3758326383,
        338241895,
        168717936,
        666307205,
        1188179964,
        773529912,
        1546045734,
        1294757372,
        1522805485,
        1396182291,
        2643833823,
        1695183700,
        2343527390,
        1986661051,
        1014477480,
        2177026350,
        1206759142,
        2456956037,
        344077627,
        2730485921,
        1290863460,
        2820302411,
        3158454273,
        3259730800,
        3505952657,
        3345764771,
        106217008,
        3516065817,
        3606008344,
        3600352804,
        1432725776,
        4094571909,
        1467031594,
        275423344,
        851169720,
        430227734,
        3100823752,
        506948616,
        1363258195,
        659060556,
        3750685593,
        883997877,
        3785050280,
        958139571,
        3318307427,
        1322822218,
        3812723403,
        1537002063,
        2003034995,
        1747873779,
        3602036899,
        1955562222,
        1575990012,
        2024104815,
        1125592928,
        2227730452,
        2716904306,
        2361852424,
        442776044,
        2428436474,
        593698344,
        2756734187,
        3733110249,
        3204031479,
        2999351573,
        3329325298,
        3815920427,
        3391569614,
        3928383900,
        3515267271,
        566280711,
        3940187606,
        3454069534,
        4118630271,
        4000239992,
        116418474,
        1914138554,
        174292421,
        2731055270,
        289380356,
        3203993006,
        460393269,
        320620315,
        685471733,
        587496836,
        852142971,
        1086792851,
        1017036298,
        365543100,
        1126000580,
        2618297676,
        1288033470,
        3409855158,
        1501505948,
        4234509866,
        1607167915,
        987167468,
        1816402316,
        1246189591
      ];
      function crypto_hashblocks_hl(hh, hl, m5, n5) {
        var wh = new Int32Array(16), wl = new Int32Array(16), bh0, bh1, bh2, bh3, bh4, bh5, bh6, bh7, bl0, bl1, bl2, bl3, bl4, bl5, bl6, bl7, th, tl, i6, j4, h5, l5, a5, b4, c4, d5;
        var ah0 = hh[0], ah1 = hh[1], ah2 = hh[2], ah3 = hh[3], ah4 = hh[4], ah5 = hh[5], ah6 = hh[6], ah7 = hh[7], al0 = hl[0], al1 = hl[1], al2 = hl[2], al3 = hl[3], al4 = hl[4], al5 = hl[5], al6 = hl[6], al7 = hl[7];
        var pos = 0;
        while (n5 >= 128) {
          for (i6 = 0; i6 < 16; i6++) {
            j4 = 8 * i6 + pos;
            wh[i6] = m5[j4 + 0] << 24 | m5[j4 + 1] << 16 | m5[j4 + 2] << 8 | m5[j4 + 3];
            wl[i6] = m5[j4 + 4] << 24 | m5[j4 + 5] << 16 | m5[j4 + 6] << 8 | m5[j4 + 7];
          }
          for (i6 = 0; i6 < 80; i6++) {
            bh0 = ah0;
            bh1 = ah1;
            bh2 = ah2;
            bh3 = ah3;
            bh4 = ah4;
            bh5 = ah5;
            bh6 = ah6;
            bh7 = ah7;
            bl0 = al0;
            bl1 = al1;
            bl2 = al2;
            bl3 = al3;
            bl4 = al4;
            bl5 = al5;
            bl6 = al6;
            bl7 = al7;
            h5 = ah7;
            l5 = al7;
            a5 = l5 & 65535;
            b4 = l5 >>> 16;
            c4 = h5 & 65535;
            d5 = h5 >>> 16;
            h5 = (ah4 >>> 14 | al4 << 32 - 14) ^ (ah4 >>> 18 | al4 << 32 - 18) ^ (al4 >>> 41 - 32 | ah4 << 32 - (41 - 32));
            l5 = (al4 >>> 14 | ah4 << 32 - 14) ^ (al4 >>> 18 | ah4 << 32 - 18) ^ (ah4 >>> 41 - 32 | al4 << 32 - (41 - 32));
            a5 += l5 & 65535;
            b4 += l5 >>> 16;
            c4 += h5 & 65535;
            d5 += h5 >>> 16;
            h5 = ah4 & ah5 ^ ~ah4 & ah6;
            l5 = al4 & al5 ^ ~al4 & al6;
            a5 += l5 & 65535;
            b4 += l5 >>> 16;
            c4 += h5 & 65535;
            d5 += h5 >>> 16;
            h5 = K2[i6 * 2];
            l5 = K2[i6 * 2 + 1];
            a5 += l5 & 65535;
            b4 += l5 >>> 16;
            c4 += h5 & 65535;
            d5 += h5 >>> 16;
            h5 = wh[i6 % 16];
            l5 = wl[i6 % 16];
            a5 += l5 & 65535;
            b4 += l5 >>> 16;
            c4 += h5 & 65535;
            d5 += h5 >>> 16;
            b4 += a5 >>> 16;
            c4 += b4 >>> 16;
            d5 += c4 >>> 16;
            th = c4 & 65535 | d5 << 16;
            tl = a5 & 65535 | b4 << 16;
            h5 = th;
            l5 = tl;
            a5 = l5 & 65535;
            b4 = l5 >>> 16;
            c4 = h5 & 65535;
            d5 = h5 >>> 16;
            h5 = (ah0 >>> 28 | al0 << 32 - 28) ^ (al0 >>> 34 - 32 | ah0 << 32 - (34 - 32)) ^ (al0 >>> 39 - 32 | ah0 << 32 - (39 - 32));
            l5 = (al0 >>> 28 | ah0 << 32 - 28) ^ (ah0 >>> 34 - 32 | al0 << 32 - (34 - 32)) ^ (ah0 >>> 39 - 32 | al0 << 32 - (39 - 32));
            a5 += l5 & 65535;
            b4 += l5 >>> 16;
            c4 += h5 & 65535;
            d5 += h5 >>> 16;
            h5 = ah0 & ah1 ^ ah0 & ah2 ^ ah1 & ah2;
            l5 = al0 & al1 ^ al0 & al2 ^ al1 & al2;
            a5 += l5 & 65535;
            b4 += l5 >>> 16;
            c4 += h5 & 65535;
            d5 += h5 >>> 16;
            b4 += a5 >>> 16;
            c4 += b4 >>> 16;
            d5 += c4 >>> 16;
            bh7 = c4 & 65535 | d5 << 16;
            bl7 = a5 & 65535 | b4 << 16;
            h5 = bh3;
            l5 = bl3;
            a5 = l5 & 65535;
            b4 = l5 >>> 16;
            c4 = h5 & 65535;
            d5 = h5 >>> 16;
            h5 = th;
            l5 = tl;
            a5 += l5 & 65535;
            b4 += l5 >>> 16;
            c4 += h5 & 65535;
            d5 += h5 >>> 16;
            b4 += a5 >>> 16;
            c4 += b4 >>> 16;
            d5 += c4 >>> 16;
            bh3 = c4 & 65535 | d5 << 16;
            bl3 = a5 & 65535 | b4 << 16;
            ah1 = bh0;
            ah2 = bh1;
            ah3 = bh2;
            ah4 = bh3;
            ah5 = bh4;
            ah6 = bh5;
            ah7 = bh6;
            ah0 = bh7;
            al1 = bl0;
            al2 = bl1;
            al3 = bl2;
            al4 = bl3;
            al5 = bl4;
            al6 = bl5;
            al7 = bl6;
            al0 = bl7;
            if (i6 % 16 === 15) {
              for (j4 = 0; j4 < 16; j4++) {
                h5 = wh[j4];
                l5 = wl[j4];
                a5 = l5 & 65535;
                b4 = l5 >>> 16;
                c4 = h5 & 65535;
                d5 = h5 >>> 16;
                h5 = wh[(j4 + 9) % 16];
                l5 = wl[(j4 + 9) % 16];
                a5 += l5 & 65535;
                b4 += l5 >>> 16;
                c4 += h5 & 65535;
                d5 += h5 >>> 16;
                th = wh[(j4 + 1) % 16];
                tl = wl[(j4 + 1) % 16];
                h5 = (th >>> 1 | tl << 32 - 1) ^ (th >>> 8 | tl << 32 - 8) ^ th >>> 7;
                l5 = (tl >>> 1 | th << 32 - 1) ^ (tl >>> 8 | th << 32 - 8) ^ (tl >>> 7 | th << 32 - 7);
                a5 += l5 & 65535;
                b4 += l5 >>> 16;
                c4 += h5 & 65535;
                d5 += h5 >>> 16;
                th = wh[(j4 + 14) % 16];
                tl = wl[(j4 + 14) % 16];
                h5 = (th >>> 19 | tl << 32 - 19) ^ (tl >>> 61 - 32 | th << 32 - (61 - 32)) ^ th >>> 6;
                l5 = (tl >>> 19 | th << 32 - 19) ^ (th >>> 61 - 32 | tl << 32 - (61 - 32)) ^ (tl >>> 6 | th << 32 - 6);
                a5 += l5 & 65535;
                b4 += l5 >>> 16;
                c4 += h5 & 65535;
                d5 += h5 >>> 16;
                b4 += a5 >>> 16;
                c4 += b4 >>> 16;
                d5 += c4 >>> 16;
                wh[j4] = c4 & 65535 | d5 << 16;
                wl[j4] = a5 & 65535 | b4 << 16;
              }
            }
          }
          h5 = ah0;
          l5 = al0;
          a5 = l5 & 65535;
          b4 = l5 >>> 16;
          c4 = h5 & 65535;
          d5 = h5 >>> 16;
          h5 = hh[0];
          l5 = hl[0];
          a5 += l5 & 65535;
          b4 += l5 >>> 16;
          c4 += h5 & 65535;
          d5 += h5 >>> 16;
          b4 += a5 >>> 16;
          c4 += b4 >>> 16;
          d5 += c4 >>> 16;
          hh[0] = ah0 = c4 & 65535 | d5 << 16;
          hl[0] = al0 = a5 & 65535 | b4 << 16;
          h5 = ah1;
          l5 = al1;
          a5 = l5 & 65535;
          b4 = l5 >>> 16;
          c4 = h5 & 65535;
          d5 = h5 >>> 16;
          h5 = hh[1];
          l5 = hl[1];
          a5 += l5 & 65535;
          b4 += l5 >>> 16;
          c4 += h5 & 65535;
          d5 += h5 >>> 16;
          b4 += a5 >>> 16;
          c4 += b4 >>> 16;
          d5 += c4 >>> 16;
          hh[1] = ah1 = c4 & 65535 | d5 << 16;
          hl[1] = al1 = a5 & 65535 | b4 << 16;
          h5 = ah2;
          l5 = al2;
          a5 = l5 & 65535;
          b4 = l5 >>> 16;
          c4 = h5 & 65535;
          d5 = h5 >>> 16;
          h5 = hh[2];
          l5 = hl[2];
          a5 += l5 & 65535;
          b4 += l5 >>> 16;
          c4 += h5 & 65535;
          d5 += h5 >>> 16;
          b4 += a5 >>> 16;
          c4 += b4 >>> 16;
          d5 += c4 >>> 16;
          hh[2] = ah2 = c4 & 65535 | d5 << 16;
          hl[2] = al2 = a5 & 65535 | b4 << 16;
          h5 = ah3;
          l5 = al3;
          a5 = l5 & 65535;
          b4 = l5 >>> 16;
          c4 = h5 & 65535;
          d5 = h5 >>> 16;
          h5 = hh[3];
          l5 = hl[3];
          a5 += l5 & 65535;
          b4 += l5 >>> 16;
          c4 += h5 & 65535;
          d5 += h5 >>> 16;
          b4 += a5 >>> 16;
          c4 += b4 >>> 16;
          d5 += c4 >>> 16;
          hh[3] = ah3 = c4 & 65535 | d5 << 16;
          hl[3] = al3 = a5 & 65535 | b4 << 16;
          h5 = ah4;
          l5 = al4;
          a5 = l5 & 65535;
          b4 = l5 >>> 16;
          c4 = h5 & 65535;
          d5 = h5 >>> 16;
          h5 = hh[4];
          l5 = hl[4];
          a5 += l5 & 65535;
          b4 += l5 >>> 16;
          c4 += h5 & 65535;
          d5 += h5 >>> 16;
          b4 += a5 >>> 16;
          c4 += b4 >>> 16;
          d5 += c4 >>> 16;
          hh[4] = ah4 = c4 & 65535 | d5 << 16;
          hl[4] = al4 = a5 & 65535 | b4 << 16;
          h5 = ah5;
          l5 = al5;
          a5 = l5 & 65535;
          b4 = l5 >>> 16;
          c4 = h5 & 65535;
          d5 = h5 >>> 16;
          h5 = hh[5];
          l5 = hl[5];
          a5 += l5 & 65535;
          b4 += l5 >>> 16;
          c4 += h5 & 65535;
          d5 += h5 >>> 16;
          b4 += a5 >>> 16;
          c4 += b4 >>> 16;
          d5 += c4 >>> 16;
          hh[5] = ah5 = c4 & 65535 | d5 << 16;
          hl[5] = al5 = a5 & 65535 | b4 << 16;
          h5 = ah6;
          l5 = al6;
          a5 = l5 & 65535;
          b4 = l5 >>> 16;
          c4 = h5 & 65535;
          d5 = h5 >>> 16;
          h5 = hh[6];
          l5 = hl[6];
          a5 += l5 & 65535;
          b4 += l5 >>> 16;
          c4 += h5 & 65535;
          d5 += h5 >>> 16;
          b4 += a5 >>> 16;
          c4 += b4 >>> 16;
          d5 += c4 >>> 16;
          hh[6] = ah6 = c4 & 65535 | d5 << 16;
          hl[6] = al6 = a5 & 65535 | b4 << 16;
          h5 = ah7;
          l5 = al7;
          a5 = l5 & 65535;
          b4 = l5 >>> 16;
          c4 = h5 & 65535;
          d5 = h5 >>> 16;
          h5 = hh[7];
          l5 = hl[7];
          a5 += l5 & 65535;
          b4 += l5 >>> 16;
          c4 += h5 & 65535;
          d5 += h5 >>> 16;
          b4 += a5 >>> 16;
          c4 += b4 >>> 16;
          d5 += c4 >>> 16;
          hh[7] = ah7 = c4 & 65535 | d5 << 16;
          hl[7] = al7 = a5 & 65535 | b4 << 16;
          pos += 128;
          n5 -= 128;
        }
        return n5;
      }
      function crypto_hash(out, m5, n5) {
        var hh = new Int32Array(8), hl = new Int32Array(8), x4 = new Uint8Array(256), i6, b4 = n5;
        hh[0] = 1779033703;
        hh[1] = 3144134277;
        hh[2] = 1013904242;
        hh[3] = 2773480762;
        hh[4] = 1359893119;
        hh[5] = 2600822924;
        hh[6] = 528734635;
        hh[7] = 1541459225;
        hl[0] = 4089235720;
        hl[1] = 2227873595;
        hl[2] = 4271175723;
        hl[3] = 1595750129;
        hl[4] = 2917565137;
        hl[5] = 725511199;
        hl[6] = 4215389547;
        hl[7] = 327033209;
        crypto_hashblocks_hl(hh, hl, m5, n5);
        n5 %= 128;
        for (i6 = 0; i6 < n5; i6++) x4[i6] = m5[b4 - n5 + i6];
        x4[n5] = 128;
        n5 = 256 - 128 * (n5 < 112 ? 1 : 0);
        x4[n5 - 9] = 0;
        ts64(x4, n5 - 8, b4 / 536870912 | 0, b4 << 3);
        crypto_hashblocks_hl(hh, hl, x4, n5);
        for (i6 = 0; i6 < 8; i6++) ts64(out, 8 * i6, hh[i6], hl[i6]);
        return 0;
      }
      function add(p5, q3) {
        var a5 = gf(), b4 = gf(), c4 = gf(), d5 = gf(), e5 = gf(), f4 = gf(), g4 = gf(), h5 = gf(), t7 = gf();
        Z(a5, p5[1], p5[0]);
        Z(t7, q3[1], q3[0]);
        M(a5, a5, t7);
        A3(b4, p5[0], p5[1]);
        A3(t7, q3[0], q3[1]);
        M(b4, b4, t7);
        M(c4, p5[3], q3[3]);
        M(c4, c4, D22);
        M(d5, p5[2], q3[2]);
        A3(d5, d5, d5);
        Z(e5, b4, a5);
        Z(f4, d5, c4);
        A3(g4, d5, c4);
        A3(h5, b4, a5);
        M(p5[0], e5, f4);
        M(p5[1], h5, g4);
        M(p5[2], g4, f4);
        M(p5[3], e5, h5);
      }
      function cswap(p5, q3, b4) {
        var i6;
        for (i6 = 0; i6 < 4; i6++) {
          sel25519(p5[i6], q3[i6], b4);
        }
      }
      function pack(r7, p5) {
        var tx3 = gf(), ty = gf(), zi = gf();
        inv25519(zi, p5[2]);
        M(tx3, p5[0], zi);
        M(ty, p5[1], zi);
        pack25519(r7, ty);
        r7[31] ^= par25519(tx3) << 7;
      }
      function scalarmult(p5, q3, s5) {
        var b4, i6;
        set25519(p5[0], gf0);
        set25519(p5[1], gf1);
        set25519(p5[2], gf1);
        set25519(p5[3], gf0);
        for (i6 = 255; i6 >= 0; --i6) {
          b4 = s5[i6 / 8 | 0] >> (i6 & 7) & 1;
          cswap(p5, q3, b4);
          add(q3, p5);
          add(p5, p5);
          cswap(p5, q3, b4);
        }
      }
      function scalarbase(p5, s5) {
        var q3 = [gf(), gf(), gf(), gf()];
        set25519(q3[0], X);
        set25519(q3[1], Y);
        set25519(q3[2], gf1);
        M(q3[3], X, Y);
        scalarmult(p5, q3, s5);
      }
      function crypto_sign_keypair(pk, sk, seeded) {
        var d5 = new Uint8Array(64);
        var p5 = [gf(), gf(), gf(), gf()];
        var i6;
        if (!seeded) randombytes(sk, 32);
        crypto_hash(d5, sk, 32);
        d5[0] &= 248;
        d5[31] &= 127;
        d5[31] |= 64;
        scalarbase(p5, d5);
        pack(pk, p5);
        for (i6 = 0; i6 < 32; i6++) sk[i6 + 32] = pk[i6];
        return 0;
      }
      var L3 = new Float64Array([237, 211, 245, 92, 26, 99, 18, 88, 214, 156, 247, 162, 222, 249, 222, 20, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 16]);
      function modL(r7, x4) {
        var carry, i6, j4, k3;
        for (i6 = 63; i6 >= 32; --i6) {
          carry = 0;
          for (j4 = i6 - 32, k3 = i6 - 12; j4 < k3; ++j4) {
            x4[j4] += carry - 16 * x4[i6] * L3[j4 - (i6 - 32)];
            carry = Math.floor((x4[j4] + 128) / 256);
            x4[j4] -= carry * 256;
          }
          x4[j4] += carry;
          x4[i6] = 0;
        }
        carry = 0;
        for (j4 = 0; j4 < 32; j4++) {
          x4[j4] += carry - (x4[31] >> 4) * L3[j4];
          carry = x4[j4] >> 8;
          x4[j4] &= 255;
        }
        for (j4 = 0; j4 < 32; j4++) x4[j4] -= carry * L3[j4];
        for (i6 = 0; i6 < 32; i6++) {
          x4[i6 + 1] += x4[i6] >> 8;
          r7[i6] = x4[i6] & 255;
        }
      }
      function reduce(r7) {
        var x4 = new Float64Array(64), i6;
        for (i6 = 0; i6 < 64; i6++) x4[i6] = r7[i6];
        for (i6 = 0; i6 < 64; i6++) r7[i6] = 0;
        modL(r7, x4);
      }
      function crypto_sign(sm, m5, n5, sk) {
        var d5 = new Uint8Array(64), h5 = new Uint8Array(64), r7 = new Uint8Array(64);
        var i6, j4, x4 = new Float64Array(64);
        var p5 = [gf(), gf(), gf(), gf()];
        crypto_hash(d5, sk, 32);
        d5[0] &= 248;
        d5[31] &= 127;
        d5[31] |= 64;
        var smlen = n5 + 64;
        for (i6 = 0; i6 < n5; i6++) sm[64 + i6] = m5[i6];
        for (i6 = 0; i6 < 32; i6++) sm[32 + i6] = d5[32 + i6];
        crypto_hash(r7, sm.subarray(32), n5 + 32);
        reduce(r7);
        scalarbase(p5, r7);
        pack(sm, p5);
        for (i6 = 32; i6 < 64; i6++) sm[i6] = sk[i6];
        crypto_hash(h5, sm, n5 + 64);
        reduce(h5);
        for (i6 = 0; i6 < 64; i6++) x4[i6] = 0;
        for (i6 = 0; i6 < 32; i6++) x4[i6] = r7[i6];
        for (i6 = 0; i6 < 32; i6++) {
          for (j4 = 0; j4 < 32; j4++) {
            x4[i6 + j4] += h5[i6] * d5[j4];
          }
        }
        modL(sm.subarray(32), x4);
        return smlen;
      }
      function unpackneg(r7, p5) {
        var t7 = gf(), chk = gf(), num = gf(), den = gf(), den2 = gf(), den4 = gf(), den6 = gf();
        set25519(r7[2], gf1);
        unpack25519(r7[1], p5);
        S3(num, r7[1]);
        M(den, num, D3);
        Z(num, num, r7[2]);
        A3(den, r7[2], den);
        S3(den2, den);
        S3(den4, den2);
        M(den6, den4, den2);
        M(t7, den6, num);
        M(t7, t7, den);
        pow2523(t7, t7);
        M(t7, t7, num);
        M(t7, t7, den);
        M(t7, t7, den);
        M(r7[0], t7, den);
        S3(chk, r7[0]);
        M(chk, chk, den);
        if (neq25519(chk, num)) M(r7[0], r7[0], I2);
        S3(chk, r7[0]);
        M(chk, chk, den);
        if (neq25519(chk, num)) return -1;
        if (par25519(r7[0]) === p5[31] >> 7) Z(r7[0], gf0, r7[0]);
        M(r7[3], r7[0], r7[1]);
        return 0;
      }
      function crypto_sign_open(m5, sm, n5, pk) {
        var i6;
        var t7 = new Uint8Array(32), h5 = new Uint8Array(64);
        var p5 = [gf(), gf(), gf(), gf()], q3 = [gf(), gf(), gf(), gf()];
        if (n5 < 64) return -1;
        if (unpackneg(q3, pk)) return -1;
        for (i6 = 0; i6 < n5; i6++) m5[i6] = sm[i6];
        for (i6 = 0; i6 < 32; i6++) m5[i6 + 32] = pk[i6];
        crypto_hash(h5, m5, n5);
        reduce(h5);
        scalarmult(p5, q3, h5);
        scalarbase(q3, sm.subarray(32));
        add(p5, q3);
        pack(t7, p5);
        n5 -= 64;
        if (crypto_verify_32(sm, 0, t7, 0)) {
          for (i6 = 0; i6 < n5; i6++) m5[i6] = 0;
          return -1;
        }
        for (i6 = 0; i6 < n5; i6++) m5[i6] = sm[i6 + 64];
        return n5;
      }
      var crypto_secretbox_KEYBYTES = 32, crypto_secretbox_NONCEBYTES = 24, crypto_secretbox_ZEROBYTES = 32, crypto_secretbox_BOXZEROBYTES = 16, crypto_scalarmult_BYTES = 32, crypto_scalarmult_SCALARBYTES = 32, crypto_box_PUBLICKEYBYTES = 32, crypto_box_SECRETKEYBYTES = 32, crypto_box_BEFORENMBYTES = 32, crypto_box_NONCEBYTES = crypto_secretbox_NONCEBYTES, crypto_box_ZEROBYTES = crypto_secretbox_ZEROBYTES, crypto_box_BOXZEROBYTES = crypto_secretbox_BOXZEROBYTES, crypto_sign_BYTES = 64, crypto_sign_PUBLICKEYBYTES = 32, crypto_sign_SECRETKEYBYTES = 64, crypto_sign_SEEDBYTES = 32, crypto_hash_BYTES = 64;
      nacl.lowlevel = {
        crypto_core_hsalsa20,
        crypto_stream_xor,
        crypto_stream,
        crypto_stream_salsa20_xor,
        crypto_stream_salsa20,
        crypto_onetimeauth,
        crypto_onetimeauth_verify,
        crypto_verify_16,
        crypto_verify_32,
        crypto_secretbox,
        crypto_secretbox_open,
        crypto_scalarmult,
        crypto_scalarmult_base,
        crypto_box_beforenm,
        crypto_box_afternm,
        crypto_box,
        crypto_box_open,
        crypto_box_keypair,
        crypto_hash,
        crypto_sign,
        crypto_sign_keypair,
        crypto_sign_open,
        crypto_secretbox_KEYBYTES,
        crypto_secretbox_NONCEBYTES,
        crypto_secretbox_ZEROBYTES,
        crypto_secretbox_BOXZEROBYTES,
        crypto_scalarmult_BYTES,
        crypto_scalarmult_SCALARBYTES,
        crypto_box_PUBLICKEYBYTES,
        crypto_box_SECRETKEYBYTES,
        crypto_box_BEFORENMBYTES,
        crypto_box_NONCEBYTES,
        crypto_box_ZEROBYTES,
        crypto_box_BOXZEROBYTES,
        crypto_sign_BYTES,
        crypto_sign_PUBLICKEYBYTES,
        crypto_sign_SECRETKEYBYTES,
        crypto_sign_SEEDBYTES,
        crypto_hash_BYTES,
        gf,
        D: D3,
        L: L3,
        pack25519,
        unpack25519,
        M,
        A: A3,
        S: S3,
        Z,
        pow2523,
        add,
        set25519,
        modL,
        scalarmult,
        scalarbase
      };
      function checkLengths(k3, n5) {
        if (k3.length !== crypto_secretbox_KEYBYTES) throw new Error("bad key size");
        if (n5.length !== crypto_secretbox_NONCEBYTES) throw new Error("bad nonce size");
      }
      function checkBoxLengths(pk, sk) {
        if (pk.length !== crypto_box_PUBLICKEYBYTES) throw new Error("bad public key size");
        if (sk.length !== crypto_box_SECRETKEYBYTES) throw new Error("bad secret key size");
      }
      function checkArrayTypes() {
        for (var i6 = 0; i6 < arguments.length; i6++) {
          if (!(arguments[i6] instanceof Uint8Array))
            throw new TypeError("unexpected type, use Uint8Array");
        }
      }
      function cleanup(arr) {
        for (var i6 = 0; i6 < arr.length; i6++) arr[i6] = 0;
      }
      nacl.randomBytes = function(n5) {
        var b4 = new Uint8Array(n5);
        randombytes(b4, n5);
        return b4;
      };
      nacl.secretbox = function(msg, nonce, key) {
        checkArrayTypes(msg, nonce, key);
        checkLengths(key, nonce);
        var m5 = new Uint8Array(crypto_secretbox_ZEROBYTES + msg.length);
        var c4 = new Uint8Array(m5.length);
        for (var i6 = 0; i6 < msg.length; i6++) m5[i6 + crypto_secretbox_ZEROBYTES] = msg[i6];
        crypto_secretbox(c4, m5, m5.length, nonce, key);
        return c4.subarray(crypto_secretbox_BOXZEROBYTES);
      };
      nacl.secretbox.open = function(box, nonce, key) {
        checkArrayTypes(box, nonce, key);
        checkLengths(key, nonce);
        var c4 = new Uint8Array(crypto_secretbox_BOXZEROBYTES + box.length);
        var m5 = new Uint8Array(c4.length);
        for (var i6 = 0; i6 < box.length; i6++) c4[i6 + crypto_secretbox_BOXZEROBYTES] = box[i6];
        if (c4.length < 32) return null;
        if (crypto_secretbox_open(m5, c4, c4.length, nonce, key) !== 0) return null;
        return m5.subarray(crypto_secretbox_ZEROBYTES);
      };
      nacl.secretbox.keyLength = crypto_secretbox_KEYBYTES;
      nacl.secretbox.nonceLength = crypto_secretbox_NONCEBYTES;
      nacl.secretbox.overheadLength = crypto_secretbox_BOXZEROBYTES;
      nacl.scalarMult = function(n5, p5) {
        checkArrayTypes(n5, p5);
        if (n5.length !== crypto_scalarmult_SCALARBYTES) throw new Error("bad n size");
        if (p5.length !== crypto_scalarmult_BYTES) throw new Error("bad p size");
        var q3 = new Uint8Array(crypto_scalarmult_BYTES);
        crypto_scalarmult(q3, n5, p5);
        return q3;
      };
      nacl.scalarMult.base = function(n5) {
        checkArrayTypes(n5);
        if (n5.length !== crypto_scalarmult_SCALARBYTES) throw new Error("bad n size");
        var q3 = new Uint8Array(crypto_scalarmult_BYTES);
        crypto_scalarmult_base(q3, n5);
        return q3;
      };
      nacl.scalarMult.scalarLength = crypto_scalarmult_SCALARBYTES;
      nacl.scalarMult.groupElementLength = crypto_scalarmult_BYTES;
      nacl.box = function(msg, nonce, publicKey, secretKey) {
        var k3 = nacl.box.before(publicKey, secretKey);
        return nacl.secretbox(msg, nonce, k3);
      };
      nacl.box.before = function(publicKey, secretKey) {
        checkArrayTypes(publicKey, secretKey);
        checkBoxLengths(publicKey, secretKey);
        var k3 = new Uint8Array(crypto_box_BEFORENMBYTES);
        crypto_box_beforenm(k3, publicKey, secretKey);
        return k3;
      };
      nacl.box.after = nacl.secretbox;
      nacl.box.open = function(msg, nonce, publicKey, secretKey) {
        var k3 = nacl.box.before(publicKey, secretKey);
        return nacl.secretbox.open(msg, nonce, k3);
      };
      nacl.box.open.after = nacl.secretbox.open;
      nacl.box.keyPair = function() {
        var pk = new Uint8Array(crypto_box_PUBLICKEYBYTES);
        var sk = new Uint8Array(crypto_box_SECRETKEYBYTES);
        crypto_box_keypair(pk, sk);
        return { publicKey: pk, secretKey: sk };
      };
      nacl.box.keyPair.fromSecretKey = function(secretKey) {
        checkArrayTypes(secretKey);
        if (secretKey.length !== crypto_box_SECRETKEYBYTES)
          throw new Error("bad secret key size");
        var pk = new Uint8Array(crypto_box_PUBLICKEYBYTES);
        crypto_scalarmult_base(pk, secretKey);
        return { publicKey: pk, secretKey: new Uint8Array(secretKey) };
      };
      nacl.box.publicKeyLength = crypto_box_PUBLICKEYBYTES;
      nacl.box.secretKeyLength = crypto_box_SECRETKEYBYTES;
      nacl.box.sharedKeyLength = crypto_box_BEFORENMBYTES;
      nacl.box.nonceLength = crypto_box_NONCEBYTES;
      nacl.box.overheadLength = nacl.secretbox.overheadLength;
      nacl.sign = function(msg, secretKey) {
        checkArrayTypes(msg, secretKey);
        if (secretKey.length !== crypto_sign_SECRETKEYBYTES)
          throw new Error("bad secret key size");
        var signedMsg = new Uint8Array(crypto_sign_BYTES + msg.length);
        crypto_sign(signedMsg, msg, msg.length, secretKey);
        return signedMsg;
      };
      nacl.sign.open = function(signedMsg, publicKey) {
        checkArrayTypes(signedMsg, publicKey);
        if (publicKey.length !== crypto_sign_PUBLICKEYBYTES)
          throw new Error("bad public key size");
        var tmp = new Uint8Array(signedMsg.length);
        var mlen = crypto_sign_open(tmp, signedMsg, signedMsg.length, publicKey);
        if (mlen < 0) return null;
        var m5 = new Uint8Array(mlen);
        for (var i6 = 0; i6 < m5.length; i6++) m5[i6] = tmp[i6];
        return m5;
      };
      nacl.sign.detached = function(msg, secretKey) {
        var signedMsg = nacl.sign(msg, secretKey);
        var sig = new Uint8Array(crypto_sign_BYTES);
        for (var i6 = 0; i6 < sig.length; i6++) sig[i6] = signedMsg[i6];
        return sig;
      };
      nacl.sign.detached.verify = function(msg, sig, publicKey) {
        checkArrayTypes(msg, sig, publicKey);
        if (sig.length !== crypto_sign_BYTES)
          throw new Error("bad signature size");
        if (publicKey.length !== crypto_sign_PUBLICKEYBYTES)
          throw new Error("bad public key size");
        var sm = new Uint8Array(crypto_sign_BYTES + msg.length);
        var m5 = new Uint8Array(crypto_sign_BYTES + msg.length);
        var i6;
        for (i6 = 0; i6 < crypto_sign_BYTES; i6++) sm[i6] = sig[i6];
        for (i6 = 0; i6 < msg.length; i6++) sm[i6 + crypto_sign_BYTES] = msg[i6];
        return crypto_sign_open(m5, sm, sm.length, publicKey) >= 0;
      };
      nacl.sign.keyPair = function() {
        var pk = new Uint8Array(crypto_sign_PUBLICKEYBYTES);
        var sk = new Uint8Array(crypto_sign_SECRETKEYBYTES);
        crypto_sign_keypair(pk, sk);
        return { publicKey: pk, secretKey: sk };
      };
      nacl.sign.keyPair.fromSecretKey = function(secretKey) {
        checkArrayTypes(secretKey);
        if (secretKey.length !== crypto_sign_SECRETKEYBYTES)
          throw new Error("bad secret key size");
        var pk = new Uint8Array(crypto_sign_PUBLICKEYBYTES);
        for (var i6 = 0; i6 < pk.length; i6++) pk[i6] = secretKey[32 + i6];
        return { publicKey: pk, secretKey: new Uint8Array(secretKey) };
      };
      nacl.sign.keyPair.fromSeed = function(seed) {
        checkArrayTypes(seed);
        if (seed.length !== crypto_sign_SEEDBYTES)
          throw new Error("bad seed size");
        var pk = new Uint8Array(crypto_sign_PUBLICKEYBYTES);
        var sk = new Uint8Array(crypto_sign_SECRETKEYBYTES);
        for (var i6 = 0; i6 < 32; i6++) sk[i6] = seed[i6];
        crypto_sign_keypair(pk, sk, true);
        return { publicKey: pk, secretKey: sk };
      };
      nacl.sign.publicKeyLength = crypto_sign_PUBLICKEYBYTES;
      nacl.sign.secretKeyLength = crypto_sign_SECRETKEYBYTES;
      nacl.sign.seedLength = crypto_sign_SEEDBYTES;
      nacl.sign.signatureLength = crypto_sign_BYTES;
      nacl.hash = function(msg) {
        checkArrayTypes(msg);
        var h5 = new Uint8Array(crypto_hash_BYTES);
        crypto_hash(h5, msg, msg.length);
        return h5;
      };
      nacl.hash.hashLength = crypto_hash_BYTES;
      nacl.verify = function(x4, y5) {
        checkArrayTypes(x4, y5);
        if (x4.length === 0 || y5.length === 0) return false;
        if (x4.length !== y5.length) return false;
        return vn(x4, 0, y5, 0, x4.length) === 0 ? true : false;
      };
      nacl.setPRNG = function(fn) {
        randombytes = fn;
      };
      (function() {
        var crypto2 = typeof self !== "undefined" ? self.crypto || self.msCrypto : null;
        if (crypto2 && crypto2.getRandomValues) {
          var QUOTA = 65536;
          nacl.setPRNG(function(x4, n5) {
            var i6, v4 = new Uint8Array(n5);
            for (i6 = 0; i6 < n5; i6 += QUOTA) {
              crypto2.getRandomValues(v4.subarray(i6, i6 + Math.min(n5 - i6, QUOTA)));
            }
            for (i6 = 0; i6 < n5; i6++) x4[i6] = v4[i6];
            cleanup(v4);
          });
        } else if (typeof __require !== "undefined") {
          crypto2 = require_crypto();
          if (crypto2 && crypto2.randomBytes) {
            nacl.setPRNG(function(x4, n5) {
              var i6, v4 = crypto2.randomBytes(n5);
              for (i6 = 0; i6 < n5; i6++) x4[i6] = v4[i6];
              cleanup(v4);
            });
          }
        }
      })();
    })(typeof module !== "undefined" && module.exports ? module.exports : self.nacl = self.nacl || {});
  }
});

// node_modules/tweetnacl-util/nacl-util.js
var require_nacl_util = __commonJS({
  "node_modules/tweetnacl-util/nacl-util.js"(exports, module) {
    (function(root, f4) {
      "use strict";
      if (typeof module !== "undefined" && module.exports) module.exports = f4();
      else if (root.nacl) root.nacl.util = f4();
      else {
        root.nacl = {};
        root.nacl.util = f4();
      }
    })(exports, function() {
      "use strict";
      var util = {};
      function validateBase64(s5) {
        if (!/^(?:[A-Za-z0-9+\/]{2}[A-Za-z0-9+\/]{2})*(?:[A-Za-z0-9+\/]{2}==|[A-Za-z0-9+\/]{3}=)?$/.test(s5)) {
          throw new TypeError("invalid encoding");
        }
      }
      util.decodeUTF8 = function(s5) {
        if (typeof s5 !== "string") throw new TypeError("expected string");
        var i6, d5 = unescape(encodeURIComponent(s5)), b4 = new Uint8Array(d5.length);
        for (i6 = 0; i6 < d5.length; i6++) b4[i6] = d5.charCodeAt(i6);
        return b4;
      };
      util.encodeUTF8 = function(arr) {
        var i6, s5 = [];
        for (i6 = 0; i6 < arr.length; i6++) s5.push(String.fromCharCode(arr[i6]));
        return decodeURIComponent(escape(s5.join("")));
      };
      if (typeof atob === "undefined") {
        if (typeof Buffer.from !== "undefined") {
          util.encodeBase64 = function(arr) {
            return Buffer.from(arr).toString("base64");
          };
          util.decodeBase64 = function(s5) {
            validateBase64(s5);
            return new Uint8Array(Array.prototype.slice.call(Buffer.from(s5, "base64"), 0));
          };
        } else {
          util.encodeBase64 = function(arr) {
            return new Buffer(arr).toString("base64");
          };
          util.decodeBase64 = function(s5) {
            validateBase64(s5);
            return new Uint8Array(Array.prototype.slice.call(new Buffer(s5, "base64"), 0));
          };
        }
      } else {
        util.encodeBase64 = function(arr) {
          var i6, s5 = [], len = arr.length;
          for (i6 = 0; i6 < len; i6++) s5.push(String.fromCharCode(arr[i6]));
          return btoa(s5.join(""));
        };
        util.decodeBase64 = function(s5) {
          validateBase64(s5);
          var i6, d5 = atob(s5), b4 = new Uint8Array(d5.length);
          for (i6 = 0; i6 < d5.length; i6++) b4[i6] = d5.charCodeAt(i6);
          return b4;
        };
      }
      return util;
    });
  }
});

// node_modules/@stellar/freighter-api/build/index.min.js
var require_index_min = __commonJS({
  "node_modules/@stellar/freighter-api/build/index.min.js"(exports, module) {
    !(function(r7, e5) {
      "object" == typeof exports && "object" == typeof module ? module.exports = e5() : "function" == typeof define && define.amd ? define([], e5) : "object" == typeof exports ? exports.freighterApi = e5() : r7.freighterApi = e5();
    })(exports, () => (() => {
      "use strict";
      var r7, e5, s5 = { d: (r8, e6) => {
        for (var t8 in e6) s5.o(e6, t8) && !s5.o(r8, t8) && Object.defineProperty(r8, t8, { enumerable: true, get: e6[t8] });
      }, o: (r8, e6) => Object.prototype.hasOwnProperty.call(r8, e6), r: (r8) => {
        "undefined" != typeof Symbol && Symbol.toStringTag && Object.defineProperty(r8, Symbol.toStringTag, { value: "Module" }), Object.defineProperty(r8, "__esModule", { value: true });
      } }, t7 = {};
      s5.r(t7), s5.d(t7, { WatchWalletChanges: () => u4, addToken: () => S3, default: () => D3, getAddress: () => _5, getNetwork: () => C4, getNetworkDetails: () => O2, isAllowed: () => R2, isBrowser: () => U, isConnected: () => N2, requestAccess: () => w6, setAllowed: () => I2, signAuthEntry: () => l5, signMessage: () => c4, signTransaction: () => d5 }), (function(r8) {
        r8.CREATE_ACCOUNT = "CREATE_ACCOUNT", r8.FUND_ACCOUNT = "FUND_ACCOUNT", r8.ADD_ACCOUNT = "ADD_ACCOUNT", r8.IMPORT_ACCOUNT = "IMPORT_ACCOUNT", r8.IMPORT_HARDWARE_WALLET = "IMPORT_HARDWARE_WALLET", r8.LOAD_ACCOUNT = "LOAD_ACCOUNT", r8.MAKE_ACCOUNT_ACTIVE = "MAKE_ACCOUNT_ACTIVE", r8.UPDATE_ACCOUNT_NAME = "UPDATE_ACCOUNT_NAME", r8.GET_MNEMONIC_PHRASE = "GET_MNEMONIC_PHRASE", r8.CONFIRM_MNEMONIC_PHRASE = "CONFIRM_MNEMONIC_PHRASE", r8.CONFIRM_MIGRATED_MNEMONIC_PHRASE = "CONFIRM_MIGRATED_MNEMONIC_PHRASE", r8.RECOVER_ACCOUNT = "RECOVER_ACCOUNT", r8.CONFIRM_PASSWORD = "CONFIRM_PASSWORD", r8.REJECT_ACCESS = "REJECT_ACCESS", r8.GRANT_ACCESS = "GRANT_ACCESS", r8.ADD_TOKEN = "ADD_TOKEN", r8.SIGN_TRANSACTION = "SIGN_TRANSACTION", r8.SIGN_BLOB = "SIGN_BLOB", r8.SIGN_AUTH_ENTRY = "SIGN_AUTH_ENTRY", r8.HANDLE_SIGNED_HW_PAYLOAD = "HANDLE_SIGNED_HW_PAYLOAD", r8.REJECT_TRANSACTION = "REJECT_TRANSACTION", r8.SIGN_FREIGHTER_TRANSACTION = "SIGN_FREIGHTER_TRANSACTION", r8.SIGN_FREIGHTER_SOROBAN_TRANSACTION = "SIGN_FREIGHTER_SOROBAN_TRANSACTION", r8.ADD_RECENT_ADDRESS = "ADD_RECENT_ADDRESS", r8.LOAD_RECENT_ADDRESSES = "LOAD_RECENT_ADDRESSES", r8.LOAD_LAST_USED_ACCOUNT = "LOAD_LAST_USED_ACCOUNT", r8.SIGN_OUT = "SIGN_OUT", r8.SHOW_BACKUP_PHRASE = "SHOW_BACKUP_PHRASE", r8.SAVE_ALLOWLIST = "SAVE_ALLOWLIST", r8.SAVE_SETTINGS = "SAVE_SETTINGS", r8.SAVE_EXPERIMENTAL_FEATURES = "SAVE_EXPERIMENTAL_FEATURES", r8.LOAD_SETTINGS = "LOAD_SETTINGS", r8.GET_CACHED_ASSET_ICON = "GET_CACHED_ASSET_ICON", r8.CACHE_ASSET_ICON = "CACHE_ASSET_ICON", r8.GET_CACHED_ASSET_DOMAIN = "GET_CACHED_ASSET_DOMAIN", r8.CACHE_ASSET_DOMAIN = "CACHE_ASSET_DOMAIN", r8.GET_MEMO_REQUIRED_ACCOUNTS = "GET_MEMO_REQUIRED_ACCOUNTS", r8.ADD_CUSTOM_NETWORK = "ADD_CUSTOM_NETWORK", r8.CHANGE_NETWORK = "CHANGE_NETWORK", r8.REMOVE_CUSTOM_NETWORK = "REMOVE_CUSTOM_NETWORK", r8.EDIT_CUSTOM_NETWORK = "EDIT_CUSTOM_NETWORK", r8.RESET_EXP_DATA = "RESET_EXP_DATA", r8.ADD_TOKEN_ID = "ADD_TOKEN_ID", r8.GET_TOKEN_IDS = "GET_TOKEN_IDS", r8.REMOVE_TOKEN_ID = "REMOVE_TOKEN_ID", r8.GET_MIGRATABLE_ACCOUNTS = "GET_MIGRATABLE_ACCOUNTS", r8.GET_MIGRATED_MNEMONIC_PHRASE = "GET_MIGRATED_MNEMONIC_PHRASE", r8.MIGRATE_ACCOUNTS = "MIGRATE_ACCOUNTS", r8.ADD_ASSETS_LIST = "ADD_ASSETS_LIST", r8.MODIFY_ASSETS_LIST = "MODIFY_ASSETS_LIST", r8.CHANGE_ASSET_VISIBILITY = "CHANGE_ASSET_VISIBILITY", r8.GET_HIDDEN_ASSETS = "GET_HIDDEN_ASSETS", r8.GET_IS_ACCOUNT_MISMATCH = "GET_IS_ACCOUNT_MISMATCH";
      })(r7 || (r7 = {})), (function(r8) {
        r8.REQUEST_ACCESS = "REQUEST_ACCESS", r8.REQUEST_PUBLIC_KEY = "REQUEST_PUBLIC_KEY", r8.SUBMIT_TOKEN = "SUBMIT_TOKEN", r8.SUBMIT_TRANSACTION = "SUBMIT_TRANSACTION", r8.SUBMIT_BLOB = "SUBMIT_BLOB", r8.SUBMIT_AUTH_ENTRY = "SUBMIT_AUTH_ENTRY", r8.REQUEST_NETWORK = "REQUEST_NETWORK", r8.REQUEST_NETWORK_DETAILS = "REQUEST_NETWORK_DETAILS", r8.REQUEST_CONNECTION_STATUS = "REQUEST_CONNECTION_STATUS", r8.REQUEST_ALLOWED_STATUS = "REQUEST_ALLOWED_STATUS", r8.SET_ALLOWED_STATUS = "SET_ALLOWED_STATUS", r8.REQUEST_USER_INFO = "REQUEST_USER_INFO";
      })(e5 || (e5 = {}));
      const n5 = (r8) => {
        const s6 = Date.now() + Math.random();
        return window.postMessage({ source: "FREIGHTER_EXTERNAL_MSG_REQUEST", messageId: s6, ...r8 }, window.location.origin), new Promise((t8) => {
          let n6 = 0;
          r8.type !== e5.REQUEST_CONNECTION_STATUS && r8.type !== e5.REQUEST_PUBLIC_KEY || (n6 = setTimeout(() => {
            t8({ isConnected: false, publicKey: "" }), window.removeEventListener("message", o5);
          }, 2e3));
          const o5 = (r9) => {
            var e6, E4;
            r9.source === window && "FREIGHTER_EXTERNAL_MSG_RESPONSE" === (null === (e6 = null == r9 ? void 0 : r9.data) || void 0 === e6 ? void 0 : e6.source) && (null === (E4 = null == r9 ? void 0 : r9.data) || void 0 === E4 ? void 0 : E4.messagedId) === s6 && (t8(r9.data), window.removeEventListener("message", o5), clearTimeout(n6));
          };
          window.addEventListener("message", o5, false);
        });
      }, o4 = { code: -1, message: "Node environment is not supported" }, E3 = { code: -1, message: "The wallet encountered an internal error. Please try again or contact the wallet if the problem persists." }, T4 = async () => {
        let r8;
        try {
          r8 = await n5({ type: e5.REQUEST_ACCESS });
        } catch (r9) {
          console.error(r9);
        }
        const { publicKey: s6 } = r8 || { publicKey: "" };
        return { publicKey: s6, error: null == r8 ? void 0 : r8.apiError };
      }, A3 = async () => {
        let r8;
        try {
          r8 = await n5({ type: e5.REQUEST_PUBLIC_KEY });
        } catch (r9) {
          console.error(r9);
        }
        return { publicKey: (null == r8 ? void 0 : r8.publicKey) || "", error: null == r8 ? void 0 : r8.apiError };
      }, a5 = async () => {
        let r8;
        try {
          r8 = await n5({ type: e5.REQUEST_NETWORK_DETAILS });
        } catch (r9) {
          console.error(r9);
        }
        const { networkDetails: s6, apiError: t8 } = r8 || { networkDetails: { network: "", networkName: "", networkUrl: "", networkPassphrase: "", sorobanRpcUrl: void 0, apiError: "" } }, { network: o5, networkUrl: E4, networkPassphrase: T5, sorobanRpcUrl: A4 } = s6;
        return { network: o5, networkUrl: E4, networkPassphrase: T5, sorobanRpcUrl: A4, error: t8 };
      }, i6 = async () => {
        let r8;
        try {
          r8 = await n5({ type: e5.REQUEST_ALLOWED_STATUS });
        } catch (r9) {
          console.error(r9);
        }
        const { isAllowed: s6 } = r8 || { isAllowed: false };
        return { isAllowed: s6, error: null == r8 ? void 0 : r8.apiError };
      }, _5 = async () => {
        let r8 = "";
        if (U) {
          const e6 = await A3();
          return r8 = e6.publicKey, e6.error ? { address: r8, error: e6.error } : { address: r8 };
        }
        return { address: r8, error: o4 };
      }, S3 = async (r8) => {
        if (U) {
          const s6 = await (async (r9) => {
            let s7;
            try {
              s7 = await n5({ contractId: r9.contractId, networkPassphrase: r9.networkPassphrase, type: e5.SUBMIT_TOKEN });
            } catch (r10) {
              return { error: E3 };
            }
            return { contractId: s7.contractId, error: null == s7 ? void 0 : s7.apiError };
          })(r8);
          return s6.error ? { contractId: "", error: s6.error } : { contractId: s6.contractId || "" };
        }
        return { contractId: "", error: o4 };
      }, d5 = async (r8, s6) => {
        if (U) {
          const t8 = await (async (r9, s7) => {
            let t9, o5, T5, A4;
            "object" == typeof s7 ? (o5 = s7.accountToSign, T5 = s7.networkPassphrase) : (t9 = s7, o5 = void 0);
            try {
              A4 = await n5({ transactionXdr: r9, network: t9, networkPassphrase: T5, accountToSign: o5, type: e5.SUBMIT_TRANSACTION });
            } catch (r10) {
              return { signedTransaction: "", signerAddress: "", error: E3 };
            }
            const { signedTransaction: a6, signerAddress: i7 } = A4;
            return { signedTransaction: a6, signerAddress: i7, error: null == A4 ? void 0 : A4.apiError };
          })(r8, s6);
          return t8.error ? { signedTxXdr: "", signerAddress: "", error: t8.error } : { signedTxXdr: t8.signedTransaction, signerAddress: t8.signerAddress };
        }
        return { signedTxXdr: "", signerAddress: "", error: o4 };
      }, c4 = async (r8, s6) => {
        if (U) {
          const { isAllowed: t8 } = await i6();
          if (!t8) {
            const r9 = await T4();
            if (r9.error) return { signedMessage: null, signerAddress: "", error: r9.error };
          }
          const o5 = await (async (r9, s7, t9) => {
            let o6;
            const T5 = (t9 || {}).address;
            try {
              o6 = await n5({ blob: r9, accountToSign: T5, apiVersion: "6.0.0", networkPassphrase: null == t9 ? void 0 : t9.networkPassphrase, type: e5.SUBMIT_BLOB });
            } catch (r10) {
              return { signedMessage: null, signerAddress: "", error: E3 };
            }
            const { signedBlob: A4, signerAddress: a6 } = o6;
            return { signedMessage: A4 || null, signerAddress: a6, error: null == o6 ? void 0 : o6.apiError };
          })(r8, 0, s6);
          return o5.error ? { signedMessage: null, signerAddress: "", error: o5.error } : { signedMessage: o5.signedMessage, signerAddress: o5.signerAddress };
        }
        return { signedMessage: null, signerAddress: "", error: o4 };
      }, l5 = async (r8, s6) => {
        if (U) {
          const { isAllowed: t8 } = await i6();
          if (!t8) {
            const r9 = await T4();
            if (r9.error) return { signedAuthEntry: null, signerAddress: "", error: r9.error };
          }
          const o5 = await (async (r9, s7, t9) => {
            const o6 = (t9 || {}).address;
            let T5;
            try {
              T5 = await n5({ entryXdr: r9, accountToSign: o6, apiVersion: "6.0.0", networkPassphrase: null == t9 ? void 0 : t9.networkPassphrase, type: e5.SUBMIT_AUTH_ENTRY });
            } catch (r10) {
              return console.error(r10), { signedAuthEntry: null, signerAddress: "", error: E3 };
            }
            const { signedAuthEntry: A4, signerAddress: a6 } = T5;
            return { signedAuthEntry: A4 || null, signerAddress: a6, error: null == T5 ? void 0 : T5.apiError };
          })(r8, 0, s6);
          return o5.error ? { signedAuthEntry: null, signerAddress: "", error: o5.error } : { signedAuthEntry: o5.signedAuthEntry, signerAddress: o5.signerAddress };
        }
        return { signedAuthEntry: null, signerAddress: "", error: o4 };
      }, N2 = async () => U ? window.freighter ? Promise.resolve({ isConnected: window.freighter }) : (async () => {
        let r8 = { isConnected: false };
        try {
          r8 = await n5({ type: e5.REQUEST_CONNECTION_STATUS });
        } catch (r9) {
          console.error(r9);
        }
        return { isConnected: r8.isConnected };
      })() : { isConnected: false, error: o4 }, C4 = async () => {
        if (U) {
          const r8 = await (async () => {
            let r9;
            try {
              r9 = await n5({ type: e5.REQUEST_NETWORK_DETAILS });
            } catch (r10) {
              console.error(r10);
            }
            const { networkDetails: s6 } = r9 || { networkDetails: { network: "", networkPassphrase: "" } };
            return { network: null == s6 ? void 0 : s6.network, networkPassphrase: null == s6 ? void 0 : s6.networkPassphrase, error: null == r9 ? void 0 : r9.apiError };
          })();
          return r8.error ? { network: "", networkPassphrase: "", error: r8.error } : { network: r8.network, networkPassphrase: r8.networkPassphrase };
        }
        return { network: "", networkPassphrase: "", error: o4 };
      }, O2 = async () => {
        if (U) {
          const r8 = await a5();
          return r8.error ? { network: "", networkUrl: "", networkPassphrase: "", error: r8.error } : { network: r8.network, networkUrl: r8.networkUrl, networkPassphrase: r8.networkPassphrase, sorobanRpcUrl: r8.sorobanRpcUrl };
        }
        return { network: "", networkUrl: "", networkPassphrase: "", error: o4 };
      }, R2 = async () => {
        let r8 = false;
        if (U) {
          const e6 = await i6();
          return r8 = e6.isAllowed, e6.error ? { isAllowed: r8, error: e6.error } : { isAllowed: r8 };
        }
        return { isAllowed: r8, error: o4 };
      }, I2 = async () => {
        let r8 = false;
        if (U) {
          const s6 = await (async () => {
            let r9;
            try {
              r9 = await n5({ type: e5.SET_ALLOWED_STATUS });
            } catch (r10) {
              console.error(r10);
            }
            const { isAllowed: s7 } = r9 || { isAllowed: false };
            return { isAllowed: s7, error: null == r9 ? void 0 : r9.apiError };
          })();
          return r8 = s6.isAllowed, s6.error ? { isAllowed: r8, error: s6.error } : { isAllowed: r8 };
        }
        return { isAllowed: r8, error: o4 };
      }, w6 = async () => {
        let r8 = "";
        if (U) {
          const e6 = await T4();
          return r8 = e6.publicKey, e6.error ? { address: r8, error: e6.error } : { address: r8 };
        }
        return { address: r8, error: o4 };
      };
      class u4 {
        constructor(r8 = 3e3) {
          this.fetchInfo = async (r9) => {
            if (!this.isRunning) return;
            const e6 = await A3(), s6 = await a5();
            (e6.error || s6.error) && r9({ address: "", network: "", networkPassphrase: "", error: e6.error || s6.error }), this.currentAddress === e6.publicKey && this.currentNetwork === s6.network && this.currentNetworkPassphrase === s6.networkPassphrase || (this.currentAddress = e6.publicKey, this.currentNetwork = s6.network, this.currentNetworkPassphrase = s6.networkPassphrase, r9({ address: e6.publicKey, network: s6.network, networkPassphrase: s6.networkPassphrase })), setTimeout(() => this.fetchInfo(r9), this.timeout);
          }, this.timeout = r8, this.currentAddress = "", this.currentNetwork = "", this.currentNetworkPassphrase = "", this.isRunning = false;
        }
        watch(r8) {
          return U ? (this.isRunning = true, this.fetchInfo(r8), {}) : { error: o4 };
        }
        stop() {
          this.isRunning = false;
        }
      }
      const U = "undefined" != typeof window, D3 = { getAddress: _5, addToken: S3, signTransaction: d5, signMessage: c4, signAuthEntry: l5, isConnected: N2, getNetwork: C4, getNetworkDetails: O2, isAllowed: R2, setAllowed: I2, requestAccess: w6, WatchWalletChanges: u4 };
      return t7;
    })());
  }
});

// node_modules/@lobstrco/signer-extension-api/build/index.min.js
var require_index_min2 = __commonJS({
  "node_modules/@lobstrco/signer-extension-api/build/index.min.js"(exports, module) {
    !(function(e5, n5) {
      "object" == typeof exports && "object" == typeof module ? module.exports = n5() : "function" == typeof define && define.amd ? define([], n5) : "object" == typeof exports ? exports.lobstrExtensionApi = n5() : e5.lobstrExtensionApi = n5();
    })(exports, () => (() => {
      "use strict";
      var e5 = { d: (n6, o5) => {
        for (var t8 in o5) e5.o(o5, t8) && !e5.o(n6, t8) && Object.defineProperty(n6, t8, { enumerable: true, get: o5[t8] });
      }, o: (e6, n6) => Object.prototype.hasOwnProperty.call(e6, n6), r: (e6) => {
        "undefined" != typeof Symbol && Symbol.toStringTag && Object.defineProperty(e6, Symbol.toStringTag, { value: "Module" }), Object.defineProperty(e6, "__esModule", { value: true });
      } }, n5 = {};
      e5.r(n5), e5.d(n5, { default: () => u4, getPublicKey: () => a5, isBrowser: () => S3, isConnected: () => c4, signMessage: () => l5, signTransaction: () => d5 });
      let o4 = (function(e6) {
        return e6[e6.V1 = 0] = "V1", e6[e6.V2 = 1] = "V2", e6;
      })({}), t7 = (function(e6) {
        return e6.REQUEST_ACCESS = "REQUEST_ACCESS", e6.SIGN = "SIGN", e6.SUBMIT_TRANSACTION = "SUBMIT_TRANSACTION", e6.SIGN_TRANSACTION = "SIGN_TRANSACTION", e6.REQUEST_CONNECTION_STATUS = "REQUEST_CONNECTION_STATUS", e6;
      })({});
      const r7 = "LOBSTR_CONNECTION_KEY", i6 = (e6) => {
        const n6 = Date.now() + Math.random();
        return window.postMessage({ source: "LOBSTR_EXTERNAL_MSG_REQUEST", messageId: n6, ...e6 }, window.location.origin), new Promise((o5) => {
          let r8 = 0;
          e6.type === t7.REQUEST_CONNECTION_STATUS && (r8 = setTimeout(() => {
            o5({ isConnected: false }), window.removeEventListener("message", i7);
          }, 2e3));
          const i7 = (e7) => {
            var t8, s6;
            e7.source === window && "LOBSTR_EXTERNAL_MSG_RESPONSE" === (null == e7 || null === (t8 = e7.data) || void 0 === t8 ? void 0 : t8.source) && (null == e7 || null === (s6 = e7.data) || void 0 === s6 ? void 0 : s6.messagedId) === n6 && (o5(e7.data), window.removeEventListener("message", i7), clearTimeout(r8));
          };
          window.addEventListener("message", i7, false);
        });
      }, s5 = async (e6, n6, r8) => {
        let s6 = { signedData: "", error: "", signerAddress: "" };
        try {
          s6 = await i6({ dataToSign: e6, connectionKey: n6, signType: r8, type: t7.SIGN, version: o4.V2 });
        } catch (e7) {
          throw console.error(e7), e7;
        }
        if (s6.error) throw s6.error;
        return s6;
      }, a5 = async () => {
        if (!S3) return "";
        const { publicKey: e6, connectionKey: n6 } = await (async () => {
          let e7 = { publicKey: "", error: "", connectionKey: "" };
          try {
            e7 = await i6({ type: t7.REQUEST_ACCESS, version: o4.V2 });
          } catch (e8) {
            console.error(e8);
          }
          const { publicKey: n7, connectionKey: r8, error: s6 } = e7;
          if (s6) throw s6;
          return { publicKey: n7, connectionKey: r8 };
        })();
        return ((e7) => {
          var n7, o5;
          null === (n7 = window) || void 0 === n7 || null === (o5 = n7.sessionStorage) || void 0 === o5 || o5.setItem(r7, e7);
        })(n6), e6;
      }, d5 = async (e6) => {
        if (!S3) return Promise.resolve("");
        const n6 = (null === (o5 = window) || void 0 === o5 || null === (t8 = o5.sessionStorage) || void 0 === t8 ? void 0 : t8.getItem(r7)) || "";
        var o5, t8;
        return (await s5(e6, n6, "transaction")).signedData;
      }, c4 = async () => !!S3 && (window.lobstrSignerExtension ? window.lobstrSignerExtension : await (async () => {
        let e6 = { isConnected: false };
        try {
          e6 = await i6({ type: t7.REQUEST_CONNECTION_STATUS, version: o4.V2 });
        } catch (e7) {
          console.error(e7);
        }
        return e6.isConnected;
      })()), l5 = async (e6) => {
        if (!S3) return Promise.resolve(null);
        const n6 = (null === (o5 = window) || void 0 === o5 || null === (t8 = o5.sessionStorage) || void 0 === t8 ? void 0 : t8.getItem(r7)) || "";
        var o5, t8;
        const i7 = await s5(e6, n6, "message");
        return { signedMessage: i7.signedData, signerAddress: i7.signerAddress };
      }, S3 = "undefined" != typeof window, u4 = { getPublicKey: a5, signTransaction: d5, isConnected: c4, signMessage: l5 };
      return n5;
    })());
  }
});

// node_modules/preact/dist/preact.module.js
var n;
var l;
var u;
var t;
var i;
var r;
var o;
var e;
var f;
var c;
var a;
var s;
var h;
var p;
var v;
var y;
var d = {};
var w = [];
var _ = /acit|ex(?:s|g|n|p|$)|rph|grid|ows|mnc|ntw|ine[ch]|zoo|^ord|itera/i;
var g = Array.isArray;
function m(n5, l5) {
  for (var u4 in l5) n5[u4] = l5[u4];
  return n5;
}
function b(n5) {
  n5 && n5.parentNode && n5.parentNode.removeChild(n5);
}
function k(l5, u4, t7) {
  var i6, r7, o4, e5 = {};
  for (o4 in u4) "key" == o4 ? i6 = u4[o4] : "ref" == o4 ? r7 = u4[o4] : e5[o4] = u4[o4];
  if (arguments.length > 2 && (e5.children = arguments.length > 3 ? n.call(arguments, 2) : t7), "function" == typeof l5 && null != l5.defaultProps) for (o4 in l5.defaultProps) void 0 === e5[o4] && (e5[o4] = l5.defaultProps[o4]);
  return x(l5, e5, i6, r7, null);
}
function x(n5, t7, i6, r7, o4) {
  var e5 = { type: n5, props: t7, key: i6, ref: r7, __k: null, __: null, __b: 0, __e: null, __c: null, constructor: void 0, __v: null == o4 ? ++u : o4, __i: -1, __u: 0 };
  return null == o4 && null != l.vnode && l.vnode(e5), e5;
}
function S(n5) {
  return n5.children;
}
function C(n5, l5) {
  this.props = n5, this.context = l5;
}
function $(n5, l5) {
  if (null == l5) return n5.__ ? $(n5.__, n5.__i + 1) : null;
  for (var u4; l5 < n5.__k.length; l5++) if (null != (u4 = n5.__k[l5]) && null != u4.__e) return u4.__e;
  return "function" == typeof n5.type ? $(n5) : null;
}
function I(n5) {
  if (n5.__P && n5.__d) {
    var u4 = n5.__v, t7 = u4.__e, i6 = [], r7 = [], o4 = m({}, u4);
    o4.__v = u4.__v + 1, l.vnode && l.vnode(o4), q(n5.__P, o4, u4, n5.__n, n5.__P.namespaceURI, 32 & u4.__u ? [t7] : null, i6, null == t7 ? $(u4) : t7, !!(32 & u4.__u), r7), o4.__v = u4.__v, o4.__.__k[o4.__i] = o4, D(i6, o4, r7), u4.__e = u4.__ = null, o4.__e != t7 && P(o4);
  }
}
function P(n5) {
  if (null != (n5 = n5.__) && null != n5.__c) return n5.__e = n5.__c.base = null, n5.__k.some(function(l5) {
    if (null != l5 && null != l5.__e) return n5.__e = n5.__c.base = l5.__e;
  }), P(n5);
}
function A(n5) {
  (!n5.__d && (n5.__d = true) && i.push(n5) && !H.__r++ || r != l.debounceRendering) && ((r = l.debounceRendering) || o)(H);
}
function H() {
  try {
    for (var n5, l5 = 1; i.length; ) i.length > l5 && i.sort(e), n5 = i.shift(), l5 = i.length, I(n5);
  } finally {
    i.length = H.__r = 0;
  }
}
function L(n5, l5, u4, t7, i6, r7, o4, e5, f4, c4, a5) {
  var s5, h5, p5, v4, y5, _5, g4, m5 = t7 && t7.__k || w, b4 = l5.length;
  for (f4 = T(u4, l5, m5, f4, b4), s5 = 0; s5 < b4; s5++) null != (p5 = u4.__k[s5]) && (h5 = -1 != p5.__i && m5[p5.__i] || d, p5.__i = s5, _5 = q(n5, p5, h5, i6, r7, o4, e5, f4, c4, a5), v4 = p5.__e, p5.ref && h5.ref != p5.ref && (h5.ref && J(h5.ref, null, p5), a5.push(p5.ref, p5.__c || v4, p5)), null == y5 && null != v4 && (y5 = v4), (g4 = !!(4 & p5.__u)) || h5.__k === p5.__k ? (f4 = j(p5, f4, n5, g4), g4 && h5.__e && (h5.__e = null)) : "function" == typeof p5.type && void 0 !== _5 ? f4 = _5 : v4 && (f4 = v4.nextSibling), p5.__u &= -7);
  return u4.__e = y5, f4;
}
function T(n5, l5, u4, t7, i6) {
  var r7, o4, e5, f4, c4, a5 = u4.length, s5 = a5, h5 = 0;
  for (n5.__k = new Array(i6), r7 = 0; r7 < i6; r7++) null != (o4 = l5[r7]) && "boolean" != typeof o4 && "function" != typeof o4 ? ("string" == typeof o4 || "number" == typeof o4 || "bigint" == typeof o4 || o4.constructor == String ? o4 = n5.__k[r7] = x(null, o4, null, null, null) : g(o4) ? o4 = n5.__k[r7] = x(S, { children: o4 }, null, null, null) : void 0 === o4.constructor && o4.__b > 0 ? o4 = n5.__k[r7] = x(o4.type, o4.props, o4.key, o4.ref ? o4.ref : null, o4.__v) : n5.__k[r7] = o4, f4 = r7 + h5, o4.__ = n5, o4.__b = n5.__b + 1, e5 = null, -1 != (c4 = o4.__i = O(o4, u4, f4, s5)) && (s5--, (e5 = u4[c4]) && (e5.__u |= 2)), null == e5 || null == e5.__v ? (-1 == c4 && (i6 > a5 ? h5-- : i6 < a5 && h5++), "function" != typeof o4.type && (o4.__u |= 4)) : c4 != f4 && (c4 == f4 - 1 ? h5-- : c4 == f4 + 1 ? h5++ : (c4 > f4 ? h5-- : h5++, o4.__u |= 4))) : n5.__k[r7] = null;
  if (s5) for (r7 = 0; r7 < a5; r7++) null != (e5 = u4[r7]) && 0 == (2 & e5.__u) && (e5.__e == t7 && (t7 = $(e5)), K(e5, e5));
  return t7;
}
function j(n5, l5, u4, t7) {
  var i6, r7;
  if ("function" == typeof n5.type) {
    for (i6 = n5.__k, r7 = 0; i6 && r7 < i6.length; r7++) i6[r7] && (i6[r7].__ = n5, l5 = j(i6[r7], l5, u4, t7));
    return l5;
  }
  n5.__e != l5 && (t7 && (l5 && n5.type && !l5.parentNode && (l5 = $(n5)), u4.insertBefore(n5.__e, l5 || null)), l5 = n5.__e);
  do {
    l5 = l5 && l5.nextSibling;
  } while (null != l5 && 8 == l5.nodeType);
  return l5;
}
function O(n5, l5, u4, t7) {
  var i6, r7, o4, e5 = n5.key, f4 = n5.type, c4 = l5[u4], a5 = null != c4 && 0 == (2 & c4.__u);
  if (null === c4 && null == e5 || a5 && e5 == c4.key && f4 == c4.type) return u4;
  if (t7 > (a5 ? 1 : 0)) {
    for (i6 = u4 - 1, r7 = u4 + 1; i6 >= 0 || r7 < l5.length; ) if (null != (c4 = l5[o4 = i6 >= 0 ? i6-- : r7++]) && 0 == (2 & c4.__u) && e5 == c4.key && f4 == c4.type) return o4;
  }
  return -1;
}
function z(n5, l5, u4) {
  "-" == l5[0] ? n5.setProperty(l5, null == u4 ? "" : u4) : n5[l5] = null == u4 ? "" : "number" != typeof u4 || _.test(l5) ? u4 : u4 + "px";
}
function N(n5, l5, u4, t7, i6) {
  var r7, o4;
  n: if ("style" == l5) if ("string" == typeof u4) n5.style.cssText = u4;
  else {
    if ("string" == typeof t7 && (n5.style.cssText = t7 = ""), t7) for (l5 in t7) u4 && l5 in u4 || z(n5.style, l5, "");
    if (u4) for (l5 in u4) t7 && u4[l5] == t7[l5] || z(n5.style, l5, u4[l5]);
  }
  else if ("o" == l5[0] && "n" == l5[1]) r7 = l5 != (l5 = l5.replace(s, "$1")), o4 = l5.toLowerCase(), l5 = o4 in n5 || "onFocusOut" == l5 || "onFocusIn" == l5 ? o4.slice(2) : l5.slice(2), n5.l || (n5.l = {}), n5.l[l5 + r7] = u4, u4 ? t7 ? u4[a] = t7[a] : (u4[a] = h, n5.addEventListener(l5, r7 ? v : p, r7)) : n5.removeEventListener(l5, r7 ? v : p, r7);
  else {
    if ("http://www.w3.org/2000/svg" == i6) l5 = l5.replace(/xlink(H|:h)/, "h").replace(/sName$/, "s");
    else if ("width" != l5 && "height" != l5 && "href" != l5 && "list" != l5 && "form" != l5 && "tabIndex" != l5 && "download" != l5 && "rowSpan" != l5 && "colSpan" != l5 && "role" != l5 && "popover" != l5 && l5 in n5) try {
      n5[l5] = null == u4 ? "" : u4;
      break n;
    } catch (n6) {
    }
    "function" == typeof u4 || (null == u4 || false === u4 && "-" != l5[4] ? n5.removeAttribute(l5) : n5.setAttribute(l5, "popover" == l5 && 1 == u4 ? "" : u4));
  }
}
function V(n5) {
  return function(u4) {
    if (this.l) {
      var t7 = this.l[u4.type + n5];
      if (null == u4[c]) u4[c] = h++;
      else if (u4[c] < t7[a]) return;
      return t7(l.event ? l.event(u4) : u4);
    }
  };
}
function q(n5, u4, t7, i6, r7, o4, e5, f4, c4, a5) {
  var s5, h5, p5, v4, y5, d5, _5, k3, x4, M, $2, I2, P2, A3, H2, T4 = u4.type;
  if (void 0 !== u4.constructor) return null;
  128 & t7.__u && (c4 = !!(32 & t7.__u), o4 = [f4 = u4.__e = t7.__e]), (s5 = l.__b) && s5(u4);
  n: if ("function" == typeof T4) try {
    if (k3 = u4.props, x4 = T4.prototype && T4.prototype.render, M = (s5 = T4.contextType) && i6[s5.__c], $2 = s5 ? M ? M.props.value : s5.__ : i6, t7.__c ? _5 = (h5 = u4.__c = t7.__c).__ = h5.__E : (x4 ? u4.__c = h5 = new T4(k3, $2) : (u4.__c = h5 = new C(k3, $2), h5.constructor = T4, h5.render = Q), M && M.sub(h5), h5.state || (h5.state = {}), h5.__n = i6, p5 = h5.__d = true, h5.__h = [], h5._sb = []), x4 && null == h5.__s && (h5.__s = h5.state), x4 && null != T4.getDerivedStateFromProps && (h5.__s == h5.state && (h5.__s = m({}, h5.__s)), m(h5.__s, T4.getDerivedStateFromProps(k3, h5.__s))), v4 = h5.props, y5 = h5.state, h5.__v = u4, p5) x4 && null == T4.getDerivedStateFromProps && null != h5.componentWillMount && h5.componentWillMount(), x4 && null != h5.componentDidMount && h5.__h.push(h5.componentDidMount);
    else {
      if (x4 && null == T4.getDerivedStateFromProps && k3 !== v4 && null != h5.componentWillReceiveProps && h5.componentWillReceiveProps(k3, $2), u4.__v == t7.__v || !h5.__e && null != h5.shouldComponentUpdate && false === h5.shouldComponentUpdate(k3, h5.__s, $2)) {
        u4.__v != t7.__v && (h5.props = k3, h5.state = h5.__s, h5.__d = false), u4.__e = t7.__e, u4.__k = t7.__k, u4.__k.some(function(n6) {
          n6 && (n6.__ = u4);
        }), w.push.apply(h5.__h, h5._sb), h5._sb = [], h5.__h.length && e5.push(h5);
        break n;
      }
      null != h5.componentWillUpdate && h5.componentWillUpdate(k3, h5.__s, $2), x4 && null != h5.componentDidUpdate && h5.__h.push(function() {
        h5.componentDidUpdate(v4, y5, d5);
      });
    }
    if (h5.context = $2, h5.props = k3, h5.__P = n5, h5.__e = false, I2 = l.__r, P2 = 0, x4) h5.state = h5.__s, h5.__d = false, I2 && I2(u4), s5 = h5.render(h5.props, h5.state, h5.context), w.push.apply(h5.__h, h5._sb), h5._sb = [];
    else do {
      h5.__d = false, I2 && I2(u4), s5 = h5.render(h5.props, h5.state, h5.context), h5.state = h5.__s;
    } while (h5.__d && ++P2 < 25);
    h5.state = h5.__s, null != h5.getChildContext && (i6 = m(m({}, i6), h5.getChildContext())), x4 && !p5 && null != h5.getSnapshotBeforeUpdate && (d5 = h5.getSnapshotBeforeUpdate(v4, y5)), A3 = null != s5 && s5.type === S && null == s5.key ? E(s5.props.children) : s5, f4 = L(n5, g(A3) ? A3 : [A3], u4, t7, i6, r7, o4, e5, f4, c4, a5), h5.base = u4.__e, u4.__u &= -161, h5.__h.length && e5.push(h5), _5 && (h5.__E = h5.__ = null);
  } catch (n6) {
    if (u4.__v = null, c4 || null != o4) if (n6.then) {
      for (u4.__u |= c4 ? 160 : 128; f4 && 8 == f4.nodeType && f4.nextSibling; ) f4 = f4.nextSibling;
      o4[o4.indexOf(f4)] = null, u4.__e = f4;
    } else {
      for (H2 = o4.length; H2--; ) b(o4[H2]);
      B(u4);
    }
    else u4.__e = t7.__e, u4.__k = t7.__k, n6.then || B(u4);
    l.__e(n6, u4, t7);
  }
  else null == o4 && u4.__v == t7.__v ? (u4.__k = t7.__k, u4.__e = t7.__e) : f4 = u4.__e = G(t7.__e, u4, t7, i6, r7, o4, e5, c4, a5);
  return (s5 = l.diffed) && s5(u4), 128 & u4.__u ? void 0 : f4;
}
function B(n5) {
  n5 && (n5.__c && (n5.__c.__e = true), n5.__k && n5.__k.some(B));
}
function D(n5, u4, t7) {
  for (var i6 = 0; i6 < t7.length; i6++) J(t7[i6], t7[++i6], t7[++i6]);
  l.__c && l.__c(u4, n5), n5.some(function(u5) {
    try {
      n5 = u5.__h, u5.__h = [], n5.some(function(n6) {
        n6.call(u5);
      });
    } catch (n6) {
      l.__e(n6, u5.__v);
    }
  });
}
function E(n5) {
  return "object" != typeof n5 || null == n5 || n5.__b > 0 ? n5 : g(n5) ? n5.map(E) : void 0 !== n5.constructor ? null : m({}, n5);
}
function G(u4, t7, i6, r7, o4, e5, f4, c4, a5) {
  var s5, h5, p5, v4, y5, w6, _5, m5 = i6.props || d, k3 = t7.props, x4 = t7.type;
  if ("svg" == x4 ? o4 = "http://www.w3.org/2000/svg" : "math" == x4 ? o4 = "http://www.w3.org/1998/Math/MathML" : o4 || (o4 = "http://www.w3.org/1999/xhtml"), null != e5) {
    for (s5 = 0; s5 < e5.length; s5++) if ((y5 = e5[s5]) && "setAttribute" in y5 == !!x4 && (x4 ? y5.localName == x4 : 3 == y5.nodeType)) {
      u4 = y5, e5[s5] = null;
      break;
    }
  }
  if (null == u4) {
    if (null == x4) return document.createTextNode(k3);
    u4 = document.createElementNS(o4, x4, k3.is && k3), c4 && (l.__m && l.__m(t7, e5), c4 = false), e5 = null;
  }
  if (null == x4) m5 === k3 || c4 && u4.data == k3 || (u4.data = k3);
  else {
    if (e5 = "textarea" == x4 && null != k3.defaultValue ? null : e5 && n.call(u4.childNodes), !c4 && null != e5) for (m5 = {}, s5 = 0; s5 < u4.attributes.length; s5++) m5[(y5 = u4.attributes[s5]).name] = y5.value;
    for (s5 in m5) y5 = m5[s5], "dangerouslySetInnerHTML" == s5 ? p5 = y5 : "children" == s5 || s5 in k3 || "value" == s5 && "defaultValue" in k3 || "checked" == s5 && "defaultChecked" in k3 || N(u4, s5, null, y5, o4);
    for (s5 in k3) y5 = k3[s5], "children" == s5 ? v4 = y5 : "dangerouslySetInnerHTML" == s5 ? h5 = y5 : "value" == s5 ? w6 = y5 : "checked" == s5 ? _5 = y5 : c4 && "function" != typeof y5 || m5[s5] === y5 || N(u4, s5, y5, m5[s5], o4);
    if (h5) c4 || p5 && (h5.__html == p5.__html || h5.__html == u4.innerHTML) || (u4.innerHTML = h5.__html), t7.__k = [];
    else if (p5 && (u4.innerHTML = ""), L("template" == t7.type ? u4.content : u4, g(v4) ? v4 : [v4], t7, i6, r7, "foreignObject" == x4 ? "http://www.w3.org/1999/xhtml" : o4, e5, f4, e5 ? e5[0] : i6.__k && $(i6, 0), c4, a5), null != e5) for (s5 = e5.length; s5--; ) b(e5[s5]);
    c4 && "textarea" != x4 || (s5 = "value", "progress" == x4 && null == w6 ? u4.removeAttribute("value") : null != w6 && (w6 !== u4[s5] || "progress" == x4 && !w6 || "option" == x4 && w6 != m5[s5]) && N(u4, s5, w6, m5[s5], o4), s5 = "checked", null != _5 && _5 != u4[s5] && N(u4, s5, _5, m5[s5], o4));
  }
  return u4;
}
function J(n5, u4, t7) {
  try {
    if ("function" == typeof n5) {
      var i6 = "function" == typeof n5.__u;
      i6 && n5.__u(), i6 && null == u4 || (n5.__u = n5(u4));
    } else n5.current = u4;
  } catch (n6) {
    l.__e(n6, t7);
  }
}
function K(n5, u4, t7) {
  var i6, r7;
  if (l.unmount && l.unmount(n5), (i6 = n5.ref) && (i6.current && i6.current != n5.__e || J(i6, null, u4)), null != (i6 = n5.__c)) {
    if (i6.componentWillUnmount) try {
      i6.componentWillUnmount();
    } catch (n6) {
      l.__e(n6, u4);
    }
    i6.base = i6.__P = null;
  }
  if (i6 = n5.__k) for (r7 = 0; r7 < i6.length; r7++) i6[r7] && K(i6[r7], u4, t7 || "function" != typeof n5.type);
  t7 || b(n5.__e), n5.__c = n5.__ = n5.__e = void 0;
}
function Q(n5, l5, u4) {
  return this.constructor(n5, u4);
}
function R(u4, t7, i6) {
  var r7, o4, e5, f4;
  t7 == document && (t7 = document.documentElement), l.__ && l.__(u4, t7), o4 = (r7 = "function" == typeof i6) ? null : i6 && i6.__k || t7.__k, e5 = [], f4 = [], q(t7, u4 = (!r7 && i6 || t7).__k = k(S, null, [u4]), o4 || d, d, t7.namespaceURI, !r7 && i6 ? [i6] : o4 ? null : t7.firstChild ? n.call(t7.childNodes) : null, e5, !r7 && i6 ? i6 : o4 ? o4.__e : t7.firstChild, r7, f4), D(e5, u4, f4);
}
n = w.slice, l = { __e: function(n5, l5, u4, t7) {
  for (var i6, r7, o4; l5 = l5.__; ) if ((i6 = l5.__c) && !i6.__) try {
    if ((r7 = i6.constructor) && null != r7.getDerivedStateFromError && (i6.setState(r7.getDerivedStateFromError(n5)), o4 = i6.__d), null != i6.componentDidCatch && (i6.componentDidCatch(n5, t7 || {}), o4 = i6.__d), o4) return i6.__E = i6;
  } catch (l6) {
    n5 = l6;
  }
  throw n5;
} }, u = 0, t = function(n5) {
  return null != n5 && void 0 === n5.constructor;
}, C.prototype.setState = function(n5, l5) {
  var u4;
  u4 = null != this.__s && this.__s != this.state ? this.__s : this.__s = m({}, this.state), "function" == typeof n5 && (n5 = n5(m({}, u4), this.props)), n5 && m(u4, n5), null != n5 && this.__v && (l5 && this._sb.push(l5), A(this));
}, C.prototype.forceUpdate = function(n5) {
  this.__v && (this.__e = true, n5 && this.__h.push(n5), A(this));
}, C.prototype.render = S, i = [], o = "function" == typeof Promise ? Promise.prototype.then.bind(Promise.resolve()) : setTimeout, e = function(n5, l5) {
  return n5.__v.__b - l5.__v.__b;
}, H.__r = 0, f = Math.random().toString(8), c = "__d" + f, a = "__a" + f, s = /(PointerCapture)$|Capture$/i, h = 0, p = V(false), v = V(true), y = 0;

// node_modules/preact/hooks/dist/hooks.module.js
var t2;
var r2;
var u2;
var i2;
var o2 = 0;
var f2 = [];
var c2 = l;
var e2 = c2.__b;
var a2 = c2.__r;
var v2 = c2.diffed;
var l2 = c2.__c;
var m2 = c2.unmount;
var s2 = c2.__;
function p2(n5, t7) {
  c2.__h && c2.__h(r2, n5, o2 || t7), o2 = 0;
  var u4 = r2.__H || (r2.__H = { __: [], __h: [] });
  return n5 >= u4.__.length && u4.__.push({}), u4.__[n5];
}
function d2(n5) {
  return o2 = 1, h2(D2, n5);
}
function h2(n5, u4, i6) {
  var o4 = p2(t2++, 2);
  if (o4.t = n5, !o4.__c && (o4.__ = [i6 ? i6(u4) : D2(void 0, u4), function(n6) {
    var t7 = o4.__N ? o4.__N[0] : o4.__[0], r7 = o4.t(t7, n6);
    t7 !== r7 && (o4.__N = [r7, o4.__[1]], o4.__c.setState({}));
  }], o4.__c = r2, !r2.__f)) {
    var f4 = function(n6, t7, r7) {
      if (!o4.__c.__H) return true;
      var u5 = o4.__c.__H.__.filter(function(n7) {
        return n7.__c;
      });
      if (u5.every(function(n7) {
        return !n7.__N;
      })) return !c4 || c4.call(this, n6, t7, r7);
      var i7 = o4.__c.props !== n6;
      return u5.some(function(n7) {
        if (n7.__N) {
          var t8 = n7.__[0];
          n7.__ = n7.__N, n7.__N = void 0, t8 !== n7.__[0] && (i7 = true);
        }
      }), c4 && c4.call(this, n6, t7, r7) || i7;
    };
    r2.__f = true;
    var c4 = r2.shouldComponentUpdate, e5 = r2.componentWillUpdate;
    r2.componentWillUpdate = function(n6, t7, r7) {
      if (this.__e) {
        var u5 = c4;
        c4 = void 0, f4(n6, t7, r7), c4 = u5;
      }
      e5 && e5.call(this, n6, t7, r7);
    }, r2.shouldComponentUpdate = f4;
  }
  return o4.__N || o4.__;
}
function y2(n5, u4) {
  var i6 = p2(t2++, 3);
  !c2.__s && C2(i6.__H, u4) && (i6.__ = n5, i6.u = u4, r2.__H.__h.push(i6));
}
function T2(n5, r7) {
  var u4 = p2(t2++, 7);
  return C2(u4.__H, r7) && (u4.__ = n5(), u4.__H = r7, u4.__h = n5), u4.__;
}
function j2() {
  for (var n5; n5 = f2.shift(); ) {
    var t7 = n5.__H;
    if (n5.__P && t7) try {
      t7.__h.some(z2), t7.__h.some(B2), t7.__h = [];
    } catch (r7) {
      t7.__h = [], c2.__e(r7, n5.__v);
    }
  }
}
c2.__b = function(n5) {
  r2 = null, e2 && e2(n5);
}, c2.__ = function(n5, t7) {
  n5 && t7.__k && t7.__k.__m && (n5.__m = t7.__k.__m), s2 && s2(n5, t7);
}, c2.__r = function(n5) {
  a2 && a2(n5), t2 = 0;
  var i6 = (r2 = n5.__c).__H;
  i6 && (u2 === r2 ? (i6.__h = [], r2.__h = [], i6.__.some(function(n6) {
    n6.__N && (n6.__ = n6.__N), n6.u = n6.__N = void 0;
  })) : (i6.__h.some(z2), i6.__h.some(B2), i6.__h = [], t2 = 0)), u2 = r2;
}, c2.diffed = function(n5) {
  v2 && v2(n5);
  var t7 = n5.__c;
  t7 && t7.__H && (t7.__H.__h.length && (1 !== f2.push(t7) && i2 === c2.requestAnimationFrame || ((i2 = c2.requestAnimationFrame) || w2)(j2)), t7.__H.__.some(function(n6) {
    n6.u && (n6.__H = n6.u), n6.u = void 0;
  })), u2 = r2 = null;
}, c2.__c = function(n5, t7) {
  t7.some(function(n6) {
    try {
      n6.__h.some(z2), n6.__h = n6.__h.filter(function(n7) {
        return !n7.__ || B2(n7);
      });
    } catch (r7) {
      t7.some(function(n7) {
        n7.__h && (n7.__h = []);
      }), t7 = [], c2.__e(r7, n6.__v);
    }
  }), l2 && l2(n5, t7);
}, c2.unmount = function(n5) {
  m2 && m2(n5);
  var t7, r7 = n5.__c;
  r7 && r7.__H && (r7.__H.__.some(function(n6) {
    try {
      z2(n6);
    } catch (n7) {
      t7 = n7;
    }
  }), r7.__H = void 0, t7 && c2.__e(t7, r7.__v));
};
var k2 = "function" == typeof requestAnimationFrame;
function w2(n5) {
  var t7, r7 = function() {
    clearTimeout(u4), k2 && cancelAnimationFrame(t7), setTimeout(n5);
  }, u4 = setTimeout(r7, 35);
  k2 && (t7 = requestAnimationFrame(r7));
}
function z2(n5) {
  var t7 = r2, u4 = n5.__c;
  "function" == typeof u4 && (n5.__c = void 0, u4()), r2 = t7;
}
function B2(n5) {
  var t7 = r2;
  n5.__c = n5.__(), r2 = t7;
}
function C2(n5, t7) {
  return !n5 || n5.length !== t7.length || t7.some(function(t8, r7) {
    return t8 !== n5[r7];
  });
}
function D2(n5, t7) {
  return "function" == typeof t7 ? t7(n5) : t7;
}

// node_modules/@preact/signals-core/dist/signals-core.module.js
var i3 = /* @__PURE__ */ Symbol.for("preact-signals");
function t3() {
  if (!(s3 > 1)) {
    var i6, t7 = false;
    !(function() {
      var i7 = c3;
      c3 = void 0;
      while (void 0 !== i7) {
        if (i7.S.v === i7.v) i7.S.i = i7.i;
        i7 = i7.o;
      }
    })();
    while (void 0 !== h3) {
      var n5 = h3;
      h3 = void 0;
      v3++;
      while (void 0 !== n5) {
        var r7 = n5.u;
        n5.u = void 0;
        n5.f &= -3;
        if (!(8 & n5.f) && w3(n5)) try {
          n5.c();
        } catch (n6) {
          if (!t7) {
            i6 = n6;
            t7 = true;
          }
        }
        n5 = r7;
      }
    }
    v3 = 0;
    s3--;
    if (t7) throw i6;
  } else s3--;
}
function n2(i6) {
  if (s3 > 0) return i6();
  e3 = ++u3;
  s3++;
  try {
    return i6();
  } finally {
    t3();
  }
}
var r3 = void 0;
function o3(i6) {
  var t7 = r3;
  r3 = void 0;
  try {
    return i6();
  } finally {
    r3 = t7;
  }
}
var f3;
var h3 = void 0;
var s3 = 0;
var v3 = 0;
var u3 = 0;
var e3 = 0;
var c3 = void 0;
var d3 = 0;
function a3(i6) {
  if (void 0 !== r3) {
    var t7 = i6.n;
    if (void 0 === t7 || t7.t !== r3) {
      t7 = { i: 0, S: i6, p: r3.s, n: void 0, t: r3, e: void 0, x: void 0, r: t7 };
      if (void 0 !== r3.s) r3.s.n = t7;
      r3.s = t7;
      i6.n = t7;
      if (32 & r3.f) i6.S(t7);
      return t7;
    } else if (-1 === t7.i) {
      t7.i = 0;
      if (void 0 !== t7.n) {
        t7.n.p = t7.p;
        if (void 0 !== t7.p) t7.p.n = t7.n;
        t7.p = r3.s;
        t7.n = void 0;
        r3.s.n = t7;
        r3.s = t7;
      }
      return t7;
    }
  }
}
function l3(i6, t7) {
  this.v = i6;
  this.i = 0;
  this.n = void 0;
  this.t = void 0;
  this.l = 0;
  this.W = null == t7 ? void 0 : t7.watched;
  this.Z = null == t7 ? void 0 : t7.unwatched;
  this.name = null == t7 ? void 0 : t7.name;
}
l3.prototype.brand = i3;
l3.prototype.h = function() {
  return true;
};
l3.prototype.S = function(i6) {
  var t7 = this, n5 = this.t;
  if (n5 !== i6 && void 0 === i6.e) {
    i6.x = n5;
    this.t = i6;
    if (void 0 !== n5) n5.e = i6;
    else o3(function() {
      var i7;
      null == (i7 = t7.W) || i7.call(t7);
    });
  }
};
l3.prototype.U = function(i6) {
  var t7 = this;
  if (void 0 !== this.t) {
    var n5 = i6.e, r7 = i6.x;
    if (void 0 !== n5) {
      n5.x = r7;
      i6.e = void 0;
    }
    if (void 0 !== r7) {
      r7.e = n5;
      i6.x = void 0;
    }
    if (i6 === this.t) {
      this.t = r7;
      if (void 0 === r7) o3(function() {
        var i7;
        null == (i7 = t7.Z) || i7.call(t7);
      });
    }
  }
};
l3.prototype.subscribe = function(i6) {
  var t7 = this;
  return j3(function() {
    var n5 = t7.value, o4 = r3;
    r3 = void 0;
    try {
      i6(n5);
    } finally {
      r3 = o4;
    }
  }, { name: "sub" });
};
l3.prototype.valueOf = function() {
  return this.value;
};
l3.prototype.toString = function() {
  return this.value + "";
};
l3.prototype.toJSON = function() {
  return this.value;
};
l3.prototype.peek = function() {
  var i6 = this;
  return o3(function() {
    return i6.value;
  });
};
Object.defineProperty(l3.prototype, "value", { get: function() {
  var i6 = a3(this);
  if (void 0 !== i6) i6.i = this.i;
  return this.v;
}, set: function(i6) {
  if (i6 !== this.v) {
    if (v3 > 100) throw new Error("Cycle detected");
    !(function(i7) {
      if (0 !== s3 && 0 === v3) {
        if (i7.l !== e3) {
          i7.l = e3;
          c3 = { S: i7, v: i7.v, i: i7.i, o: c3 };
        }
      }
    })(this);
    this.v = i6;
    this.i++;
    d3++;
    s3++;
    try {
      for (var n5 = this.t; void 0 !== n5; n5 = n5.x) n5.t.N();
    } finally {
      t3();
    }
  }
} });
function y3(i6, t7) {
  return new l3(i6, t7);
}
function w3(i6) {
  for (var t7 = i6.s; void 0 !== t7; t7 = t7.n) if (t7.S.i !== t7.i || !t7.S.h() || t7.S.i !== t7.i) return true;
  return false;
}
function _2(i6) {
  for (var t7 = i6.s; void 0 !== t7; t7 = t7.n) {
    var n5 = t7.S.n;
    if (void 0 !== n5) t7.r = n5;
    t7.S.n = t7;
    t7.i = -1;
    if (void 0 === t7.n) {
      i6.s = t7;
      break;
    }
  }
}
function b2(i6) {
  var t7 = i6.s, n5 = void 0;
  while (void 0 !== t7) {
    var r7 = t7.p;
    if (-1 === t7.i) {
      t7.S.U(t7);
      if (void 0 !== r7) r7.n = t7.n;
      if (void 0 !== t7.n) t7.n.p = r7;
    } else n5 = t7;
    t7.S.n = t7.r;
    if (void 0 !== t7.r) t7.r = void 0;
    t7 = r7;
  }
  i6.s = n5;
}
function p3(i6, t7) {
  l3.call(this, void 0);
  this.x = i6;
  this.s = void 0;
  this.g = d3 - 1;
  this.f = 4;
  this.W = null == t7 ? void 0 : t7.watched;
  this.Z = null == t7 ? void 0 : t7.unwatched;
  this.name = null == t7 ? void 0 : t7.name;
}
p3.prototype = new l3();
p3.prototype.h = function() {
  this.f &= -3;
  if (1 & this.f) return false;
  if (32 == (36 & this.f)) return true;
  this.f &= -5;
  if (this.g === d3) return true;
  this.g = d3;
  this.f |= 1;
  if (this.i > 0 && !w3(this)) {
    this.f &= -2;
    return true;
  }
  var i6 = r3;
  try {
    _2(this);
    r3 = this;
    var t7 = this.x();
    if (16 & this.f || this.v !== t7 || 0 === this.i) {
      this.v = t7;
      this.f &= -17;
      this.i++;
    }
  } catch (i7) {
    this.v = i7;
    this.f |= 16;
    this.i++;
  }
  r3 = i6;
  b2(this);
  this.f &= -2;
  return true;
};
p3.prototype.S = function(i6) {
  if (void 0 === this.t) {
    this.f |= 36;
    for (var t7 = this.s; void 0 !== t7; t7 = t7.n) t7.S.S(t7);
  }
  l3.prototype.S.call(this, i6);
};
p3.prototype.U = function(i6) {
  if (void 0 !== this.t) {
    l3.prototype.U.call(this, i6);
    if (void 0 === this.t) {
      this.f &= -33;
      for (var t7 = this.s; void 0 !== t7; t7 = t7.n) t7.S.U(t7);
    }
  }
};
p3.prototype.N = function() {
  if (!(2 & this.f)) {
    this.f |= 6;
    for (var i6 = this.t; void 0 !== i6; i6 = i6.x) i6.t.N();
  }
};
Object.defineProperty(p3.prototype, "value", { get: function() {
  if (1 & this.f) throw new Error("Cycle detected");
  var i6 = a3(this);
  this.h();
  if (void 0 !== i6) i6.i = this.i;
  if (16 & this.f) throw this.v;
  return this.v;
} });
function g2(i6, t7) {
  return new p3(i6, t7);
}
function S2(i6) {
  var n5 = i6.m;
  i6.m = void 0;
  if ("function" == typeof n5) {
    s3++;
    var o4 = r3;
    r3 = void 0;
    try {
      n5();
    } catch (t7) {
      i6.f &= -2;
      i6.f |= 8;
      m3(i6);
      throw t7;
    } finally {
      r3 = o4;
      t3();
    }
  }
}
function m3(i6) {
  for (var t7 = i6.s; void 0 !== t7; t7 = t7.n) t7.S.U(t7);
  i6.x = void 0;
  i6.s = void 0;
  S2(i6);
}
function x2(i6) {
  if (r3 !== this) throw new Error("Out-of-order effect");
  b2(this);
  r3 = i6;
  this.f &= -2;
  if (8 & this.f) m3(this);
  t3();
}
function E2(i6, t7) {
  this.x = i6;
  this.m = void 0;
  this.s = void 0;
  this.u = void 0;
  this.f = 32;
  this.name = null == t7 ? void 0 : t7.name;
  if (f3) f3.push(this);
}
E2.prototype.c = function() {
  var i6 = this.S();
  try {
    if (8 & this.f) return;
    if (void 0 === this.x) return;
    var t7 = this.x();
    if ("function" == typeof t7) this.m = t7;
  } finally {
    i6();
  }
};
E2.prototype.S = function() {
  if (1 & this.f) throw new Error("Cycle detected");
  this.f |= 1;
  this.f &= -9;
  S2(this);
  _2(this);
  s3++;
  var i6 = r3;
  r3 = this;
  return x2.bind(this, i6);
};
E2.prototype.N = function() {
  if (!(2 & this.f)) {
    this.f |= 2;
    this.u = h3;
    h3 = this;
  }
};
E2.prototype.d = function() {
  this.f |= 8;
  if (!(1 & this.f)) m3(this);
};
E2.prototype.dispose = function() {
  this.d();
};
function j3(i6, t7) {
  var n5 = new E2(i6, t7);
  try {
    n5.c();
  } catch (i7) {
    n5.d();
    throw i7;
  }
  var r7 = n5.d.bind(n5);
  r7[Symbol.dispose] = r7;
  return r7;
}

// node_modules/@preact/signals/dist/signals.module.js
var l4;
var d4;
var h4;
var p4 = "undefined" != typeof window && !!window.__PREACT_SIGNALS_DEVTOOLS__;
var _3 = [];
j3(function() {
  l4 = this.N;
})();
function g3(i6, r7) {
  l[i6] = r7.bind(null, l[i6] || function() {
  });
}
function b3(i6) {
  if (h4) {
    var n5 = h4;
    h4 = void 0;
    n5();
  }
  h4 = i6 && i6.S();
}
function y4(i6) {
  var n5 = this, t7 = i6.data, e5 = useSignal(t7);
  e5.value = t7;
  var f4 = T2(function() {
    var i7 = n5, t8 = n5.__v;
    while (t8 = t8.__) if (t8.__c) {
      t8.__c.__$f |= 4;
      break;
    }
    var o4 = g2(function() {
      var i8 = e5.value.value;
      return 0 === i8 ? 0 : true === i8 ? "" : i8 || "";
    }), f5 = g2(function() {
      return !Array.isArray(o4.value) && !t(o4.value);
    }), a6 = j3(function() {
      this.N = F;
      if (f5.value) {
        var n6 = o4.value;
        if (i7.__v && i7.__v.__e && 3 === i7.__v.__e.nodeType) i7.__v.__e.data = n6;
      }
    }), v5 = n5.__$u.d;
    n5.__$u.d = function() {
      a6();
      v5.call(this);
    };
    return [f5, o4];
  }, []), a5 = f4[0], v4 = f4[1];
  return a5.value ? v4.peek() : v4.value;
}
y4.displayName = "ReactiveTextNode";
Object.defineProperties(l3.prototype, { constructor: { configurable: true, value: void 0 }, type: { configurable: true, value: y4 }, props: { configurable: true, get: function() {
  var i6 = this;
  return { data: { get value() {
    return i6.value;
  } } };
} }, __b: { configurable: true, value: 1 } });
g3("__b", function(i6, n5) {
  if ("string" == typeof n5.type) {
    var r7, t7 = n5.props;
    for (var o4 in t7) if ("children" !== o4) {
      var e5 = t7[o4];
      if (e5 instanceof l3) {
        if (!r7) n5.__np = r7 = {};
        r7[o4] = e5;
        t7[o4] = e5.peek();
      }
    }
  }
  i6(n5);
});
g3("__r", function(i6, n5) {
  i6(n5);
  if (n5.type !== S) {
    b3();
    var r7, o4 = n5.__c;
    if (o4) {
      o4.__$f &= -2;
      if (void 0 === (r7 = o4.__$u)) o4.__$u = r7 = (function(i7, n6) {
        var r8;
        j3(function() {
          r8 = this;
        }, { name: n6 });
        r8.c = i7;
        return r8;
      })(function() {
        var i7;
        if (p4) null == (i7 = r7.y) || i7.call(r7);
        o4.__$f |= 1;
        o4.setState({});
      }, "function" == typeof n5.type ? n5.type.displayName || n5.type.name : "");
    }
    d4 = o4;
    b3(r7);
  }
});
g3("__e", function(i6, n5, r7, t7) {
  b3();
  d4 = void 0;
  i6(n5, r7, t7);
});
g3("diffed", function(i6, n5) {
  b3();
  d4 = void 0;
  var r7;
  if ("string" == typeof n5.type && (r7 = n5.__e)) {
    var t7 = n5.__np, o4 = n5.props;
    if (t7) {
      var e5 = r7.U;
      if (e5) for (var f4 in e5) {
        var u4 = e5[f4];
        if (void 0 !== u4 && !(f4 in t7)) {
          u4.d();
          e5[f4] = void 0;
        }
      }
      else {
        e5 = {};
        r7.U = e5;
      }
      for (var a5 in t7) {
        var c4 = e5[a5], v4 = t7[a5];
        if (void 0 === c4) {
          c4 = w4(r7, a5, v4);
          e5[a5] = c4;
        } else c4.o(v4, o4);
      }
      for (var s5 in t7) o4[s5] = t7[s5];
    }
  }
  i6(n5);
});
function w4(i6, n5, r7, t7) {
  var o4 = n5 in i6 && void 0 === i6.ownerSVGElement, e5 = y3(r7), f4 = r7.peek();
  return { o: function(i7, n6) {
    e5.value = i7;
    f4 = i7.peek();
  }, d: j3(function() {
    this.N = F;
    var r8 = e5.value.value;
    if (f4 !== r8) {
      f4 = void 0;
      if (o4) i6[n5] = r8;
      else if (null != r8 && (false !== r8 || "-" === n5[4])) i6.setAttribute(n5, r8);
      else i6.removeAttribute(n5);
    } else f4 = void 0;
  }) };
}
g3("unmount", function(i6, n5) {
  if ("string" == typeof n5.type) {
    var r7 = n5.__e;
    if (r7) {
      var t7 = r7.U;
      if (t7) {
        r7.U = void 0;
        for (var o4 in t7) {
          var e5 = t7[o4];
          if (e5) e5.d();
        }
      }
    }
    n5.__np = void 0;
  } else {
    var f4 = n5.__c;
    if (f4) {
      var u4 = f4.__$u;
      if (u4) {
        f4.__$u = void 0;
        u4.d();
      }
    }
  }
  i6(n5);
});
g3("__h", function(i6, n5, r7, t7) {
  if (t7 < 3 || 9 === t7) n5.__$f |= 2;
  i6(n5, r7, t7);
});
C.prototype.shouldComponentUpdate = function(i6, n5) {
  if (this.__R) return true;
  var r7 = this.__$u, t7 = r7 && void 0 !== r7.s;
  for (var o4 in n5) return true;
  if (this.__f || "boolean" == typeof this.u && true === this.u) {
    var e5 = 2 & this.__$f;
    if (!(t7 || e5 || 4 & this.__$f)) return true;
    if (1 & this.__$f) return true;
  } else {
    if (!(t7 || 4 & this.__$f)) return true;
    if (3 & this.__$f) return true;
  }
  for (var f4 in i6) if ("__source" !== f4 && i6[f4] !== this.props[f4]) return true;
  for (var u4 in this.props) if (!(u4 in i6)) return true;
  return false;
};
function useSignal(i6, n5) {
  return T2(function() {
    return y3(i6, n5);
  }, []);
}
var q2 = function(i6) {
  queueMicrotask(function() {
    queueMicrotask(i6);
  });
};
function x3() {
  n2(function() {
    var i6;
    while (i6 = _3.shift()) l4.call(i6);
  });
}
function F() {
  if (1 === _3.push(this)) (l.requestAnimationFrame || q2)(x3);
}

// node_modules/htm/dist/htm.module.js
var n3 = function(t7, s5, r7, e5) {
  var u4;
  s5[0] = 0;
  for (var h5 = 1; h5 < s5.length; h5++) {
    var p5 = s5[h5++], a5 = s5[h5] ? (s5[0] |= p5 ? 1 : 2, r7[s5[h5++]]) : s5[++h5];
    3 === p5 ? e5[0] = a5 : 4 === p5 ? e5[1] = Object.assign(e5[1] || {}, a5) : 5 === p5 ? (e5[1] = e5[1] || {})[s5[++h5]] = a5 : 6 === p5 ? e5[1][s5[++h5]] += a5 + "" : p5 ? (u4 = t7.apply(a5, n3(t7, a5, r7, ["", null])), e5.push(u4), a5[0] ? s5[0] |= 2 : (s5[h5 - 2] = 0, s5[h5] = u4)) : e5.push(a5);
  }
  return e5;
};
var t4 = /* @__PURE__ */ new Map();
function htm_module_default(s5) {
  var r7 = t4.get(this);
  return r7 || (r7 = /* @__PURE__ */ new Map(), t4.set(this, r7)), (r7 = n3(this, r7.get(s5) || (r7.set(s5, r7 = (function(n5) {
    for (var t7, s6, r8 = 1, e5 = "", u4 = "", h5 = [0], p5 = function(n6) {
      1 === r8 && (n6 || (e5 = e5.replace(/^\s*\n\s*|\s*\n\s*$/g, ""))) ? h5.push(0, n6, e5) : 3 === r8 && (n6 || e5) ? (h5.push(3, n6, e5), r8 = 2) : 2 === r8 && "..." === e5 && n6 ? h5.push(4, n6, 0) : 2 === r8 && e5 && !n6 ? h5.push(5, 0, true, e5) : r8 >= 5 && ((e5 || !n6 && 5 === r8) && (h5.push(r8, 0, e5, s6), r8 = 6), n6 && (h5.push(r8, n6, 0, s6), r8 = 6)), e5 = "";
    }, a5 = 0; a5 < n5.length; a5++) {
      a5 && (1 === r8 && p5(), p5(a5));
      for (var l5 = 0; l5 < n5[a5].length; l5++) t7 = n5[a5][l5], 1 === r8 ? "<" === t7 ? (p5(), h5 = [h5], r8 = 3) : e5 += t7 : 4 === r8 ? "--" === e5 && ">" === t7 ? (r8 = 1, e5 = "") : e5 = t7 + e5[0] : u4 ? t7 === u4 ? u4 = "" : e5 += t7 : '"' === t7 || "'" === t7 ? u4 = t7 : ">" === t7 ? (p5(), r8 = 1) : r8 && ("=" === t7 ? (r8 = 5, s6 = e5, e5 = "") : "/" === t7 && (r8 < 5 || ">" === n5[a5][l5 + 1]) ? (p5(), 3 === r8 && (h5 = h5[0]), r8 = h5, (h5 = h5[0]).push(2, 0, r8), r8 = 0) : " " === t7 || "	" === t7 || "\n" === t7 || "\r" === t7 ? (p5(), r8 = 2) : e5 += t7), 3 === r8 && "!--" === e5 && (r8 = 4, h5 = h5[0]);
    }
    return p5(), h5;
  })(s5)), r7), arguments, [])).length > 1 ? r7 : r7[0];
}

// node_modules/htm/preact/index.module.js
var m4 = htm_module_default.bind(k);

// node_modules/@creit.tech/stellar-wallets-kit/esm/types/components.js
var SwkAppRoute;
(function(SwkAppRoute2) {
  SwkAppRoute2["AUTH_OPTIONS"] = "AUTH_OPTIONS";
  SwkAppRoute2["HELP_PAGE"] = "HELP_PAGE";
  SwkAppRoute2["PROFILE_PAGE"] = "PROFILE_PAGE";
  SwkAppRoute2["HW_ACCOUNTS_FETCHER"] = "HW_ACCOUNTS_FETCHER";
})(SwkAppRoute || (SwkAppRoute = {}));
var SwkAppMode;
(function(SwkAppMode2) {
  SwkAppMode2["FIXED"] = "FIXED";
  SwkAppMode2["BLOCK"] = "BLOCK";
  SwkAppMode2["HIDDEN"] = "HIDDEN";
})(SwkAppMode || (SwkAppMode = {}));
var SwkAppLightTheme = {
  "background": "#fcfcfcff",
  "background-secondary": "#f8f8f8ff",
  "foreground-strong": "#000000",
  "foreground": "#161619ff",
  "foreground-secondary": "#2d2d31ff",
  "primary": "#3b82f6",
  "primary-foreground": "#ffffff",
  "transparent": "rgba(0, 0, 0, 0)",
  "lighter": "#fcfcfc",
  "light": "#f8f8f8",
  "light-gray": "oklch(0.800 0.006 286.033)",
  "gray": "oklch(0.600 0.006 286.033)",
  "danger": "oklch(57.7% 0.245 27.325)",
  "border": "rgba(0, 0, 0, 0.15)",
  "shadow": "0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -4px rgba(0, 0, 0, 0.1)",
  "border-radius": "0.5rem",
  "font-family": "sans-serif"
};

// node_modules/@creit.tech/stellar-wallets-kit/esm/types/storage.js
var LocalStorageKeys;
(function(LocalStorageKeys2) {
  LocalStorageKeys2["usedWalletsIds"] = "@StellarWalletsKit/usedWalletsIds";
  LocalStorageKeys2["activeAddress"] = "@StellarWalletsKit/activeAddress";
  LocalStorageKeys2["selectedModuleId"] = "@StellarWalletsKit/selectedModuleId";
  LocalStorageKeys2["hardwareWalletPaths"] = "@StellarWalletsKit/hardwareWalletPaths";
  LocalStorageKeys2["wcSessionPaths"] = "@StellarWalletsKit/wcSessionPaths";
})(LocalStorageKeys || (LocalStorageKeys = {}));

// node_modules/@creit.tech/stellar-wallets-kit/esm/types/mod.js
var Networks;
(function(Networks2) {
  Networks2["PUBLIC"] = "Public Global Stellar Network ; September 2015";
  Networks2["TESTNET"] = "Test SDF Network ; September 2015";
  Networks2["FUTURENET"] = "Test SDF Future Network ; October 2022";
  Networks2["SANDBOX"] = "Local Sandbox Stellar Network ; September 2022";
  Networks2["STANDALONE"] = "Standalone Network ; February 2017";
})(Networks || (Networks = {}));
var ModuleType;
(function(ModuleType2) {
  ModuleType2["HW_WALLET"] = "HW_WALLET";
  ModuleType2["HOT_WALLET"] = "HOT_WALLET";
  ModuleType2["BRIDGE_WALLET"] = "BRIDGE_WALLET";
  ModuleType2["AIR_GAPED_WALLET"] = "AIR_GAPED_WALLET";
})(ModuleType || (ModuleType = {}));
var KitEventType;
(function(KitEventType2) {
  KitEventType2["STATE_UPDATED"] = "STATE_UPDATE";
  KitEventType2["WALLET_SELECTED"] = "WALLET_SELECTED";
  KitEventType2["DISCONNECT"] = "DISCONNECT";
})(KitEventType || (KitEventType = {}));

// node_modules/@creit.tech/stellar-wallets-kit/esm/state/values.js
var localstorage = globalThis.localStorage;
var mode = y3(SwkAppMode.FIXED);
var modalTitle = y3("Connect a Wallet");
var showInstallLabel = y3(true);
var hideUnsupportedWallets = y3(true);
var installText = y3("Install");
var horizonUrl = y3("https://horizon.stellar.org");
var selectedNetwork = y3(Networks.PUBLIC);
var theme = y3(SwkAppLightTheme);
var route = y3(SwkAppRoute.AUTH_OPTIONS);
var routerHistory = y3([SwkAppRoute.AUTH_OPTIONS]);
var activeAddress = y3(localstorage?.getItem(LocalStorageKeys.activeAddress) || void 0);
var selectedModuleId = y3(localstorage?.getItem(LocalStorageKeys.selectedModuleId) || void 0);
var allowedWallets = y3([]);
var activeModules = y3([]);
var activeModule = g2(() => {
  return activeModules.value.find((m5) => m5.productId === selectedModuleId.value);
});
var hardwareWalletPathsInitial = localstorage?.getItem(LocalStorageKeys.hardwareWalletPaths);
var hardwareWalletPaths = y3(JSON.parse(hardwareWalletPathsInitial || "[]"));
var mnemonicPath = g2(() => {
  const path = hardwareWalletPaths.value.find(({ publicKey }) => publicKey === activeAddress.value);
  if (!path)
    return void 0;
  return `44'/148'/${path.index}'`;
});
var wcSessionPathsInitial = localstorage?.getItem(LocalStorageKeys.wcSessionPaths);
var wcSessionPaths = y3(JSON.parse(wcSessionPathsInitial || "[]"));
function resetWalletState() {
  routerHistory.value = [];
  hardwareWalletPaths.value = [];
  wcSessionPaths.value = [];
  activeAddress.value = void 0;
  selectedModuleId.value = void 0;
}

// node_modules/@creit.tech/stellar-wallets-kit/esm/state/events.js
function createSubject() {
  const trigger = y3(null);
  let status = "active";
  let storedError = null;
  const nextListeners = /* @__PURE__ */ new Set();
  const errorListeners = /* @__PURE__ */ new Set();
  const completeListeners = /* @__PURE__ */ new Set();
  j3(() => {
    if (status === "active" && trigger.value !== null) {
      const v4 = trigger.value;
      trigger.value = null;
      for (const cb of nextListeners)
        cb(v4);
    }
  });
  function clearAll() {
    nextListeners.clear();
    errorListeners.clear();
    completeListeners.clear();
  }
  return {
    next(v4) {
      if (status === "active")
        trigger.value = v4;
    },
    error(err) {
      if (status !== "active")
        return;
      status = "error";
      storedError = err;
      for (const cb of errorListeners)
        cb(err);
      clearAll();
    },
    complete() {
      if (status !== "active")
        return;
      status = "completed";
      for (const cb of completeListeners)
        cb();
      clearAll();
    },
    subscribe(next, error, complete) {
      if (status === "error") {
        error?.(storedError);
        return () => {
        };
      }
      if (status === "completed") {
        complete?.();
        return () => {
        };
      }
      if (next)
        nextListeners.add(next);
      if (error)
        errorListeners.add(error);
      if (complete)
        completeListeners.add(complete);
      return () => {
        if (next)
          nextListeners.delete(next);
        if (error)
          errorListeners.delete(error);
        if (complete)
          completeListeners.delete(complete);
      };
    },
    isCompleted() {
      return status === "completed";
    },
    hasError() {
      return status === "error";
    }
  };
}
var moduleSelectedEvent = createSubject();
var addressUpdatedEvent = createSubject();
var closeEvent = createSubject();
var disconnectEvent = createSubject();

// node_modules/@creit.tech/stellar-wallets-kit/esm/state/effects.js
var localstorage2 = globalThis.localStorage;
var document2 = globalThis.document;
var updatedThemeEffect = j3(() => {
  if (document2) {
    for (const [key, value] of Object.entries(theme.value)) {
      document2.documentElement.style.setProperty(`--swk-${key}`, value);
    }
  }
});
var updatedSelectedModule = j3(() => {
  if (localstorage2 && !!activeModule.value) {
    try {
      const record = localstorage2.getItem(LocalStorageKeys.usedWalletsIds);
      const usedWalletsIds = record ? new Set(JSON.parse(record)) : /* @__PURE__ */ new Set();
      if (usedWalletsIds.has(activeModule.value.productId)) {
        usedWalletsIds.delete(activeModule.value.productId);
      }
      localstorage2.setItem(LocalStorageKeys.usedWalletsIds, JSON.stringify([activeModule.value.productId, ...usedWalletsIds]));
    } catch (e5) {
      console.error(e5);
    }
  }
});
var updateActiveSession = j3(() => {
  if (localstorage2) {
    if (activeAddress.value) {
      localstorage2.setItem(LocalStorageKeys.activeAddress, activeAddress.value);
    } else {
      localstorage2.removeItem(LocalStorageKeys.activeAddress);
    }
    if (selectedModuleId.value) {
      localstorage2.setItem(LocalStorageKeys.selectedModuleId, selectedModuleId.value);
    } else {
      localstorage2.removeItem(LocalStorageKeys.selectedModuleId);
    }
    if (typeof hardwareWalletPaths.value !== "undefined") {
      localstorage2.setItem(LocalStorageKeys.hardwareWalletPaths, JSON.stringify(hardwareWalletPaths.value));
    }
    if (typeof wcSessionPaths.value !== "undefined") {
      localstorage2.setItem(LocalStorageKeys.wcSessionPaths, JSON.stringify(wcSessionPaths.value));
    }
  }
});

// node_modules/@creit.tech/stellar-wallets-kit/node_modules/@twind/core/core.js
var active;
function toClassName(rule) {
  return [
    ...rule.v,
    (rule.i ? "!" : "") + rule.n
  ].join(":");
}
function format(rules2, seperator = ",") {
  return rules2.map(toClassName).join(seperator);
}
var escape2 = "undefined" != typeof CSS && CSS.escape || // Simplified: escaping only special characters
// Needed for NodeJS and Edge <79 (https://caniuse.com/mdn-api_css_escape)
((className) => className.replace(/[!"'`*+.,;:\\/<=>?@#$%&^|~()[\]{}]/g, "\\$&").replace(/^\d/, "\\3$& "));
function hash(value) {
  for (var h5 = 9, index = value.length; index--; ) h5 = Math.imul(h5 ^ value.charCodeAt(index), 1597334677);
  return "#" + ((h5 ^ h5 >>> 9) >>> 0).toString(36);
}
function mql(screen2, prefix = "@media ") {
  return prefix + asArray(screen2).map((screen3) => {
    return "string" == typeof screen3 && (screen3 = {
      min: screen3
    }), screen3.raw || Object.keys(screen3).map((feature) => `(${feature}-width:${screen3[feature]})`).join(" and ");
  }).join(",");
}
function asArray(value = []) {
  return Array.isArray(value) ? value : null == value ? [] : [
    value
  ];
}
function identity(value) {
  return value;
}
function noop() {
}
var Layer = {
  /**
  * 1. `default` (public)
  */
  d: (
    /* efaults */
    0
  ),
  /* Shifts.layer */
  /**
  * 2. `base` (public) — for things like reset rules or default styles applied to plain HTML elements.
  */
  b: (
    /* ase */
    134217728
  ),
  /* Shifts.layer */
  /**
  * 3. `components` (public, used by `style()`) — is for class-based styles that you want to be able to override with utilities.
  */
  c: (
    /* omponents */
    268435456
  ),
  /* Shifts.layer */
  // reserved for style():
  // - props: 0b011
  // - when: 0b100
  /**
  * 6. `aliases` (public, used by `apply()`) — `~(...)`
  */
  a: (
    /* liases */
    671088640
  ),
  /* Shifts.layer */
  /**
  * 6. `utilities` (public) — for small, single-purpose classes
  */
  u: (
    /* tilities */
    805306368
  ),
  /* Shifts.layer */
  /**
  * 7. `overrides` (public, used by `css()`)
  */
  o: (
    /* verrides */
    939524096
  )
};
function seperatorPrecedence(string) {
  return string.match(/[-=:;]/g)?.length || 0;
}
function atRulePrecedence(css2) {
  return Math.min(/(?:^|width[^\d]+)(\d+(?:.\d+)?)(p)?/.test(css2) ? Math.max(0, 29.63 * (+RegExp.$1 / (RegExp.$2 ? 15 : 1)) ** 0.137 - 43) : 0, 15) << 22 | /* Shifts.responsive */
  Math.min(seperatorPrecedence(css2), 15) << 18;
}
var PRECEDENCES_BY_PSEUDO_CLASS = [
  /* fi */
  "rst-c",
  /* hild: 0 */
  /* la */
  "st-ch",
  /* ild: 1 */
  // even and odd use: nth-child
  /* nt */
  "h-chi",
  /* ld: 2 */
  /* an */
  "y-lin",
  /* k: 3 */
  /* li */
  "nk",
  /* : 4 */
  /* vi */
  "sited",
  /* : 5 */
  /* ch */
  "ecked",
  /* : 6 */
  /* em */
  "pty",
  /* : 7 */
  /* re */
  "ad-on",
  /* ly: 8 */
  /* fo */
  "cus-w",
  /* ithin : 9 */
  /* ho */
  "ver",
  /* : 10 */
  /* fo */
  "cus",
  /* : 11 */
  /* fo */
  "cus-v",
  /* isible : 12 */
  /* ac */
  "tive",
  /* : 13 */
  /* di */
  "sable",
  /* d : 14 */
  /* op */
  "tiona",
  /* l: 15 */
  /* re */
  "quire"
];
function convert({ n: name, i: important, v: variants2 = [] }, context2, precedence, conditions) {
  name && (name = toClassName({
    n: name,
    i: important,
    v: variants2
  }));
  conditions = [
    ...asArray(conditions)
  ];
  for (let variant of variants2) {
    let screen2 = context2.theme("screens", variant);
    for (let condition of asArray(screen2 && mql(screen2) || context2.v(variant))) {
      var selector;
      conditions.push(condition);
      precedence |= screen2 ? 67108864 | /* Shifts.screens */
      atRulePrecedence(condition) : "dark" == variant ? 1073741824 : (
        /* Shifts.darkMode */
        "@" == condition[0] ? atRulePrecedence(condition) : (selector = condition, // use first found pseudo-class
        1 << ~(/:([a-z-]+)/.test(selector) && ~PRECEDENCES_BY_PSEUDO_CLASS.indexOf(RegExp.$1.slice(2, 7)) || -18))
      );
    }
  }
  return {
    n: name,
    p: precedence,
    r: conditions,
    i: important
  };
}
var registry = /* @__PURE__ */ new Map();
function stringify$1(rule) {
  if (rule.d) {
    let groups = [], selector = replaceEach(
      // merge all conditions into a selector string
      rule.r.reduce((selector2, condition) => {
        return "@" == condition[0] ? (groups.push(condition), selector2) : (
          // Go over the selector and replace the matching multiple selectors if any
          condition ? replaceEach(selector2, (selectorPart) => replaceEach(
            condition,
            // If the current condition has a nested selector replace it
            (conditionPart) => {
              let mergeMatch = /(:merge\(.+?\))(:[a-z-]+|\\[.+])/.exec(conditionPart);
              if (mergeMatch) {
                let selectorIndex = selectorPart.indexOf(mergeMatch[1]);
                return ~selectorIndex ? (
                  // [':merge(.group):hover .rule', ':merge(.group):focus &'] -> ':merge(.group):focus:hover .rule'
                  // ':merge(.group)' + ':focus' + ':hover .rule'
                  selectorPart.slice(0, selectorIndex) + mergeMatch[0] + selectorPart.slice(selectorIndex + mergeMatch[1].length)
                ) : (
                  // [':merge(.peer):focus~&', ':merge(.group):hover &'] -> ':merge(.peer):focus~:merge(.group):hover &'
                  replaceReference(selectorPart, conditionPart)
                );
              }
              return replaceReference(conditionPart, selectorPart);
            }
          )) : selector2
        );
      }, "&"),
      // replace '&' with rule name or an empty string
      (selectorPart) => replaceReference(selectorPart, rule.n ? "." + escape2(rule.n) : "")
    );
    return selector && groups.push(selector.replace(/:merge\((.+?)\)/g, "$1")), groups.reduceRight((body, grouping) => grouping + "{" + body + "}", rule.d);
  }
}
function replaceEach(selector, iteratee) {
  return selector.replace(/ *((?:\(.+?\)|\[.+?\]|[^,])+) *(,|$)/g, (_5, selectorPart, comma) => iteratee(selectorPart) + comma);
}
function replaceReference(selector, reference) {
  return selector.replace(/&/g, reference);
}
var collator = new Intl.Collator("en", {
  numeric: true
});
function sortedInsertionIndex(array, element) {
  for (var low = 0, high = array.length; low < high; ) {
    let pivot = high + low >> 1;
    0 >= compareTwindRules(array[pivot], element) ? low = pivot + 1 : high = pivot;
  }
  return high;
}
function compareTwindRules(a5, b4) {
  let layer = a5.p & Layer.o;
  return layer == (b4.p & Layer.o) && (layer == Layer.b || layer == Layer.o) ? 0 : a5.p - b4.p || a5.o - b4.o || collator.compare(byModifier(a5.n), byModifier(b4.n)) || collator.compare(byName(a5.n), byName(b4.n));
}
function byModifier(s5) {
  return (s5 || "").split(/:/).pop().split("/").pop() || "\0";
}
function byName(s5) {
  return (s5 || "").replace(/\W/g, (c4) => String.fromCharCode(127 + c4.charCodeAt(0))) + "\0";
}
function parseColorComponent(chars, factor) {
  return Math.round(parseInt(chars, 16) * factor);
}
function toColorValue(color, options = {}) {
  if ("function" == typeof color) return color(options);
  let { opacityValue = "1", opacityVariable } = options, opacity = opacityVariable ? `var(${opacityVariable})` : opacityValue;
  if (color.includes("<alpha-value>")) return color.replace("<alpha-value>", opacity);
  if ("#" == color[0] && (4 == color.length || 7 == color.length)) {
    let size = (color.length - 1) / 3, factor = [
      17,
      1,
      0.062272
    ][size - 1];
    return `rgba(${[
      parseColorComponent(color.substr(1, size), factor),
      parseColorComponent(color.substr(1 + size, size), factor),
      parseColorComponent(color.substr(1 + 2 * size, size), factor),
      opacity
    ]})`;
  }
  return "1" == opacity ? color : "0" == opacity ? "#0000" : (
    // convert rgb and hsl to alpha variant
    color.replace(/^(rgb|hsl)(\([^)]+)\)$/, `$1a$2,${opacity})`)
  );
}
function serialize(style, rule, context2, precedence, conditions = []) {
  return (function serialize$(style2, { n: name, p: precedence2, r: conditions2 = [], i: important }, context3) {
    let rules2 = [], declarations = "", maxPropertyPrecedence = 0, numberOfDeclarations = 0;
    for (let key in style2 || {}) {
      var layer, property;
      let value = style2[key];
      if ("@" == key[0]) {
        if (!value) continue;
        if ("a" == key[1]) {
          rules2.push(...translateWith(name, precedence2, parse("" + value), context3, precedence2, conditions2, important, true));
          continue;
        }
        if ("l" == key[1]) {
          for (let css2 of asArray(value)) rules2.push(...serialize$(css2, {
            n: name,
            p: (layer = Layer[key[7]], // Set layer (first reset, than set)
            precedence2 & ~Layer.o | layer),
            r: "d" == key[7] ? [] : conditions2,
            i: important
          }, context3));
          continue;
        }
        if ("i" == key[1]) {
          rules2.push(...asArray(value).map((value2) => ({
            // before all layers
            p: -1,
            o: 0,
            r: [],
            d: key + " " + value2
          })));
          continue;
        }
        if ("k" == key[1]) {
          rules2.push({
            p: Layer.d,
            o: 0,
            r: [
              key
            ],
            d: serialize$(value, {
              p: Layer.d
            }, context3).map(stringify$1).join("")
          });
          continue;
        }
        if ("f" == key[1]) {
          rules2.push(...asArray(value).map((value2) => ({
            p: Layer.d,
            o: 0,
            r: [
              key
            ],
            d: serialize$(value2, {
              p: Layer.d
            }, context3).map(stringify$1).join("")
          })));
          continue;
        }
      }
      if ("object" != typeof value || Array.isArray(value)) {
        if ("label" == key && value) name = value + hash(JSON.stringify([
          precedence2,
          important,
          style2
        ]));
        else if (value || 0 === value) {
          key = key.replace(/[A-Z]/g, (_5) => "-" + _5.toLowerCase());
          numberOfDeclarations += 1;
          maxPropertyPrecedence = Math.max(maxPropertyPrecedence, "-" == (property = key)[0] ? 0 : seperatorPrecedence(property) + (/^(?:(border-(?!w|c|sty)|[tlbr].{2,4}m?$|c.{7,8}$)|([fl].{5}l|g.{8}$|pl))/.test(property) ? +!!RegExp.$1 || /* +1 */
          -!!RegExp.$2 : (
            /* -1 */
            0
          )) + 1);
          declarations += (declarations ? ";" : "") + asArray(value).map((value2) => context3.s(
            key,
            // support theme(...) function in values
            // calc(100vh - theme('spacing.12'))
            resolveThemeFunction("" + value2, context3.theme) + (important ? " !important" : "")
          )).join(";");
        }
      } else if ("@" == key[0] || key.includes("&")) {
        let rulePrecedence = precedence2;
        if ("@" == key[0]) {
          key = key.replace(/\bscreen\(([^)]+)\)/g, (_5, screenKey) => {
            let screen2 = context3.theme("screens", screenKey);
            return screen2 ? (rulePrecedence |= 67108864, /* Shifts.screens */
            mql(screen2, "")) : _5;
          });
          rulePrecedence |= atRulePrecedence(key);
        }
        rules2.push(...serialize$(value, {
          n: name,
          p: rulePrecedence,
          r: [
            ...conditions2,
            key
          ],
          i: important
        }, context3));
      } else
        rules2.push(...serialize$(value, {
          p: precedence2,
          r: [
            ...conditions2,
            key
          ]
        }, context3));
    }
    return (
      // PERF: prevent unshift using `rules = [{}]` above and then `rules[0] = {...}`
      rules2.unshift({
        n: name,
        p: precedence2,
        o: (
          // number of declarations (descending)
          Math.max(0, 15 - numberOfDeclarations) + // greatest precedence of properties
          // if there is no property precedence this is most likely a custom property only declaration
          // these have the highest precedence
          1.5 * Math.min(maxPropertyPrecedence || 15, 15)
        ),
        r: conditions2,
        // stringified declarations
        d: declarations
      }), rules2.sort(compareTwindRules)
    );
  })(style, convert(rule, context2, precedence, conditions), context2);
}
function resolveThemeFunction(value, theme3) {
  return value.replace(/theme\((["'`])?(.+?)\1(?:\s*,\s*(["'`])?(.+?)\3)?\)/g, (_5, __, key, ___, defaultValue = "") => {
    let value2 = theme3(key, defaultValue);
    return "function" == typeof value2 && /color|fill|stroke/i.test(key) ? toColorValue(value2) : "" + asArray(value2).filter((v4) => Object(v4) !== v4);
  });
}
function merge(rules2, name) {
  let current;
  let result = [];
  for (let rule of rules2)
    if (rule.d && rule.n) {
      if (current?.p == rule.p && "" + current.r == "" + rule.r) {
        current.c = [
          current.c,
          rule.c
        ].filter(Boolean).join(" ");
        current.d = current.d + ";" + rule.d;
      } else
        result.push(current = {
          ...rule,
          n: rule.n && name
        });
    } else result.push({
      ...rule,
      n: rule.n && name
    });
  return result;
}
function translate(rules2, context2, precedence = Layer.u, conditions, important) {
  let result = [];
  for (let rule of rules2) for (let cssRule of (function(rule2, context3, precedence2, conditions2, important2) {
    rule2 = {
      ...rule2,
      i: rule2.i || important2
    };
    let resolved = (function(rule3, context4) {
      let factory = registry.get(rule3.n);
      return factory ? factory(rule3, context4) : context4.r(rule3.n, "dark" == rule3.v[0]);
    })(rule2, context3);
    return resolved ? (
      // a list of class names
      "string" == typeof resolved ? ({ r: conditions2, p: precedence2 } = convert(rule2, context3, precedence2, conditions2), merge(translate(parse(resolved), context3, precedence2, conditions2, rule2.i), rule2.n)) : Array.isArray(resolved) ? resolved.map((rule3) => {
        var precedence1, layer;
        return {
          o: 0,
          ...rule3,
          r: [
            ...asArray(conditions2),
            ...asArray(rule3.r)
          ],
          p: (precedence1 = precedence2, layer = rule3.p ?? precedence2, precedence1 & ~Layer.o | layer)
        };
      }) : serialize(resolved, rule2, context3, precedence2, conditions2)
    ) : (
      // propagate className as is
      [
        {
          c: toClassName(rule2),
          p: 0,
          o: 0,
          r: []
        }
      ]
    );
  })(rule, context2, precedence, conditions, important)) result.splice(sortedInsertionIndex(result, cssRule), 0, cssRule);
  return result;
}
function translateWith(name, layer, rules2, context2, precedence, conditions, important, useOrderOfRules) {
  return merge((useOrderOfRules ? rules2.flatMap((rule) => translate([
    rule
  ], context2, precedence, conditions, important)) : translate(rules2, context2, precedence, conditions, important)).map((rule) => {
    return (
      // do not move defaults
      // move only rules with a name unless they are in the base layer
      rule.p & Layer.o && (rule.n || layer == Layer.b) ? {
        ...rule,
        p: rule.p & ~Layer.o | layer,
        o: 0
      } : rule
    );
  }), name);
}
function define2(className, layer, rules2, useOrderOfRules) {
  var factory;
  return factory = (rule, context2) => {
    let { n: name, p: precedence, r: conditions, i: important } = convert(rule, context2, layer);
    return rules2 && translateWith(name, layer, rules2, context2, precedence, conditions, important, useOrderOfRules);
  }, registry.set(className, factory), className;
}
function createRule(active2, current, loc) {
  if ("(" != active2[active2.length - 1]) {
    let variants2 = [], important = false, negated = false, name = "";
    for (let value of active2) if (!("(" == value || /[~@]$/.test(value))) {
      if ("!" == value[0]) {
        value = value.slice(1);
        important = !important;
      }
      if (value.endsWith(":")) {
        variants2["dark:" == value ? "unshift" : "push"](value.slice(0, -1));
        continue;
      }
      if ("-" == value[0]) {
        value = value.slice(1);
        negated = !negated;
      }
      value.endsWith("-") && (value = value.slice(0, -1));
      value && "&" != value && (name += (name && "-") + value);
    }
    if (name) {
      negated && (name = "-" + name);
      current[0].push({
        n: name,
        v: variants2.filter(uniq),
        i: important
      });
    }
  }
}
function uniq(value, index, values) {
  return values.indexOf(value) == index;
}
var cache = /* @__PURE__ */ new Map();
function parse(token) {
  let parsed = cache.get(token);
  if (!parsed) {
    let active2 = [], current = [
      []
    ], startIndex = 0, skip = 0, comment = null, position2 = 0, commit = (isRule, endOffset = 0) => {
      if (startIndex != position2) {
        active2.push(token.slice(startIndex, position2 + endOffset));
        isRule && createRule(active2, current);
      }
      startIndex = position2 + 1;
    };
    for (; position2 < token.length; position2++) {
      let char = token[position2];
      if (skip) "\\" != token[position2 - 1] && (skip += +("[" == char) || -("]" == char));
      else if ("[" == char)
        skip += 1;
      else if (comment) {
        if ("\\" != token[position2 - 1] && comment.test(token.slice(position2))) {
          comment = null;
          startIndex = position2 + RegExp.lastMatch.length;
        }
      } else if ("/" == char && "\\" != token[position2 - 1] && ("*" == token[position2 + 1] || "/" == token[position2 + 1]))
        comment = "*" == token[position2 + 1] ? /^\*\// : /^[\r\n]/;
      else if ("(" == char) {
        commit();
        active2.push(char);
      } else if (":" == char) ":" != token[position2 + 1] && commit(false, 1);
      else if (/[\s,)]/.test(char)) {
        commit(true);
        let lastGroup = active2.lastIndexOf("(");
        if (")" == char) {
          let nested = active2[lastGroup - 1];
          if (/[~@]$/.test(nested)) {
            let rules2 = current.shift();
            active2.length = lastGroup;
            createRule([
              ...active2,
              "#"
            ], current);
            let { v: v4 } = current[0].pop();
            for (let rule of rules2)
              rule.v.splice(+("dark" == rule.v[0]) - +("dark" == v4[0]), v4.length);
            createRule([
              ...active2,
              define2(
                // named nested
                nested.length > 1 ? nested.slice(0, -1) + hash(JSON.stringify([
                  nested,
                  rules2
                ])) : nested + "(" + format(rules2) + ")",
                Layer.a,
                rules2,
                /@$/.test(nested)
              )
            ], current);
          }
          lastGroup = active2.lastIndexOf("(", lastGroup - 1);
        }
        active2.length = lastGroup + 1;
      } else /[~@]/.test(char) && "(" == token[position2 + 1] && // start nested block
      // ~(...) or button~(...)
      // @(...) or button@(...)
      current.unshift([]);
    }
    commit(true);
    cache.set(token, parsed = current[0]);
  }
  return parsed;
}
function interleave(strings, interpolations, handle) {
  return interpolations.reduce((result, interpolation, index) => result + handle(interpolation) + strings[index + 1], strings[0]);
}
function interpolate(strings, interpolations) {
  return Array.isArray(strings) && Array.isArray(strings.raw) ? interleave(strings, interpolations, (value) => toString(value).trim()) : interpolations.filter(Boolean).reduce((result, value) => result + toString(value), strings ? toString(strings) : "");
}
function toString(value) {
  let tmp, result = "";
  if (value && "object" == typeof value) {
    if (Array.isArray(value)) (tmp = interpolate(value[0], value.slice(1))) && (result += " " + tmp);
    else for (let key in value) value[key] && (result += " " + key);
  } else null != value && "boolean" != typeof value && (result += " " + value);
  return result;
}
function astish(strings, interpolations) {
  return Array.isArray(strings) ? astish$(interleave(strings, interpolations, (interpolation) => null != interpolation && "boolean" != typeof interpolation ? interpolation : "")) : "string" == typeof strings ? astish$(strings) : [
    strings
  ];
}
var newRule = / *(?:(?:([\u0080-\uFFFF\w-%@]+) *:? *([^{;]+?);|([^;}{]*?) *{)|(}))/g;
function astish$(css2) {
  let block;
  css2 = // Remove comments (multiline and single line)
  css2.replace(/\/\*[^]*?\*\/|\s\s+|\n/gm, " ");
  let tree = [
    {}
  ], rules2 = [
    tree[0]
  ], conditions = [];
  for (; block = newRule.exec(css2); ) {
    if (block[4]) {
      tree.shift();
      conditions.shift();
    }
    if (block[3]) {
      conditions.unshift(block[3]);
      tree.unshift({});
      rules2.push(conditions.reduce((body, condition) => ({
        [condition]: body
      }), tree[0]));
    } else if (!block[4]) {
      if (tree[0][block[1]]) {
        tree.unshift({});
        rules2.push(conditions.reduce((body, condition) => ({
          [condition]: body
        }), tree[0]));
      }
      tree[0][block[1]] = block[2];
    }
  }
  return rules2;
}
function css(strings, ...interpolations) {
  var factory;
  let ast = astish(strings, interpolations), className = (ast.find((o4) => o4.label)?.label || "css") + hash(JSON.stringify(ast));
  return factory = (rule, context2) => merge(ast.flatMap((css2) => serialize(css2, rule, context2, Layer.o)), className), registry.set(className, factory), className;
}
function match(pattern, resolve, convert2) {
  return [
    pattern,
    fromMatch(resolve, convert2)
  ];
}
function fromMatch(resolve, convert2) {
  return "function" == typeof resolve ? resolve : "string" == typeof resolve && /^[\w-]+$/.test(resolve) ? (
    // a CSS property alias
    (match2, context2) => ({
      [resolve]: convert2 ? convert2(match2, context2) : maybeNegate(match2, 1)
    })
  ) : (match2) => (
    // CSSObject, shortcut or apply
    resolve || {
      [match2[1]]: maybeNegate(match2, 2)
    }
  );
}
function maybeNegate(match2, offset, value = match2.slice(offset).find(Boolean) || match2.$$ || match2.input) {
  return "-" == match2.input[0] ? `calc(${value} * -1)` : value;
}
function matchTheme(pattern, section, resolve, convert2) {
  return [
    pattern,
    fromTheme(section, resolve, convert2)
  ];
}
function fromTheme(section, resolve, convert2) {
  let factory = "string" == typeof resolve ? (match2, context2) => ({
    [resolve]: convert2 ? convert2(match2, context2) : match2._
  }) : resolve || (({ 1: $1, _: _5 }, context2, section2) => ({
    [$1 || section2]: _5
  }));
  return (match2, context2) => {
    let themeSection = camelize(section || match2[1]), value = context2.theme(themeSection, match2.$$) ?? arbitrary(match2.$$, themeSection, context2);
    if (null != value) return match2._ = maybeNegate(match2, 0, value), factory(match2, context2, themeSection);
  };
}
function matchColor(pattern, options = {}, resolve) {
  return [
    pattern,
    colorFromTheme(options, resolve)
  ];
}
function colorFromTheme(options = {}, resolve) {
  return (match2, context2) => {
    let { section = camelize(match2[0]).replace("-", "") + "Color" } = options, [colorMatch, opacityMatch] = parseValue(match2.$$);
    if (!colorMatch) return;
    let colorValue = context2.theme(section, colorMatch) || arbitrary(colorMatch, section, context2);
    if (!colorValue || "object" == typeof colorValue) return;
    let {
      // text- -> --tw-text-opacity
      // ring-offset(?:-|$) -> --tw-ring-offset-opacity
      // TODO move this default into preset-tailwind?
      opacityVariable = `--tw-${match2[0].replace(/-$/, "")}-opacity`,
      opacitySection = section.replace("Color", "Opacity"),
      property = section,
      selector
    } = options, opacityValue = context2.theme(opacitySection, opacityMatch || "DEFAULT") || opacityMatch && arbitrary(opacityMatch, opacitySection, context2), create = resolve || (({ _: _5 }) => {
      let properties2 = toCSS(property, _5);
      return selector ? {
        [selector]: properties2
      } : properties2;
    });
    match2._ = {
      value: toColorValue(colorValue, {
        opacityVariable: opacityVariable || void 0,
        opacityValue: opacityValue || void 0
      }),
      color: (options2) => toColorValue(colorValue, options2),
      opacityVariable: opacityVariable || void 0,
      opacityValue: opacityValue || void 0
    };
    let properties = create(match2, context2);
    if (!match2.dark) {
      let darkColorValue = context2.d(section, colorMatch, colorValue);
      if (darkColorValue && darkColorValue !== colorValue) {
        match2._ = {
          value: toColorValue(darkColorValue, {
            opacityVariable: opacityVariable || void 0,
            opacityValue: opacityValue || "1"
          }),
          color: (options2) => toColorValue(darkColorValue, options2),
          opacityVariable: opacityVariable || void 0,
          opacityValue: opacityValue || void 0
        };
        properties = {
          "&": properties,
          [context2.v("dark")]: create(match2, context2)
        };
      }
    }
    return properties;
  };
}
function parseValue(input) {
  return (input.match(/^(\[[^\]]+]|[^/]+?)(?:\/(.+))?$/) || []).slice(1);
}
function toCSS(property, value) {
  let properties = {};
  if ("string" == typeof value) properties[property] = value;
  else {
    value.opacityVariable && value.value.includes(value.opacityVariable) && (properties[value.opacityVariable] = value.opacityValue || "1");
    properties[property] = value.value;
  }
  return properties;
}
function arbitrary(value, section, context2) {
  if ("[" == value[0] && "]" == value.slice(-1)) {
    value = normalize(resolveThemeFunction(value.slice(1, -1), context2.theme));
    if (!section) return value;
    if (
      // Respect type hints from the user on ambiguous arbitrary values - https://tailwindcss.com/docs/adding-custom-styles#resolving-ambiguities
      !// If this is a color section and the value is a hex color, color function or color name
      (/color|fill|stroke/i.test(section) && !(/^color:/.test(value) || /^(#|((hsl|rgb)a?|hwb|lab|lch|color)\(|[a-z]+$)/.test(value)) || // url(, [a-z]-gradient(, image(, cross-fade(, image-set(
      /image/i.test(section) && !(/^image:/.test(value) || /^[a-z-]+\(/.test(value)) || // font-*
      // - fontWeight (type: ['lookup', 'number', 'any'])
      // - fontFamily (type: ['lookup', 'generic-name', 'family-name'])
      /weight/i.test(section) && !(/^(number|any):/.test(value) || /^\d+$/.test(value)) || // bg-*
      // - backgroundPosition (type: ['lookup', ['position', { preferOnConflict: true }]])
      // - backgroundSize (type: ['lookup', 'length', 'percentage', 'size'])
      /position/i.test(section) && /^(length|size):/.test(value))
    )
      return value.replace(/^[a-z-]+:/, "");
  }
}
function camelize(value) {
  return value.replace(/-./g, (x4) => x4[1].toUpperCase());
}
function normalize(value) {
  return (
    // Keep raw strings if it starts with `url(`
    value.includes("url(") ? value.replace(/(.*?)(url\(.*?\))(.*?)/g, (_5, before = "", url, after = "") => normalize(before) + url + normalize(after)) : value.replace(/(^|[^\\])_+/g, (fullMatch, characterBefore) => characterBefore + " ".repeat(fullMatch.length - characterBefore.length)).replace(/\\_/g, "_").replace(/(calc|min|max|clamp)\(.+\)/g, (match2) => match2.replace(/(-?\d*\.?\d(?!\b-.+[,)](?![^+\-/*])\D)(?:%|[a-z]+)?|\))([+\-/*])/g, "$1 $2 "))
  );
}
function cx(strings, ...interpolations) {
  return format(parse(interpolate(strings, interpolations)), " ");
}
function defineConfig({ presets = [], ...userConfig }) {
  let config3 = {
    darkMode: void 0,
    darkColor: void 0,
    preflight: false !== userConfig.preflight && [],
    theme: {},
    variants: asArray(userConfig.variants),
    rules: asArray(userConfig.rules),
    ignorelist: asArray(userConfig.ignorelist),
    hash: void 0,
    stringify: (property, value) => property + ":" + value,
    finalize: []
  };
  for (let preset of asArray([
    ...presets,
    {
      darkMode: userConfig.darkMode,
      darkColor: userConfig.darkColor,
      preflight: false !== userConfig.preflight && asArray(userConfig.preflight),
      theme: userConfig.theme,
      hash: userConfig.hash,
      stringify: userConfig.stringify,
      finalize: userConfig.finalize
    }
  ])) {
    let { preflight: preflight2, darkMode = config3.darkMode, darkColor = config3.darkColor, theme: theme3, variants: variants2, rules: rules2, ignorelist, hash: hash2 = config3.hash, stringify = config3.stringify, finalize } = "function" == typeof preset ? preset(config3) : preset;
    config3 = {
      // values defined by user or previous presets take precedence
      preflight: false !== config3.preflight && false !== preflight2 && [
        ...config3.preflight,
        ...asArray(preflight2)
      ],
      darkMode,
      darkColor,
      theme: {
        ...config3.theme,
        ...theme3,
        extend: {
          ...config3.theme.extend,
          ...theme3?.extend
        }
      },
      variants: [
        ...config3.variants,
        ...asArray(variants2)
      ],
      rules: [
        ...config3.rules,
        ...asArray(rules2)
      ],
      ignorelist: [
        ...config3.ignorelist,
        ...asArray(ignorelist)
      ],
      hash: hash2,
      stringify,
      finalize: [
        ...config3.finalize,
        ...asArray(finalize)
      ]
    };
  }
  return config3;
}
function find(value, list, cache2, getResolver, context2, isDark) {
  for (let item of list) {
    let resolver = cache2.get(item);
    resolver || cache2.set(item, resolver = getResolver(item));
    let resolved = resolver(value, context2, isDark);
    if (resolved) return resolved;
  }
}
function getVariantResolver(variant) {
  var resolve;
  return createResolve(variant[0], "function" == typeof (resolve = variant[1]) ? resolve : () => resolve);
}
function getRuleResolver(rule) {
  var resolve, convert2;
  return Array.isArray(rule) ? createResolve(rule[0], fromMatch(rule[1], rule[2])) : createResolve(rule, fromMatch(resolve, convert2));
}
function createResolve(patterns, resolve) {
  return createRegExpExecutor(patterns, (value, condition, context2, isDark) => {
    let match2 = condition.exec(value);
    if (match2) return (
      // MATCH.$_ = value
      match2.$$ = value.slice(match2[0].length), match2.dark = isDark, resolve(match2, context2)
    );
  });
}
function createRegExpExecutor(patterns, run) {
  let conditions = asArray(patterns).map(toCondition);
  return (value, context2, isDark) => {
    for (let condition of conditions) {
      let result = run(value, condition, context2, isDark);
      if (result) return result;
    }
  };
}
function toCondition(value) {
  return "string" == typeof value ? RegExp("^" + value + (value.includes("$") || "-" == value.slice(-1) ? "" : "$")) : value;
}
function twind(userConfig, sheet) {
  let config3 = defineConfig(userConfig), context2 = (function({ theme: theme3, darkMode, darkColor = noop, variants: variants2, rules: rules2, hash: hash$1, stringify, ignorelist, finalize }) {
    let variantCache = /* @__PURE__ */ new Map(), variantResolvers = /* @__PURE__ */ new Map(), ruleCache = /* @__PURE__ */ new Map(), ruleResolvers = /* @__PURE__ */ new Map(), ignored = createRegExpExecutor(ignorelist, (value, condition) => condition.test(value));
    variants2.push([
      "dark",
      Array.isArray(darkMode) || "class" == darkMode ? `${asArray(darkMode)[1] || ".dark"} &` : "string" == typeof darkMode && "media" != darkMode ? darkMode : (
        // a custom selector
        "@media (prefers-color-scheme:dark)"
      )
    ]);
    let h5 = "function" == typeof hash$1 ? (value) => hash$1(value, hash) : hash$1 ? hash : identity;
    h5 !== identity && finalize.push((rule) => ({
      ...rule,
      n: rule.n && h5(rule.n),
      d: rule.d?.replace(/--(tw(?:-[\w-]+)?)\b/g, (_5, property) => "--" + h5(property).replace("#", ""))
    }));
    let ctx = {
      theme: (function({ extend = {}, ...base }) {
        let resolved = {}, resolveContext = {
          get colors() {
            return theme4("colors");
          },
          theme: theme4,
          // Stub implementation as negated values are automatically infered and do _not_ need to be in the theme
          negative() {
            return {};
          },
          breakpoints(screens) {
            let breakpoints = {};
            for (let key in screens) "string" == typeof screens[key] && (breakpoints["screen-" + key] = screens[key]);
            return breakpoints;
          }
        };
        return theme4;
        function theme4(sectionKey, key, defaultValue, opacityValue) {
          if (sectionKey) {
            ({ 1: sectionKey, 2: opacityValue } = // eslint-disable-next-line no-sparse-arrays
            /^(\S+?)(?:\s*\/\s*([^/]+))?$/.exec(sectionKey) || [
              ,
              sectionKey
            ]);
            if (/[.[]/.test(sectionKey)) {
              let path = [];
              sectionKey.replace(/\[([^\]]+)\]|([^.[]+)/g, (_5, $1, $2 = $1) => path.push($2));
              sectionKey = path.shift();
              defaultValue = key;
              key = path.join("-");
            }
            let section = resolved[sectionKey] || // two-step deref to allow extend section to reference base section
            Object.assign(Object.assign(
              // Make sure to not get into recursive calls
              resolved[sectionKey] = {},
              deref(base, sectionKey)
            ), deref(extend, sectionKey));
            if (null == key) return section;
            key || (key = "DEFAULT");
            let value = section[key] ?? key.split("-").reduce((obj, prop) => obj?.[prop], section) ?? defaultValue;
            return opacityValue ? toColorValue(value, {
              opacityValue: resolveThemeFunction(opacityValue, theme4)
            }) : value;
          }
          let result = {};
          for (let section1 of [
            ...Object.keys(base),
            ...Object.keys(extend)
          ]) result[section1] = theme4(section1);
          return result;
        }
        function deref(source, section) {
          let value = source[section];
          return ("function" == typeof value && (value = value(resolveContext)), value && /color|fill|stroke/i.test(section)) ? (function flattenColorPalette(colors, path = []) {
            let flattend = {};
            for (let key in colors) {
              let value2 = colors[key], keyPath = [
                ...path,
                key
              ];
              flattend[keyPath.join("-")] = value2;
              if ("DEFAULT" == key) {
                keyPath = path;
                flattend[path.join("-")] = value2;
              }
              "object" == typeof value2 && Object.assign(flattend, flattenColorPalette(value2, keyPath));
            }
            return flattend;
          })(value) : value;
        }
      })(theme3),
      e: escape2,
      h: h5,
      s(property, value) {
        return stringify(property, value, ctx);
      },
      d(section, key, color) {
        return darkColor(section, key, ctx, color);
      },
      v(value) {
        return variantCache.has(value) || variantCache.set(value, find(value, variants2, variantResolvers, getVariantResolver, ctx) || "&:" + value), variantCache.get(value);
      },
      r(className, isDark) {
        let key = JSON.stringify([
          className,
          isDark
        ]);
        return ruleCache.has(key) || ruleCache.set(key, !ignored(className, ctx) && find(className, rules2, ruleResolvers, getRuleResolver, ctx, isDark)), ruleCache.get(key);
      },
      f(rule) {
        return finalize.reduce((rule2, p5) => p5(rule2, ctx), rule);
      }
    };
    return ctx;
  })(config3), cache2 = /* @__PURE__ */ new Map(), sortedPrecedences = [], insertedRules = /* @__PURE__ */ new Set();
  sheet.resume((className) => cache2.set(className, className), (cssText, rule) => {
    sheet.insert(cssText, sortedPrecedences.length, rule);
    sortedPrecedences.push(rule);
    insertedRules.add(cssText);
  });
  function insert(rule) {
    let finalRule = context2.f(rule), cssText = stringify$1(finalRule);
    if (cssText && !insertedRules.has(cssText)) {
      insertedRules.add(cssText);
      let index = sortedInsertionIndex(sortedPrecedences, rule);
      sheet.insert(cssText, index, rule);
      sortedPrecedences.splice(index, 0, rule);
    }
    return finalRule.n;
  }
  return Object.defineProperties(function tw3(tokens) {
    if (!cache2.size) for (let preflight2 of asArray(config3.preflight)) {
      "function" == typeof preflight2 && (preflight2 = preflight2(context2));
      preflight2 && ("string" == typeof preflight2 ? translateWith("", Layer.b, parse(preflight2), context2, Layer.b, [], false, true) : serialize(preflight2, {}, context2, Layer.b)).forEach(insert);
    }
    tokens = "" + tokens;
    let className = cache2.get(tokens);
    if (!className) {
      let classNames = /* @__PURE__ */ new Set();
      for (let rule of translate(parse(tokens), context2)) classNames.add(rule.c).add(insert(rule));
      className = [
        ...classNames
      ].filter(Boolean).join(" ");
      cache2.set(tokens, className).set(className, className);
    }
    return className;
  }, Object.getOwnPropertyDescriptors({
    get target() {
      return sheet.target;
    },
    theme: context2.theme,
    config: config3,
    snapshot() {
      let restoreSheet = sheet.snapshot(), insertedRules$ = new Set(insertedRules), cache$ = new Map(cache2), sortedPrecedences$ = [
        ...sortedPrecedences
      ];
      return () => {
        restoreSheet();
        insertedRules = insertedRules$;
        cache2 = cache$;
        sortedPrecedences = sortedPrecedences$;
      };
    },
    clear() {
      sheet.clear();
      insertedRules = /* @__PURE__ */ new Set();
      cache2 = /* @__PURE__ */ new Map();
      sortedPrecedences = [];
    },
    destroy() {
      this.clear();
      sheet.destroy();
    }
  }));
}
function getStyleElement(selector) {
  let style = document.querySelector(selector || 'style[data-twind=""]');
  if (!style || "STYLE" != style.tagName) {
    style = document.createElement("style");
    document.head.prepend(style);
  }
  return style.dataset.twind = "claimed", style;
}
function cssom(element) {
  let target = element?.cssRules ? element : (element && "string" != typeof element ? element : getStyleElement(element)).sheet;
  return {
    target,
    snapshot() {
      let rules2 = Array.from(target.cssRules, (rule) => rule.cssText);
      return () => {
        this.clear();
        rules2.forEach(this.insert);
      };
    },
    clear() {
      for (let index = target.cssRules.length; index--; ) target.deleteRule(index);
    },
    destroy() {
      target.ownerNode?.remove();
    },
    insert(cssText, index) {
      try {
        target.insertRule(cssText, index);
      } catch (error) {
        target.insertRule(":root{}", index);
      }
    },
    resume: noop
  };
}
function virtual(includeResumeData) {
  let target = [];
  return {
    target,
    snapshot() {
      let rules2 = [
        ...target
      ];
      return () => {
        target.splice(0, target.length, ...rules2);
      };
    },
    clear() {
      target.length = 0;
    },
    destroy() {
      this.clear();
    },
    insert(css2, index, rule) {
      target.splice(index, 0, includeResumeData ? `/*!${rule.p.toString(36)},${(2 * rule.o).toString(36)}${rule.n ? "," + rule.n : ""}*/${css2}` : css2);
    },
    resume: noop
  };
}
var tw = /* @__PURE__ */ new Proxy(
  // just exposing the active as tw should work with most bundlers
  // as ES module export can be re-assigned BUT some bundlers to not honor this
  // -> using a delegation proxy here
  noop,
  {
    apply(_target, _thisArg, args) {
      return active(args[0]);
    },
    get(target, property) {
      let value = active[property];
      return "function" == typeof value ? function() {
        return value.apply(active, arguments);
      } : value;
    }
  }
);
var injectGlobal = function(strings, ...interpolations) {
  ("function" == typeof this ? this : tw)(css({
    "@layer base": astish(strings, interpolations)
  }));
};
var keyframes = /* @__PURE__ */ (function bind(thisArg) {
  return new Proxy(function keyframes3(strings, ...interpolations) {
    return keyframes$(thisArg, "", strings, interpolations);
  }, {
    get(target, name) {
      return "bind" === name ? bind : name in target ? target[name] : function namedKeyframes(strings, ...interpolations) {
        return keyframes$(thisArg, name, strings, interpolations);
      };
    }
  });
})();
function keyframes$(thisArg, name, strings, interpolations) {
  return {
    toString() {
      let ast = astish(strings, interpolations), keyframeName = escape2(name + hash(JSON.stringify([
        name,
        ast
      ])));
      return (
        // lazy access tw
        ("function" == typeof thisArg ? thisArg : tw)(css({
          [`@keyframes ${keyframeName}`]: astish(strings, interpolations)
        })), keyframeName
      );
    }
  };
}
var tx = function(strings, ...interpolations) {
  return ("function" == typeof this ? this : tw)(interpolate(strings, interpolations));
};

// node_modules/style-vendorizer/dist/esm/bundle.min.mjs
var i4 = /* @__PURE__ */ new Map([["align-self", "-ms-grid-row-align"], ["color-adjust", "-webkit-print-color-adjust"], ["column-gap", "grid-column-gap"], ["forced-color-adjust", "-ms-high-contrast-adjust"], ["gap", "grid-gap"], ["grid-template-columns", "-ms-grid-columns"], ["grid-template-rows", "-ms-grid-rows"], ["justify-self", "-ms-grid-column-align"], ["margin-inline-end", "-webkit-margin-end"], ["margin-inline-start", "-webkit-margin-start"], ["mask-border", "-webkit-mask-box-image"], ["mask-border-outset", "-webkit-mask-box-image-outset"], ["mask-border-slice", "-webkit-mask-box-image-slice"], ["mask-border-source", "-webkit-mask-box-image-source"], ["mask-border-repeat", "-webkit-mask-box-image-repeat"], ["mask-border-width", "-webkit-mask-box-image-width"], ["overflow-wrap", "word-wrap"], ["padding-inline-end", "-webkit-padding-end"], ["padding-inline-start", "-webkit-padding-start"], ["print-color-adjust", "color-adjust"], ["row-gap", "grid-row-gap"], ["scroll-margin-bottom", "scroll-snap-margin-bottom"], ["scroll-margin-left", "scroll-snap-margin-left"], ["scroll-margin-right", "scroll-snap-margin-right"], ["scroll-margin-top", "scroll-snap-margin-top"], ["scroll-margin", "scroll-snap-margin"], ["text-combine-upright", "-ms-text-combine-horizontal"]]);
function r4(r7) {
  return i4.get(r7);
}
function a4(i6) {
  var r7 = /^(?:(text-(?:decoration$|e|or|si)|back(?:ground-cl|d|f)|box-d|mask(?:$|-[ispro]|-cl)|pr|hyphena|flex-d)|(tab-|column(?!-s)|text-align-l)|(ap)|u|hy)/i.exec(i6);
  return r7 ? r7[1] ? 1 : r7[2] ? 2 : r7[3] ? 3 : 5 : 0;
}
function t5(i6, r7) {
  var a5 = /^(?:(pos)|(cli)|(background-i)|(flex(?:$|-b)|(?:max-|min-)?(?:block-s|inl|he|widt))|dis)/i.exec(i6);
  return a5 ? a5[1] ? /^sti/i.test(r7) ? 1 : 0 : a5[2] ? /^pat/i.test(r7) ? 1 : 0 : a5[3] ? /^image-/i.test(r7) ? 1 : 0 : a5[4] ? "-" === r7[3] ? 2 : 0 : /^(?:inline-)?grid$/i.test(r7) ? 4 : 0 : 0;
}

// node_modules/@creit.tech/stellar-wallets-kit/node_modules/@twind/preset-autoprefix/preset-autoprefix.js
var CSSPrefixFlags = [
  [
    "-webkit-",
    1
  ],
  // 0b001
  [
    "-moz-",
    2
  ],
  // 0b010
  [
    "-ms-",
    4
  ]
];
function presetAutoprefix() {
  return ({ stringify }) => ({
    stringify(property, value, context2) {
      let cssText = "", propertyAlias = r4(property);
      propertyAlias && (cssText += stringify(propertyAlias, value, context2) + ";");
      let propertyFlags = a4(property), valueFlags = t5(property, value);
      for (let prefix of CSSPrefixFlags) {
        propertyFlags & prefix[1] && (cssText += stringify(prefix[0] + property, value, context2) + ";");
        valueFlags & prefix[1] && (cssText += stringify(property, prefix[0] + value, context2) + ";");
      }
      return cssText + stringify(property, value, context2);
    }
  });
}

// node_modules/@creit.tech/stellar-wallets-kit/node_modules/@twind/preset-tailwind/baseTheme.js
var theme2 = {
  screens: {
    sm: "640px",
    md: "768px",
    lg: "1024px",
    xl: "1280px",
    "2xl": "1536px"
  },
  columns: {
    auto: "auto",
    // Handled by plugin,
    // 1: '1',
    // 2: '2',
    // 3: '3',
    // 4: '4',
    // 5: '5',
    // 6: '6',
    // 7: '7',
    // 8: '8',
    // 9: '9',
    // 10: '10',
    // 11: '11',
    // 12: '12',
    "3xs": "16rem",
    "2xs": "18rem",
    xs: "20rem",
    sm: "24rem",
    md: "28rem",
    lg: "32rem",
    xl: "36rem",
    "2xl": "42rem",
    "3xl": "48rem",
    "4xl": "56rem",
    "5xl": "64rem",
    "6xl": "72rem",
    "7xl": "80rem"
  },
  spacing: {
    px: "1px",
    0: "0px",
    .../* @__PURE__ */ linear(4, "rem", 4, 0.5, 0.5),
    // 0.5: '0.125rem',
    // 1: '0.25rem',
    // 1.5: '0.375rem',
    // 2: '0.5rem',
    // 2.5: '0.625rem',
    // 3: '0.75rem',
    // 3.5: '0.875rem',
    // 4: '1rem',
    .../* @__PURE__ */ linear(12, "rem", 4, 5),
    // 5: '1.25rem',
    // 6: '1.5rem',
    // 7: '1.75rem',
    // 8: '2rem',
    // 9: '2.25rem',
    // 10: '2.5rem',
    // 11: '2.75rem',
    // 12: '3rem',
    14: "3.5rem",
    .../* @__PURE__ */ linear(64, "rem", 4, 16, 4),
    // 16: '4rem',
    // 20: '5rem',
    // 24: '6rem',
    // 28: '7rem',
    // 32: '8rem',
    // 36: '9rem',
    // 40: '10rem',
    // 44: '11rem',
    // 48: '12rem',
    // 52: '13rem',
    // 56: '14rem',
    // 60: '15rem',
    // 64: '16rem',
    72: "18rem",
    80: "20rem",
    96: "24rem"
  },
  durations: {
    75: "75ms",
    100: "100ms",
    150: "150ms",
    200: "200ms",
    300: "300ms",
    500: "500ms",
    700: "700ms",
    1e3: "1000ms"
  },
  animation: {
    none: "none",
    spin: "spin 1s linear infinite",
    ping: "ping 1s cubic-bezier(0,0,0.2,1) infinite",
    pulse: "pulse 2s cubic-bezier(0.4,0,0.6,1) infinite",
    bounce: "bounce 1s infinite"
  },
  aspectRatio: {
    auto: "auto",
    square: "1/1",
    video: "16/9"
  },
  backdropBlur: /* @__PURE__ */ alias("blur"),
  backdropBrightness: /* @__PURE__ */ alias("brightness"),
  backdropContrast: /* @__PURE__ */ alias("contrast"),
  backdropGrayscale: /* @__PURE__ */ alias("grayscale"),
  backdropHueRotate: /* @__PURE__ */ alias("hueRotate"),
  backdropInvert: /* @__PURE__ */ alias("invert"),
  backdropOpacity: /* @__PURE__ */ alias("opacity"),
  backdropSaturate: /* @__PURE__ */ alias("saturate"),
  backdropSepia: /* @__PURE__ */ alias("sepia"),
  backgroundColor: /* @__PURE__ */ alias("colors"),
  backgroundImage: {
    none: "none"
  },
  // These are built-in
  // 'gradient-to-t': 'linear-gradient(to top, var(--tw-gradient-stops))',
  // 'gradient-to-tr': 'linear-gradient(to top right, var(--tw-gradient-stops))',
  // 'gradient-to-r': 'linear-gradient(to right, var(--tw-gradient-stops))',
  // 'gradient-to-br': 'linear-gradient(to bottom right, var(--tw-gradient-stops))',
  // 'gradient-to-b': 'linear-gradient(to bottom, var(--tw-gradient-stops))',
  // 'gradient-to-bl': 'linear-gradient(to bottom left, var(--tw-gradient-stops))',
  // 'gradient-to-l': 'linear-gradient(to left, var(--tw-gradient-stops))',
  // 'gradient-to-tl': 'linear-gradient(to top left, var(--tw-gradient-stops))',
  backgroundOpacity: /* @__PURE__ */ alias("opacity"),
  // backgroundPosition: {
  //   // The following are already handled by the plugin:
  //   // center, right, left, bottom, top
  //   // 'bottom-10px-right-20px' -> bottom 10px right 20px
  // },
  backgroundSize: {
    auto: "auto",
    cover: "cover",
    contain: "contain"
  },
  blur: {
    none: "none",
    0: "0",
    sm: "4px",
    DEFAULT: "8px",
    md: "12px",
    lg: "16px",
    xl: "24px",
    "2xl": "40px",
    "3xl": "64px"
  },
  brightness: {
    .../* @__PURE__ */ linear(200, "", 100, 0, 50),
    // 0: '0',
    // 50: '.5',
    // 150: '1.5',
    // 200: '2',
    .../* @__PURE__ */ linear(110, "", 100, 90, 5),
    // 90: '.9',
    // 95: '.95',
    // 100: '1',
    // 105: '1.05',
    // 110: '1.1',
    75: "0.75",
    125: "1.25"
  },
  borderColor: ({ theme: theme3 }) => ({
    DEFAULT: theme3("colors.gray.200", "currentColor"),
    ...theme3("colors")
  }),
  borderOpacity: /* @__PURE__ */ alias("opacity"),
  borderRadius: {
    none: "0px",
    sm: "0.125rem",
    DEFAULT: "0.25rem",
    md: "0.375rem",
    lg: "0.5rem",
    xl: "0.75rem",
    "2xl": "1rem",
    "3xl": "1.5rem",
    "1/2": "50%",
    full: "9999px"
  },
  borderSpacing: /* @__PURE__ */ alias("spacing"),
  borderWidth: {
    DEFAULT: "1px",
    .../* @__PURE__ */ exponential(8, "px")
  },
  // 0: '0px',
  // 2: '2px',
  // 4: '4px',
  // 8: '8px',
  boxShadow: {
    sm: "0 1px 2px 0 rgba(0,0,0,0.05)",
    DEFAULT: "0 1px 3px 0 rgba(0,0,0,0.1), 0 1px 2px -1px rgba(0,0,0,0.1)",
    md: "0 4px 6px -1px rgba(0,0,0,0.1), 0 2px 4px -2px rgba(0,0,0,0.1)",
    lg: "0 10px 15px -3px rgba(0,0,0,0.1), 0 4px 6px -4px rgba(0,0,0,0.1)",
    xl: "0 20px 25px -5px rgba(0,0,0,0.1), 0 8px 10px -6px rgba(0,0,0,0.1)",
    "2xl": "0 25px 50px -12px rgba(0,0,0,0.25)",
    inner: "inset 0 2px 4px 0 rgba(0,0,0,0.05)",
    none: "0 0 #0000"
  },
  boxShadowColor: alias("colors"),
  // container: {},
  // cursor: {
  //   // Default values are handled by plugin
  // },
  caretColor: /* @__PURE__ */ alias("colors"),
  accentColor: ({ theme: theme3 }) => ({
    auto: "auto",
    ...theme3("colors")
  }),
  contrast: {
    .../* @__PURE__ */ linear(200, "", 100, 0, 50),
    // 0: '0',
    // 50: '.5',
    // 150: '1.5',
    // 200: '2',
    75: "0.75",
    125: "1.25"
  },
  content: {
    none: "none"
  },
  divideColor: /* @__PURE__ */ alias("borderColor"),
  divideOpacity: /* @__PURE__ */ alias("borderOpacity"),
  divideWidth: /* @__PURE__ */ alias("borderWidth"),
  dropShadow: {
    sm: "0 1px 1px rgba(0,0,0,0.05)",
    DEFAULT: [
      "0 1px 2px rgba(0,0,0,0.1)",
      "0 1px 1px rgba(0,0,0,0.06)"
    ],
    md: [
      "0 4px 3px rgba(0,0,0,0.07)",
      "0 2px 2px rgba(0,0,0,0.06)"
    ],
    lg: [
      "0 10px 8px rgba(0,0,0,0.04)",
      "0 4px 3px rgba(0,0,0,0.1)"
    ],
    xl: [
      "0 20px 13px rgba(0,0,0,0.03)",
      "0 8px 5px rgba(0,0,0,0.08)"
    ],
    "2xl": "0 25px 25px rgba(0,0,0,0.15)",
    none: "0 0 #0000"
  },
  fill: ({ theme: theme3 }) => ({
    ...theme3("colors"),
    none: "none"
  }),
  grayscale: {
    DEFAULT: "100%",
    0: "0"
  },
  hueRotate: {
    0: "0deg",
    15: "15deg",
    30: "30deg",
    60: "60deg",
    90: "90deg",
    180: "180deg"
  },
  invert: {
    DEFAULT: "100%",
    0: "0"
  },
  flex: {
    1: "1 1 0%",
    auto: "1 1 auto",
    initial: "0 1 auto",
    none: "none"
  },
  flexBasis: ({ theme: theme3 }) => ({
    ...theme3("spacing"),
    ...ratios(2, 6),
    // '1/2': '50%',
    // '1/3': '33.333333%',
    // '2/3': '66.666667%',
    // '1/4': '25%',
    // '2/4': '50%',
    // '3/4': '75%',
    // '1/5': '20%',
    // '2/5': '40%',
    // '3/5': '60%',
    // '4/5': '80%',
    // '1/6': '16.666667%',
    // '2/6': '33.333333%',
    // '3/6': '50%',
    // '4/6': '66.666667%',
    // '5/6': '83.333333%',
    ...ratios(12, 12),
    // '1/12': '8.333333%',
    // '2/12': '16.666667%',
    // '3/12': '25%',
    // '4/12': '33.333333%',
    // '5/12': '41.666667%',
    // '6/12': '50%',
    // '7/12': '58.333333%',
    // '8/12': '66.666667%',
    // '9/12': '75%',
    // '10/12': '83.333333%',
    // '11/12': '91.666667%',
    auto: "auto",
    full: "100%"
  }),
  flexGrow: {
    DEFAULT: 1,
    0: 0
  },
  flexShrink: {
    DEFAULT: 1,
    0: 0
  },
  fontFamily: {
    sans: 'ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,"Helvetica Neue",Arial,"Noto Sans",sans-serif,"Apple Color Emoji","Segoe UI Emoji","Segoe UI Symbol","Noto Color Emoji"'.split(","),
    serif: 'ui-serif,Georgia,Cambria,"Times New Roman",Times,serif'.split(","),
    mono: 'ui-monospace,SFMono-Regular,Menlo,Monaco,Consolas,"Liberation Mono","Courier New",monospace'.split(",")
  },
  fontSize: {
    xs: [
      "0.75rem",
      "1rem"
    ],
    sm: [
      "0.875rem",
      "1.25rem"
    ],
    base: [
      "1rem",
      "1.5rem"
    ],
    lg: [
      "1.125rem",
      "1.75rem"
    ],
    xl: [
      "1.25rem",
      "1.75rem"
    ],
    "2xl": [
      "1.5rem",
      "2rem"
    ],
    "3xl": [
      "1.875rem",
      "2.25rem"
    ],
    "4xl": [
      "2.25rem",
      "2.5rem"
    ],
    "5xl": [
      "3rem",
      "1"
    ],
    "6xl": [
      "3.75rem",
      "1"
    ],
    "7xl": [
      "4.5rem",
      "1"
    ],
    "8xl": [
      "6rem",
      "1"
    ],
    "9xl": [
      "8rem",
      "1"
    ]
  },
  fontWeight: {
    thin: "100",
    extralight: "200",
    light: "300",
    normal: "400",
    medium: "500",
    semibold: "600",
    bold: "700",
    extrabold: "800",
    black: "900"
  },
  gap: /* @__PURE__ */ alias("spacing"),
  gradientColorStops: /* @__PURE__ */ alias("colors"),
  gridAutoColumns: {
    auto: "auto",
    min: "min-content",
    max: "max-content",
    fr: "minmax(0,1fr)"
  },
  gridAutoRows: {
    auto: "auto",
    min: "min-content",
    max: "max-content",
    fr: "minmax(0,1fr)"
  },
  gridColumn: {
    // span-X is handled by the plugin: span-1 -> span 1 / span 1
    auto: "auto",
    "span-full": "1 / -1"
  },
  // gridColumnEnd: {
  //   // Defaults handled by plugin
  // },
  // gridColumnStart: {
  //   // Defaults handled by plugin
  // },
  gridRow: {
    // span-X is handled by the plugin: span-1 -> span 1 / span 1
    auto: "auto",
    "span-full": "1 / -1"
  },
  // gridRowStart: {
  //   // Defaults handled by plugin
  // },
  // gridRowEnd: {
  //   // Defaults handled by plugin
  // },
  gridTemplateColumns: {
    // numbers are handled by the plugin: 1 -> repeat(1, minmax(0, 1fr))
    none: "none"
  },
  gridTemplateRows: {
    // numbers are handled by the plugin: 1 -> repeat(1, minmax(0, 1fr))
    none: "none"
  },
  height: ({ theme: theme3 }) => ({
    ...theme3("spacing"),
    ...ratios(2, 6),
    // '1/2': '50%',
    // '1/3': '33.333333%',
    // '2/3': '66.666667%',
    // '1/4': '25%',
    // '2/4': '50%',
    // '3/4': '75%',
    // '1/5': '20%',
    // '2/5': '40%',
    // '3/5': '60%',
    // '4/5': '80%',
    // '1/6': '16.666667%',
    // '2/6': '33.333333%',
    // '3/6': '50%',
    // '4/6': '66.666667%',
    // '5/6': '83.333333%',
    min: "min-content",
    max: "max-content",
    fit: "fit-content",
    auto: "auto",
    full: "100%",
    screen: "100vh"
  }),
  inset: ({ theme: theme3 }) => ({
    ...theme3("spacing"),
    ...ratios(2, 4),
    // '1/2': '50%',
    // '1/3': '33.333333%',
    // '2/3': '66.666667%',
    // '1/4': '25%',
    // '2/4': '50%',
    // '3/4': '75%',
    auto: "auto",
    full: "100%"
  }),
  keyframes: {
    spin: {
      from: {
        transform: "rotate(0deg)"
      },
      to: {
        transform: "rotate(360deg)"
      }
    },
    ping: {
      "0%": {
        transform: "scale(1)",
        opacity: "1"
      },
      "75%,100%": {
        transform: "scale(2)",
        opacity: "0"
      }
    },
    pulse: {
      "0%,100%": {
        opacity: "1"
      },
      "50%": {
        opacity: ".5"
      }
    },
    bounce: {
      "0%, 100%": {
        transform: "translateY(-25%)",
        animationTimingFunction: "cubic-bezier(0.8,0,1,1)"
      },
      "50%": {
        transform: "none",
        animationTimingFunction: "cubic-bezier(0,0,0.2,1)"
      }
    }
  },
  letterSpacing: {
    tighter: "-0.05em",
    tight: "-0.025em",
    normal: "0em",
    wide: "0.025em",
    wider: "0.05em",
    widest: "0.1em"
  },
  lineHeight: {
    .../* @__PURE__ */ linear(10, "rem", 4, 3),
    // 3: '.75rem',
    // 4: '1rem',
    // 5: '1.25rem',
    // 6: '1.5rem',
    // 7: '1.75rem',
    // 8: '2rem',
    // 9: '2.25rem',
    // 10: '2.5rem',
    none: "1",
    tight: "1.25",
    snug: "1.375",
    normal: "1.5",
    relaxed: "1.625",
    loose: "2"
  },
  // listStyleType: {
  //   // Defaults handled by plugin
  // },
  margin: ({ theme: theme3 }) => ({
    auto: "auto",
    ...theme3("spacing")
  }),
  maxHeight: ({ theme: theme3 }) => ({
    full: "100%",
    min: "min-content",
    max: "max-content",
    fit: "fit-content",
    screen: "100vh",
    ...theme3("spacing")
  }),
  maxWidth: ({ theme: theme3, breakpoints }) => ({
    ...breakpoints(theme3("screens")),
    none: "none",
    0: "0rem",
    xs: "20rem",
    sm: "24rem",
    md: "28rem",
    lg: "32rem",
    xl: "36rem",
    "2xl": "42rem",
    "3xl": "48rem",
    "4xl": "56rem",
    "5xl": "64rem",
    "6xl": "72rem",
    "7xl": "80rem",
    full: "100%",
    min: "min-content",
    max: "max-content",
    fit: "fit-content",
    prose: "65ch"
  }),
  minHeight: {
    0: "0px",
    full: "100%",
    min: "min-content",
    max: "max-content",
    fit: "fit-content",
    screen: "100vh"
  },
  minWidth: {
    0: "0px",
    full: "100%",
    min: "min-content",
    max: "max-content",
    fit: "fit-content"
  },
  // objectPosition: {
  //   // The plugins joins all arguments by default
  // },
  opacity: {
    .../* @__PURE__ */ linear(100, "", 100, 0, 10),
    // 0: '0',
    // 10: '0.1',
    // 20: '0.2',
    // 30: '0.3',
    // 40: '0.4',
    // 60: '0.6',
    // 70: '0.7',
    // 80: '0.8',
    // 90: '0.9',
    // 100: '1',
    5: "0.05",
    25: "0.25",
    75: "0.75",
    95: "0.95"
  },
  order: {
    // Handled by plugin
    // 1: '1',
    // 2: '2',
    // 3: '3',
    // 4: '4',
    // 5: '5',
    // 6: '6',
    // 7: '7',
    // 8: '8',
    // 9: '9',
    // 10: '10',
    // 11: '11',
    // 12: '12',
    first: "-9999",
    last: "9999",
    none: "0"
  },
  padding: /* @__PURE__ */ alias("spacing"),
  placeholderColor: /* @__PURE__ */ alias("colors"),
  placeholderOpacity: /* @__PURE__ */ alias("opacity"),
  outlineColor: /* @__PURE__ */ alias("colors"),
  outlineOffset: /* @__PURE__ */ exponential(8, "px"),
  // 0: '0px',
  // 1: '1px',
  // 2: '2px',
  // 4: '4px',
  // 8: '8px',,
  outlineWidth: /* @__PURE__ */ exponential(8, "px"),
  // 0: '0px',
  // 1: '1px',
  // 2: '2px',
  // 4: '4px',
  // 8: '8px',,
  ringColor: ({ theme: theme3 }) => ({
    ...theme3("colors"),
    DEFAULT: "#3b82f6"
  }),
  ringOffsetColor: /* @__PURE__ */ alias("colors"),
  ringOffsetWidth: /* @__PURE__ */ exponential(8, "px"),
  // 0: '0px',
  // 1: '1px',
  // 2: '2px',
  // 4: '4px',
  // 8: '8px',,
  ringOpacity: ({ theme: theme3 }) => ({
    ...theme3("opacity"),
    DEFAULT: "0.5"
  }),
  ringWidth: {
    DEFAULT: "3px",
    .../* @__PURE__ */ exponential(8, "px")
  },
  // 0: '0px',
  // 1: '1px',
  // 2: '2px',
  // 4: '4px',
  // 8: '8px',
  rotate: {
    .../* @__PURE__ */ exponential(2, "deg"),
    // 0: '0deg',
    // 1: '1deg',
    // 2: '2deg',
    .../* @__PURE__ */ exponential(12, "deg", 3),
    // 3: '3deg',
    // 6: '6deg',
    // 12: '12deg',
    .../* @__PURE__ */ exponential(180, "deg", 45)
  },
  // 45: '45deg',
  // 90: '90deg',
  // 180: '180deg',
  saturate: /* @__PURE__ */ linear(200, "", 100, 0, 50),
  // 0: '0',
  // 50: '.5',
  // 100: '1',
  // 150: '1.5',
  // 200: '2',
  scale: {
    .../* @__PURE__ */ linear(150, "", 100, 0, 50),
    // 0: '0',
    // 50: '.5',
    // 150: '1.5',
    .../* @__PURE__ */ linear(110, "", 100, 90, 5),
    // 90: '.9',
    // 95: '.95',
    // 100: '1',
    // 105: '1.05',
    // 110: '1.1',
    75: "0.75",
    125: "1.25"
  },
  scrollMargin: /* @__PURE__ */ alias("spacing"),
  scrollPadding: /* @__PURE__ */ alias("spacing"),
  sepia: {
    0: "0",
    DEFAULT: "100%"
  },
  skew: {
    .../* @__PURE__ */ exponential(2, "deg"),
    // 0: '0deg',
    // 1: '1deg',
    // 2: '2deg',
    .../* @__PURE__ */ exponential(12, "deg", 3)
  },
  // 3: '3deg',
  // 6: '6deg',
  // 12: '12deg',
  space: /* @__PURE__ */ alias("spacing"),
  stroke: ({ theme: theme3 }) => ({
    ...theme3("colors"),
    none: "none"
  }),
  strokeWidth: /* @__PURE__ */ linear(2),
  // 0: '0',
  // 1: '1',
  // 2: '2',,
  textColor: /* @__PURE__ */ alias("colors"),
  textDecorationColor: /* @__PURE__ */ alias("colors"),
  textDecorationThickness: {
    "from-font": "from-font",
    auto: "auto",
    .../* @__PURE__ */ exponential(8, "px")
  },
  // 0: '0px',
  // 1: '1px',
  // 2: '2px',
  // 4: '4px',
  // 8: '8px',
  textUnderlineOffset: {
    auto: "auto",
    .../* @__PURE__ */ exponential(8, "px")
  },
  // 0: '0px',
  // 1: '1px',
  // 2: '2px',
  // 4: '4px',
  // 8: '8px',
  textIndent: /* @__PURE__ */ alias("spacing"),
  textOpacity: /* @__PURE__ */ alias("opacity"),
  // transformOrigin: {
  //   // The following are already handled by the plugin:
  //   // center, right, left, bottom, top
  //   // 'bottom-10px-right-20px' -> bottom 10px right 20px
  // },
  transitionDuration: ({ theme: theme3 }) => ({
    ...theme3("durations"),
    DEFAULT: "150ms"
  }),
  transitionDelay: /* @__PURE__ */ alias("durations"),
  transitionProperty: {
    none: "none",
    all: "all",
    DEFAULT: "color,background-color,border-color,text-decoration-color,fill,stroke,opacity,box-shadow,transform,filter,backdrop-filter",
    colors: "color,background-color,border-color,text-decoration-color,fill,stroke",
    opacity: "opacity",
    shadow: "box-shadow",
    transform: "transform"
  },
  transitionTimingFunction: {
    DEFAULT: "cubic-bezier(0.4,0,0.2,1)",
    linear: "linear",
    in: "cubic-bezier(0.4,0,1,1)",
    out: "cubic-bezier(0,0,0.2,1)",
    "in-out": "cubic-bezier(0.4,0,0.2,1)"
  },
  translate: ({ theme: theme3 }) => ({
    ...theme3("spacing"),
    ...ratios(2, 4),
    // '1/2': '50%',
    // '1/3': '33.333333%',
    // '2/3': '66.666667%',
    // '1/4': '25%',
    // '2/4': '50%',
    // '3/4': '75%',
    full: "100%"
  }),
  width: ({ theme: theme3 }) => ({
    min: "min-content",
    max: "max-content",
    fit: "fit-content",
    screen: "100vw",
    ...theme3("flexBasis")
  }),
  willChange: {
    scroll: "scroll-position"
  },
  // other options handled by rules
  // auto: 'auto',
  // contents: 'contents',
  // transform: 'transform',
  zIndex: {
    .../* @__PURE__ */ linear(50, "", 1, 0, 10),
    // 0: '0',
    // 10: '10',
    // 20: '20',
    // 30: '30',
    // 40: '40',
    // 50: '50',
    auto: "auto"
  }
};
function ratios(start, end) {
  let result = {};
  do
    for (var dividend = 1; dividend < start; dividend++) result[`${dividend}/${start}`] = Number((dividend / start * 100).toFixed(6)) + "%";
  while (++start <= end);
  return result;
}
function exponential(stop, unit, start = 0) {
  let result = {};
  for (; start <= stop; start = 2 * start || 1) result[start] = start + unit;
  return result;
}
function linear(stop, unit = "", divideBy = 1, start = 0, step = 1, result = {}) {
  for (; start <= stop; start += step) result[start] = start / divideBy + unit;
  return result;
}
function alias(section) {
  return ({ theme: theme3 }) => theme3(section);
}

// node_modules/@creit.tech/stellar-wallets-kit/node_modules/@twind/preset-tailwind/preflight.js
var preflight = {
  /*
  1. Prevent padding and border from affecting element width. (https://github.com/mozdevs/cssremedy/issues/4)
  2. Allow adding a border to an element by just adding a border-width. (https://github.com/tailwindcss/tailwindcss/pull/116)
  */
  "*,::before,::after": {
    boxSizing: "border-box",
    /* 1 */
    borderWidth: "0",
    /* 2 */
    borderStyle: "solid",
    /* 2 */
    borderColor: "theme(borderColor.DEFAULT, currentColor)"
  },
  /* 2 */
  "::before,::after": {
    "--tw-content": "''"
  },
  /*
  1. Use a consistent sensible line-height in all browsers.
  2. Prevent adjustments of font size after orientation changes in iOS.
  3. Use a more readable tab size.
  4. Use the user's configured `sans` font-family by default.
  5. Use the user's configured `sans` font-feature-settings by default.
  */
  html: {
    lineHeight: 1.5,
    /* 1 */
    WebkitTextSizeAdjust: "100%",
    /* 2 */
    MozTabSize: "4",
    /* 3 */
    tabSize: 4,
    /* 3 */
    fontFamily: `theme(fontFamily.sans, ${theme2.fontFamily.sans})`,
    /* 4 */
    fontFeatureSettings: "theme(fontFamily.sans[1].fontFeatureSettings, normal)"
  },
  /* 5 */
  /*
  1. Remove the margin in all browsers.
  2. Inherit line-height from `html` so users can set them as a class directly on the `html` element.
  */
  body: {
    margin: "0",
    /* 1 */
    lineHeight: "inherit"
  },
  /* 2 */
  /*
  1. Add the correct height in Firefox.
  2. Correct the inheritance of border color in Firefox. (https://bugzilla.mozilla.org/show_bug.cgi?id=190655)
  3. Ensure horizontal rules are visible by default.
  */
  hr: {
    height: "0",
    /* 1 */
    color: "inherit",
    /* 2 */
    borderTopWidth: "1px"
  },
  /* 3 */
  /*
  Add the correct text decoration in Chrome, Edge, and Safari.
  */
  "abbr:where([title])": {
    textDecoration: "underline dotted"
  },
  /*
  Remove the default font size and weight for headings.
  */
  "h1,h2,h3,h4,h5,h6": {
    fontSize: "inherit",
    fontWeight: "inherit"
  },
  /*
  Reset links to optimize for opt-in styling instead of opt-out.
  */
  a: {
    color: "inherit",
    textDecoration: "inherit"
  },
  /*
  Add the correct font weight in Edge and Safari.
  */
  "b,strong": {
    fontWeight: "bolder"
  },
  /*
  1. Use the user's configured `mono` font family by default.
  2. Use the user's configured `mono` font-feature-settings by default.
  3. Correct the odd `em` font sizing in all browsers.
  */
  "code,kbd,samp,pre": {
    fontFamily: `theme(fontFamily.mono, ${theme2.fontFamily.mono})`,
    fontFeatureSettings: "theme(fontFamily.mono[1].fontFeatureSettings, normal)",
    fontSize: "1em"
  },
  /*
  Add the correct font size in all browsers.
  */
  small: {
    fontSize: "80%"
  },
  /*
  Prevent `sub` and `sup` elements from affecting the line height in all browsers.
  */
  "sub,sup": {
    fontSize: "75%",
    lineHeight: 0,
    position: "relative",
    verticalAlign: "baseline"
  },
  sub: {
    bottom: "-0.25em"
  },
  sup: {
    top: "-0.5em"
  },
  /*
  1. Remove text indentation from table contents in Chrome and Safari. (https://bugs.chromium.org/p/chromium/issues/detail?id=999088, https://bugs.webkit.org/show_bug.cgi?id=201297)
  2. Correct table border color inheritance in all Chrome and Safari. (https://bugs.chromium.org/p/chromium/issues/detail?id=935729, https://bugs.webkit.org/show_bug.cgi?id=195016)
  3. Remove gaps between table borders by default.
  */
  table: {
    textIndent: "0",
    /* 1 */
    borderColor: "inherit",
    /* 2 */
    borderCollapse: "collapse"
  },
  /* 3 */
  /*
  1. Change the font styles in all browsers.
  2. Remove the margin in Firefox and Safari.
  3. Remove default padding in all browsers.
  */
  "button,input,optgroup,select,textarea": {
    fontFamily: "inherit",
    /* 1 */
    fontSize: "100%",
    /* 1 */
    lineHeight: "inherit",
    /* 1 */
    color: "inherit",
    /* 1 */
    margin: "0",
    /* 2 */
    padding: "0"
  },
  /* 3 */
  /*
  Remove the inheritance of text transform in Edge and Firefox.
  */
  "button,select": {
    textTransform: "none"
  },
  /*
  1. Correct the inability to style clickable types in iOS and Safari.
  2. Remove default button styles.
  */
  "button,[type='button'],[type='reset'],[type='submit']": {
    WebkitAppearance: "button",
    /* 1 */
    backgroundColor: "transparent",
    /* 2 */
    backgroundImage: "none"
  },
  /* 4 */
  /*
  Use the modern Firefox focus style for all focusable elements.
  */
  ":-moz-focusring": {
    outline: "auto"
  },
  /*
  Remove the additional `:invalid` styles in Firefox. (https://github.com/mozilla/gecko-dev/blob/2f9eacd9d3d995c937b4251a5557d95d494c9be1/layout/style/res/forms.css#L728-L737)
  */
  ":-moz-ui-invalid": {
    boxShadow: "none"
  },
  /*
  Add the correct vertical alignment in Chrome and Firefox.
  */
  progress: {
    verticalAlign: "baseline"
  },
  /*
  Correct the cursor style of increment and decrement buttons in Safari.
  */
  "::-webkit-inner-spin-button,::-webkit-outer-spin-button": {
    height: "auto"
  },
  /*
  1. Correct the odd appearance in Chrome and Safari.
  2. Correct the outline style in Safari.
  */
  "[type='search']": {
    WebkitAppearance: "textfield",
    /* 1 */
    outlineOffset: "-2px"
  },
  /* 2 */
  /*
  Remove the inner padding in Chrome and Safari on macOS.
  */
  "::-webkit-search-decoration": {
    WebkitAppearance: "none"
  },
  /*
  1. Correct the inability to style clickable types in iOS and Safari.
  2. Change font properties to `inherit` in Safari.
  */
  "::-webkit-file-upload-button": {
    WebkitAppearance: "button",
    /* 1 */
    font: "inherit"
  },
  /* 2 */
  /*
  Add the correct display in Chrome and Safari.
  */
  summary: {
    display: "list-item"
  },
  /*
  Removes the default spacing and border for appropriate elements.
  */
  "blockquote,dl,dd,h1,h2,h3,h4,h5,h6,hr,figure,p,pre": {
    margin: "0"
  },
  fieldset: {
    margin: "0",
    padding: "0"
  },
  legend: {
    padding: "0"
  },
  "ol,ul,menu": {
    listStyle: "none",
    margin: "0",
    padding: "0"
  },
  /*
  Prevent resizing textareas horizontally by default.
  */
  textarea: {
    resize: "vertical"
  },
  /*
  1. Reset the default placeholder opacity in Firefox. (https://github.com/tailwindlabs/tailwindcss/issues/3300)
  2. Set the default placeholder color to the user's configured gray 400 color.
  */
  "input::placeholder,textarea::placeholder": {
    opacity: 1,
    /* 1 */
    color: "theme(colors.gray.400, #9ca3af)"
  },
  /* 2 */
  /*
  Set the default cursor for buttons.
  */
  'button,[role="button"]': {
    cursor: "pointer"
  },
  /*
  Make sure disabled buttons don't get the pointer cursor.
  */
  ":disabled": {
    cursor: "default"
  },
  /*
  1. Make replaced elements `display: block` by default. (https://github.com/mozdevs/cssremedy/issues/14)
  2. Add `vertical-align: middle` to align replaced elements more sensibly by default. (https://github.com/jensimmons/cssremedy/issues/14#issuecomment-634934210)
    This can trigger a poorly considered lint error in some tools but is included by design.
  */
  "img,svg,video,canvas,audio,iframe,embed,object": {
    display: "block",
    /* 1 */
    verticalAlign: "middle"
  },
  /* 2 */
  /*
  Constrain images and videos to the parent width and preserve their intrinsic aspect ratio. (https://github.com/mozdevs/cssremedy/issues/14)
  */
  "img,video": {
    maxWidth: "100%",
    height: "auto"
  },
  /* Make elements with the HTML hidden attribute stay hidden by default */
  "[hidden]": {
    display: "none"
  }
};

// node_modules/@creit.tech/stellar-wallets-kit/node_modules/@twind/preset-tailwind/rules.js
var rules = [
  /* arbitrary properties: [paint-order:markers] */
  match("\\[([-\\w]+):(.+)]", ({ 1: $1, 2: $2 }, context2) => ({
    "@layer overrides": {
      "&": {
        [$1]: arbitrary(`[${$2}]`, "", context2)
      }
    }
  })),
  /* Styling based on parent and peer state */
  match("(group|peer)([~/][^-[]+)?", ({ input }, { h: h5 }) => [
    {
      c: h5(input)
    }
  ]),
  /* LAYOUT */
  matchTheme("aspect-", "aspectRatio"),
  match("container", (_5, { theme: theme3 }) => {
    let { screens = theme3("screens"), center, padding: padding6 } = theme3("container"), rules2 = {
      width: "100%",
      marginRight: center && "auto",
      marginLeft: center && "auto",
      ...paddingFor("xs")
    };
    for (let screen2 in screens) {
      let value = screens[screen2];
      "string" == typeof value && (rules2[mql(value)] = {
        "&": {
          maxWidth: value,
          ...paddingFor(screen2)
        }
      });
    }
    return rules2;
    function paddingFor(screen2) {
      let value = padding6 && ("string" == typeof padding6 ? padding6 : padding6[screen2] || padding6.DEFAULT);
      if (value) return {
        paddingRight: value,
        paddingLeft: value
      };
    }
  }),
  // Content
  matchTheme("content-", "content", ({ _: _5 }) => ({
    "--tw-content": _5,
    content: "var(--tw-content)"
  })),
  // Box Decoration Break
  match("(?:box-)?decoration-(slice|clone)", "boxDecorationBreak"),
  // Box Sizing
  match("box-(border|content)", "boxSizing", ({ 1: $1 }) => $1 + "-box"),
  // Display
  match("hidden", {
    display: "none"
  }),
  // Table Layout
  match("table-(auto|fixed)", "tableLayout"),
  match([
    "(block|flex|table|grid|inline|contents|flow-root|list-item)",
    "(inline-(block|flex|table|grid))",
    "(table-(caption|cell|column|row|(column|row|footer|header)-group))"
  ], "display"),
  // Floats
  "(float)-(left|right|none)",
  // Clear
  "(clear)-(left|right|none|both)",
  // Overflow
  "(overflow(?:-[xy])?)-(auto|hidden|clip|visible|scroll)",
  // Isolation
  "(isolation)-(auto)",
  // Isolation
  match("isolate", "isolation"),
  // Object Fit
  match("object-(contain|cover|fill|none|scale-down)", "objectFit"),
  // Object Position
  matchTheme("object-", "objectPosition"),
  match("object-(top|bottom|center|(left|right)(-(top|bottom))?)", "objectPosition", spacify),
  // Overscroll Behavior
  match("overscroll(-[xy])?-(auto|contain|none)", ({ 1: $1 = "", 2: $2 }) => ({
    ["overscroll-behavior" + $1]: $2
  })),
  // Position
  match("(static|fixed|absolute|relative|sticky)", "position"),
  // Top / Right / Bottom / Left
  matchTheme("-?inset(-[xy])?(?:$|-)", "inset", ({ 1: $1, _: _5 }) => ({
    top: "-x" != $1 && _5,
    right: "-y" != $1 && _5,
    bottom: "-x" != $1 && _5,
    left: "-y" != $1 && _5
  })),
  matchTheme("-?(top|bottom|left|right)(?:$|-)", "inset"),
  // Visibility
  match("(visible|collapse)", "visibility"),
  match("invisible", {
    visibility: "hidden"
  }),
  // Z-Index
  matchTheme("-?z-", "zIndex"),
  /* FLEXBOX */
  // Flex Direction
  match("flex-((row|col)(-reverse)?)", "flexDirection", columnify),
  match("flex-(wrap|wrap-reverse|nowrap)", "flexWrap"),
  matchTheme("(flex-(?:grow|shrink))(?:$|-)"),
  /*, 'flex-grow' | flex-shrink */
  matchTheme("(flex)-"),
  /*, 'flex' */
  matchTheme("grow(?:$|-)", "flexGrow"),
  matchTheme("shrink(?:$|-)", "flexShrink"),
  matchTheme("basis-", "flexBasis"),
  matchTheme("-?(order)-"),
  /*, 'order' */
  "-?(order)-(\\d+)",
  /* GRID */
  // Grid Template Columns
  matchTheme("grid-cols-", "gridTemplateColumns"),
  match("grid-cols-(\\d+)", "gridTemplateColumns", gridTemplate),
  // Grid Column Start / End
  matchTheme("col-", "gridColumn"),
  match("col-(span)-(\\d+)", "gridColumn", span),
  matchTheme("col-start-", "gridColumnStart"),
  match("col-start-(auto|\\d+)", "gridColumnStart"),
  matchTheme("col-end-", "gridColumnEnd"),
  match("col-end-(auto|\\d+)", "gridColumnEnd"),
  // Grid Template Rows
  matchTheme("grid-rows-", "gridTemplateRows"),
  match("grid-rows-(\\d+)", "gridTemplateRows", gridTemplate),
  // Grid Row Start / End
  matchTheme("row-", "gridRow"),
  match("row-(span)-(\\d+)", "gridRow", span),
  matchTheme("row-start-", "gridRowStart"),
  match("row-start-(auto|\\d+)", "gridRowStart"),
  matchTheme("row-end-", "gridRowEnd"),
  match("row-end-(auto|\\d+)", "gridRowEnd"),
  // Grid Auto Flow
  match("grid-flow-((row|col)(-dense)?)", "gridAutoFlow", (match2) => spacify(columnify(match2))),
  match("grid-flow-(dense)", "gridAutoFlow"),
  // Grid Auto Columns
  matchTheme("auto-cols-", "gridAutoColumns"),
  // Grid Auto Rows
  matchTheme("auto-rows-", "gridAutoRows"),
  // Gap
  matchTheme("gap-x(?:$|-)", "gap", "columnGap"),
  matchTheme("gap-y(?:$|-)", "gap", "rowGap"),
  matchTheme("gap(?:$|-)", "gap"),
  /* BOX ALIGNMENT */
  // Justify Items
  // Justify Self
  "(justify-(?:items|self))-",
  // Justify Content
  match("justify-", "justifyContent", convertContentValue),
  // Align Content
  // Align Items
  // Align Self
  match("(content|items|self)-", (match2) => ({
    ["align-" + match2[1]]: convertContentValue(match2)
  })),
  // Place Content
  // Place Items
  // Place Self
  match("(place-(content|items|self))-", ({ 1: $1, $$ }) => ({
    [$1]: ("wun".includes($$[3]) ? "space-" : "") + $$
  })),
  /* SPACING */
  // Padding
  matchTheme("p([xytrbl])?(?:$|-)", "padding", edge("padding")),
  // Margin
  matchTheme("-?m([xytrbl])?(?:$|-)", "margin", edge("margin")),
  // Space Between
  matchTheme("-?space-(x|y)(?:$|-)", "space", ({ 1: $1, _: _5 }) => ({
    "&>:not([hidden])~:not([hidden])": {
      [`--tw-space-${$1}-reverse`]: "0",
      ["margin-" + {
        y: "top",
        x: "left"
      }[$1]]: `calc(${_5} * calc(1 - var(--tw-space-${$1}-reverse)))`,
      ["margin-" + {
        y: "bottom",
        x: "right"
      }[$1]]: `calc(${_5} * var(--tw-space-${$1}-reverse))`
    }
  })),
  match("space-(x|y)-reverse", ({ 1: $1 }) => ({
    "&>:not([hidden])~:not([hidden])": {
      [`--tw-space-${$1}-reverse`]: "1"
    }
  })),
  /* SIZING */
  // Width
  matchTheme("w-", "width"),
  // Min-Width
  matchTheme("min-w-", "minWidth"),
  // Max-Width
  matchTheme("max-w-", "maxWidth"),
  // Height
  matchTheme("h-", "height"),
  // Min-Height
  matchTheme("min-h-", "minHeight"),
  // Max-Height
  matchTheme("max-h-", "maxHeight"),
  /* TYPOGRAPHY */
  // Font Weight
  matchTheme("font-", "fontWeight"),
  // Font Family
  matchTheme("font-", "fontFamily", ({ _: _5 }) => {
    return "string" == typeof (_5 = asArray(_5))[1] ? {
      fontFamily: join(_5)
    } : {
      fontFamily: join(_5[0]),
      ..._5[1]
    };
  }),
  // Font Smoothing
  match("antialiased", {
    WebkitFontSmoothing: "antialiased",
    MozOsxFontSmoothing: "grayscale"
  }),
  match("subpixel-antialiased", {
    WebkitFontSmoothing: "auto",
    MozOsxFontSmoothing: "auto"
  }),
  // Font Style
  match("italic", "fontStyle"),
  match("not-italic", {
    fontStyle: "normal"
  }),
  // Font Variant Numeric
  match("(ordinal|slashed-zero|(normal|lining|oldstyle|proportional|tabular)-nums|(diagonal|stacked)-fractions)", ({ 1: $1, 2: $2 = "", 3: $3 }) => (
    // normal-nums
    "normal" == $2 ? {
      fontVariantNumeric: "normal"
    } : {
      ["--tw-" + ($3 ? (
        // diagonal-fractions, stacked-fractions
        "numeric-fraction"
      ) : "pt".includes($2[0]) ? (
        // proportional-nums, tabular-nums
        "numeric-spacing"
      ) : $2 ? (
        // lining-nums, oldstyle-nums
        "numeric-figure"
      ) : (
        // ordinal, slashed-zero
        $1
      ))]: $1,
      fontVariantNumeric: "var(--tw-ordinal) var(--tw-slashed-zero) var(--tw-numeric-figure) var(--tw-numeric-spacing) var(--tw-numeric-fraction)",
      ...asDefaults({
        "--tw-ordinal": "var(--tw-empty,/*!*/ /*!*/)",
        "--tw-slashed-zero": "var(--tw-empty,/*!*/ /*!*/)",
        "--tw-numeric-figure": "var(--tw-empty,/*!*/ /*!*/)",
        "--tw-numeric-spacing": "var(--tw-empty,/*!*/ /*!*/)",
        "--tw-numeric-fraction": "var(--tw-empty,/*!*/ /*!*/)"
      })
    }
  )),
  // Letter Spacing
  matchTheme("tracking-", "letterSpacing"),
  // Line Height
  matchTheme("leading-", "lineHeight"),
  // List Style Position
  match("list-(inside|outside)", "listStylePosition"),
  // List Style Type
  matchTheme("list-", "listStyleType"),
  match("list-", "listStyleType"),
  // Placeholder Opacity
  matchTheme("placeholder-opacity-", "placeholderOpacity", ({ _: _5 }) => ({
    "&::placeholder": {
      "--tw-placeholder-opacity": _5
    }
  })),
  // Placeholder Color
  matchColor("placeholder-", {
    property: "color",
    selector: "&::placeholder"
  }),
  // Text Alignment
  match("text-(left|center|right|justify|start|end)", "textAlign"),
  match("text-(ellipsis|clip)", "textOverflow"),
  // Text Opacity
  matchTheme("text-opacity-", "textOpacity", "--tw-text-opacity"),
  // Text Color
  matchColor("text-", {
    property: "color"
  }),
  // Font Size
  matchTheme("text-", "fontSize", ({ _: _5 }) => "string" == typeof _5 ? {
    fontSize: _5
  } : {
    fontSize: _5[0],
    ..."string" == typeof _5[1] ? {
      lineHeight: _5[1]
    } : _5[1]
  }),
  // Text Indent
  matchTheme("indent-", "textIndent"),
  // Text Decoration
  match("(overline|underline|line-through)", "textDecorationLine"),
  match("no-underline", {
    textDecorationLine: "none"
  }),
  // Text Underline offset
  matchTheme("underline-offset-", "textUnderlineOffset"),
  // Text Decoration Color
  matchColor("decoration-", {
    section: "textDecorationColor",
    opacityVariable: false,
    opacitySection: "opacity"
  }),
  // Text Decoration Thickness
  matchTheme("decoration-", "textDecorationThickness"),
  // Text Decoration Style
  match("decoration-", "textDecorationStyle"),
  // Text Transform
  match("(uppercase|lowercase|capitalize)", "textTransform"),
  match("normal-case", {
    textTransform: "none"
  }),
  // Text Overflow
  match("truncate", {
    overflow: "hidden",
    whiteSpace: "nowrap",
    textOverflow: "ellipsis"
  }),
  // Vertical Alignment
  match("align-", "verticalAlign"),
  // Whitespace
  match("whitespace-", "whiteSpace"),
  // Word Break
  match("break-normal", {
    wordBreak: "normal",
    overflowWrap: "normal"
  }),
  match("break-words", {
    overflowWrap: "break-word"
  }),
  match("break-all", {
    wordBreak: "break-all"
  }),
  match("break-keep", {
    wordBreak: "keep-all"
  }),
  // Caret Color
  matchColor("caret-", {
    // section: 'caretColor',
    opacityVariable: false,
    opacitySection: "opacity"
  }),
  // Accent Color
  matchColor("accent-", {
    // section: 'accentColor',
    opacityVariable: false,
    opacitySection: "opacity"
  }),
  // Gradient Color Stops
  match("bg-gradient-to-([trbl]|[tb][rl])", "backgroundImage", ({ 1: $1 }) => `linear-gradient(to ${position($1, " ")},var(--tw-gradient-stops))`),
  matchColor("from-", {
    section: "gradientColorStops",
    opacityVariable: false,
    opacitySection: "opacity"
  }, ({ _: _5 }) => ({
    "--tw-gradient-from": _5.value,
    "--tw-gradient-to": _5.color({
      opacityValue: "0"
    }),
    "--tw-gradient-stops": "var(--tw-gradient-from),var(--tw-gradient-to)"
  })),
  matchColor("via-", {
    section: "gradientColorStops",
    opacityVariable: false,
    opacitySection: "opacity"
  }, ({ _: _5 }) => ({
    "--tw-gradient-to": _5.color({
      opacityValue: "0"
    }),
    "--tw-gradient-stops": `var(--tw-gradient-from),${_5.value},var(--tw-gradient-to)`
  })),
  matchColor("to-", {
    section: "gradientColorStops",
    property: "--tw-gradient-to",
    opacityVariable: false,
    opacitySection: "opacity"
  }),
  /* BACKGROUNDS */
  // Background Attachment
  match("bg-(fixed|local|scroll)", "backgroundAttachment"),
  // Background Origin
  match("bg-origin-(border|padding|content)", "backgroundOrigin", ({ 1: $1 }) => $1 + "-box"),
  // Background Repeat
  match([
    "bg-(no-repeat|repeat(-[xy])?)",
    "bg-repeat-(round|space)"
  ], "backgroundRepeat"),
  // Background Blend Mode
  match("bg-blend-", "backgroundBlendMode"),
  // Background Clip
  match("bg-clip-(border|padding|content|text)", "backgroundClip", ({ 1: $1 }) => $1 + ("text" == $1 ? "" : "-box")),
  // Background Opacity
  matchTheme("bg-opacity-", "backgroundOpacity", "--tw-bg-opacity"),
  // Background Color
  // bg-${backgroundColor}/${backgroundOpacity}
  matchColor("bg-", {
    section: "backgroundColor"
  }),
  // Background Image
  // supported arbitrary types are: length, color, angle, list
  matchTheme("bg-", "backgroundImage"),
  // Background Position
  matchTheme("bg-", "backgroundPosition"),
  match("bg-(top|bottom|center|(left|right)(-(top|bottom))?)", "backgroundPosition", spacify),
  // Background Size
  matchTheme("bg-", "backgroundSize"),
  /* BORDERS */
  // Border Radius
  matchTheme("rounded(?:$|-)", "borderRadius"),
  matchTheme("rounded-([trbl]|[tb][rl])(?:$|-)", "borderRadius", ({ 1: $1, _: _5 }) => {
    let corners = {
      t: [
        "tl",
        "tr"
      ],
      r: [
        "tr",
        "br"
      ],
      b: [
        "bl",
        "br"
      ],
      l: [
        "bl",
        "tl"
      ]
    }[$1] || [
      $1,
      $1
    ];
    return {
      [`border-${position(corners[0])}-radius`]: _5,
      [`border-${position(corners[1])}-radius`]: _5
    };
  }),
  // Border Collapse
  match("border-(collapse|separate)", "borderCollapse"),
  // Border Opacity
  matchTheme("border-opacity(?:$|-)", "borderOpacity", "--tw-border-opacity"),
  // Border Style
  match("border-(solid|dashed|dotted|double|none)", "borderStyle"),
  // Border Spacing
  matchTheme("border-spacing(-[xy])?(?:$|-)", "borderSpacing", ({ 1: $1, _: _5 }) => ({
    ...asDefaults({
      "--tw-border-spacing-x": "0",
      "--tw-border-spacing-y": "0"
    }),
    ["--tw-border-spacing" + ($1 || "-x")]: _5,
    ["--tw-border-spacing" + ($1 || "-y")]: _5,
    "border-spacing": "var(--tw-border-spacing-x) var(--tw-border-spacing-y)"
  })),
  // Border Color
  matchColor("border-([xytrbl])-", {
    section: "borderColor"
  }, edge("border", "Color")),
  matchColor("border-"),
  // Border Width
  matchTheme("border-([xytrbl])(?:$|-)", "borderWidth", edge("border", "Width")),
  matchTheme("border(?:$|-)", "borderWidth"),
  // Divide Opacity
  matchTheme("divide-opacity(?:$|-)", "divideOpacity", ({ _: _5 }) => ({
    "&>:not([hidden])~:not([hidden])": {
      "--tw-divide-opacity": _5
    }
  })),
  // Divide Style
  match("divide-(solid|dashed|dotted|double|none)", ({ 1: $1 }) => ({
    "&>:not([hidden])~:not([hidden])": {
      borderStyle: $1
    }
  })),
  // Divide Width
  match("divide-([xy]-reverse)", ({ 1: $1 }) => ({
    "&>:not([hidden])~:not([hidden])": {
      ["--tw-divide-" + $1]: "1"
    }
  })),
  matchTheme("divide-([xy])(?:$|-)", "divideWidth", ({ 1: $1, _: _5 }) => {
    let edges = {
      x: "lr",
      y: "tb"
    }[$1];
    return {
      "&>:not([hidden])~:not([hidden])": {
        [`--tw-divide-${$1}-reverse`]: "0",
        [`border-${position(edges[0])}Width`]: `calc(${_5} * calc(1 - var(--tw-divide-${$1}-reverse)))`,
        [`border-${position(edges[1])}Width`]: `calc(${_5} * var(--tw-divide-${$1}-reverse))`
      }
    };
  }),
  // Divide Color
  matchColor("divide-", {
    // section: $0.replace('-', 'Color') -> 'divideColor'
    property: "borderColor",
    // opacityVariable: '--tw-border-opacity',
    // opacitySection: section.replace('Color', 'Opacity') -> 'divideOpacity'
    selector: "&>:not([hidden])~:not([hidden])"
  }),
  // Ring Offset Opacity
  matchTheme("ring-opacity(?:$|-)", "ringOpacity", "--tw-ring-opacity"),
  // Ring Offset Color
  matchColor("ring-offset-", {
    // section: 'ringOffsetColor',
    property: "--tw-ring-offset-color",
    opacityVariable: false
  }),
  // opacitySection: section.replace('Color', 'Opacity') -> 'ringOffsetOpacity'
  // Ring Offset Width
  matchTheme("ring-offset(?:$|-)", "ringOffsetWidth", "--tw-ring-offset-width"),
  // Ring Inset
  match("ring-inset", {
    "--tw-ring-inset": "inset"
  }),
  // Ring Color
  matchColor("ring-", {
    // section: 'ringColor',
    property: "--tw-ring-color"
  }),
  // opacityVariable: '--tw-ring-opacity',
  // opacitySection: section.replace('Color', 'Opacity') -> 'ringOpacity'
  // Ring Width
  matchTheme("ring(?:$|-)", "ringWidth", ({ _: _5 }, { theme: theme3 }) => ({
    ...asDefaults({
      "--tw-ring-offset-shadow": "0 0 #0000",
      "--tw-ring-shadow": "0 0 #0000",
      "--tw-shadow": "0 0 #0000",
      "--tw-shadow-colored": "0 0 #0000",
      // Within own declaration to have the defaults above to be merged with defaults from shadow
      "&": {
        "--tw-ring-inset": "var(--tw-empty,/*!*/ /*!*/)",
        "--tw-ring-offset-width": theme3("ringOffsetWidth", "", "0px"),
        "--tw-ring-offset-color": toColorValue(theme3("ringOffsetColor", "", "#fff")),
        "--tw-ring-color": toColorValue(theme3("ringColor", "", "#93c5fd"), {
          opacityVariable: "--tw-ring-opacity"
        }),
        "--tw-ring-opacity": theme3("ringOpacity", "", "0.5")
      }
    }),
    "--tw-ring-offset-shadow": "var(--tw-ring-inset) 0 0 0 var(--tw-ring-offset-width) var(--tw-ring-offset-color)",
    "--tw-ring-shadow": `var(--tw-ring-inset) 0 0 0 calc(${_5} + var(--tw-ring-offset-width)) var(--tw-ring-color)`,
    boxShadow: "var(--tw-ring-offset-shadow),var(--tw-ring-shadow),var(--tw-shadow)"
  })),
  /* EFFECTS */
  // Box Shadow Color
  matchColor("shadow-", {
    section: "boxShadowColor",
    opacityVariable: false,
    opacitySection: "opacity"
  }, ({ _: _5 }) => ({
    "--tw-shadow-color": _5.value,
    "--tw-shadow": "var(--tw-shadow-colored)"
  })),
  // Box Shadow
  matchTheme("shadow(?:$|-)", "boxShadow", ({ _: _5 }) => ({
    ...asDefaults({
      "--tw-ring-offset-shadow": "0 0 #0000",
      "--tw-ring-shadow": "0 0 #0000",
      "--tw-shadow": "0 0 #0000",
      "--tw-shadow-colored": "0 0 #0000"
    }),
    "--tw-shadow": join(_5),
    // replace all colors with reference to --tw-shadow-colored
    // this matches colors after non-comma char (keyword, offset) before comma or the end
    "--tw-shadow-colored": join(_5).replace(/([^,]\s+)(?:#[a-f\d]+|(?:(?:hsl|rgb)a?|hwb|lab|lch|color|var)\(.+?\)|[a-z]+)(,|$)/g, "$1var(--tw-shadow-color)$2"),
    boxShadow: "var(--tw-ring-offset-shadow),var(--tw-ring-shadow),var(--tw-shadow)"
  })),
  // Opacity
  matchTheme("(opacity)-"),
  /*, 'opacity' */
  // Mix Blend Mode
  match("mix-blend-", "mixBlendMode"),
  /* FILTERS */
  ...filter(),
  ...filter("backdrop-"),
  /* TRANSITIONS AND ANIMATION */
  // Transition Property
  matchTheme("transition(?:$|-)", "transitionProperty", (match2, { theme: theme3 }) => ({
    transitionProperty: join(match2),
    transitionTimingFunction: "none" == match2._ ? void 0 : join(theme3("transitionTimingFunction", "")),
    transitionDuration: "none" == match2._ ? void 0 : join(theme3("transitionDuration", ""))
  })),
  // Transition Duration
  matchTheme("duration(?:$|-)", "transitionDuration", "transitionDuration", join),
  // Transition Timing Function
  matchTheme("ease(?:$|-)", "transitionTimingFunction", "transitionTimingFunction", join),
  // Transition Delay
  matchTheme("delay(?:$|-)", "transitionDelay", "transitionDelay", join),
  matchTheme("animate(?:$|-)", "animation", (match2, { theme: theme3, h: h5, e: e5 }) => {
    let animation = join(match2), parts = animation.split(" "), keyframeValues = theme3("keyframes", parts[0]);
    return keyframeValues ? {
      ["@keyframes " + (parts[0] = e5(h5(parts[0])))]: keyframeValues,
      animation: parts.join(" ")
    } : {
      animation
    };
  }),
  /* TRANSFORMS */
  // Transform
  "(transform)-(none)",
  match("transform", tranformDefaults),
  match("transform-(cpu|gpu)", ({ 1: $1 }) => ({
    "--tw-transform": transformValue("gpu" == $1)
  })),
  // Scale
  matchTheme("scale(-[xy])?-", "scale", ({ 1: $1, _: _5 }) => ({
    ["--tw-scale" + ($1 || "-x")]: _5,
    ["--tw-scale" + ($1 || "-y")]: _5,
    ...tranformDefaults()
  })),
  // Rotate
  matchTheme("-?(rotate)-", "rotate", transform),
  // Translate
  matchTheme("-?(translate-[xy])-", "translate", transform),
  // Skew
  matchTheme("-?(skew-[xy])-", "skew", transform),
  // Transform Origin
  match("origin-(center|((top|bottom)(-(left|right))?)|left|right)", "transformOrigin", spacify),
  /* INTERACTIVITY */
  // Appearance
  "(appearance)-",
  // Columns
  matchTheme("(columns)-"),
  /*, 'columns' */
  "(columns)-(\\d+)",
  // Break Before, After and Inside
  "(break-(?:before|after|inside))-",
  // Cursor
  matchTheme("(cursor)-"),
  /*, 'cursor' */
  "(cursor)-",
  // Scroll Snap Type
  match("snap-(none)", "scroll-snap-type"),
  match("snap-(x|y|both)", ({ 1: $1 }) => ({
    ...asDefaults({
      "--tw-scroll-snap-strictness": "proximity"
    }),
    "scroll-snap-type": $1 + " var(--tw-scroll-snap-strictness)"
  })),
  match("snap-(mandatory|proximity)", "--tw-scroll-snap-strictness"),
  // Scroll Snap Align
  match("snap-(?:(start|end|center)|align-(none))", "scroll-snap-align"),
  // Scroll Snap Stop
  match("snap-(normal|always)", "scroll-snap-stop"),
  match("scroll-(auto|smooth)", "scroll-behavior"),
  // Scroll Margin
  // Padding
  matchTheme("scroll-p([xytrbl])?(?:$|-)", "padding", edge("scroll-padding")),
  // Margin
  matchTheme("-?scroll-m([xytrbl])?(?:$|-)", "scroll-margin", edge("scroll-margin")),
  // Touch Action
  match("touch-(auto|none|manipulation)", "touch-action"),
  match("touch-(pinch-zoom|pan-(?:(x|left|right)|(y|up|down)))", ({ 1: $1, 2: $2, 3: $3 }) => ({
    ...asDefaults({
      "--tw-pan-x": "var(--tw-empty,/*!*/ /*!*/)",
      "--tw-pan-y": "var(--tw-empty,/*!*/ /*!*/)",
      "--tw-pinch-zoom": "var(--tw-empty,/*!*/ /*!*/)",
      "--tw-touch-action": "var(--tw-pan-x) var(--tw-pan-y) var(--tw-pinch-zoom)"
    }),
    // x, left, right -> pan-x
    // y, up, down -> pan-y
    // -> pinch-zoom
    [`--tw-${$2 ? "pan-x" : $3 ? "pan-y" : $1}`]: $1,
    "touch-action": "var(--tw-touch-action)"
  })),
  // Outline Style
  match("outline-none", {
    outline: "2px solid transparent",
    "outline-offset": "2px"
  }),
  match("outline", {
    outlineStyle: "solid"
  }),
  match("outline-(dashed|dotted|double)", "outlineStyle"),
  // Outline Offset
  matchTheme("-?(outline-offset)-"),
  /*, 'outlineOffset'*/
  // Outline Color
  matchColor("outline-", {
    opacityVariable: false,
    opacitySection: "opacity"
  }),
  // Outline Width
  matchTheme("outline-", "outlineWidth"),
  // Pointer Events
  "(pointer-events)-",
  // Will Change
  matchTheme("(will-change)-"),
  /*, 'willChange' */
  "(will-change)-",
  // Resize
  [
    "resize(?:-(none|x|y))?",
    "resize",
    ({ 1: $1 }) => ({
      x: "horizontal",
      y: "vertical"
    })[$1] || $1 || "both"
  ],
  // User Select
  match("select-(none|text|all|auto)", "userSelect"),
  /* SVG */
  // Fill, Stroke
  matchColor("fill-", {
    section: "fill",
    opacityVariable: false,
    opacitySection: "opacity"
  }),
  matchColor("stroke-", {
    section: "stroke",
    opacityVariable: false,
    opacitySection: "opacity"
  }),
  // Stroke Width
  matchTheme("stroke-", "strokeWidth"),
  /* ACCESSIBILITY */
  // Screen Readers
  match("sr-only", {
    position: "absolute",
    width: "1px",
    height: "1px",
    padding: "0",
    margin: "-1px",
    overflow: "hidden",
    whiteSpace: "nowrap",
    clip: "rect(0,0,0,0)",
    borderWidth: "0"
  }),
  match("not-sr-only", {
    position: "static",
    width: "auto",
    height: "auto",
    padding: "0",
    margin: "0",
    overflow: "visible",
    whiteSpace: "normal",
    clip: "auto"
  })
];
function spacify(value) {
  return ("string" == typeof value ? value : value[1]).replace(/-/g, " ").trim();
}
function columnify(value) {
  return ("string" == typeof value ? value : value[1]).replace("col", "column");
}
function position(shorthand, separator = "-") {
  let longhand = [];
  for (let short of shorthand) longhand.push({
    t: "top",
    r: "right",
    b: "bottom",
    l: "left"
  }[short]);
  return longhand.join(separator);
}
function join(value) {
  return value && "" + (value._ || value);
}
function convertContentValue({ $$ }) {
  return ({
    // /* aut*/ o: '',
    /* sta*/
    r: (
      /*t*/
      "flex-"
    ),
    /* end*/
    "": "flex-",
    // /* cen*/ t /*er*/: '',
    /* bet*/
    w: (
      /*een*/
      "space-"
    ),
    /* aro*/
    u: (
      /*nd*/
      "space-"
    ),
    /* eve*/
    n: (
      /*ly*/
      "space-"
    )
  }[$$[3] || ""] || "") + $$;
}
function edge(propertyPrefix, propertySuffix = "") {
  return ({ 1: $1, _: _5 }) => {
    let edges = {
      x: "lr",
      y: "tb"
    }[$1] || $1 + $1;
    return edges ? {
      ...toCSS(propertyPrefix + "-" + position(edges[0]) + propertySuffix, _5),
      ...toCSS(propertyPrefix + "-" + position(edges[1]) + propertySuffix, _5)
    } : toCSS(propertyPrefix + propertySuffix, _5);
  };
}
function filter(prefix = "") {
  let filters = [
    "blur",
    "brightness",
    "contrast",
    "grayscale",
    "hue-rotate",
    "invert",
    prefix && "opacity",
    "saturate",
    "sepia",
    !prefix && "drop-shadow"
  ].filter(Boolean), defaults = {};
  for (let key of filters) defaults[`--tw-${prefix}${key}`] = "var(--tw-empty,/*!*/ /*!*/)";
  return defaults = {
    // move defaults
    ...asDefaults(defaults),
    // add default filter which allows standalone usage
    [`${prefix}filter`]: filters.map((key) => `var(--tw-${prefix}${key})`).join(" ")
  }, [
    `(${prefix}filter)-(none)`,
    match(`${prefix}filter`, defaults),
    ...filters.map((key) => matchTheme(
      // hue-rotate can be negated
      `${"h" == key[0] ? "-?" : ""}(${prefix}${key})(?:$|-)`,
      key,
      ({ 1: $1, _: _5 }) => ({
        [`--tw-${$1}`]: asArray(_5).map((value) => `${key}(${value})`).join(" "),
        ...defaults
      })
    ))
  ];
}
function transform({ 1: $1, _: _5 }) {
  return {
    ["--tw-" + $1]: _5,
    ...tranformDefaults()
  };
}
function tranformDefaults() {
  return {
    ...asDefaults({
      "--tw-translate-x": "0",
      "--tw-translate-y": "0",
      "--tw-rotate": "0",
      "--tw-skew-x": "0",
      "--tw-skew-y": "0",
      "--tw-scale-x": "1",
      "--tw-scale-y": "1",
      "--tw-transform": transformValue()
    }),
    transform: "var(--tw-transform)"
  };
}
function transformValue(gpu) {
  return [
    gpu ? (
      // -gpu
      "translate3d(var(--tw-translate-x),var(--tw-translate-y),0)"
    ) : "translateX(var(--tw-translate-x)) translateY(var(--tw-translate-y))",
    "rotate(var(--tw-rotate))",
    "skewX(var(--tw-skew-x))",
    "skewY(var(--tw-skew-y))",
    "scaleX(var(--tw-scale-x))",
    "scaleY(var(--tw-scale-y))"
  ].join(" ");
}
function span({ 1: $1, 2: $2 }) {
  return `${$1} ${$2} / ${$1} ${$2}`;
}
function gridTemplate({ 1: $1 }) {
  return `repeat(${$1},minmax(0,1fr))`;
}
function asDefaults(props) {
  return {
    "@layer defaults": {
      "*,::before,::after": props,
      "::backdrop": props
    }
  };
}

// node_modules/@creit.tech/stellar-wallets-kit/node_modules/@twind/preset-tailwind/variants.js
var variants = [
  [
    "sticky",
    "@supports ((position: -webkit-sticky) or (position:sticky))"
  ],
  [
    "motion-reduce",
    "@media (prefers-reduced-motion:reduce)"
  ],
  [
    "motion-safe",
    "@media (prefers-reduced-motion:no-preference)"
  ],
  [
    "print",
    "@media print"
  ],
  [
    "(portrait|landscape)",
    ({ 1: $1 }) => `@media (orientation:${$1})`
  ],
  [
    "contrast-(more|less)",
    ({ 1: $1 }) => `@media (prefers-contrast:${$1})`
  ],
  [
    "(first-(letter|line)|placeholder|backdrop|before|after)",
    ({ 1: $1 }) => `&::${$1}`
  ],
  [
    "(marker|selection)",
    ({ 1: $1 }) => `& *::${$1},&::${$1}`
  ],
  [
    "file",
    "&::file-selector-button"
  ],
  [
    "(first|last|only)",
    ({ 1: $1 }) => `&:${$1}-child`
  ],
  [
    "even",
    "&:nth-child(2n)"
  ],
  [
    "odd",
    "&:nth-child(odd)"
  ],
  [
    "open",
    "&[open]"
  ],
  // All other pseudo classes are already supported by twind
  [
    "(aria|data)-",
    ({
      1: $1,
      /* aria or data */
      $$
    }, context2) => $$ && `&[${$1}-${// aria-asc or data-checked -> from theme
    context2.theme($1, $$) || // aria-[...] or data-[...]
    arbitrary($$, "", context2) || // default handling
    `${$$}="true"`}]`
  ],
  /* Styling based on parent and peer state */
  // Groups classes like: group-focus and group-hover
  // these need to add a marker selector with the pseudo class
  // => '.group:focus .group-focus:selector'
  [
    "((group|peer)(~[^-[]+)?)(-\\[(.+)]|[-[].+?)(\\/.+)?",
    ({ 2: type, 3: name = "", 4: $4, 5: $5 = "", 6: label = name }, { e: e5, h: h5, v: v4 }) => {
      let selector = normalize($5) || ("[" == $4[0] ? $4 : v4($4.slice(1)));
      return `${(selector.includes("&") ? selector : "&" + selector).replace(/&/g, `:merge(.${e5(h5(type + label))})`)}${"p" == type[0] ? "~" : " "}&`;
    }
  ],
  // direction variants
  [
    "(ltr|rtl)",
    ({ 1: $1 }) => `[dir="${$1}"] &`
  ],
  [
    "supports-",
    ({ $$ }, context2) => {
      $$ && ($$ = context2.theme("supports", $$) || arbitrary($$, "", context2));
      if ($$) return $$.includes(":") || ($$ += ":var(--tw)"), /^\w*\s*\(/.test($$) || ($$ = `(${$$})`), // Chrome has a bug where `(condtion1)or(condition2)` is not valid
      // But `(condition1) or (condition2)` is supported.
      `@supports ${$$.replace(/\b(and|or|not)\b/g, " $1 ").trim()}`;
    }
  ],
  [
    "max-",
    ({ $$ }, context2) => {
      $$ && ($$ = context2.theme("screens", $$) || arbitrary($$, "", context2));
      if ("string" == typeof $$) return `@media not all and (min-width:${$$})`;
    }
  ],
  [
    "min-",
    ({ $$ }, context2) => {
      return $$ && ($$ = arbitrary($$, "", context2)), $$ && `@media (min-width:${$$})`;
    }
  ],
  // Arbitrary variants
  [
    /^\[(.+)]$/,
    ({ 1: $1 }) => /[&@]/.test($1) && normalize($1).replace(/[}]+$/, "").split("{")
  ]
];

// node_modules/@creit.tech/stellar-wallets-kit/node_modules/@twind/preset-tailwind/base.js
function presetTailwindBase({ colors, disablePreflight } = {}) {
  return {
    // allow other preflight to run
    preflight: disablePreflight ? void 0 : preflight,
    theme: {
      ...theme2,
      colors: {
        inherit: "inherit",
        current: "currentColor",
        transparent: "transparent",
        black: "#000",
        white: "#fff",
        ...colors
      }
    },
    variants,
    rules,
    finalize(rule) {
      return (
        // automatically add `content: ''` to before and after so you don’t have to specify it unless you want a different value
        // ignore global, preflight, and auto added rules
        rule.n && // only if there are declarations
        rule.d && // and it has a ::before or ::after selector
        rule.r.some((r7) => /^&::(before|after)$/.test(r7)) && // there is no content property yet
        !/(^|;)content:/.test(rule.d) ? {
          ...rule,
          d: "content:var(--tw-content);" + rule.d
        } : rule
      );
    }
  };
}

// node_modules/@creit.tech/stellar-wallets-kit/esm/components/twind.js
var config = defineConfig({
  preflight: false,
  hash: true,
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        "background": "var(--swk-background)",
        "background-secondary": "var(--swk-background-secondary)",
        "foreground-strong": "var(--swk-foreground-strong)",
        "foreground": "var(--swk-foreground)",
        "foreground-secondary": "var(--swk-foreground-secondary)",
        "primary": "var(--swk-primary)",
        "primary-foreground": "var(--swk-primary-foreground)",
        "transparent": "var(--swk-transparent)",
        "lighter": "var(--swk-lighter)",
        "light": "var(--swk-light)",
        "light-gray": "var(--swk-light-gray)",
        "gray": "var(--swk-gray)",
        "danger": "var(--swk-danger)",
        "border": "var(--swk-border)"
      },
      boxShadow: {
        default: "0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -4px rgba(0, 0, 0, 0.1)"
      },
      borderRadius: {
        default: "var(--swk-border-radius)"
      },
      fontFamily: {
        default: "var(--swk-font-family)"
      }
    }
  },
  presets: [presetAutoprefix(), presetTailwindBase({ disablePreflight: true })]
});
var _tw = twind(config, typeof document === "undefined" ? virtual() : cssom("style[data-library]"));
var tw2 = (text) => _tw(`!(${text})`);
var tx2 = tx.bind(_tw);
var injectGlobal2 = injectGlobal.bind(_tw);
var keyframes2 = keyframes.bind(_tw);
var reset = css`
  .stellar-wallets-kit *,
  .stellar-wallets-kit ::after,
  .stellar-wallets-kit ::before,
  .stellar-wallets-kit ::backdrop,
  .stellar-wallets-kit ::file-selector-button {
    box-sizing: border-box;
    margin: 0;
    padding: 0;
    border: 0 solid;
  }
  .stellar-wallets-kit :host {
    line-height: 1.5;
    -webkit-text-size-adjust: 100%;
    tab-size: 4;
    font-family:
      ui-sans-serif, system-ui, sans-serif, "Apple Color Emoji", "Segoe UI Emoji", "Segoe UI Symbol",
      "Noto Color Emoji";
    font-feature-settings: normal;
    font-variation-settings: normal;
    -webkit-tap-highlight-color: transparent;
  }
  .stellar-wallets-kit hr {
    height: 0;
    color: inherit;
    border-top-width: 1px;
  }
  .stellar-wallets-kit abbr:where([title]) {
    -webkit-text-decoration: underline dotted;
    text-decoration: underline dotted;
  }
  .stellar-wallets-kit h1,
  .stellar-wallets-kit h2,
  .stellar-wallets-kit h3,
  .stellar-wallets-kit h4,
  .stellar-wallets-kit h5,
  .stellar-wallets-kit h6 {
    font-size: inherit;
    font-weight: inherit;
  }
  .stellar-wallets-kit a {
    color: inherit;
    -webkit-text-decoration: inherit;
    text-decoration: inherit;
  }
  .stellar-wallets-kit b,
  .stellar-wallets-kit strong {
    font-weight: bolder;
  }
  .stellar-wallets-kit code,
  .stellar-wallets-kit kbd,
  .stellar-wallets-kit samp,
  .stellar-wallets-kit pre {
    font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace;
    font-feature-settings: normal;
    font-variation-settings: normal;
    font-size: 1em;
  }
  .stellar-wallets-kit small {
    font-size: 80%;
  }
  .stellar-wallets-kit sub,
  .stellar-wallets-kit sup {
    font-size: 75%;
    line-height: 0;
    position: relative;
    vertical-align: baseline;
  }
  .stellar-wallets-kit sub {
    bottom: -0.25em;
  }
  .stellar-wallets-kit sup {
    top: -0.5em;
  }
  .stellar-wallets-kit table {
    text-indent: 0;
    border-color: inherit;
    border-collapse: collapse;
  }
  .stellar-wallets-kit :-moz-focusring {
    outline: auto;
  }
  .stellar-wallets-kit progress {
    vertical-align: baseline;
  }
  .stellar-wallets-kit summary {
    display: list-item;
  }
  .stellar-wallets-kit ol,
  .stellar-wallets-kit ul,
  .stellar-wallets-kit menu {
    list-style: none;
  }
  .stellar-wallets-kit img,
  .stellar-wallets-kit svg,
  .stellar-wallets-kit video,
  .stellar-wallets-kit canvas,
  .stellar-wallets-kit audio,
  .stellar-wallets-kit iframe,
  .stellar-wallets-kit embed,
  .stellar-wallets-kit object {
    display: block;
    vertical-align: middle;
  }
  .stellar-wallets-kit img,
  .stellar-wallets-kit video {
    max-width: 100%;
    height: auto;
  }
  .stellar-wallets-kit button,
  .stellar-wallets-kit input,
  .stellar-wallets-kit select,
  .stellar-wallets-kit optgroup,
  .stellar-wallets-kit textarea,
  .stellar-wallets-kit ::file-selector-button {
    font: inherit;
    font-feature-settings: inherit;
    font-variation-settings: inherit;
    letter-spacing: inherit;
    color: inherit;
    border-radius: 0;
    background-color: transparent;
    opacity: 1;
  }
  .stellar-wallets-kit :where(select:is([multiple], [size])) optgroup {
    font-weight: bolder;
  }
  .stellar-wallets-kit :where(select:is([multiple], [size])) optgroup option {
    padding-inline-start: 20px;
  }
  .stellar-wallets-kit ::file-selector-button {
    margin-inline-end: 4px;
  }
  .stellar-wallets-kit ::placeholder {
    opacity: 1;
  }
  .stellar-wallets-kit textarea {
    resize: vertical;
  }
  .stellar-wallets-kit ::-webkit-search-decoration {
    -webkit-appearance: none;
  }
  .stellar-wallets-kit ::-webkit-date-and-time-value {
    min-height: 1lh;
    text-align: inherit;
  }
  .stellar-wallets-kit ::-webkit-datetime-edit {
    display: inline-flex;
  }
  .stellar-wallets-kit ::-webkit-datetime-edit-fields-wrapper {
    padding: 0;
  }
  .stellar-wallets-kit ::-webkit-datetime-edit,
  .stellar-wallets-kit ::-webkit-datetime-edit-year-field,
  .stellar-wallets-kit ::-webkit-datetime-edit-month-field,
  .stellar-wallets-kit ::-webkit-datetime-edit-day-field,
  .stellar-wallets-kit ::-webkit-datetime-edit-hour-field,
  .stellar-wallets-kit ::-webkit-datetime-edit-minute-field,
  .stellar-wallets-kit ::-webkit-datetime-edit-second-field,
  .stellar-wallets-kit ::-webkit-datetime-edit-millisecond-field,
  .stellar-wallets-kit ::-webkit-datetime-edit-meridiem-field {
    padding-block: 0;
  }
  .stellar-wallets-kit ::-webkit-calendar-picker-indicator {
    line-height: 1;
  }
  .stellar-wallets-kit :-moz-ui-invalid {
    box-shadow: none;
  }
  .stellar-wallets-kit button,
  .stellar-wallets-kit input:where([type="button"], [type="reset"], [type="submit"]),
  .stellar-wallets-kit ::file-selector-button {
    appearance: button;
  }
  .stellar-wallets-kit ::-webkit-inner-spin-button,
  .stellar-wallets-kit ::-webkit-outer-spin-button {
    height: auto;
  }
  .stellar-wallets-kit [hidden]:where(:not([hidden="until-found"])) {
    display: none !important;
  }
`;

// node_modules/@creit.tech/stellar-wallets-kit/esm/components/shared/button.js
var ButtonSize;
(function(ButtonSize2) {
  ButtonSize2["xs"] = "xs";
  ButtonSize2["sm"] = "sm";
  ButtonSize2["md"] = "md";
  ButtonSize2["lg"] = "lg";
  ButtonSize2["xl"] = "xl";
})(ButtonSize || (ButtonSize = {}));
var ButtonMode;
(function(ButtonMode2) {
  ButtonMode2["primary"] = "primary";
  ButtonMode2["secondary"] = "secondary";
  ButtonMode2["ghost"] = "ghost";
  ButtonMode2["free"] = "free";
})(ButtonMode || (ButtonMode = {}));
var ButtonShape;
(function(ButtonShape2) {
  ButtonShape2["regular"] = "regular";
  ButtonShape2["icon"] = "icon";
})(ButtonShape || (ButtonShape = {}));
var defaultClasses = "flex items-center justify-center font-semibold easy-in-out transition leading-none";
function Button({ size = ButtonSize.md, mode: mode2 = ButtonMode.primary, shape = ButtonShape.regular, classes, styles, children, onClick }) {
  const modeStyle = cx({
    "border-none bg-primary text-primary-foreground shadow-default hover:opacity-70 focus:opacity-90": mode2 === ButtonMode.primary,
    "border-none bg-background text-foreground shadow-default hover:opacity-70 focus:opacity-90": mode2 === ButtonMode.secondary,
    "bg-transparent text-foreground border-transparent border-1 hover:border-light-gray": mode2 === ButtonMode.ghost
  });
  const radius = cx({
    "rounded-default": shape === ButtonShape.regular,
    "rounded-full": shape === ButtonShape.icon
  });
  const sizeStyle = cx({
    "text-xs": size === ButtonSize.xs,
    "text-sm": size !== ButtonSize.xs
  });
  const padding6 = cx({
    "px-2 py-1": shape === ButtonShape.regular && (size === ButtonSize.xs || size === ButtonSize.sm),
    "px-2.5 py-1.5": shape === ButtonShape.regular && size === ButtonSize.md,
    "px-3 py-2": shape === ButtonShape.regular && size === ButtonSize.lg,
    "px-3.5 py-2.5": shape === ButtonShape.regular && size === ButtonSize.xl,
    "p-1": shape === ButtonShape.icon && size === ButtonSize.xs,
    "p-1.5": shape === ButtonShape.icon && size === ButtonSize.sm,
    "p-2": shape === ButtonShape.icon && size === ButtonSize.md,
    "p-2.5": shape === ButtonShape.icon && size === ButtonSize.lg,
    "p-3": shape === ButtonShape.icon && size === ButtonSize.xl
  });
  const theme3 = mode2 === ButtonMode.free ? "" : tw2(cx("cursor-pointer", defaultClasses, modeStyle, radius, sizeStyle, padding6));
  return m4`
    <button onClick="${() => onClick()}" type="button" style="${styles}" class="${theme3} ${classes}">
      ${children}
    </button>
  `;
}

// node_modules/@creit.tech/stellar-wallets-kit/esm/components/router.js
function resetHistory() {
  routerHistory.value = [];
}
function navigateTo(nextRoute) {
  route.value = nextRoute;
  routerHistory.value = [...routerHistory.value, nextRoute];
}
function goBack() {
  const currentHistory = routerHistory.value;
  currentHistory.pop();
  routerHistory.value = currentHistory.slice();
  route.value = currentHistory[currentHistory.length - 1];
}
function PageTransition({ children, isActive, duration = 300 }) {
  const [visible, setVisible] = d2(isActive);
  const [shouldRender, setShouldRender] = d2(isActive);
  y2(() => {
    if (isActive) {
      setShouldRender(true);
      globalThis.requestAnimationFrame(() => setVisible(true));
    } else {
      setVisible(false);
      const timer2 = globalThis.setTimeout(() => setShouldRender(false), duration);
      return () => globalThis.clearTimeout(timer2);
    }
  }, [isActive, duration]);
  if (!shouldRender)
    return null;
  const styles = {
    position: visible ? "relative" : "absolute",
    inset: 0,
    transition: `opacity ${duration}ms ease, transform ${duration}ms ease, position ${duration}ms ease`,
    opacity: visible ? 1 : 0
  };
  return m4`<div style=${styles}>${children}</div>`;
}
function MultiPageAnimator({ currentRoute, pages: pages2, duration = 300 }) {
  const entries = Object.entries(pages2).map(([key, Component]) => m4`
      <${PageTransition} id=${key} key=${key} isActive=${currentRoute === key} duration=${duration}>
        <${Component} />
      <//>
    `);
  return m4`<div style=${{ position: "relative", width: "100%", height: "100%" }}>${entries}</div>`;
}

// node_modules/@creit.tech/stellar-wallets-kit/esm/components/shared/header.js
function openHelpPage() {
  navigateTo(SwkAppRoute.HELP_PAGE);
}
function back() {
  goBack();
}
var leftButtonComponent = g2(() => {
  if (route.value !== SwkAppRoute.AUTH_OPTIONS) {
    if (routerHistory.value.length < 2)
      return m4``;
    return m4`
      <${Button} onClick=${() => back()}
                 size="${ButtonSize.md}"
                 mode="${ButtonMode.ghost}"
                 shape="${ButtonShape.icon}">
        
        <svg class="${tw2("w-4 h-4")}" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor"><path d="M7.82843 10.9999H20V12.9999H7.82843L13.1924 18.3638L11.7782 19.778L4 11.9999L11.7782 4.22168L13.1924 5.63589L7.82843 10.9999Z"></path></svg>
      <//>
    `;
  } else {
    return m4`
      <${Button} onClick=${() => openHelpPage()}
                 size="${ButtonSize.md}"
                 mode="${ButtonMode.ghost}"
                 shape="${ButtonShape.icon}">
        <svg class="${tw2("w-4 h-4")}" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor"><path d="M12 22C6.47715 22 2 17.5228 2 12C2 6.47715 6.47715 2 12 2C17.5228 2 22 6.47715 22 12C22 17.5228 17.5228 22 12 22ZM12 20C16.4183 20 20 16.4183 20 12C20 7.58172 16.4183 4 12 4C7.58172 4 4 7.58172 4 12C4 16.4183 7.58172 20 12 20ZM11 15H13V17H11V15ZM13 13.3551V14H11V12.5C11 11.9477 11.4477 11.5 12 11.5C12.8284 11.5 13.5 10.8284 13.5 10C13.5 9.17157 12.8284 8.5 12 8.5C11.2723 8.5 10.6656 9.01823 10.5288 9.70577L8.56731 9.31346C8.88637 7.70919 10.302 6.5 12 6.5C13.933 6.5 15.5 8.067 15.5 10C15.5 11.5855 14.4457 12.9248 13 13.3551Z"></path></svg>
      <//>
    `;
  }
});
function Header() {
  return m4`
    <header class="${tw2("flex items-center px-3 py-2")}">
      <div class="${tw2("w-3/12 flex justify-start")}">
        ${leftButtonComponent.value}
      </div>

      <div class="${tw2("w-6/12 text-center")}">
        <h1 class="${tw2("text-foreground-strong font-semibold")}">
          ${modalTitle.value}
        </h1>
      </div>

      <div class="${tw2("w-3/12 flex justify-end")}">
        <${Button} onClick=${() => closeEvent.next()}
                   size="${ButtonSize.md}"
                   mode="${ButtonMode.ghost}"
                   shape="${ButtonShape.icon}">

          <svg class="${tw2("w-4 h-4")}" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor"><path d="M11.9997 10.5865L16.9495 5.63672L18.3637 7.05093L13.4139 12.0007L18.3637 16.9504L16.9495 18.3646L11.9997 13.4149L7.04996 18.3646L5.63574 16.9504L10.5855 12.0007L5.63574 7.05093L7.04996 5.63672L11.9997 10.5865Z"></path></svg>
        <//>
      </div>
    </header>
  `;
}

// node_modules/@creit.tech/stellar-wallets-kit/esm/components/shared/footer.js
function Footer() {
  return m4`
    <footer class="${tw2("w-full text-center p-2 border-t-1 border-t-border")}">
      <p class="${tw2("text-xs text-foreground")}">
        Powered by
        <a target="_blank" href="https://stellarwalletskit.dev/" class="${tw2("font-semibold underline ml-1")}">
          Stellar Wallets Kit
        </a>
      </p>
    </footer>
  `;
}

// node_modules/@creit.tech/stellar-wallets-kit/esm/components/shared/avatar.js
var AvatarSize;
(function(AvatarSize2) {
  AvatarSize2["xs"] = "w-6 h-6";
  AvatarSize2["sm"] = "w-8 h-8";
  AvatarSize2["md"] = "w-10 h-10";
  AvatarSize2["lg"] = "w-12 h-12";
  AvatarSize2["xl"] = "w-14 h-14";
})(AvatarSize || (AvatarSize = {}));
var defaultClasses2 = "inline-block rounded-full outline -outline-offset-1 outline-black/5 dark:outline-white/10";
function Avatar(props) {
  return m4`
    <img alt="${props.alt}" src="${props.image}" class="${tw2(cx(defaultClasses2, props.size))}" />
  `;
}

// node_modules/@creit.tech/stellar-wallets-kit/esm/components/pages/auth-options.page.js
var sortedWallet = g2(() => {
  const tempSortedWallets = allowedWallets.value.reduce((all, current) => {
    return {
      available: current.isAvailable ? [...all.available, current] : all.available,
      unavailable: !current.isAvailable ? [...all.unavailable, current] : all.unavailable
    };
  }, { available: [], unavailable: [] });
  let usedWalletsIds;
  try {
    const record = globalThis?.localStorage.getItem(LocalStorageKeys.usedWalletsIds);
    usedWalletsIds = record ? JSON.parse(record) : [];
  } catch (e5) {
    console.error(e5);
    usedWalletsIds = [];
  }
  const usedWallets = [];
  const nonUsedWallets = [];
  for (const availableWallet of tempSortedWallets.available) {
    if (usedWalletsIds.find((id) => id === availableWallet.id)) {
      usedWallets.push(availableWallet);
    } else {
      nonUsedWallets.push(availableWallet);
    }
  }
  return [
    ...usedWallets.sort((a5, b4) => {
      return usedWalletsIds.indexOf(a5.id) - usedWalletsIds.indexOf(b4.id);
    }),
    ...nonUsedWallets,
    ...tempSortedWallets.unavailable
  ];
});
async function onWalletSelected(item) {
  if (!item.isAvailable) {
    globalThis.open(item.url, "_blank");
    return;
  }
  selectedModuleId.value = item.id;
  moduleSelectedEvent.next(item);
  if (item.type === ModuleType.HW_WALLET) {
    navigateTo(SwkAppRoute.HW_ACCOUNTS_FETCHER);
  } else {
    try {
      const { address } = await activeModule.value.getAddress();
      activeAddress.value = address;
      addressUpdatedEvent.next(address);
    } catch (e5) {
      addressUpdatedEvent.next(e5);
    }
  }
}
function AuthOptionsPage() {
  modalTitle.value = "Connect Wallet";
  const wrapper = sortedWallet.value.find((w6) => w6.isPlatformWrapper);
  if (wrapper) {
    onWalletSelected(wrapper).then();
    return m4`
      <div class="${tw2("w-full text-center px-4 py-8")}">
        <div class="${tw2("w-full mb-4")}">
          <${Avatar} alt="${wrapper.name} icon" image="${wrapper.icon}" size="${AvatarSize.md}" />
        </div>

        <p class="${tw2("text-foreground text-lg w-full")}">
          Connecting to your wallet using <b>${wrapper.name}</b>
        </p>
      </div>
    `;
  }
  const loadingMessage = m4`
    <div class="${tw2("w-full text-center text-foreground font-semibold p-4")}">Loading wallets...</div>
  `;
  const walletItem = sortedWallet.value.map((wallet) => {
    return m4`
      <li
        onClick="${() => onWalletSelected(wallet)}"
        class="${tw2("px-2 py-2 cursor-pointer flex justify-between items-center bg-background hover:border-light-gray border-1 border-transparent rounded-default duration-150 ease active:bg-background active:border-gray")}"
      >
        <div class="${tw2("flex items-center gap-2")}">
          <${Avatar} class="${tw2("mr-2")}" alt="${wallet.name} icon" image="${wallet.icon}" size="${AvatarSize.sm}" />
          <p class="${tw2("text-foreground font-semibold")}">${wallet.name}</p>
        </div>

        ${showInstallLabel.value && !wallet.isAvailable ? m4`
            <div class="${tw2("ml-4 flex items-center")}">
              <small
                class="${tw2("inline-flex items-center border-1 border-border px-2 py-1 rounded-default text-foreground-secondary text-xs bg-background-secondary")}"
              >
                ${installText.value}

                <svg class="${tw2("w-4 h-4")}" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M16.0037 9.41421L7.39712 18.0208L5.98291 16.6066L14.5895 8H7.00373V6H18.0037V17H16.0037V9.41421Z"></path>
                </svg>
              </small>
            </div>
          ` : ""}
      </li>
    `;
  });
  return m4`
    <ul class="${tw2("w-full grid gap-2 px-2 py-4")}">
      ${sortedWallet.value.length === 0 ? loadingMessage : walletItem}
    </ul>
  `;
}

// node_modules/@creit.tech/stellar-wallets-kit/esm/components/pages/what-is-a-wallet.page.js
function WhatIsAWalletPage() {
  return m4`
    <section class="${tw2("w-full p-4 pb-8 rounded-tl-default")}">
      <div class="${tw2("w-full mb-6")}">
        <h3 class="${tw2("text-foreground-strong font-semibold text-lg mb-2")}">What is a wallet?</h3>
        <p class="${tw2("text-foreground text-sm")}">
          Wallets are used to send, receive, and store the keys you use to sign blockchain transactions.
        </p>
      </div>

      <div class="w-full">
        <h3 class="${tw2("text-foreground-strong font-semibold text-lg mb-2")}">What is Stellar?</h3>
        <p class="${tw2("text-foreground text-sm")}">
          Stellar is a decentralized, public blockchain that gives developers the tools to create experiences that are more
          like cash than crypto.
        </p>
      </div>
    </section>
  `;
}

// node_modules/@creit.tech/stellar-wallets-kit/esm/sdk/utils.js
function parseError(e5) {
  return {
    code: e5?.error?.code || e5?.code || -1,
    message: e5?.error?.message || e5?.message || typeof e5 === "string" && e5 || "Unhandled error from the wallet",
    ext: e5?.error?.ext || e5?.ext
  };
}
function disconnect() {
  if (activeModule.value?.disconnect) {
    activeModule.value.disconnect();
  }
  resetWalletState();
  disconnectEvent.next();
  closeEvent.next();
}

// node_modules/@creit.tech/stellar-wallets-kit/esm/components/pages/profile.page.js
var showCopiedText = y3(false);
function copyToClipboard() {
  if (!activeAddress.value) {
    throw new Error(`Text to copy to the clipboard can't be undefined`);
  }
  navigator.clipboard.writeText(activeAddress.value).then(() => {
    showCopiedText.value = true;
    setTimeout(() => {
      showCopiedText.value = false;
    }, 2500);
  }).catch((e5) => console.error(e5));
}
function ProfilePage() {
  modalTitle.value = "";
  return m4`
    <section class="${tw2("w-full flex flex-col pb-8")}">
      <div class="${tw2("w-full flex justify-center mb-4")}">
        <${Avatar} alt="${activeModule.value?.productName} icon" image="${activeModule.value?.productIcon}" size="${AvatarSize.xl}" />
      </div>
      
      <div class="${tw2("w-full flex items-center justify-center mb-2")}">
        <h1 class="${tw2("text-lg font-semibold text-foreground")}">
          ${activeAddress.value && `${activeAddress.value.slice(0, 6)}....${activeAddress.value.slice(-6)}`}
        </h1>
      </div>
      
      <div class="${tw2("w-full flex flex-col items-center justify-center gap-2")}">
        <${Button} mode="${ButtonMode.ghost}" onClick="${copyToClipboard}" size="${ButtonSize.sm}">
          ${showCopiedText.value ? "Address copied!" : m4`Copy address`} <svg class="${tw2("w-4 h-4 ml-2")}" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor"><path d="M6.9998 6V3C6.9998 2.44772 7.44752 2 7.9998 2H19.9998C20.5521 2 20.9998 2.44772 20.9998 3V17C20.9998 17.5523 20.5521 18 19.9998 18H16.9998V20.9991C16.9998 21.5519 16.5499 22 15.993 22H4.00666C3.45059 22 3 21.5554 3 20.9991L3.0026 7.00087C3.0027 6.44811 3.45264 6 4.00942 6H6.9998ZM5.00242 8L5.00019 20H14.9998V8H5.00242ZM8.9998 6H16.9998V16H18.9998V4H8.9998V6Z"></path></svg>
        <//>

        <${Button} mode="${ButtonMode.ghost}" onClick="${disconnect}" size="${ButtonSize.sm}">
          Disconnect <svg class="${tw2("w-4 h-4 ml-2")}" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor"><path d="M5 11H13V13H5V16L0 12L5 8V11ZM3.99927 18H6.70835C8.11862 19.2447 9.97111 20 12 20C16.4183 20 20 16.4183 20 12C20 7.58172 16.4183 4 12 4C9.97111 4 8.11862 4.75527 6.70835 6H3.99927C5.82368 3.57111 8.72836 2 12 2C17.5228 2 22 6.47715 22 12C22 17.5228 17.5228 22 12 22C8.72836 22 5.82368 20.4289 3.99927 18Z"></path></svg>
        <//>
      </div>
    </section>
  `;
}

// node_modules/@creit.tech/stellar-wallets-kit/esm/components/pages/hw-accounts-fetcher.page.js
var initialState = {
  error: null,
  loading: true,
  accounts: []
};
var HwAccountsFetcherPage = class extends C {
  constructor() {
    super(...arguments);
    Object.defineProperty(this, "stateSignal", {
      enumerable: true,
      configurable: true,
      writable: true,
      value: y3(initialState)
    });
  }
  componentWillMount() {
    modalTitle.value = "Wallet Accounts";
    this.fetchAccounts();
  }
  async fetchAccounts() {
    const hwModule = activeModule.value;
    this.stateSignal.value = initialState;
    if (hwModule.disconnect) {
      await hwModule.disconnect();
      await new Promise((r7) => setTimeout(r7, 500));
    }
    try {
      const accounts = await hwModule.getAddresses();
      this.stateSignal.value = {
        ...this.stateSignal.value,
        loading: false,
        accounts
      };
    } catch (err) {
      this.stateSignal.value = {
        ...this.stateSignal.value,
        error: err.message
      };
    }
  }
  async selectAccount(params) {
    activeAddress.value = params.publicKey;
    addressUpdatedEvent.next(params.publicKey);
  }
  render() {
    const loadingComponent = m4`
      <div class="${tw2("py-8 w-full flex justify-center items-center text-foreground")}">
        <svg class="${tw2("w-8 h-8 text-gray-200 animate-spin")}" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor">
          <path d="M12 3C16.9706 3 21 7.02944 21 12H19C19 8.13401 15.866 5 12 5V3Z"></path>
        </svg>
      </div>
    `;
    const accountsListComponent = m4`    
      <ul class="${tw2("w-full grid gap-2 px-2 py-4 text-foreground")}">
        ${hardwareWalletPaths.value.map(({ publicKey, index }) => {
      return m4`
            <li onClick=${() => this.selectAccount({ publicKey, index })}
                class="${tw2("px-2 py-2 cursor-pointer flex justify-between items-center bg-background hover:border-light-gray border-1 border-transparent rounded-default duration-150 ease active:bg-background active:border-gray")}">
              ${publicKey.slice(0, 6)}....${publicKey.slice(-6)}

              <span class="dialog-text">(44'/148'/${index}')</span>
            </li>
          `;
    })}
      </ul>
    `;
    const errorComponent = m4`
      <div class="${tw2("w-full text-center text-foreground py-4")}">
        <div class="${tw2("text-danger")}">
          <svg class="${tw2("inline-block mx-auto w-8 h-8 mb-2")}" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12.8659 3.00017L22.3922 19.5002C22.6684 19.9785 22.5045 20.5901 22.0262 20.8662C21.8742 20.954 21.7017 21.0002 21.5262 21.0002H2.47363C1.92135 21.0002 1.47363 20.5525 1.47363 20.0002C1.47363 19.8246 1.51984 19.6522 1.60761 19.5002L11.1339 3.00017C11.41 2.52187 12.0216 2.358 12.4999 2.63414C12.6519 2.72191 12.7782 2.84815 12.8659 3.00017ZM4.20568 19.0002H19.7941L11.9999 5.50017L4.20568 19.0002ZM10.9999 16.0002H12.9999V18.0002H10.9999V16.0002ZM10.9999 9.00017H12.9999V14.0002H10.9999V9.00017Z"></path>
          </svg>
        </div>
        
        <h3 class="${tw2("text-sm font-semibold")}">
          Error while fetching accounts with reason:
        </h3>
        
        <p class="${tw2("mb-4 text-sm")}">
          ${this.stateSignal.value.error}
        </p>
        
        <div class="${tw2("w-full flex justify-center items-center")}">
          <${Button} onClick=${() => this.fetchAccounts()} size="${ButtonSize.md}">
            Retry
          <//>
        </div>
      </div>
    `;
    if (this.stateSignal.value.error) {
      return errorComponent;
    } else {
      return this.stateSignal.value.loading ? loadingComponent : accountsListComponent;
    }
  }
};

// node_modules/@creit.tech/stellar-wallets-kit/esm/components/app.js
var pages = {
  [SwkAppRoute.AUTH_OPTIONS]: AuthOptionsPage,
  [SwkAppRoute.HELP_PAGE]: WhatIsAWalletPage,
  [SwkAppRoute.PROFILE_PAGE]: ProfilePage,
  [SwkAppRoute.HW_ACCOUNTS_FETCHER]: HwAccountsFetcherPage
};
var glass = css`
  .glass {
    backdrop-filter: blur(10px);
    background-color: color-mix(in srgb, var(--swk-background) 25%, transparent);
  }
`;
function SwkApp() {
  const kitsClasses = tw2(cx([
    mode.value === SwkAppMode.FIXED ? "fixed flex left-0 top-0 z-[999] w-full h-full" : "inline-flex",
    "font-default justify-center items-center"
  ]));
  return m4`
    <section class="stellar-wallets-kit ${kitsClasses} ${tw2(reset)} ${tw2(glass)}">
      ${mode.value === SwkAppMode.FIXED ? m4`
          <div class="${tw2("absolute left-0 top-0 z-0 w-full h-full bg-[rgba(0,0,0,0.5)]")}" onClick="${() => closeEvent.next()}"></div>
        ` : ""}

      <section
        class="${tw2("w-full h-fit relative max-w-[22rem] max-h-[39.4375rem] grid grid-cols-1 grid-rows-[auto_1fr_auto] bg-background rounded-default shadow-default transition-all duration-[0.5s] ease-in-out overflow-hidden max-h-[400px] overflow-y-scroll")}"
      >
        <div class="${tw2("col-span-1 top-0 sticky z-50")} glass">
          <${Header} />
        </div>

        <div class="${tw2("col-span-1 relative z-10")}">
          <${MultiPageAnimator}
            currentRoute="${route.value}"
            pages="${pages}"
            duration="${400}"
          />
        </div>

        <div class="${tw2("col-span-1 bottom-0 sticky z-50")} glass">
          <${Footer} />
        </div>
      </section>
    </section>
  `;
}

// node_modules/@creit.tech/stellar-wallets-kit/esm/components/kit-button.js
async function handleOnClick(cb) {
  if (cb)
    cb();
  if (typeof activeModules.value === "undefined")
    throw new Error(`The kit hasn't been initiated.`);
  if (!activeModule.value || !activeAddress.value) {
    await StellarWalletsKit.authModal();
  } else {
    await StellarWalletsKit.profileModal();
  }
}
function SwkButton(props) {
  const content = activeAddress.value ? `${activeAddress.value.slice(0, 4)}....${activeAddress.value.slice(-6)}` : "Connect Wallet";
  return m4`
    <div class="${tw2(reset)} ${tw2("inline-block")}">      
      <${Button} styles=${props.styles} 
                 classes=${props.classes}
                 mode=${props.mode || ButtonMode.primary}
                 shape=${props.shape || ButtonShape.regular}
                 size=${props.size}
                 onClick=${() => handleOnClick(props.onClick)}>        
        ${props.children ? props.children : content}
      <//>
    </div>
  `;
}

// node_modules/@creit.tech/stellar-wallets-kit/esm/sdk/kit.js
var StellarWalletsKit = class _StellarWalletsKit {
  static init(params) {
    activeModules.value = params.modules;
    if (params.selectedWalletId)
      _StellarWalletsKit.setWallet(params.selectedWalletId);
    if (params.network)
      _StellarWalletsKit.setNetwork(params.network);
    if (params.theme)
      _StellarWalletsKit.setTheme(params.theme);
    if (params.authModal) {
      if (typeof params.authModal.showInstallLabel !== "undefined") {
        showInstallLabel.value = params.authModal.showInstallLabel;
      }
      if (typeof params.authModal.hideUnsupportedWallets !== "undefined") {
        hideUnsupportedWallets.value = params.authModal.hideUnsupportedWallets;
      }
    }
  }
  static get selectedModule() {
    if (!activeModule.value) {
      throw { code: -3, message: "Please set the wallet first" };
    }
    return activeModule.value;
  }
  /**
   * This method sets the active wallet (module) that will be used when calling others methods (for example getAddress).
   */
  static setWallet(id) {
    const target = activeModules.value.find((mod) => mod.productId === id);
    if (!target)
      throw new Error(`Wallet id "${id}" is not and existing module`);
    selectedModuleId.value = target.productId;
  }
  /**
   * This method sets the Stellar network the kit will use across calls.
   */
  static setNetwork(network) {
    selectedNetwork.value = network;
  }
  /**
   * You can manually update the kit's styles with this method.
   */
  static setTheme(newTheme = SwkAppLightTheme) {
    theme.value = newTheme;
  }
  // ---------------------------------------------- Wallet Interaction ----------------------------------------------
  /**
   * This method will get you the `address` that's currently active in the Kit's memory. Such address is fetched when the user connects its wallet
   *
   * NOTE: If you want to fetch the address directly from the wallet, use the `fetchAddress` method instead.
   */
  static async getAddress() {
    if (!activeAddress.value) {
      throw {
        code: -1,
        message: "No wallet has been connected."
      };
    }
    return { address: activeAddress.value };
  }
  /**
   * This method will fetch the address from the selected module and update the internal kit's memory
   *
   * NOTE: We suggest that you use `getAddress` when possible instead of this method. Trying to fetch the address from a module
   * that is not ready might cause unexpected behaviors (for example with Freighter if no permission has been granted or when the user is using a hardware wallet);
   */
  static async fetchAddress() {
    const { address } = await _StellarWalletsKit.selectedModule.getAddress();
    activeAddress.value = address;
    addressUpdatedEvent.next(address);
    return { address };
  }
  static signTransaction(xdr, opts) {
    return _StellarWalletsKit.selectedModule.signTransaction(xdr, {
      ...opts,
      networkPassphrase: opts?.networkPassphrase || selectedNetwork.value
    });
  }
  static signAuthEntry(authEntry, opts) {
    return _StellarWalletsKit.selectedModule.signAuthEntry(authEntry, {
      ...opts,
      networkPassphrase: opts?.networkPassphrase || selectedNetwork.value
    });
  }
  static signMessage(message, opts) {
    return _StellarWalletsKit.selectedModule.signMessage(message, {
      ...opts,
      networkPassphrase: opts?.networkPassphrase || selectedNetwork.value
    });
  }
  static signAndSubmitTransaction(xdr, opts) {
    const module = _StellarWalletsKit.selectedModule;
    if (!module.signAndSubmitTransaction) {
      throw {
        code: -3,
        message: `The selected module "${module.productName}" does not support the "signAndSubmitTransaction" method.`
      };
    }
    return module.signAndSubmitTransaction(xdr, {
      ...opts,
      networkPassphrase: opts?.networkPassphrase || selectedNetwork.value
    });
  }
  static getNetwork() {
    return _StellarWalletsKit.selectedModule.getNetwork();
  }
  static async disconnect() {
    disconnect();
  }
  static on(type, callback) {
    switch (type) {
      case KitEventType.STATE_UPDATED: {
        let currentActiveAddress = void 0;
        let currentSelectedNetwork = void 0;
        return j3(() => {
          if (activeAddress.value !== currentActiveAddress || selectedNetwork.value !== currentSelectedNetwork) {
            currentActiveAddress = activeAddress.value;
            currentSelectedNetwork = selectedNetwork.value;
            callback({
              eventType: KitEventType.STATE_UPDATED,
              payload: { address: activeAddress.value, networkPassphrase: selectedNetwork.value }
            });
          }
        });
      }
      case KitEventType.WALLET_SELECTED: {
        let current = void 0;
        return j3(() => {
          if (selectedModuleId.value !== current) {
            current = selectedModuleId.value;
            callback({
              eventType: KitEventType.WALLET_SELECTED,
              payload: { id: selectedModuleId.value }
            });
          }
        });
      }
      case KitEventType.DISCONNECT:
        return disconnectEvent.subscribe(() => {
          callback({ eventType: KitEventType.DISCONNECT, payload: {} });
        });
      default:
        throw new Error(`${type} event type is not supported`);
    }
  }
  static async refreshSupportedWallets() {
    const results = await Promise.all(activeModules.value.map(async (mod) => {
      const timer2 = new Promise((r7) => setTimeout(() => r7(false), 1e3));
      return {
        id: mod.productId,
        name: mod.productName,
        type: mod.moduleType,
        icon: mod.productIcon,
        isAvailable: await Promise.race([timer2, mod.isAvailable()]).catch(() => false),
        isPlatformWrapper: await Promise.race([
          timer2,
          mod.isPlatformWrapper ? mod.isPlatformWrapper() : Promise.resolve(false)
        ]).catch(() => false),
        url: mod.productUrl
      };
    }));
    allowedWallets.value = results;
    return results;
  }
  static async createButton(container, props = {}) {
    R(m4`
        <${SwkButton}
          styles="${props.styles}"
          classes="${props.classes}"
          mode="${props.mode}"
          shape="${props.shape}"
          size="${props.size}"
          onClick="${() => props.onClick && props.onClick()}"
          children="${props.children}"
        />
      `, container);
  }
  // ---------------------------------------------- Modal methods ----------------------------------------------
  /**
   * This method opens an "authentication" modal where the user can pick the wallet they want to connect,
   * it sets the selected wallet as the currently active module and then it requests the public key from the wallet.
   */
  static async authModal(params) {
    resetHistory();
    navigateTo(SwkAppRoute.AUTH_OPTIONS);
    mode.value = params?.container ? SwkAppMode.BLOCK : SwkAppMode.FIXED;
    const wrapper = document.createElement("div");
    (params?.container || document.body).appendChild(wrapper);
    R(m4`
        <${SwkApp} />
      `, wrapper);
    await _StellarWalletsKit.refreshSupportedWallets();
    const subs = [];
    const close = () => {
      for (const sub of subs)
        sub();
      R(null, wrapper);
      wrapper.parentNode?.removeChild(wrapper);
    };
    return new Promise((resolve, reject) => {
      const sub1 = addressUpdatedEvent.subscribe((result) => {
        if (typeof result === "string") {
          resolve({ address: result });
        } else {
          reject(parseError(result));
        }
      });
      const sub2 = closeEvent.subscribe(() => {
        reject({ code: -1, message: "The user closed the modal." });
      });
      subs.push(sub1);
      subs.push(sub2);
    }).then((r7) => {
      close();
      return r7;
    }).catch((e5) => {
      close();
      throw e5;
    });
  }
  /**
   * This method opens the "profile" modal, this modal allows the user to check its currently connected account, copy its public key
   */
  static async profileModal(params) {
    if (!activeAddress.value) {
      throw { code: -1, message: "There is no active address, the user needs to authenticate first." };
    }
    resetHistory();
    navigateTo(SwkAppRoute.PROFILE_PAGE);
    mode.value = params?.container ? SwkAppMode.BLOCK : SwkAppMode.FIXED;
    const wrapper = document.createElement("div");
    (params?.container || document.body).appendChild(wrapper);
    R(m4`
        <${SwkApp} />
      `, wrapper);
    const sub = closeEvent.subscribe(() => {
      sub();
      R(null, wrapper);
      wrapper.parentNode?.removeChild(wrapper);
    });
  }
};

// node_modules/@creit.tech/xbull-wallet-connect/index.js
var import_tweetnacl = __toESM(require_nacl_fast(), 1);
var import_tweetnacl_util = __toESM(require_nacl_util(), 1);

// node_modules/@creit.tech/xbull-wallet-connect/interfaces.js
var L2 = ((L3) => (L3.XBULL_CONNECT = "XBULL_CONNECT", L3.XBULL_GET_PUBLIC_KEY = "XBULL_GET_PUBLIC_KEY", L3.XBULL_SIGN_XDR = "XBULL_SIGN_XDR", L3.XBULL_GET_NETWORK = "XBULL_GET_NETWORK", L3.XBULL_SIGN_MESSAGE = "XBULL_SIGN_MESSAGE", L3.XBULL_INITIAL_RESPONSE = "XBULL_INITIAL_RESPONSE", L3.XBULL_CONNECT_RESPONSE = "XBULL_CONNECT_RESPONSE", L3.XBULL_SIGN = "XBULL_SIGN", L3.XBULL_SIGN_RESPONSE = "XBULL_SIGN_RESPONSE", L3.XBULL_SIGN_MESSAGE_RESPONSE = "XBULL_SIGN_MESSAGE_RESPONSE", L3))(L2 || {});
function _4(L3) {
  return !!L3.error;
}

// node_modules/tslib/tslib.es6.mjs
var extendStatics = function(d5, b4) {
  extendStatics = Object.setPrototypeOf || { __proto__: [] } instanceof Array && function(d6, b5) {
    d6.__proto__ = b5;
  } || function(d6, b5) {
    for (var p5 in b5) if (Object.prototype.hasOwnProperty.call(b5, p5)) d6[p5] = b5[p5];
  };
  return extendStatics(d5, b4);
};
function __extends(d5, b4) {
  if (typeof b4 !== "function" && b4 !== null)
    throw new TypeError("Class extends value " + String(b4) + " is not a constructor or null");
  extendStatics(d5, b4);
  function __() {
    this.constructor = d5;
  }
  d5.prototype = b4 === null ? Object.create(b4) : (__.prototype = b4.prototype, new __());
}
function __awaiter(thisArg, _arguments, P2, generator) {
  function adopt(value) {
    return value instanceof P2 ? value : new P2(function(resolve) {
      resolve(value);
    });
  }
  return new (P2 || (P2 = Promise))(function(resolve, reject) {
    function fulfilled(value) {
      try {
        step(generator.next(value));
      } catch (e5) {
        reject(e5);
      }
    }
    function rejected(value) {
      try {
        step(generator["throw"](value));
      } catch (e5) {
        reject(e5);
      }
    }
    function step(result) {
      result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected);
    }
    step((generator = generator.apply(thisArg, _arguments || [])).next());
  });
}
function __generator(thisArg, body) {
  var _5 = { label: 0, sent: function() {
    if (t7[0] & 1) throw t7[1];
    return t7[1];
  }, trys: [], ops: [] }, f4, y5, t7, g4 = Object.create((typeof Iterator === "function" ? Iterator : Object).prototype);
  return g4.next = verb(0), g4["throw"] = verb(1), g4["return"] = verb(2), typeof Symbol === "function" && (g4[Symbol.iterator] = function() {
    return this;
  }), g4;
  function verb(n5) {
    return function(v4) {
      return step([n5, v4]);
    };
  }
  function step(op) {
    if (f4) throw new TypeError("Generator is already executing.");
    while (g4 && (g4 = 0, op[0] && (_5 = 0)), _5) try {
      if (f4 = 1, y5 && (t7 = op[0] & 2 ? y5["return"] : op[0] ? y5["throw"] || ((t7 = y5["return"]) && t7.call(y5), 0) : y5.next) && !(t7 = t7.call(y5, op[1])).done) return t7;
      if (y5 = 0, t7) op = [op[0] & 2, t7.value];
      switch (op[0]) {
        case 0:
        case 1:
          t7 = op;
          break;
        case 4:
          _5.label++;
          return { value: op[1], done: false };
        case 5:
          _5.label++;
          y5 = op[1];
          op = [0];
          continue;
        case 7:
          op = _5.ops.pop();
          _5.trys.pop();
          continue;
        default:
          if (!(t7 = _5.trys, t7 = t7.length > 0 && t7[t7.length - 1]) && (op[0] === 6 || op[0] === 2)) {
            _5 = 0;
            continue;
          }
          if (op[0] === 3 && (!t7 || op[1] > t7[0] && op[1] < t7[3])) {
            _5.label = op[1];
            break;
          }
          if (op[0] === 6 && _5.label < t7[1]) {
            _5.label = t7[1];
            t7 = op;
            break;
          }
          if (t7 && _5.label < t7[2]) {
            _5.label = t7[2];
            _5.ops.push(op);
            break;
          }
          if (t7[2]) _5.ops.pop();
          _5.trys.pop();
          continue;
      }
      op = body.call(thisArg, _5);
    } catch (e5) {
      op = [6, e5];
      y5 = 0;
    } finally {
      f4 = t7 = 0;
    }
    if (op[0] & 5) throw op[1];
    return { value: op[0] ? op[1] : void 0, done: true };
  }
}
function __values(o4) {
  var s5 = typeof Symbol === "function" && Symbol.iterator, m5 = s5 && o4[s5], i6 = 0;
  if (m5) return m5.call(o4);
  if (o4 && typeof o4.length === "number") return {
    next: function() {
      if (o4 && i6 >= o4.length) o4 = void 0;
      return { value: o4 && o4[i6++], done: !o4 };
    }
  };
  throw new TypeError(s5 ? "Object is not iterable." : "Symbol.iterator is not defined.");
}
function __read(o4, n5) {
  var m5 = typeof Symbol === "function" && o4[Symbol.iterator];
  if (!m5) return o4;
  var i6 = m5.call(o4), r7, ar = [], e5;
  try {
    while ((n5 === void 0 || n5-- > 0) && !(r7 = i6.next()).done) ar.push(r7.value);
  } catch (error) {
    e5 = { error };
  } finally {
    try {
      if (r7 && !r7.done && (m5 = i6["return"])) m5.call(i6);
    } finally {
      if (e5) throw e5.error;
    }
  }
  return ar;
}
function __spreadArray(to, from2, pack) {
  if (pack || arguments.length === 2) for (var i6 = 0, l5 = from2.length, ar; i6 < l5; i6++) {
    if (ar || !(i6 in from2)) {
      if (!ar) ar = Array.prototype.slice.call(from2, 0, i6);
      ar[i6] = from2[i6];
    }
  }
  return to.concat(ar || Array.prototype.slice.call(from2));
}
function __await(v4) {
  return this instanceof __await ? (this.v = v4, this) : new __await(v4);
}
function __asyncGenerator(thisArg, _arguments, generator) {
  if (!Symbol.asyncIterator) throw new TypeError("Symbol.asyncIterator is not defined.");
  var g4 = generator.apply(thisArg, _arguments || []), i6, q3 = [];
  return i6 = Object.create((typeof AsyncIterator === "function" ? AsyncIterator : Object).prototype), verb("next"), verb("throw"), verb("return", awaitReturn), i6[Symbol.asyncIterator] = function() {
    return this;
  }, i6;
  function awaitReturn(f4) {
    return function(v4) {
      return Promise.resolve(v4).then(f4, reject);
    };
  }
  function verb(n5, f4) {
    if (g4[n5]) {
      i6[n5] = function(v4) {
        return new Promise(function(a5, b4) {
          q3.push([n5, v4, a5, b4]) > 1 || resume(n5, v4);
        });
      };
      if (f4) i6[n5] = f4(i6[n5]);
    }
  }
  function resume(n5, v4) {
    try {
      step(g4[n5](v4));
    } catch (e5) {
      settle(q3[0][3], e5);
    }
  }
  function step(r7) {
    r7.value instanceof __await ? Promise.resolve(r7.value.v).then(fulfill, reject) : settle(q3[0][2], r7);
  }
  function fulfill(value) {
    resume("next", value);
  }
  function reject(value) {
    resume("throw", value);
  }
  function settle(f4, v4) {
    if (f4(v4), q3.shift(), q3.length) resume(q3[0][0], q3[0][1]);
  }
}
function __asyncValues(o4) {
  if (!Symbol.asyncIterator) throw new TypeError("Symbol.asyncIterator is not defined.");
  var m5 = o4[Symbol.asyncIterator], i6;
  return m5 ? m5.call(o4) : (o4 = typeof __values === "function" ? __values(o4) : o4[Symbol.iterator](), i6 = {}, verb("next"), verb("throw"), verb("return"), i6[Symbol.asyncIterator] = function() {
    return this;
  }, i6);
  function verb(n5) {
    i6[n5] = o4[n5] && function(v4) {
      return new Promise(function(resolve, reject) {
        v4 = o4[n5](v4), settle(resolve, reject, v4.done, v4.value);
      });
    };
  }
  function settle(resolve, reject, d5, v4) {
    Promise.resolve(v4).then(function(v5) {
      resolve({ value: v5, done: d5 });
    }, reject);
  }
}

// node_modules/rxjs/dist/esm5/internal/util/isFunction.js
function isFunction(value) {
  return typeof value === "function";
}

// node_modules/rxjs/dist/esm5/internal/util/createErrorClass.js
function createErrorClass(createImpl) {
  var _super = function(instance) {
    Error.call(instance);
    instance.stack = new Error().stack;
  };
  var ctorFunc = createImpl(_super);
  ctorFunc.prototype = Object.create(Error.prototype);
  ctorFunc.prototype.constructor = ctorFunc;
  return ctorFunc;
}

// node_modules/rxjs/dist/esm5/internal/util/UnsubscriptionError.js
var UnsubscriptionError = createErrorClass(function(_super) {
  return function UnsubscriptionErrorImpl(errors) {
    _super(this);
    this.message = errors ? errors.length + " errors occurred during unsubscription:\n" + errors.map(function(err, i6) {
      return i6 + 1 + ") " + err.toString();
    }).join("\n  ") : "";
    this.name = "UnsubscriptionError";
    this.errors = errors;
  };
});

// node_modules/rxjs/dist/esm5/internal/util/arrRemove.js
function arrRemove(arr, item) {
  if (arr) {
    var index = arr.indexOf(item);
    0 <= index && arr.splice(index, 1);
  }
}

// node_modules/rxjs/dist/esm5/internal/Subscription.js
var Subscription = (function() {
  function Subscription2(initialTeardown) {
    this.initialTeardown = initialTeardown;
    this.closed = false;
    this._parentage = null;
    this._finalizers = null;
  }
  Subscription2.prototype.unsubscribe = function() {
    var e_1, _a, e_2, _b;
    var errors;
    if (!this.closed) {
      this.closed = true;
      var _parentage = this._parentage;
      if (_parentage) {
        this._parentage = null;
        if (Array.isArray(_parentage)) {
          try {
            for (var _parentage_1 = __values(_parentage), _parentage_1_1 = _parentage_1.next(); !_parentage_1_1.done; _parentage_1_1 = _parentage_1.next()) {
              var parent_1 = _parentage_1_1.value;
              parent_1.remove(this);
            }
          } catch (e_1_1) {
            e_1 = { error: e_1_1 };
          } finally {
            try {
              if (_parentage_1_1 && !_parentage_1_1.done && (_a = _parentage_1.return)) _a.call(_parentage_1);
            } finally {
              if (e_1) throw e_1.error;
            }
          }
        } else {
          _parentage.remove(this);
        }
      }
      var initialFinalizer = this.initialTeardown;
      if (isFunction(initialFinalizer)) {
        try {
          initialFinalizer();
        } catch (e5) {
          errors = e5 instanceof UnsubscriptionError ? e5.errors : [e5];
        }
      }
      var _finalizers = this._finalizers;
      if (_finalizers) {
        this._finalizers = null;
        try {
          for (var _finalizers_1 = __values(_finalizers), _finalizers_1_1 = _finalizers_1.next(); !_finalizers_1_1.done; _finalizers_1_1 = _finalizers_1.next()) {
            var finalizer = _finalizers_1_1.value;
            try {
              execFinalizer(finalizer);
            } catch (err) {
              errors = errors !== null && errors !== void 0 ? errors : [];
              if (err instanceof UnsubscriptionError) {
                errors = __spreadArray(__spreadArray([], __read(errors)), __read(err.errors));
              } else {
                errors.push(err);
              }
            }
          }
        } catch (e_2_1) {
          e_2 = { error: e_2_1 };
        } finally {
          try {
            if (_finalizers_1_1 && !_finalizers_1_1.done && (_b = _finalizers_1.return)) _b.call(_finalizers_1);
          } finally {
            if (e_2) throw e_2.error;
          }
        }
      }
      if (errors) {
        throw new UnsubscriptionError(errors);
      }
    }
  };
  Subscription2.prototype.add = function(teardown) {
    var _a;
    if (teardown && teardown !== this) {
      if (this.closed) {
        execFinalizer(teardown);
      } else {
        if (teardown instanceof Subscription2) {
          if (teardown.closed || teardown._hasParent(this)) {
            return;
          }
          teardown._addParent(this);
        }
        (this._finalizers = (_a = this._finalizers) !== null && _a !== void 0 ? _a : []).push(teardown);
      }
    }
  };
  Subscription2.prototype._hasParent = function(parent) {
    var _parentage = this._parentage;
    return _parentage === parent || Array.isArray(_parentage) && _parentage.includes(parent);
  };
  Subscription2.prototype._addParent = function(parent) {
    var _parentage = this._parentage;
    this._parentage = Array.isArray(_parentage) ? (_parentage.push(parent), _parentage) : _parentage ? [_parentage, parent] : parent;
  };
  Subscription2.prototype._removeParent = function(parent) {
    var _parentage = this._parentage;
    if (_parentage === parent) {
      this._parentage = null;
    } else if (Array.isArray(_parentage)) {
      arrRemove(_parentage, parent);
    }
  };
  Subscription2.prototype.remove = function(teardown) {
    var _finalizers = this._finalizers;
    _finalizers && arrRemove(_finalizers, teardown);
    if (teardown instanceof Subscription2) {
      teardown._removeParent(this);
    }
  };
  Subscription2.EMPTY = (function() {
    var empty = new Subscription2();
    empty.closed = true;
    return empty;
  })();
  return Subscription2;
})();
var EMPTY_SUBSCRIPTION = Subscription.EMPTY;
function isSubscription(value) {
  return value instanceof Subscription || value && "closed" in value && isFunction(value.remove) && isFunction(value.add) && isFunction(value.unsubscribe);
}
function execFinalizer(finalizer) {
  if (isFunction(finalizer)) {
    finalizer();
  } else {
    finalizer.unsubscribe();
  }
}

// node_modules/rxjs/dist/esm5/internal/config.js
var config2 = {
  onUnhandledError: null,
  onStoppedNotification: null,
  Promise: void 0,
  useDeprecatedSynchronousErrorHandling: false,
  useDeprecatedNextContext: false
};

// node_modules/rxjs/dist/esm5/internal/scheduler/timeoutProvider.js
var timeoutProvider = {
  setTimeout: function(handler, timeout) {
    var args = [];
    for (var _i = 2; _i < arguments.length; _i++) {
      args[_i - 2] = arguments[_i];
    }
    var delegate = timeoutProvider.delegate;
    if (delegate === null || delegate === void 0 ? void 0 : delegate.setTimeout) {
      return delegate.setTimeout.apply(delegate, __spreadArray([handler, timeout], __read(args)));
    }
    return setTimeout.apply(void 0, __spreadArray([handler, timeout], __read(args)));
  },
  clearTimeout: function(handle) {
    var delegate = timeoutProvider.delegate;
    return ((delegate === null || delegate === void 0 ? void 0 : delegate.clearTimeout) || clearTimeout)(handle);
  },
  delegate: void 0
};

// node_modules/rxjs/dist/esm5/internal/util/reportUnhandledError.js
function reportUnhandledError(err) {
  timeoutProvider.setTimeout(function() {
    var onUnhandledError = config2.onUnhandledError;
    if (onUnhandledError) {
      onUnhandledError(err);
    } else {
      throw err;
    }
  });
}

// node_modules/rxjs/dist/esm5/internal/util/noop.js
function noop2() {
}

// node_modules/rxjs/dist/esm5/internal/NotificationFactories.js
var COMPLETE_NOTIFICATION = (function() {
  return createNotification("C", void 0, void 0);
})();
function errorNotification(error) {
  return createNotification("E", void 0, error);
}
function nextNotification(value) {
  return createNotification("N", value, void 0);
}
function createNotification(kind, value, error) {
  return {
    kind,
    value,
    error
  };
}

// node_modules/rxjs/dist/esm5/internal/util/errorContext.js
var context = null;
function errorContext(cb) {
  if (config2.useDeprecatedSynchronousErrorHandling) {
    var isRoot = !context;
    if (isRoot) {
      context = { errorThrown: false, error: null };
    }
    cb();
    if (isRoot) {
      var _a = context, errorThrown = _a.errorThrown, error = _a.error;
      context = null;
      if (errorThrown) {
        throw error;
      }
    }
  } else {
    cb();
  }
}
function captureError(err) {
  if (config2.useDeprecatedSynchronousErrorHandling && context) {
    context.errorThrown = true;
    context.error = err;
  }
}

// node_modules/rxjs/dist/esm5/internal/Subscriber.js
var Subscriber = (function(_super) {
  __extends(Subscriber2, _super);
  function Subscriber2(destination) {
    var _this = _super.call(this) || this;
    _this.isStopped = false;
    if (destination) {
      _this.destination = destination;
      if (isSubscription(destination)) {
        destination.add(_this);
      }
    } else {
      _this.destination = EMPTY_OBSERVER;
    }
    return _this;
  }
  Subscriber2.create = function(next, error, complete) {
    return new SafeSubscriber(next, error, complete);
  };
  Subscriber2.prototype.next = function(value) {
    if (this.isStopped) {
      handleStoppedNotification(nextNotification(value), this);
    } else {
      this._next(value);
    }
  };
  Subscriber2.prototype.error = function(err) {
    if (this.isStopped) {
      handleStoppedNotification(errorNotification(err), this);
    } else {
      this.isStopped = true;
      this._error(err);
    }
  };
  Subscriber2.prototype.complete = function() {
    if (this.isStopped) {
      handleStoppedNotification(COMPLETE_NOTIFICATION, this);
    } else {
      this.isStopped = true;
      this._complete();
    }
  };
  Subscriber2.prototype.unsubscribe = function() {
    if (!this.closed) {
      this.isStopped = true;
      _super.prototype.unsubscribe.call(this);
      this.destination = null;
    }
  };
  Subscriber2.prototype._next = function(value) {
    this.destination.next(value);
  };
  Subscriber2.prototype._error = function(err) {
    try {
      this.destination.error(err);
    } finally {
      this.unsubscribe();
    }
  };
  Subscriber2.prototype._complete = function() {
    try {
      this.destination.complete();
    } finally {
      this.unsubscribe();
    }
  };
  return Subscriber2;
})(Subscription);
var _bind = Function.prototype.bind;
function bind2(fn, thisArg) {
  return _bind.call(fn, thisArg);
}
var ConsumerObserver = (function() {
  function ConsumerObserver2(partialObserver) {
    this.partialObserver = partialObserver;
  }
  ConsumerObserver2.prototype.next = function(value) {
    var partialObserver = this.partialObserver;
    if (partialObserver.next) {
      try {
        partialObserver.next(value);
      } catch (error) {
        handleUnhandledError(error);
      }
    }
  };
  ConsumerObserver2.prototype.error = function(err) {
    var partialObserver = this.partialObserver;
    if (partialObserver.error) {
      try {
        partialObserver.error(err);
      } catch (error) {
        handleUnhandledError(error);
      }
    } else {
      handleUnhandledError(err);
    }
  };
  ConsumerObserver2.prototype.complete = function() {
    var partialObserver = this.partialObserver;
    if (partialObserver.complete) {
      try {
        partialObserver.complete();
      } catch (error) {
        handleUnhandledError(error);
      }
    }
  };
  return ConsumerObserver2;
})();
var SafeSubscriber = (function(_super) {
  __extends(SafeSubscriber2, _super);
  function SafeSubscriber2(observerOrNext, error, complete) {
    var _this = _super.call(this) || this;
    var partialObserver;
    if (isFunction(observerOrNext) || !observerOrNext) {
      partialObserver = {
        next: observerOrNext !== null && observerOrNext !== void 0 ? observerOrNext : void 0,
        error: error !== null && error !== void 0 ? error : void 0,
        complete: complete !== null && complete !== void 0 ? complete : void 0
      };
    } else {
      var context_1;
      if (_this && config2.useDeprecatedNextContext) {
        context_1 = Object.create(observerOrNext);
        context_1.unsubscribe = function() {
          return _this.unsubscribe();
        };
        partialObserver = {
          next: observerOrNext.next && bind2(observerOrNext.next, context_1),
          error: observerOrNext.error && bind2(observerOrNext.error, context_1),
          complete: observerOrNext.complete && bind2(observerOrNext.complete, context_1)
        };
      } else {
        partialObserver = observerOrNext;
      }
    }
    _this.destination = new ConsumerObserver(partialObserver);
    return _this;
  }
  return SafeSubscriber2;
})(Subscriber);
function handleUnhandledError(error) {
  if (config2.useDeprecatedSynchronousErrorHandling) {
    captureError(error);
  } else {
    reportUnhandledError(error);
  }
}
function defaultErrorHandler(err) {
  throw err;
}
function handleStoppedNotification(notification, subscriber) {
  var onStoppedNotification = config2.onStoppedNotification;
  onStoppedNotification && timeoutProvider.setTimeout(function() {
    return onStoppedNotification(notification, subscriber);
  });
}
var EMPTY_OBSERVER = {
  closed: true,
  next: noop2,
  error: defaultErrorHandler,
  complete: noop2
};

// node_modules/rxjs/dist/esm5/internal/symbol/observable.js
var observable = (function() {
  return typeof Symbol === "function" && Symbol.observable || "@@observable";
})();

// node_modules/rxjs/dist/esm5/internal/util/identity.js
function identity2(x4) {
  return x4;
}

// node_modules/rxjs/dist/esm5/internal/util/pipe.js
function pipeFromArray(fns) {
  if (fns.length === 0) {
    return identity2;
  }
  if (fns.length === 1) {
    return fns[0];
  }
  return function piped(input) {
    return fns.reduce(function(prev, fn) {
      return fn(prev);
    }, input);
  };
}

// node_modules/rxjs/dist/esm5/internal/Observable.js
var Observable = (function() {
  function Observable2(subscribe) {
    if (subscribe) {
      this._subscribe = subscribe;
    }
  }
  Observable2.prototype.lift = function(operator) {
    var observable2 = new Observable2();
    observable2.source = this;
    observable2.operator = operator;
    return observable2;
  };
  Observable2.prototype.subscribe = function(observerOrNext, error, complete) {
    var _this = this;
    var subscriber = isSubscriber(observerOrNext) ? observerOrNext : new SafeSubscriber(observerOrNext, error, complete);
    errorContext(function() {
      var _a = _this, operator = _a.operator, source = _a.source;
      subscriber.add(operator ? operator.call(subscriber, source) : source ? _this._subscribe(subscriber) : _this._trySubscribe(subscriber));
    });
    return subscriber;
  };
  Observable2.prototype._trySubscribe = function(sink) {
    try {
      return this._subscribe(sink);
    } catch (err) {
      sink.error(err);
    }
  };
  Observable2.prototype.forEach = function(next, promiseCtor) {
    var _this = this;
    promiseCtor = getPromiseCtor(promiseCtor);
    return new promiseCtor(function(resolve, reject) {
      var subscriber = new SafeSubscriber({
        next: function(value) {
          try {
            next(value);
          } catch (err) {
            reject(err);
            subscriber.unsubscribe();
          }
        },
        error: reject,
        complete: resolve
      });
      _this.subscribe(subscriber);
    });
  };
  Observable2.prototype._subscribe = function(subscriber) {
    var _a;
    return (_a = this.source) === null || _a === void 0 ? void 0 : _a.subscribe(subscriber);
  };
  Observable2.prototype[observable] = function() {
    return this;
  };
  Observable2.prototype.pipe = function() {
    var operations = [];
    for (var _i = 0; _i < arguments.length; _i++) {
      operations[_i] = arguments[_i];
    }
    return pipeFromArray(operations)(this);
  };
  Observable2.prototype.toPromise = function(promiseCtor) {
    var _this = this;
    promiseCtor = getPromiseCtor(promiseCtor);
    return new promiseCtor(function(resolve, reject) {
      var value;
      _this.subscribe(function(x4) {
        return value = x4;
      }, function(err) {
        return reject(err);
      }, function() {
        return resolve(value);
      });
    });
  };
  Observable2.create = function(subscribe) {
    return new Observable2(subscribe);
  };
  return Observable2;
})();
function getPromiseCtor(promiseCtor) {
  var _a;
  return (_a = promiseCtor !== null && promiseCtor !== void 0 ? promiseCtor : config2.Promise) !== null && _a !== void 0 ? _a : Promise;
}
function isObserver(value) {
  return value && isFunction(value.next) && isFunction(value.error) && isFunction(value.complete);
}
function isSubscriber(value) {
  return value && value instanceof Subscriber || isObserver(value) && isSubscription(value);
}

// node_modules/rxjs/dist/esm5/internal/util/lift.js
function hasLift(source) {
  return isFunction(source === null || source === void 0 ? void 0 : source.lift);
}
function operate(init) {
  return function(source) {
    if (hasLift(source)) {
      return source.lift(function(liftedSource) {
        try {
          return init(liftedSource, this);
        } catch (err) {
          this.error(err);
        }
      });
    }
    throw new TypeError("Unable to lift unknown Observable type");
  };
}

// node_modules/rxjs/dist/esm5/internal/operators/OperatorSubscriber.js
function createOperatorSubscriber(destination, onNext, onComplete, onError, onFinalize) {
  return new OperatorSubscriber(destination, onNext, onComplete, onError, onFinalize);
}
var OperatorSubscriber = (function(_super) {
  __extends(OperatorSubscriber2, _super);
  function OperatorSubscriber2(destination, onNext, onComplete, onError, onFinalize, shouldUnsubscribe) {
    var _this = _super.call(this, destination) || this;
    _this.onFinalize = onFinalize;
    _this.shouldUnsubscribe = shouldUnsubscribe;
    _this._next = onNext ? function(value) {
      try {
        onNext(value);
      } catch (err) {
        destination.error(err);
      }
    } : _super.prototype._next;
    _this._error = onError ? function(err) {
      try {
        onError(err);
      } catch (err2) {
        destination.error(err2);
      } finally {
        this.unsubscribe();
      }
    } : _super.prototype._error;
    _this._complete = onComplete ? function() {
      try {
        onComplete();
      } catch (err) {
        destination.error(err);
      } finally {
        this.unsubscribe();
      }
    } : _super.prototype._complete;
    return _this;
  }
  OperatorSubscriber2.prototype.unsubscribe = function() {
    var _a;
    if (!this.shouldUnsubscribe || this.shouldUnsubscribe()) {
      var closed_1 = this.closed;
      _super.prototype.unsubscribe.call(this);
      !closed_1 && ((_a = this.onFinalize) === null || _a === void 0 ? void 0 : _a.call(this));
    }
  };
  return OperatorSubscriber2;
})(Subscriber);

// node_modules/rxjs/dist/esm5/internal/util/ObjectUnsubscribedError.js
var ObjectUnsubscribedError = createErrorClass(function(_super) {
  return function ObjectUnsubscribedErrorImpl() {
    _super(this);
    this.name = "ObjectUnsubscribedError";
    this.message = "object unsubscribed";
  };
});

// node_modules/rxjs/dist/esm5/internal/Subject.js
var Subject = (function(_super) {
  __extends(Subject2, _super);
  function Subject2() {
    var _this = _super.call(this) || this;
    _this.closed = false;
    _this.currentObservers = null;
    _this.observers = [];
    _this.isStopped = false;
    _this.hasError = false;
    _this.thrownError = null;
    return _this;
  }
  Subject2.prototype.lift = function(operator) {
    var subject = new AnonymousSubject(this, this);
    subject.operator = operator;
    return subject;
  };
  Subject2.prototype._throwIfClosed = function() {
    if (this.closed) {
      throw new ObjectUnsubscribedError();
    }
  };
  Subject2.prototype.next = function(value) {
    var _this = this;
    errorContext(function() {
      var e_1, _a;
      _this._throwIfClosed();
      if (!_this.isStopped) {
        if (!_this.currentObservers) {
          _this.currentObservers = Array.from(_this.observers);
        }
        try {
          for (var _b = __values(_this.currentObservers), _c = _b.next(); !_c.done; _c = _b.next()) {
            var observer = _c.value;
            observer.next(value);
          }
        } catch (e_1_1) {
          e_1 = { error: e_1_1 };
        } finally {
          try {
            if (_c && !_c.done && (_a = _b.return)) _a.call(_b);
          } finally {
            if (e_1) throw e_1.error;
          }
        }
      }
    });
  };
  Subject2.prototype.error = function(err) {
    var _this = this;
    errorContext(function() {
      _this._throwIfClosed();
      if (!_this.isStopped) {
        _this.hasError = _this.isStopped = true;
        _this.thrownError = err;
        var observers = _this.observers;
        while (observers.length) {
          observers.shift().error(err);
        }
      }
    });
  };
  Subject2.prototype.complete = function() {
    var _this = this;
    errorContext(function() {
      _this._throwIfClosed();
      if (!_this.isStopped) {
        _this.isStopped = true;
        var observers = _this.observers;
        while (observers.length) {
          observers.shift().complete();
        }
      }
    });
  };
  Subject2.prototype.unsubscribe = function() {
    this.isStopped = this.closed = true;
    this.observers = this.currentObservers = null;
  };
  Object.defineProperty(Subject2.prototype, "observed", {
    get: function() {
      var _a;
      return ((_a = this.observers) === null || _a === void 0 ? void 0 : _a.length) > 0;
    },
    enumerable: false,
    configurable: true
  });
  Subject2.prototype._trySubscribe = function(subscriber) {
    this._throwIfClosed();
    return _super.prototype._trySubscribe.call(this, subscriber);
  };
  Subject2.prototype._subscribe = function(subscriber) {
    this._throwIfClosed();
    this._checkFinalizedStatuses(subscriber);
    return this._innerSubscribe(subscriber);
  };
  Subject2.prototype._innerSubscribe = function(subscriber) {
    var _this = this;
    var _a = this, hasError = _a.hasError, isStopped = _a.isStopped, observers = _a.observers;
    if (hasError || isStopped) {
      return EMPTY_SUBSCRIPTION;
    }
    this.currentObservers = null;
    observers.push(subscriber);
    return new Subscription(function() {
      _this.currentObservers = null;
      arrRemove(observers, subscriber);
    });
  };
  Subject2.prototype._checkFinalizedStatuses = function(subscriber) {
    var _a = this, hasError = _a.hasError, thrownError = _a.thrownError, isStopped = _a.isStopped;
    if (hasError) {
      subscriber.error(thrownError);
    } else if (isStopped) {
      subscriber.complete();
    }
  };
  Subject2.prototype.asObservable = function() {
    var observable2 = new Observable();
    observable2.source = this;
    return observable2;
  };
  Subject2.create = function(destination, source) {
    return new AnonymousSubject(destination, source);
  };
  return Subject2;
})(Observable);
var AnonymousSubject = (function(_super) {
  __extends(AnonymousSubject2, _super);
  function AnonymousSubject2(destination, source) {
    var _this = _super.call(this) || this;
    _this.destination = destination;
    _this.source = source;
    return _this;
  }
  AnonymousSubject2.prototype.next = function(value) {
    var _a, _b;
    (_b = (_a = this.destination) === null || _a === void 0 ? void 0 : _a.next) === null || _b === void 0 ? void 0 : _b.call(_a, value);
  };
  AnonymousSubject2.prototype.error = function(err) {
    var _a, _b;
    (_b = (_a = this.destination) === null || _a === void 0 ? void 0 : _a.error) === null || _b === void 0 ? void 0 : _b.call(_a, err);
  };
  AnonymousSubject2.prototype.complete = function() {
    var _a, _b;
    (_b = (_a = this.destination) === null || _a === void 0 ? void 0 : _a.complete) === null || _b === void 0 ? void 0 : _b.call(_a);
  };
  AnonymousSubject2.prototype._subscribe = function(subscriber) {
    var _a, _b;
    return (_b = (_a = this.source) === null || _a === void 0 ? void 0 : _a.subscribe(subscriber)) !== null && _b !== void 0 ? _b : EMPTY_SUBSCRIPTION;
  };
  return AnonymousSubject2;
})(Subject);

// node_modules/rxjs/dist/esm5/internal/scheduler/dateTimestampProvider.js
var dateTimestampProvider = {
  now: function() {
    return (dateTimestampProvider.delegate || Date).now();
  },
  delegate: void 0
};

// node_modules/rxjs/dist/esm5/internal/scheduler/Action.js
var Action = (function(_super) {
  __extends(Action2, _super);
  function Action2(scheduler, work) {
    return _super.call(this) || this;
  }
  Action2.prototype.schedule = function(state, delay) {
    if (delay === void 0) {
      delay = 0;
    }
    return this;
  };
  return Action2;
})(Subscription);

// node_modules/rxjs/dist/esm5/internal/scheduler/intervalProvider.js
var intervalProvider = {
  setInterval: function(handler, timeout) {
    var args = [];
    for (var _i = 2; _i < arguments.length; _i++) {
      args[_i - 2] = arguments[_i];
    }
    var delegate = intervalProvider.delegate;
    if (delegate === null || delegate === void 0 ? void 0 : delegate.setInterval) {
      return delegate.setInterval.apply(delegate, __spreadArray([handler, timeout], __read(args)));
    }
    return setInterval.apply(void 0, __spreadArray([handler, timeout], __read(args)));
  },
  clearInterval: function(handle) {
    var delegate = intervalProvider.delegate;
    return ((delegate === null || delegate === void 0 ? void 0 : delegate.clearInterval) || clearInterval)(handle);
  },
  delegate: void 0
};

// node_modules/rxjs/dist/esm5/internal/scheduler/AsyncAction.js
var AsyncAction = (function(_super) {
  __extends(AsyncAction2, _super);
  function AsyncAction2(scheduler, work) {
    var _this = _super.call(this, scheduler, work) || this;
    _this.scheduler = scheduler;
    _this.work = work;
    _this.pending = false;
    return _this;
  }
  AsyncAction2.prototype.schedule = function(state, delay) {
    var _a;
    if (delay === void 0) {
      delay = 0;
    }
    if (this.closed) {
      return this;
    }
    this.state = state;
    var id = this.id;
    var scheduler = this.scheduler;
    if (id != null) {
      this.id = this.recycleAsyncId(scheduler, id, delay);
    }
    this.pending = true;
    this.delay = delay;
    this.id = (_a = this.id) !== null && _a !== void 0 ? _a : this.requestAsyncId(scheduler, this.id, delay);
    return this;
  };
  AsyncAction2.prototype.requestAsyncId = function(scheduler, _id, delay) {
    if (delay === void 0) {
      delay = 0;
    }
    return intervalProvider.setInterval(scheduler.flush.bind(scheduler, this), delay);
  };
  AsyncAction2.prototype.recycleAsyncId = function(_scheduler, id, delay) {
    if (delay === void 0) {
      delay = 0;
    }
    if (delay != null && this.delay === delay && this.pending === false) {
      return id;
    }
    if (id != null) {
      intervalProvider.clearInterval(id);
    }
    return void 0;
  };
  AsyncAction2.prototype.execute = function(state, delay) {
    if (this.closed) {
      return new Error("executing a cancelled action");
    }
    this.pending = false;
    var error = this._execute(state, delay);
    if (error) {
      return error;
    } else if (this.pending === false && this.id != null) {
      this.id = this.recycleAsyncId(this.scheduler, this.id, null);
    }
  };
  AsyncAction2.prototype._execute = function(state, _delay) {
    var errored = false;
    var errorValue;
    try {
      this.work(state);
    } catch (e5) {
      errored = true;
      errorValue = e5 ? e5 : new Error("Scheduled action threw falsy error");
    }
    if (errored) {
      this.unsubscribe();
      return errorValue;
    }
  };
  AsyncAction2.prototype.unsubscribe = function() {
    if (!this.closed) {
      var _a = this, id = _a.id, scheduler = _a.scheduler;
      var actions = scheduler.actions;
      this.work = this.state = this.scheduler = null;
      this.pending = false;
      arrRemove(actions, this);
      if (id != null) {
        this.id = this.recycleAsyncId(scheduler, id, null);
      }
      this.delay = null;
      _super.prototype.unsubscribe.call(this);
    }
  };
  return AsyncAction2;
})(Action);

// node_modules/rxjs/dist/esm5/internal/Scheduler.js
var Scheduler = (function() {
  function Scheduler2(schedulerActionCtor, now) {
    if (now === void 0) {
      now = Scheduler2.now;
    }
    this.schedulerActionCtor = schedulerActionCtor;
    this.now = now;
  }
  Scheduler2.prototype.schedule = function(work, delay, state) {
    if (delay === void 0) {
      delay = 0;
    }
    return new this.schedulerActionCtor(this, work).schedule(state, delay);
  };
  Scheduler2.now = dateTimestampProvider.now;
  return Scheduler2;
})();

// node_modules/rxjs/dist/esm5/internal/scheduler/AsyncScheduler.js
var AsyncScheduler = (function(_super) {
  __extends(AsyncScheduler2, _super);
  function AsyncScheduler2(SchedulerAction, now) {
    if (now === void 0) {
      now = Scheduler.now;
    }
    var _this = _super.call(this, SchedulerAction, now) || this;
    _this.actions = [];
    _this._active = false;
    return _this;
  }
  AsyncScheduler2.prototype.flush = function(action) {
    var actions = this.actions;
    if (this._active) {
      actions.push(action);
      return;
    }
    var error;
    this._active = true;
    do {
      if (error = action.execute(action.state, action.delay)) {
        break;
      }
    } while (action = actions.shift());
    this._active = false;
    if (error) {
      while (action = actions.shift()) {
        action.unsubscribe();
      }
      throw error;
    }
  };
  return AsyncScheduler2;
})(Scheduler);

// node_modules/rxjs/dist/esm5/internal/scheduler/async.js
var asyncScheduler = new AsyncScheduler(AsyncAction);
var async = asyncScheduler;

// node_modules/rxjs/dist/esm5/internal/observable/empty.js
var EMPTY = new Observable(function(subscriber) {
  return subscriber.complete();
});

// node_modules/rxjs/dist/esm5/internal/util/isScheduler.js
function isScheduler(value) {
  return value && isFunction(value.schedule);
}

// node_modules/rxjs/dist/esm5/internal/util/args.js
function last(arr) {
  return arr[arr.length - 1];
}
function popScheduler(args) {
  return isScheduler(last(args)) ? args.pop() : void 0;
}

// node_modules/rxjs/dist/esm5/internal/util/isArrayLike.js
var isArrayLike = (function(x4) {
  return x4 && typeof x4.length === "number" && typeof x4 !== "function";
});

// node_modules/rxjs/dist/esm5/internal/util/isPromise.js
function isPromise(value) {
  return isFunction(value === null || value === void 0 ? void 0 : value.then);
}

// node_modules/rxjs/dist/esm5/internal/util/isInteropObservable.js
function isInteropObservable(input) {
  return isFunction(input[observable]);
}

// node_modules/rxjs/dist/esm5/internal/util/isAsyncIterable.js
function isAsyncIterable(obj) {
  return Symbol.asyncIterator && isFunction(obj === null || obj === void 0 ? void 0 : obj[Symbol.asyncIterator]);
}

// node_modules/rxjs/dist/esm5/internal/util/throwUnobservableError.js
function createInvalidObservableTypeError(input) {
  return new TypeError("You provided " + (input !== null && typeof input === "object" ? "an invalid object" : "'" + input + "'") + " where a stream was expected. You can provide an Observable, Promise, ReadableStream, Array, AsyncIterable, or Iterable.");
}

// node_modules/rxjs/dist/esm5/internal/symbol/iterator.js
function getSymbolIterator() {
  if (typeof Symbol !== "function" || !Symbol.iterator) {
    return "@@iterator";
  }
  return Symbol.iterator;
}
var iterator = getSymbolIterator();

// node_modules/rxjs/dist/esm5/internal/util/isIterable.js
function isIterable(input) {
  return isFunction(input === null || input === void 0 ? void 0 : input[iterator]);
}

// node_modules/rxjs/dist/esm5/internal/util/isReadableStreamLike.js
function readableStreamLikeToAsyncGenerator(readableStream) {
  return __asyncGenerator(this, arguments, function readableStreamLikeToAsyncGenerator_1() {
    var reader, _a, value, done;
    return __generator(this, function(_b) {
      switch (_b.label) {
        case 0:
          reader = readableStream.getReader();
          _b.label = 1;
        case 1:
          _b.trys.push([1, , 9, 10]);
          _b.label = 2;
        case 2:
          if (false) return [3, 8];
          return [4, __await(reader.read())];
        case 3:
          _a = _b.sent(), value = _a.value, done = _a.done;
          if (!done) return [3, 5];
          return [4, __await(void 0)];
        case 4:
          return [2, _b.sent()];
        case 5:
          return [4, __await(value)];
        case 6:
          return [4, _b.sent()];
        case 7:
          _b.sent();
          return [3, 2];
        case 8:
          return [3, 10];
        case 9:
          reader.releaseLock();
          return [7];
        case 10:
          return [2];
      }
    });
  });
}
function isReadableStreamLike(obj) {
  return isFunction(obj === null || obj === void 0 ? void 0 : obj.getReader);
}

// node_modules/rxjs/dist/esm5/internal/observable/innerFrom.js
function innerFrom(input) {
  if (input instanceof Observable) {
    return input;
  }
  if (input != null) {
    if (isInteropObservable(input)) {
      return fromInteropObservable(input);
    }
    if (isArrayLike(input)) {
      return fromArrayLike(input);
    }
    if (isPromise(input)) {
      return fromPromise(input);
    }
    if (isAsyncIterable(input)) {
      return fromAsyncIterable(input);
    }
    if (isIterable(input)) {
      return fromIterable(input);
    }
    if (isReadableStreamLike(input)) {
      return fromReadableStreamLike(input);
    }
  }
  throw createInvalidObservableTypeError(input);
}
function fromInteropObservable(obj) {
  return new Observable(function(subscriber) {
    var obs = obj[observable]();
    if (isFunction(obs.subscribe)) {
      return obs.subscribe(subscriber);
    }
    throw new TypeError("Provided object does not correctly implement Symbol.observable");
  });
}
function fromArrayLike(array) {
  return new Observable(function(subscriber) {
    for (var i6 = 0; i6 < array.length && !subscriber.closed; i6++) {
      subscriber.next(array[i6]);
    }
    subscriber.complete();
  });
}
function fromPromise(promise) {
  return new Observable(function(subscriber) {
    promise.then(function(value) {
      if (!subscriber.closed) {
        subscriber.next(value);
        subscriber.complete();
      }
    }, function(err) {
      return subscriber.error(err);
    }).then(null, reportUnhandledError);
  });
}
function fromIterable(iterable) {
  return new Observable(function(subscriber) {
    var e_1, _a;
    try {
      for (var iterable_1 = __values(iterable), iterable_1_1 = iterable_1.next(); !iterable_1_1.done; iterable_1_1 = iterable_1.next()) {
        var value = iterable_1_1.value;
        subscriber.next(value);
        if (subscriber.closed) {
          return;
        }
      }
    } catch (e_1_1) {
      e_1 = { error: e_1_1 };
    } finally {
      try {
        if (iterable_1_1 && !iterable_1_1.done && (_a = iterable_1.return)) _a.call(iterable_1);
      } finally {
        if (e_1) throw e_1.error;
      }
    }
    subscriber.complete();
  });
}
function fromAsyncIterable(asyncIterable) {
  return new Observable(function(subscriber) {
    process(asyncIterable, subscriber).catch(function(err) {
      return subscriber.error(err);
    });
  });
}
function fromReadableStreamLike(readableStream) {
  return fromAsyncIterable(readableStreamLikeToAsyncGenerator(readableStream));
}
function process(asyncIterable, subscriber) {
  var asyncIterable_1, asyncIterable_1_1;
  var e_2, _a;
  return __awaiter(this, void 0, void 0, function() {
    var value, e_2_1;
    return __generator(this, function(_b) {
      switch (_b.label) {
        case 0:
          _b.trys.push([0, 5, 6, 11]);
          asyncIterable_1 = __asyncValues(asyncIterable);
          _b.label = 1;
        case 1:
          return [4, asyncIterable_1.next()];
        case 2:
          if (!(asyncIterable_1_1 = _b.sent(), !asyncIterable_1_1.done)) return [3, 4];
          value = asyncIterable_1_1.value;
          subscriber.next(value);
          if (subscriber.closed) {
            return [2];
          }
          _b.label = 3;
        case 3:
          return [3, 1];
        case 4:
          return [3, 11];
        case 5:
          e_2_1 = _b.sent();
          e_2 = { error: e_2_1 };
          return [3, 11];
        case 6:
          _b.trys.push([6, , 9, 10]);
          if (!(asyncIterable_1_1 && !asyncIterable_1_1.done && (_a = asyncIterable_1.return))) return [3, 8];
          return [4, _a.call(asyncIterable_1)];
        case 7:
          _b.sent();
          _b.label = 8;
        case 8:
          return [3, 10];
        case 9:
          if (e_2) throw e_2.error;
          return [7];
        case 10:
          return [7];
        case 11:
          subscriber.complete();
          return [2];
      }
    });
  });
}

// node_modules/rxjs/dist/esm5/internal/util/executeSchedule.js
function executeSchedule(parentSubscription, scheduler, work, delay, repeat) {
  if (delay === void 0) {
    delay = 0;
  }
  if (repeat === void 0) {
    repeat = false;
  }
  var scheduleSubscription = scheduler.schedule(function() {
    work();
    if (repeat) {
      parentSubscription.add(this.schedule(null, delay));
    } else {
      this.unsubscribe();
    }
  }, delay);
  parentSubscription.add(scheduleSubscription);
  if (!repeat) {
    return scheduleSubscription;
  }
}

// node_modules/rxjs/dist/esm5/internal/operators/observeOn.js
function observeOn(scheduler, delay) {
  if (delay === void 0) {
    delay = 0;
  }
  return operate(function(source, subscriber) {
    source.subscribe(createOperatorSubscriber(subscriber, function(value) {
      return executeSchedule(subscriber, scheduler, function() {
        return subscriber.next(value);
      }, delay);
    }, function() {
      return executeSchedule(subscriber, scheduler, function() {
        return subscriber.complete();
      }, delay);
    }, function(err) {
      return executeSchedule(subscriber, scheduler, function() {
        return subscriber.error(err);
      }, delay);
    }));
  });
}

// node_modules/rxjs/dist/esm5/internal/operators/subscribeOn.js
function subscribeOn(scheduler, delay) {
  if (delay === void 0) {
    delay = 0;
  }
  return operate(function(source, subscriber) {
    subscriber.add(scheduler.schedule(function() {
      return source.subscribe(subscriber);
    }, delay));
  });
}

// node_modules/rxjs/dist/esm5/internal/scheduled/scheduleObservable.js
function scheduleObservable(input, scheduler) {
  return innerFrom(input).pipe(subscribeOn(scheduler), observeOn(scheduler));
}

// node_modules/rxjs/dist/esm5/internal/scheduled/schedulePromise.js
function schedulePromise(input, scheduler) {
  return innerFrom(input).pipe(subscribeOn(scheduler), observeOn(scheduler));
}

// node_modules/rxjs/dist/esm5/internal/scheduled/scheduleArray.js
function scheduleArray(input, scheduler) {
  return new Observable(function(subscriber) {
    var i6 = 0;
    return scheduler.schedule(function() {
      if (i6 === input.length) {
        subscriber.complete();
      } else {
        subscriber.next(input[i6++]);
        if (!subscriber.closed) {
          this.schedule();
        }
      }
    });
  });
}

// node_modules/rxjs/dist/esm5/internal/scheduled/scheduleIterable.js
function scheduleIterable(input, scheduler) {
  return new Observable(function(subscriber) {
    var iterator2;
    executeSchedule(subscriber, scheduler, function() {
      iterator2 = input[iterator]();
      executeSchedule(subscriber, scheduler, function() {
        var _a;
        var value;
        var done;
        try {
          _a = iterator2.next(), value = _a.value, done = _a.done;
        } catch (err) {
          subscriber.error(err);
          return;
        }
        if (done) {
          subscriber.complete();
        } else {
          subscriber.next(value);
        }
      }, 0, true);
    });
    return function() {
      return isFunction(iterator2 === null || iterator2 === void 0 ? void 0 : iterator2.return) && iterator2.return();
    };
  });
}

// node_modules/rxjs/dist/esm5/internal/scheduled/scheduleAsyncIterable.js
function scheduleAsyncIterable(input, scheduler) {
  if (!input) {
    throw new Error("Iterable cannot be null");
  }
  return new Observable(function(subscriber) {
    executeSchedule(subscriber, scheduler, function() {
      var iterator2 = input[Symbol.asyncIterator]();
      executeSchedule(subscriber, scheduler, function() {
        iterator2.next().then(function(result) {
          if (result.done) {
            subscriber.complete();
          } else {
            subscriber.next(result.value);
          }
        });
      }, 0, true);
    });
  });
}

// node_modules/rxjs/dist/esm5/internal/scheduled/scheduleReadableStreamLike.js
function scheduleReadableStreamLike(input, scheduler) {
  return scheduleAsyncIterable(readableStreamLikeToAsyncGenerator(input), scheduler);
}

// node_modules/rxjs/dist/esm5/internal/scheduled/scheduled.js
function scheduled(input, scheduler) {
  if (input != null) {
    if (isInteropObservable(input)) {
      return scheduleObservable(input, scheduler);
    }
    if (isArrayLike(input)) {
      return scheduleArray(input, scheduler);
    }
    if (isPromise(input)) {
      return schedulePromise(input, scheduler);
    }
    if (isAsyncIterable(input)) {
      return scheduleAsyncIterable(input, scheduler);
    }
    if (isIterable(input)) {
      return scheduleIterable(input, scheduler);
    }
    if (isReadableStreamLike(input)) {
      return scheduleReadableStreamLike(input, scheduler);
    }
  }
  throw createInvalidObservableTypeError(input);
}

// node_modules/rxjs/dist/esm5/internal/observable/from.js
function from(input, scheduler) {
  return scheduler ? scheduled(input, scheduler) : innerFrom(input);
}

// node_modules/rxjs/dist/esm5/internal/observable/of.js
function of() {
  var args = [];
  for (var _i = 0; _i < arguments.length; _i++) {
    args[_i] = arguments[_i];
  }
  var scheduler = popScheduler(args);
  return from(args, scheduler);
}

// node_modules/rxjs/dist/esm5/internal/observable/throwError.js
function throwError(errorOrErrorFactory, scheduler) {
  var errorFactory = isFunction(errorOrErrorFactory) ? errorOrErrorFactory : function() {
    return errorOrErrorFactory;
  };
  var init = function(subscriber) {
    return subscriber.error(errorFactory());
  };
  return new Observable(scheduler ? function(subscriber) {
    return scheduler.schedule(init, 0, subscriber);
  } : init);
}

// node_modules/rxjs/dist/esm5/internal/util/EmptyError.js
var EmptyError = createErrorClass(function(_super) {
  return function EmptyErrorImpl() {
    _super(this);
    this.name = "EmptyError";
    this.message = "no elements in sequence";
  };
});

// node_modules/rxjs/dist/esm5/internal/firstValueFrom.js
function firstValueFrom(source, config3) {
  var hasConfig = typeof config3 === "object";
  return new Promise(function(resolve, reject) {
    var subscriber = new SafeSubscriber({
      next: function(value) {
        resolve(value);
        subscriber.unsubscribe();
      },
      error: reject,
      complete: function() {
        if (hasConfig) {
          resolve(config3.defaultValue);
        } else {
          reject(new EmptyError());
        }
      }
    });
    source.subscribe(subscriber);
  });
}

// node_modules/rxjs/dist/esm5/internal/util/isDate.js
function isValidDate(value) {
  return value instanceof Date && !isNaN(value);
}

// node_modules/rxjs/dist/esm5/internal/observable/timer.js
function timer(dueTime, intervalOrScheduler, scheduler) {
  if (dueTime === void 0) {
    dueTime = 0;
  }
  if (scheduler === void 0) {
    scheduler = async;
  }
  var intervalDuration = -1;
  if (intervalOrScheduler != null) {
    if (isScheduler(intervalOrScheduler)) {
      scheduler = intervalOrScheduler;
    } else {
      intervalDuration = intervalOrScheduler;
    }
  }
  return new Observable(function(subscriber) {
    var due = isValidDate(dueTime) ? +dueTime - scheduler.now() : dueTime;
    if (due < 0) {
      due = 0;
    }
    var n5 = 0;
    return scheduler.schedule(function() {
      if (!subscriber.closed) {
        subscriber.next(n5++);
        if (0 <= intervalDuration) {
          this.schedule(void 0, intervalDuration);
        } else {
          subscriber.complete();
        }
      }
    }, due);
  });
}

// node_modules/rxjs/dist/esm5/internal/operators/take.js
function take(count) {
  return count <= 0 ? function() {
    return EMPTY;
  } : operate(function(source, subscriber) {
    var seen = 0;
    source.subscribe(createOperatorSubscriber(subscriber, function(value) {
      if (++seen <= count) {
        subscriber.next(value);
        if (count <= seen) {
          subscriber.complete();
        }
      }
    }));
  });
}

// node_modules/rxjs/dist/esm5/internal/operators/switchMap.js
function switchMap(project, resultSelector) {
  return operate(function(source, subscriber) {
    var innerSubscriber = null;
    var index = 0;
    var isComplete = false;
    var checkComplete = function() {
      return isComplete && !innerSubscriber && subscriber.complete();
    };
    source.subscribe(createOperatorSubscriber(subscriber, function(value) {
      innerSubscriber === null || innerSubscriber === void 0 ? void 0 : innerSubscriber.unsubscribe();
      var innerIndex = 0;
      var outerIndex = index++;
      innerFrom(project(value, outerIndex)).subscribe(innerSubscriber = createOperatorSubscriber(subscriber, function(innerValue) {
        return subscriber.next(resultSelector ? resultSelector(value, innerValue, outerIndex, innerIndex++) : innerValue);
      }, function() {
        innerSubscriber = null;
        checkComplete();
      }));
    }, function() {
      isComplete = true;
      checkComplete();
    }));
  });
}

// node_modules/rxjs/dist/esm5/internal/operators/takeUntil.js
function takeUntil(notifier) {
  return operate(function(source, subscriber) {
    innerFrom(notifier).subscribe(createOperatorSubscriber(subscriber, function() {
      return subscriber.complete();
    }, noop2));
    !subscriber.closed && source.subscribe(subscriber);
  });
}

// node_modules/@creit.tech/xbull-wallet-connect/mobile-sdk.js
var r5 = class {
  constructor() {
    this.isConnected = false;
  }
  sendEventToContentScript(e5, r7, o4) {
    return new Promise(((s5) => {
      const t7 = (e6) => {
        if (e6.source !== window || !e6.data || e6.origin !== window.origin) return;
        e6.data.eventId === o4 && (s5(e6), window.removeEventListener("message", t7, false));
      };
      window.addEventListener("message", t7, false), window.webkit.messageHandlers.cordova_iab.postMessage(JSON.stringify({ type: e5, eventId: o4, detail: r7 }));
    }));
  }
  async enableConnection() {
    const r7 = { origin: window.origin, host: window.location.host, permissions: { canRequestPublicKey: true, canRequestSign: true } }, o4 = await this.sendEventToContentScript(L2.XBULL_CONNECT, r7, crypto.randomUUID()), { detail: s5 } = o4.data;
    if (!s5 || s5.error) throw { code: s5?.code || -1, message: s5?.errorMessage || "Unexpected error" };
    this.isConnected = true;
  }
  async getAddress() {
    try {
      await this.enableConnection();
    } catch (e5) {
      return { error: { code: e5?.code || -1, message: e5?.message || "Unexpected error" } };
    }
    const r7 = { origin: window.origin, host: window.location.host }, o4 = await this.sendEventToContentScript(L2.XBULL_GET_PUBLIC_KEY, r7, crypto.randomUUID()), { detail: s5 } = o4.data;
    return !s5 || s5.error ? { error: { code: s5?.code || -1, message: s5?.errorMessage || "Unexpected error" } } : { address: s5.payload };
  }
  async signTransaction(r7) {
    if (r7.opts?.submit || r7.opts?.submitUrl) return { error: { code: -1, message: "Parameters `submit` and `submitUrl` are not supported" } };
    try {
      await this.enableConnection();
    } catch (e5) {
      return { error: { code: e5?.code || -1, message: e5?.message || "Unexpected error" } };
    }
    const o4 = { origin: window.origin, host: window.location.host, network: r7.opts?.networkPassphrase, publicKey: r7.opts?.address, xdr: r7.xdr, xdrType: "Transaction" }, s5 = await this.sendEventToContentScript(L2.XBULL_SIGN_XDR, o4, crypto.randomUUID()), { detail: t7 } = s5.data;
    return !t7 || t7.error ? { error: { code: t7?.code || -1, message: t7?.errorMessage || "Unexpected error" } } : { signedTxXdr: t7.payload.signedXdr, signerAddress: t7.payload.signerAddress };
  }
  async signMessage(r7, o4) {
    if (!r7) return { error: { code: -1, message: "The message must be defined." } };
    try {
      await this.enableConnection();
    } catch (e5) {
      return { error: { code: e5?.code || -1, message: e5?.message || "Unexpected error" } };
    }
    const s5 = { origin: window.origin, host: window.location.host, message: r7, publicKey: o4?.address, network: o4?.networkPassphrase }, t7 = await this.sendEventToContentScript(L2.XBULL_SIGN_MESSAGE, s5, crypto.randomUUID()), { detail: n5 } = t7.data;
    return !n5 || n5.error ? { error: { code: n5?.code || -1, message: n5?.errorMessage || "Unexpected error" } } : { signedMessage: n5.payload.signedMessage, signerAddress: n5.payload.signerAddress };
  }
  async getNetwork() {
    try {
      await this.enableConnection();
    } catch (e5) {
      return { error: { code: e5?.code || -1, message: e5?.message || "Unexpected error" } };
    }
    const r7 = { origin: window.origin, host: window.location.host }, o4 = await this.sendEventToContentScript(L2.XBULL_GET_NETWORK, r7, crypto.randomUUID()), { detail: s5 } = o4.data;
    return !s5 || s5.error ? { error: { code: s5?.code || -1, message: s5?.errorMessage || "Unexpected error" } } : { network: s5.payload.network, networkPassphrase: s5.payload.networkPassphrase };
  }
};

// node_modules/@creit.tech/xbull-wallet-connect/index.js
var w5 = class {
  constructor(o4) {
    this.closeCurrentPromises$ = new Subject(), this.closeObservables$ = new Subject(), this.initialResponse$ = new Subject(), this.initialResponseCompleted$ = new Subject(), this.connectResponse$ = new Subject(), this.connectResult$ = new Subject(), this.signResponse$ = new Subject(), this.signResult$ = new Subject(), this.signMessageResponse$ = new Subject(), this.signMessageResult$ = new Subject(), this.closeCurrentPromisesSubscription = timer(1e3, 1e3).pipe(takeUntil(this.closeObservables$)).subscribe((() => {
      this.target?.closed && this.closeCurrentPromises$.next();
    })), this.onInititalResponseSubscription = this.initialResponse$.pipe(takeUntil(this.closeObservables$)).subscribe(((e5) => {
      const s5 = this.decryptFromReceiver({ oneTimeCode: e5.data.oneTimeCode, payload: e5.data.message, senderPublicKey: e5.data.publicKey });
      JSON.parse(s5).providedSession === this.session() && (this.targetPublicKey = e5.data.publicKey, this.initialResponseCompleted$.next());
    })), this.onConnectResponseSubscription = this.connectResponse$.pipe(takeUntil(this.closeObservables$)).subscribe(((e5) => {
      if (!this.targetPublicKey) return void this.connectResult$.next({ success: false, message: "Wallet encryption public key is not provided, request rejected." });
      if (!e5.data.success) return void this.connectResult$.next({ success: false, message: "Request rejected from the wallet" });
      const s5 = this.decryptFromReceiver({ oneTimeCode: e5.data.oneTimeCode, payload: e5.data.message, senderPublicKey: this.targetPublicKey }), t7 = JSON.parse(s5);
      this.connectResult$.next({ success: true, publicKey: t7.publicKey });
    })), this.onSignResponseSubscription = this.signResponse$.pipe(takeUntil(this.closeObservables$)).subscribe(((e5) => {
      if (!this.targetPublicKey) return void this.signResult$.next({ success: false, message: "Wallet encryption public key is not provided, request rejected." });
      if (!e5.data.success) return void this.signResult$.next({ success: false, message: "Request rejected from the wallet" });
      const s5 = this.decryptFromReceiver({ oneTimeCode: e5.data.oneTimeCode, payload: e5.data.message, senderPublicKey: this.targetPublicKey }), t7 = JSON.parse(s5);
      this.signResult$.next({ success: true, xdr: t7.xdr });
    })), this.onSignMessageResponseSubscription = this.signMessageResponse$.pipe(takeUntil(this.closeObservables$)).subscribe(((e5) => {
      if (!this.targetPublicKey) return void this.signMessageResult$.next({ success: false, message: "Wallet encryption public key is not provided, request rejected." });
      if (!e5.data.success) return void this.signMessageResult$.next({ success: false, message: "Request rejected from the wallet" });
      const s5 = this.decryptFromReceiver({ oneTimeCode: e5.data.oneTimeCode, payload: e5.data.message, senderPublicKey: this.targetPublicKey }), t7 = JSON.parse(s5);
      this.signMessageResult$.next({ success: true, ...t7 });
    })), this.preferredTarget = o4?.preferredTarget || "extension", this.walletUrl = o4?.url || "https://wallet.xbull.app/connect";
    const d5 = import_tweetnacl.box.keyPair(), u4 = (0, import_tweetnacl_util.encodeBase64)((0, import_tweetnacl.randomBytes)(24));
    this.encryptForReceiver = (r7) => {
      const n5 = (0, import_tweetnacl.randomBytes)(24), o5 = (0, import_tweetnacl.box)((0, import_tweetnacl_util.decodeUTF8)(r7.data), n5, r7.receiverPublicKey, d5.secretKey);
      return { message: (0, import_tweetnacl_util.encodeBase64)(o5), oneTimeCode: (0, import_tweetnacl_util.encodeBase64)(n5) };
    }, this.decryptFromReceiver = (s5) => {
      const t7 = import_tweetnacl.box.open((0, import_tweetnacl_util.decodeBase64)(s5.payload), (0, import_tweetnacl_util.decodeBase64)(s5.oneTimeCode), (0, import_tweetnacl_util.decodeBase64)(s5.senderPublicKey), d5.secretKey);
      if (!t7) throw new Error("Decrypted message is null");
      return (0, import_tweetnacl_util.encodeUTF8)(t7);
    }, this.publicKey = () => d5.publicKey, this.session = () => u4.slice();
    const g4 = (e5) => {
      switch (e5.data.type) {
        case L2.XBULL_INITIAL_RESPONSE:
          this.initialResponse$.next(e5);
          break;
        case L2.XBULL_CONNECT_RESPONSE:
          this.connectResponse$.next(e5);
          break;
        case L2.XBULL_SIGN_RESPONSE:
          this.signResponse$.next(e5);
          break;
        case L2.XBULL_SIGN_MESSAGE_RESPONSE:
          this.signMessageResponse$.next(e5);
      }
    };
    window.addEventListener("message", g4), this.closeObservables$.asObservable().pipe(take(1)).subscribe((() => {
      window.removeEventListener("message", g4);
    }));
  }
  openWallet() {
    return this.target && !this.target.closed && (this.target.close(), this.target = null, this.closeCurrentPromises$.next()), this.target = window.open(`${this.walletUrl}?public=${encodeURIComponent((0, import_tweetnacl_util.encodeBase64)(this.publicKey()))}&session=${encodeURIComponent(this.session())}`, "xBull_Wallet_app", "width=380,height=640,left=100,top=100"), firstValueFrom(this.initialResponseCompleted$.pipe(takeUntil(this.closeCurrentPromises$)).pipe(takeUntil(this.closeObservables$)));
  }
  closeWallet() {
    this.target && (this.target?.close(), this.target = null);
  }
  async connect(e5 = { canRequestPublicKey: true, canRequestSign: true }) {
    const s5 = window?.webkit?.messageHandlers?.cordova_iab ? new r5() : window.xBullSDK;
    if (s5 && "extension" === this.preferredTarget) {
      const e6 = await s5.getAddress();
      if (_4(e6)) throw e6.error;
      return e6.address;
    }
    {
      if (await this.openWallet(), !this.target || !this.targetPublicKey) throw new Error("xBull Wallet is not open, we can't connect with it");
      const { message: s6, oneTimeCode: t7 } = this.encryptForReceiver({ data: JSON.stringify(e5), receiverPublicKey: (0, import_tweetnacl_util.decodeBase64)(this.targetPublicKey) }), i6 = { type: L2.XBULL_CONNECT, message: s6, oneTimeCode: t7 };
      this.target.postMessage(i6, "*");
      const n5 = this.connectResult$.asObservable().pipe(switchMap(((e6) => e6.success ? (this.closeWallet(), of(e6.publicKey)) : (this.closeWallet(), throwError((() => new Error(e6.message))))))).pipe(take(1)).pipe(takeUntil(this.closeCurrentPromises$)).pipe(takeUntil(this.closeObservables$));
      return firstValueFrom(n5);
    }
  }
  async sign(e5) {
    const s5 = window?.webkit?.messageHandlers?.cordova_iab ? new r5() : window.xBullSDK;
    if (s5 && "extension" === this.preferredTarget) {
      const t7 = await s5.signTransaction({ xdr: e5.xdr, opts: { networkPassphrase: e5.network, address: e5.publicKey } });
      if (_4(t7)) throw t7.error;
      return t7.signedTxXdr;
    }
    {
      if (await this.openWallet(), !this.target || !this.targetPublicKey) throw new Error("xBull Wallet is not open, we can't connect with it");
      if ("string" != typeof e5.xdr) throw new Error("XDR provided needs to be a string value");
      const { message: s6, oneTimeCode: t7 } = this.encryptForReceiver({ data: JSON.stringify(e5), receiverPublicKey: (0, import_tweetnacl_util.decodeBase64)(this.targetPublicKey) }), i6 = { type: L2.XBULL_SIGN, message: s6, oneTimeCode: t7 };
      this.target.postMessage(i6, "*");
      const n5 = this.signResult$.asObservable().pipe(switchMap(((e6) => e6.success ? (this.closeWallet(), of(e6.xdr)) : (this.closeWallet(), throwError((() => new Error(e6.message))))))).pipe(take(1)).pipe(takeUntil(this.closeCurrentPromises$)).pipe(takeUntil(this.closeObservables$));
      return firstValueFrom(n5);
    }
  }
  async signMessage(e5, s5) {
    const t7 = window?.webkit?.messageHandlers?.cordova_iab ? new r5() : window.xBullSDK;
    if (t7 && "extension" === this.preferredTarget) {
      const i6 = await t7.signMessage(e5, s5);
      if (_4(i6)) throw i6.error;
      return i6;
    }
    {
      if (await this.openWallet(), !this.target || !this.targetPublicKey) throw new Error("xBull Wallet is not open, we can't connect with it");
      if ("string" != typeof e5) throw new Error("XDR provided needs to be a string value");
      const t8 = this.encryptForReceiver({ data: JSON.stringify({ message: e5, opts: s5 }), receiverPublicKey: (0, import_tweetnacl_util.decodeBase64)(this.targetPublicKey) }), i6 = { type: L2.XBULL_SIGN_MESSAGE, message: t8.message, oneTimeCode: t8.oneTimeCode };
      this.target.postMessage(i6, "*");
      const n5 = this.signMessageResult$.asObservable().pipe(switchMap(((e6) => e6.success ? (this.closeWallet(), of({ signedMessage: e6.signedMessage, signerAddress: e6.signerAddress })) : (this.closeWallet(), throwError((() => new Error(e6.message))))))).pipe(take(1)).pipe(takeUntil(this.closeCurrentPromises$)).pipe(takeUntil(this.closeObservables$));
      return firstValueFrom(n5);
    }
  }
  closeConnections() {
    this.closeObservables$.next(), this.closeCurrentPromises$.next(), this.closeObservables$.complete(), this.closeCurrentPromises$.complete();
  }
};

// node_modules/@creit.tech/stellar-wallets-kit/esm/sdk/modules/xbull.module.js
var XBULL_ID = "xbull";
var xBullModule = class {
  constructor() {
    Object.defineProperty(this, "moduleType", {
      enumerable: true,
      configurable: true,
      writable: true,
      value: ModuleType.HOT_WALLET
    });
    Object.defineProperty(this, "productId", {
      enumerable: true,
      configurable: true,
      writable: true,
      value: XBULL_ID
    });
    Object.defineProperty(this, "productName", {
      enumerable: true,
      configurable: true,
      writable: true,
      value: "xBull"
    });
    Object.defineProperty(this, "productUrl", {
      enumerable: true,
      configurable: true,
      writable: true,
      value: "https://xbull.app"
    });
    Object.defineProperty(this, "productIcon", {
      enumerable: true,
      configurable: true,
      writable: true,
      value: "https://stellar.creit.tech/wallet-icons/xbull.png"
    });
  }
  isAvailable() {
    return Promise.resolve(true);
  }
  async getAddress() {
    try {
      const bridge = new w5();
      const publicKey = await bridge.connect();
      bridge.closeConnections();
      return { address: publicKey };
    } catch (e5) {
      throw parseError(e5);
    }
  }
  async signTransaction(xdr, opts) {
    try {
      const bridge = new w5();
      const signedXdr = await bridge.sign({
        xdr,
        publicKey: opts?.address,
        network: opts?.networkPassphrase
      });
      bridge.closeConnections();
      return { signedTxXdr: signedXdr, signerAddress: opts?.address };
    } catch (e5) {
      throw parseError(e5);
    }
  }
  signAuthEntry() {
    return Promise.reject({
      code: -3,
      message: 'xBull does not support the "signAuthEntry" function'
    });
  }
  async signMessage(message, opts) {
    try {
      const bridge = new w5();
      const result = await bridge.signMessage(message, {
        address: opts?.address,
        networkPassphrase: opts?.networkPassphrase
      });
      bridge.closeConnections();
      return result;
    } catch (e5) {
      throw parseError(e5);
    }
  }
  getNetwork() {
    return Promise.reject({
      code: -3,
      message: 'xBull does not support the "getNetwork" function'
    });
  }
};

// node_modules/@creit.tech/stellar-wallets-kit/esm/sdk/modules/freighter.module.js
var import_freighter_api = __toESM(require_index_min(), 1);

// node_modules/@creit.tech/stellar-wallets-kit/esm/deps/jsr.io/@std/encoding/1.0.10/_validate_binary_like.js
var encoder = new TextEncoder();

// node_modules/@creit.tech/stellar-wallets-kit/esm/deps/jsr.io/@std/encoding/1.0.10/_common32.js
var padding = "=".charCodeAt(0);
var alphabet = {
  base32: new TextEncoder().encode("ABCDEFGHIJKLMNOPQRSTUVWXYZ234567"),
  base32hex: new TextEncoder().encode("0123456789ABCDEFGHIJKLMNOPQRSTUV"),
  base32crockford: new TextEncoder().encode("0123456789ABCDEFGHJKMNPQRSTVWXYZ")
};
var rAlphabet = {
  base32: new Uint8Array(128).fill(32),
  // alphabet.base32.length
  base32hex: new Uint8Array(128).fill(32),
  base32crockford: new Uint8Array(128).fill(32)
};
alphabet.base32.forEach((byte, i6) => rAlphabet.base32[byte] = i6);
alphabet.base32hex.forEach((byte, i6) => rAlphabet.base32hex[byte] = i6);
alphabet.base32crockford.forEach((byte, i6) => rAlphabet.base32crockford[byte] = i6);

// node_modules/@creit.tech/stellar-wallets-kit/esm/deps/jsr.io/@std/encoding/1.0.10/_common_detach.js
function detach(buffer, maxSize) {
  const originalSize = buffer.length;
  if (buffer.byteOffset) {
    const b4 = new Uint8Array(buffer.buffer);
    b4.set(buffer);
    buffer = b4.subarray(0, originalSize);
  }
  buffer = new Uint8Array(buffer.buffer.transfer(maxSize));
  buffer.set(buffer.subarray(0, originalSize), maxSize - originalSize);
  return [buffer, maxSize - originalSize];
}

// node_modules/@creit.tech/stellar-wallets-kit/esm/deps/jsr.io/@std/encoding/1.0.10/base32.js
var padding2 = "=".charCodeAt(0);
var alphabet2 = new TextEncoder().encode("ABCDEFGHIJKLMNOPQRSTUVWXYZ234567");
var rAlphabet2 = new Uint8Array(128).fill(32);
alphabet2.forEach((byte, i6) => rAlphabet2[byte] = i6);

// node_modules/@creit.tech/stellar-wallets-kit/esm/deps/jsr.io/@std/encoding/1.0.10/base58.js
var base58alphabet = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz".split("");

// node_modules/@creit.tech/stellar-wallets-kit/esm/deps/jsr.io/@std/encoding/1.0.10/_common64.js
var padding3 = "=".charCodeAt(0);
var alphabet3 = {
  base64: new TextEncoder().encode("ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/"),
  base64url: new TextEncoder().encode("ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_")
};
var rAlphabet3 = {
  base64: new Uint8Array(128).fill(64),
  // alphabet.base64.length
  base64url: new Uint8Array(128).fill(64)
};
alphabet3.base64.forEach((byte, i6) => rAlphabet3.base64[byte] = i6);
alphabet3.base64url.forEach((byte, i6) => rAlphabet3.base64url[byte] = i6);
function calcSizeBase64(originalSize) {
  return ((originalSize + 2) / 3 | 0) * 4;
}
function encode2(buffer, i6, o4, alphabet8, padding6) {
  i6 += 2;
  for (; i6 < buffer.length; i6 += 3) {
    const x4 = buffer[i6 - 2] << 16 | buffer[i6 - 1] << 8 | buffer[i6];
    buffer[o4++] = alphabet8[x4 >> 18];
    buffer[o4++] = alphabet8[x4 >> 12 & 63];
    buffer[o4++] = alphabet8[x4 >> 6 & 63];
    buffer[o4++] = alphabet8[x4 & 63];
  }
  switch (i6) {
    case buffer.length + 1: {
      const x4 = buffer[i6 - 2] << 16;
      buffer[o4++] = alphabet8[x4 >> 18];
      buffer[o4++] = alphabet8[x4 >> 12 & 63];
      buffer[o4++] = padding6;
      buffer[o4++] = padding6;
      break;
    }
    case buffer.length: {
      const x4 = buffer[i6 - 2] << 16 | buffer[i6 - 1] << 8;
      buffer[o4++] = alphabet8[x4 >> 18];
      buffer[o4++] = alphabet8[x4 >> 12 & 63];
      buffer[o4++] = alphabet8[x4 >> 6 & 63];
      buffer[o4++] = padding6;
      break;
    }
  }
  return o4;
}

// node_modules/@creit.tech/stellar-wallets-kit/esm/deps/jsr.io/@std/encoding/1.0.10/base64.js
var padding4 = "=".charCodeAt(0);
var alphabet4 = new TextEncoder().encode("ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/");
var rAlphabet4 = new Uint8Array(128).fill(64);
alphabet4.forEach((byte, i6) => rAlphabet4[byte] = i6);
function encodeBase64(data) {
  if (typeof data === "string") {
    data = new TextEncoder().encode(data);
  } else if (data instanceof ArrayBuffer)
    data = new Uint8Array(data).slice();
  else
    data = data.slice();
  const [output, i6] = detach(data, calcSizeBase64(data.length));
  encode2(output, i6, 0, alphabet4, padding4);
  return new TextDecoder().decode(output);
}

// node_modules/@creit.tech/stellar-wallets-kit/esm/deps/jsr.io/@std/encoding/1.0.10/base64url.js
var padding5 = "=".charCodeAt(0);
var alphabet5 = new TextEncoder().encode("ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_");
var rAlphabet5 = new Uint8Array(128).fill(64);
alphabet5.forEach((byte, i6) => rAlphabet5[byte] = i6);

// node_modules/@creit.tech/stellar-wallets-kit/esm/deps/jsr.io/@std/encoding/1.0.10/_common16.js
var alphabet6 = new TextEncoder().encode("0123456789abcdef");
var rAlphabet6 = new Uint8Array(128).fill(16);
alphabet6.forEach((byte, i6) => rAlphabet6[byte] = i6);
new TextEncoder().encode("ABCDEF").forEach((byte, i6) => rAlphabet6[byte] = i6 + 10);

// node_modules/@creit.tech/stellar-wallets-kit/esm/deps/jsr.io/@std/encoding/1.0.10/hex.js
var alphabet7 = new TextEncoder().encode("0123456789abcdef");
var rAlphabet7 = new Uint8Array(128).fill(16);
alphabet7.forEach((byte, i6) => rAlphabet7[byte] = i6);
new TextEncoder().encode("ABCDEF").forEach((byte, i6) => rAlphabet7[byte] = i6 + 10);

// node_modules/@creit.tech/stellar-wallets-kit/esm/deps/jsr.io/@std/encoding/1.0.10/varint.js
var AB = new ArrayBuffer(8);
var U32_VIEW = new Uint32Array(AB);
var U64_VIEW = new BigUint64Array(AB);

// node_modules/@creit.tech/stellar-wallets-kit/esm/sdk/modules/freighter.module.js
var FREIGHTER_ID = "freighter";
var FreighterModule = class {
  constructor() {
    Object.defineProperty(this, "moduleType", {
      enumerable: true,
      configurable: true,
      writable: true,
      value: ModuleType.HOT_WALLET
    });
    Object.defineProperty(this, "productId", {
      enumerable: true,
      configurable: true,
      writable: true,
      value: FREIGHTER_ID
    });
    Object.defineProperty(this, "productName", {
      enumerable: true,
      configurable: true,
      writable: true,
      value: "Freighter"
    });
    Object.defineProperty(this, "productUrl", {
      enumerable: true,
      configurable: true,
      writable: true,
      value: "https://freighter.app"
    });
    Object.defineProperty(this, "productIcon", {
      enumerable: true,
      configurable: true,
      writable: true,
      value: "https://stellar.creit.tech/wallet-icons/freighter.png"
    });
  }
  async runChecks() {
    if (!await this.isAvailable()) {
      throw new Error("Freighter is not connected");
    }
  }
  async isAvailable() {
    if (window.stellar?.provider === "freighter" && window.stellar?.platform === "mobile")
      return false;
    try {
      const response = await (0, import_freighter_api.isConnected)();
      return !response.error && response.isConnected;
    } catch (e5) {
      console.error(e5);
      return false;
    }
  }
  async getAddress(params) {
    try {
      await this.runChecks();
      if (params?.skipRequestAccess !== true) {
        const requestAccessResult = await (0, import_freighter_api.requestAccess)();
        if (requestAccessResult.error)
          return Promise.reject(parseError(requestAccessResult.error));
      }
      const { address, error } = await (0, import_freighter_api.getAddress)();
      if (error)
        return Promise.reject(error);
      if (!address) {
        return Promise.reject({
          code: -3,
          message: "Getting the address from Freighter is not allowed, please request access first."
        });
      }
      return { address };
    } catch (e5) {
      throw parseError(e5);
    }
  }
  async signTransaction(xdr, opts) {
    try {
      await this.runChecks();
      const { signedTxXdr, signerAddress, error } = await (0, import_freighter_api.signTransaction)(xdr, {
        address: opts?.address,
        networkPassphrase: opts?.networkPassphrase
      });
      if (error)
        return Promise.reject(error);
      return { signedTxXdr, signerAddress };
    } catch (e5) {
      throw parseError(e5);
    }
  }
  async signAuthEntry(authEntry, opts) {
    try {
      await this.runChecks();
      const { signedAuthEntry, signerAddress, error } = await (0, import_freighter_api.signAuthEntry)(authEntry, {
        address: opts?.address,
        networkPassphrase: opts?.networkPassphrase
      });
      if (error)
        return Promise.reject(error);
      if (!signedAuthEntry) {
        return Promise.reject({
          code: -3,
          message: "signedAuthEntry returned from Freighter is undefined."
        });
      }
      return {
        signedAuthEntry: typeof signedAuthEntry === "string" ? signedAuthEntry : encodeBase64(new Uint8Array(signedAuthEntry)),
        signerAddress
      };
    } catch (e5) {
      throw parseError(e5);
    }
  }
  async signMessage(message, opts) {
    try {
      await this.runChecks();
      const { signedMessage, signerAddress, error } = await (0, import_freighter_api.signMessage)(message, {
        address: opts?.address,
        networkPassphrase: opts?.networkPassphrase
      });
      if (error)
        return Promise.reject(error);
      if (!signedMessage) {
        return Promise.reject({
          code: -3,
          message: "signedMessage returned from Freighter is undefined."
        });
      }
      return {
        signedMessage: typeof signedMessage === "string" ? signedMessage : encodeBase64(new Uint8Array(signedMessage)),
        signerAddress
      };
    } catch (e5) {
      throw parseError(e5);
    }
  }
  async getNetwork() {
    try {
      await this.runChecks();
      const { network, networkPassphrase, error } = await (0, import_freighter_api.getNetwork)();
      if (error)
        return Promise.reject(error);
      return { network, networkPassphrase };
    } catch (e5) {
      throw parseError(e5);
    }
  }
};

// node_modules/@creit.tech/stellar-wallets-kit/esm/sdk/modules/lobstr.module.js
var import_signer_extension_api = __toESM(require_index_min2(), 1);
var LOBSTR_ID = "lobstr";
var LobstrModule = class {
  constructor() {
    Object.defineProperty(this, "moduleType", {
      enumerable: true,
      configurable: true,
      writable: true,
      value: ModuleType.HOT_WALLET
    });
    Object.defineProperty(this, "productId", {
      enumerable: true,
      configurable: true,
      writable: true,
      value: LOBSTR_ID
    });
    Object.defineProperty(this, "productName", {
      enumerable: true,
      configurable: true,
      writable: true,
      value: "LOBSTR"
    });
    Object.defineProperty(this, "productUrl", {
      enumerable: true,
      configurable: true,
      writable: true,
      value: "https://lobstr.co"
    });
    Object.defineProperty(this, "productIcon", {
      enumerable: true,
      configurable: true,
      writable: true,
      value: "https://stellar.creit.tech/wallet-icons/lobstr.png"
    });
  }
  async runChecks() {
    if (!await this.isAvailable()) {
      throw new Error(`Lobstr is not connected`);
    }
  }
  async isAvailable() {
    return (0, import_signer_extension_api.isConnected)();
  }
  async getAddress() {
    try {
      await this.runChecks();
      const address = await (0, import_signer_extension_api.getPublicKey)();
      return { address };
    } catch (e5) {
      throw parseError(e5);
    }
  }
  async signTransaction(xdr, opts) {
    if (opts?.address) {
      console.warn(`Lobstr doesn't allow specifying what public key should sign the transaction, we skip the value`);
    }
    if (opts?.networkPassphrase) {
      console.warn(`Lobstr doesn't allow specifying the network that should be used, we skip the value`);
    }
    try {
      await this.runChecks();
      const signedTxXdr = await (0, import_signer_extension_api.signTransaction)(xdr);
      return { signedTxXdr };
    } catch (e5) {
      throw parseError(e5);
    }
  }
  async signMessage(message, opts) {
    if (opts?.address) {
      console.warn(`Lobstr doesn't allow specifying what public key should sign the transaction, we skip the value`);
    }
    if (opts?.networkPassphrase) {
      console.warn(`Lobstr doesn't allow specifying the network that should be used, we skip the value`);
    }
    try {
      await this.runChecks();
      const result = await (0, import_signer_extension_api.signMessage)(message);
      if (!result) {
        throw new Error("Signing message failed");
      }
      return result;
    } catch (e5) {
      throw parseError(e5);
    }
  }
  signAuthEntry() {
    return Promise.reject({
      code: -3,
      message: 'Lobstr does not support the "signAuthEntry" function'
    });
  }
  getNetwork() {
    return Promise.reject({
      code: -3,
      message: 'Lobstr does not support the "getNetwork" function'
    });
  }
};

// node_modules/@albedo-link/intent/src/random-token-generator.js
function generateRandomToken() {
  const rn = new Uint32Array(4);
  if (typeof crypto !== "undefined" && crypto.getRandomValues) {
    crypto.getRandomValues(rn);
  } else {
    for (let i6 = 0; i6 < rn.length; i6++) {
      rn[i6] = Math.floor(Math.random() * 4294967295);
    }
  }
  return Array.from(rn).map((n5) => n5.toString(36)).join("");
}

// node_modules/@albedo-link/intent/src/intent-interface.js
var intentInterface = {
  public_key: {
    title: "View public key",
    description: "Requests account public key. It's a simple way of authentication for Stellar-based applications. The response ensures that a user owns the corresponding secret key.",
    implicitFlow: false,
    params: {
      token: {
        description: "Verification token generated by the application (should be unique or random).",
        type: "string",
        required: false
      },
      callback: {
        description: "Optional URL callback where Albedo will POST a signed token and public key.",
        type: "string",
        required: false
      },
      require_existing: {
        description: "Allow existing Albedo accounts only.",
        type: "boolean",
        required: false
      }
    },
    returns: {
      pubkey: {
        description: "User-selected public key.",
        type: "string"
      },
      signed_message: {
        description: "HEX-encoded authentication message derived from the public key and verification token.",
        type: "string"
      },
      signature: {
        description: "HEX-encoded ED25519 signature of the authentication message that can be further used to verify user's keypair ownership.",
        type: "string"
      }
    }
  },
  sign_message: {
    title: "Sign text message",
    description: "Requests arbitrary message signing. Can be used to implement identity/ownership verification.",
    implicitFlow: true,
    params: {
      message: {
        description: "Text message to sign.",
        type: "string",
        required: true
      },
      pubkey: {
        description: "Specific public key requested by the application.",
        type: "string",
        required: false
      },
      callback: {
        description: "Optional URL callback where Albedo will POST a signed message.",
        type: "string",
        required: false
      }
    },
    returns: {
      pubkey: {
        description: "User-selected public key.",
        type: "string"
      },
      original_message: {
        description: "Text message to sign from request.",
        type: "string"
      },
      signed_message: {
        description: "HEX-encoded message derived from the public key and original message.",
        type: "string"
      },
      message_signature: {
        description: "HEX-encoded ED25519 signature of the signed message.",
        type: "string"
      }
    }
  },
  tx: {
    title: "Sign transaction",
    description: "Requests a signature for the transaction. Returns the signed transaction envelope that can be submitted to the network or used for multi-sig coordination.",
    implicitFlow: true,
    params: {
      xdr: {
        description: "XDR-encoded transaction envelope to sign.",
        type: "string",
        required: true
      },
      pubkey: {
        description: "Specific public key requested by the application.",
        type: "string",
        required: false
      },
      network: {
        description: "Stellar network identifier.",
        type: "string",
        required: false
      },
      callback: {
        description: "Optional URL callback where Albedo will POST the signed transaction XDR instead of submitting it to Horizon.",
        type: "string",
        required: false
      },
      description: {
        description: "Optional human-friendly short transaction description provided by developers.",
        type: "string",
        required: false
      },
      submit: {
        description: "If set, the signed transaction will be submitted to the Horizon server instead of returning it to the application.",
        type: "boolean",
        required: false
      }
    },
    returns: {
      xdr: {
        description: "XDR-encoded transaction envelope from request.",
        type: "string"
      },
      tx_hash: {
        description: "HEX-encoded transaction hash.",
        type: "string"
      },
      signed_envelope_xdr: {
        description: "XDR-encoded transaction envelope with new signatures.",
        type: "string"
      },
      network: {
        description: "Stellar network identifier.",
        type: "string"
      },
      result: {
        description: "Optional response from Horizon if the transaction has been submitted automatically.",
        type: "object"
      }
    }
  },
  pay: {
    title: "Make payment",
    description: "Requests a payment from a user. Works with any Stellar asset, supports transaction memo.",
    implicitFlow: true,
    params: {
      amount: {
        description: "Requested payment amount.",
        type: "string",
        required: true
      },
      destination: {
        description: "Payment destination address.",
        type: "string",
        required: true
      },
      asset_code: {
        description: "Asset code (skip for XLM).",
        type: "string",
        required: false
      },
      asset_issuer: {
        description: "Asset issuer (skip for XLM).",
        type: "string",
        required: false
      },
      memo: {
        description: "Transaction memo (required for exchanges and some anchors).",
        type: "string",
        required: false
      },
      memo_type: {
        description: "Transaction memo type.",
        type: "string",
        required: false
      },
      pubkey: {
        description: "Specific public key requested by the application.",
        type: "string",
        required: false
      },
      network: {
        description: "Stellar network identifier or private network passphrase.",
        type: "string",
        required: false
      },
      callback: {
        description: "Optional URL callback where Albedo will POST the signed transaction XDR instead of submitting it to Horizon. ",
        type: "string",
        required: false
      },
      submit: {
        description: "If set, the signed transaction will be submitted to the Horizon server instead of returning it to the application.",
        type: "boolean",
        required: false
      }
    },
    returns: {
      amount: {
        description: "Payment amount from request.",
        type: "string"
      },
      destination: {
        description: "Payment destination address from request.",
        type: "string"
      },
      asset_code: {
        description: "Asset code from request.",
        type: "string"
      },
      asset_issuer: {
        description: "Asset issuer from request.",
        type: "string"
      },
      memo: {
        description: "Transaction memo from request.",
        type: "string"
      },
      memo_type: {
        description: "Transaction memo type from request.",
        type: "string"
      },
      tx_hash: {
        description: "HEX-encoded transaction hash.",
        type: "string"
      },
      signed_envelope_xdr: {
        description: "XDR-encoded transaction envelope with new signatures.",
        type: "string"
      },
      pubkey: {
        description: "User-selected public key.",
        type: "string"
      },
      network: {
        description: "Stellar network identifier.",
        type: "string"
      },
      result: {
        description: "Optional response from Horizon if the transaction has been submitted automatically.",
        type: "object"
      }
    }
  },
  trust: {
    title: "Establish trustline",
    description: "Requests permission to create a trustline to a given Stellar asset. Gradually simplifies the process of creating trustlines for anchors, ICOs, and airdrops.",
    implicitFlow: true,
    params: {
      asset_code: {
        description: "Trustline asset code.",
        type: "string",
        required: true
      },
      asset_issuer: {
        description: "Trustline asset issuer address.",
        type: "string",
        required: true
      },
      limit: {
        description: "Trust limit.",
        type: "string",
        required: false
      },
      memo: {
        description: "Transaction memo (required for exchanges and some anchors).",
        type: "string",
        required: false
      },
      memo_type: {
        description: "Transaction memo type.",
        type: "string",
        required: false
      },
      pubkey: {
        description: "Specific public key requested by the application.",
        type: "string",
        required: false
      },
      network: {
        description: "Stellar network identifier or private network passphrase.",
        type: "string",
        required: false
      },
      callback: {
        description: "Optional URL callback where Albedo will POST the signed transaction XDR instead of submitting it to Horizon. ",
        type: "string",
        required: false
      },
      submit: {
        description: "If set, the signed transaction will be submitted to the Horizon server instead of returning it to the application.",
        type: "boolean",
        required: false
      }
    },
    returns: {
      asset_code: {
        description: "Trustline asset code from request.",
        type: "string"
      },
      asset_issuer: {
        description: "Trustline asset issuer address from request.",
        type: "string"
      },
      limit: {
        description: "Trust limit from request.",
        type: "string"
      },
      tx_hash: {
        description: "HEX-encoded transaction hash.",
        type: "string"
      },
      signed_envelope_xdr: {
        description: "XDR-encoded transaction envelope with new signatures.",
        type: "string"
      },
      pubkey: {
        description: "User-selected public key.",
        type: "string"
      },
      network: {
        description: "Stellar network identifier.",
        type: "string"
      },
      result: {
        description: "Optional response from Horizon if the transaction has been submitted automatically.",
        type: "object"
      }
    }
  },
  exchange: {
    title: "Swap tokens",
    description: "Requests permission to buy tokens on Stellar DEX at market price.",
    implicitFlow: false,
    params: {
      amount: {
        description: "The amount of asset to buy.",
        type: "string",
        required: true
      },
      max_price: {
        description: "Maximum price the user willing to pay.",
        type: "string",
        required: true
      },
      sell_asset_code: {
        description: "Asset code of the asset to sell.",
        type: "string",
        required: false
      },
      sell_asset_issuer: {
        description: "Issuer account of the asset to sell.",
        type: "string",
        required: false
      },
      buy_asset_code: {
        description: "Asset code of the asset to buy.",
        type: "string",
        required: false
      },
      buy_asset_issuer: {
        description: "Issuer account of the asset to buy.",
        type: "string",
        required: false
      },
      memo: {
        description: "Transaction memo (required for exchanges and some anchors).",
        type: "string",
        required: false
      },
      memo_type: {
        description: "Transaction memo type.",
        type: "string",
        required: false
      },
      pubkey: {
        description: "Specific public key requested by the application.",
        type: "string",
        required: false
      },
      network: {
        description: "Stellar network identifier or private network passphrase.",
        type: "string",
        required: false
      },
      callback: {
        description: "Optional URL callback where Albedo will POST the signed transaction XDR instead of submitting it to Horizon.",
        type: "string",
        required: false
      },
      submit: {
        description: "If set, the signed transaction will be submitted to the Horizon server instead of returning it to the application.",
        type: "boolean",
        required: false
      }
    },
    returns: {
      amount: {
        description: "The amount of asset to buy from request.",
        type: "string"
      },
      max_price: {
        description: "Maximum price the user willing to pay from request.",
        type: "string"
      },
      sell_asset_code: {
        description: "Asset code of the asset to sell from request.",
        type: "string"
      },
      sell_asset_issuer: {
        description: "Issuer account of the asset to sell from request.",
        type: "string"
      },
      buy_asset_code: {
        description: "Asset code of the asset to buy from request.",
        type: "string"
      },
      buy_asset_issuer: {
        description: "Issuer account of the asset to buy from request.",
        type: "string"
      },
      tx_hash: {
        description: "HEX-encoded transaction hash.",
        type: "string"
      },
      signed_envelope_xdr: {
        description: "XDR-encoded transaction envelope with new signatures.",
        type: "string"
      },
      pubkey: {
        description: "User-selected public key.",
        type: "string"
      },
      network: {
        description: "Stellar network identifier.",
        type: "string"
      },
      result: {
        description: "Optional response from Horizon if the transaction has been submitted automatically.",
        type: "object"
      }
    }
  },
  implicit_flow: {
    title: "Implicit permissions",
    description: 'Requests temporary access token for one or more intents that can be used to execute actions without explicit confirmation from the user. In order to be executed implicitly, an implicit flow permissions for a given intent should be granted and "pubkey" parameter set.',
    implicitFlow: false,
    params: {
      intents: {
        description: "Requested implicit flow intents.",
        type: "string|string[]",
        required: true
      },
      network: {
        description: "Stellar network identifier or private network passphrase.",
        type: "string",
        required: false
      }
    },
    returns: {
      granted: {
        description: "Whether a user granted permissions or not.",
        type: "boolean"
      },
      intents: {
        description: "Requested implicit flow intents.",
        type: "string[]"
      },
      grants: {
        description: "Implicit flow intents that have been granted.",
        type: "string[]"
      },
      session: {
        description: "Unique implicit session id.",
        type: "string"
      },
      valid_until: {
        description: "Session expiration timestamp.",
        type: "number"
      },
      pubkey: {
        description: "User-selected public key.",
        type: "string"
      },
      network: {
        description: "Stellar network identifier.",
        type: "string"
      }
    }
  },
  manage_account: {
    title: "Open account settings",
    description: "Opens account settings window for a given account.",
    implicitFlow: false,
    params: {
      pubkey: {
        description: "Specific public key requested by the application.",
        type: "string",
        required: true
      },
      network: {
        description: "Stellar network identifier or private network passphrase.",
        type: "string",
        required: false
      }
    },
    returns: {
      pubkey: {
        description: "Public key from intent request.",
        type: "string"
      }
    }
  },
  batch: {
    title: "Intents batch",
    description: "Requests execution of several tx intents bundled together. This intent is atomic \u2013 a user confirms or rejects all bundled requests at once, with the same account and the same Stellar network.",
    implicitFlow: true,
    params: {
      intents: {
        description: "Requested tx intents that should be executed together.",
        type: "object[]",
        required: true
      },
      pubkey: {
        description: "Specific public key requested by the application.",
        type: "string",
        required: false
      },
      network: {
        description: "Stellar network identifier or private network passphrase.",
        type: "string",
        required: false
      }
    },
    returns: {
      intents: {
        description: "Requested tx intents.",
        type: "object[]"
      },
      results: {
        description: "Array of results for each requested intent.",
        type: "object[]"
      },
      pubkey: {
        description: "User-selected public key.",
        type: "string"
      },
      network: {
        description: "Stellar network identifier.",
        type: "string"
      }
    }
  }
};
var intent_interface_default = intentInterface;

// node_modules/@albedo-link/intent/src/intent-errors.js
var intentErrors = {
  unhandledError: {
    message: "Unhandled error occurred. If this error persists, please contact Albedo support.",
    code: -1
  },
  externalError: {
    message: "External error occurred.",
    code: -2
  },
  invalidIntentRequest: {
    message: "Intent request is invalid.",
    code: -3
  },
  actionRejectedByUser: {
    message: "Action request was rejected by the user.",
    code: -4
  },
  horizonError: {
    message: "Transaction failed when submitted to Stellar network.",
    code: -5
  },
  callbackError: {
    message: "Callback redirect failed.",
    code: -6
  }
};
var intent_errors_default = intentErrors;

// node_modules/@albedo-link/intent/src/transport-handler.js
function TransportHandler(targetWindow, ephemeral = false) {
  this.windowHandler = targetWindow;
  this.ephemeral = !!ephemeral;
  this.isLoaded = false;
  this.pendingRequests = {};
  this.preprocessRequestParams = null;
  this.onLoaded = new Promise((resolve, reject) => this.onLoadedCallback = resolve).then(() => this);
  this.messageHandler = this.messageHandler.bind(this);
  window.addEventListener("message", this.messageHandler, false);
}
TransportHandler.prototype = {
  isLoaded: false,
  protocolVersion: 3,
  markLoaded() {
    const { onLoadedCallback } = this;
    if (onLoadedCallback) {
      this.onLoadedCallback = null;
      this.isLoaded = true;
      onLoadedCallback();
    }
  },
  /**
   * Handler for incoming communication messages processing.
   * @param {Object} data - Received data.
   */
  messageHandler({ data }) {
    if (data.albedo) {
      this.matchProtocolVersion(data.albedo.protocol);
      return this.markLoaded();
    }
    if (data.albedoIntentResult) {
      const { __reqid, ...result } = data.albedoIntentResult, pending = this.pendingRequests[__reqid];
      if (pending) {
        delete this.pendingRequests[__reqid];
        pending(result);
        if (this.ephemeral) {
          window.removeEventListener("message", this.messageHandler, false);
          this.windowHandler.close();
        }
      }
    }
  },
  /**
   * Handler for the transport window close event.
   */
  transportCloseHandler() {
    for (let key in this.pendingRequests)
      if (this.pendingRequests.hasOwnProperty(key)) {
        const pending = this.pendingRequests[key];
        delete this.pendingRequests[key];
        pending(intent_errors_default.actionRejectedByUser);
      }
  },
  /**
   * Request intent confirmation using current transport.
   * @param {Object} params - Intent request params.
   * @return {Promise}
   */
  postMessage(params) {
    const nonce = generateRandomToken();
    return new Promise((resolve, reject) => {
      this.onLoaded.then(() => {
        this.pendingRequests[nonce] = handleIntentResponsePromise.bind(this, resolve, reject);
        params = Object.assign({ __reqid: nonce, __albedo_intent_version: this.protocolVersion }, params);
        if (this.preprocessRequestParams) {
          params = this.preprocessRequestParams(params);
        }
        this.windowHandler.postMessage(params, "*");
      });
    });
  },
  /**
   * Check protocol version compatibility.
   * @param {Number} albedoProtocolVersion
   */
  matchProtocolVersion(albedoProtocolVersion) {
    const versionDif = albedoProtocolVersion - this.protocolVersion;
    if (versionDif === 0) return;
    const error = `@albedo-link/intent module protocol version (${this.protocolVersion}) is incompatible with current Albedo protocol version ${albedoProtocolVersion}.`;
    if (versionDif > 0) {
      console.warn(error + " Please update @albedo-link/intent module to avoid possible connection problems.");
    } else if (versionDif < 0) {
      this.windowHandler.close();
      throw new Error(error);
    }
  }
};
function handleIntentResponsePromise(resolve, reject, res) {
  if (res.error) {
    reject(res);
  } else {
    resolve(res);
  }
}
var transport_handler_default = TransportHandler;

// node_modules/@albedo-link/intent/src/transport-builder.js
function createDialogTransport(frontendUrl) {
  const url = `${frontendUrl}/confirm`, w6 = 480, h5 = 600, dualScreenLeft = window.screenLeft !== void 0 ? window.screenLeft : window.screenX, dualScreenTop = window.screenTop !== void 0 ? window.screenTop : window.screenY, currentWindowWidth = window.innerWidth ? window.innerWidth : document.documentElement.clientWidth ? document.documentElement.clientWidth : screen.width, currentWindowHeight = window.innerHeight ? window.innerHeight : document.documentElement.clientHeight ? document.documentElement.clientHeight : screen.height, left = currentWindowWidth / 2 - w6 / 2 + dualScreenLeft, top = currentWindowHeight / 2 - h5 / 2 + dualScreenTop;
  const dialogWindow = window.open(url, "auth.albedo.link", `height=${h5},width=${w6},top=${top},left=${left},menubar=0,toolbar=0,location=0,status=0,personalbar=0,scrollbars=0,dependent=1`);
  return new transport_handler_default(dialogWindow, true).onLoaded;
}
var sharedIframeTransport = null;
function createIframeTransport(frontendUrl) {
  if (!sharedIframeTransport) {
    const iframe = document.createElement("iframe");
    iframe.style.border = "none";
    Object.assign(iframe, {
      width: "0",
      height: "0",
      frameBorder: "0",
      referrerPolicy: "origin",
      src: `${frontendUrl}`
    });
    document.body.appendChild(iframe);
    sharedIframeTransport = new transport_handler_default(iframe.contentWindow);
  }
  return sharedIframeTransport.onLoaded;
}

// node_modules/@albedo-link/intent/src/implicit-session.js
function ImplicitSession({ session, pubkey, grants, valid_until }) {
  this.key = session;
  this.pubkey = pubkey;
  this.grants = grants.slice();
  this.validUntil = valid_until;
  Object.freeze(this);
  Object.freeze(this.grants);
}
ImplicitSession.prototype = {
  /**
   * Unique session key.
   * @type {String}
   */
  key: "",
  /**
   * Public key of the key pair used to authorize the session.
   * @type {String}
   */
  pubkey: "",
  /**
   * Granted permissions.
   * @type {Array<String>}
   */
  grants: [],
  /**
   * Time-to-live.
   * @type {Number}
   */
  validUntil: 0,
  /**
   * Check whether the session is expired or not.
   * @return {boolean}
   */
  get isExpired() {
    return this.validUntil - 2e3 < (/* @__PURE__ */ new Date()).getTime();
  },
  toJSON() {
    return {
      session: this.key,
      pubkey: this.pubkey,
      grants: this.grants.slice(),
      valid_until: this.validUntil
    };
  }
};
var implicit_session_default = ImplicitSession;

// node_modules/@albedo-link/intent/src/implicit-session-storage.js
var storagePrefix = "albedo_session_";
var implicitSessions = {};
function getStorage() {
  return window.sessionStorage;
}
var saveToBrowserStorage = true;
function saveImplicitSession(intentResult) {
  const session = new implicit_session_default(intentResult);
  if (!saveToBrowserStorage) {
    implicitSessions[session.pubkey] = session;
  } else {
    getStorage().setItem(storagePrefix + session.pubkey, JSON.stringify(session));
  }
}
function retrieveSessionFromStorage(pubkey) {
  let session;
  if (!saveToBrowserStorage) {
    session = implicitSessions[pubkey];
  } else {
    const restored = getStorage().getItem(storagePrefix + pubkey);
    if (restored) {
      session = new implicit_session_default(JSON.parse(restored));
    }
  }
  if (!session) return null;
  if (session.isExpired) {
    forgetSession(pubkey);
    return null;
  }
  return session;
}
function getImplicitSession(intent, pubkey) {
  const session = retrieveSessionFromStorage(pubkey);
  if (!session || !session.grants.includes(intent)) return null;
  return session;
}
function getAllImplicitSessions() {
  const storage = getStorage();
  return Object.keys(storage).filter((key) => key.indexOf(storagePrefix) === 0).map((key) => retrieveSessionFromStorage(key.substr(storagePrefix.length))).filter((session) => !!session);
}
function forgetSession(pubkey) {
  if (!saveToBrowserStorage) {
    delete implicitSessions[pubkey];
  } else {
    getStorage().removeItem(storagePrefix + pubkey);
  }
}

// node_modules/@albedo-link/intent/src/intent-dispatcher.js
function intentError(msg) {
  return Object.assign(new Error(), intent_errors_default.invalidIntentRequest, { ext: msg });
}
function requestIntentConfirmation(params, frontendUrl) {
  try {
    const { intent } = params;
    if (!intent)
      throw intentError('Parameter "intent" is required.');
    const intentDescriptor = intent_interface_default[intent];
    if (!intentDescriptor)
      throw intentError(`Unknown intent: "${intent}".`);
    const requestParams = prepareRequestParams(intentDescriptor, params);
    return prepareTransport(requestParams, frontendUrl).then((transport) => sendRequest(requestParams, transport));
  } catch (e5) {
    const { code = -1, message, ext } = e5, res = { message, code };
    if (ext) {
      res.ext = ext;
    }
    return Promise.reject(res);
  }
}
function prepareTransport(params, frontendUrl) {
  if (params.pubkey) {
    const session = getImplicitSession(params.intent, params.pubkey);
    if (session) {
      params.session = session.key;
      return createIframeTransport(frontendUrl);
    }
  }
  setTimeout(() => {
    if (params.intent === "implicit_flow") {
      createIframeTransport(frontendUrl);
    }
  }, 200);
  return createDialogTransport(frontendUrl);
}
function sendRequest(params, transport) {
  return transport.postMessage(params).then((result) => {
    if (result.intent === "implicit_flow" && result.granted) {
      saveImplicitSession(result);
    }
    return result;
  });
}
function prepareRequestParams(intentDescriptor, params) {
  if (typeof params !== "object")
    throw intentError("Intent parameters expected.");
  const { intent, pubkey } = params, requestParams = { intent };
  if (pubkey && !/^G[0-9A-Z]{55}$/.test(pubkey))
    throw intentError('Invalid "pubkey" parameter. Stellar account public key expected.');
  for (const key in intentDescriptor.params) {
    const props = intentDescriptor.params[key], value = params[key];
    if (value) {
      requestParams[key] = value;
    } else if (props.required) {
      throw intentError(`Parameter "${key}" is required for intent "${intent}".`);
    }
  }
  return requestParams;
}

// node_modules/@albedo-link/intent/src/web+stellar-handler.js
function parseQuery(query = null) {
  if (query === null) {
    query = window.location.search;
  }
  if (query[0] === "?") query = query.substr(1);
  const dest = {};
  for (let kv of query.split("&")) {
    const [key, value] = kv.split("=").map((v4) => decodeURIComponent(v4));
    dest[key] = value;
  }
  return dest;
}
function bindWebStellarLinkHandler(albedoIntent) {
  if (typeof document === "undefined" || !document.addEventListener) return;
  document.addEventListener("click", function sep0007Handler(e5) {
    if (e5.target.tagName !== "A" || (e5.target.href || "").indexOf("web+stellar:") !== 0) return;
    e5.preventDefault();
    e5.stopImmediatePropagation();
    const { pathname: intentName, search } = new URL(e5.target.href);
    if (!["tx", "pay"].includes(intentName)) {
      alert(`Invalid operation requested: ${intentName}. It's likely an external application error. Please contact support team of ${window.location.origin}.`);
      return;
    }
    const params = parseQuery(search);
    albedoIntent.request(intentName, params);
  }, false);
}

// node_modules/@albedo-link/intent/src/index.js
if (typeof window === "object" && typeof window.fetch !== "function") {
  throw new Error("Browser FetchAPI is not available. For legacy browsers support use polyfills such as whatwg-fetch.");
}
function AlbedoIntent() {
}
AlbedoIntent.prototype = {
  frontendUrl: "https://albedo.link",
  intentInterface: intent_interface_default,
  intentErrors: intent_errors_default,
  /**
   * Initiate external intent request.
   * @param {String} intent - Intent name.
   * @param {Object} [params] - Request parameters.
   * @returns {Promise<Object>}
   */
  request(intent, params) {
    return requestIntentConfirmation(Object.assign(params || {}, { intent }), this.frontendUrl);
  },
  /**
   * Requests temporary permissions to execute the specific intents without calling confirmation dialog.
   * @param {Object} params - Intent parameters.
   * @param {Array<String>} params.intents - Requested intents.
   * @returns {Promise<ImplicitFlowIntentResult>}
   */
  implicitFlow(params) {
    return this.request("implicit_flow", params);
  },
  /**
   * Request secure third-party application authentication.
   * @param {Object} params - Intent parameters.
   * @param {String} [params.token] - Verification token generated by the application (should be unique or random).
   * @param {String} [params.require_existing] - Allow existing Albedo accounts only.
   * @returns {Promise<PublicKeyIntentResult>}
   */
  publicKey(params) {
    params = Object.assign({}, params);
    if (!params.token) {
      params.token = generateRandomToken();
    }
    return this.request("public_key", params);
  },
  /**
   * Request transaction signing, returns the signed transaction envelope.
   * @param {Object} params - Intent parameters.
   * @param {String} params.xdr - A Stellar transaction in XDR format encoded in base64.
   * @param {String} [params.pubkey] - Specific public key requested by the application.
   * @param {String} [params.network] - Stellar network identifier or private network passphrase.
   * @param {Boolean} [params.submit] - If set, the signed transaction will be submitted to the Horizon server instead of returning it to the application.
   * @returns {Promise<TxIntentResult>}
   */
  tx(params) {
    return this.request("tx", params);
  },
  /**
   * Requests execution of several tx intents bundled together. This intent is atomic – a user confirms or rejects all bundled requests at once, with the same account and the same Stellar network.
   * @param {Object} params - Intent parameters.
   * @param {String} params.intents - Requested tx intents.
   * @param {String} [params.pubkey] - Specific public key requested by the application.
   * @param {String} [params.network] - Stellar network identifier or private network passphrase.
   * @returns {Promise<BatchIntentResult>}
   */
  batch(params) {
    return this.request("batch", params);
  },
  /**
   * Request an asset trustline creation.
   * @param {Object} params - Intent parameters.
   * @param {String} params.destination - Payment destination address.
   * @param {String} params.amount - Amount to pay.
   * @param {String} [params.asset_code] - [Optional] Asset code (if not set XLM is implied).
   * @param {String} [params.asset_issuer] - [Optional] Asset issuer (if not set XLM is implied).
   * @param {String} [params.memo] - [Optional] Memo to be included in the payment.
   * @param {('MEMO_TEXT' | 'MEMO_ID' | 'MEMO_HASH' | 'MEMO_RETURN')} [params.memo_type] - [Optional] Memo type to be included in the payment.
   * @param {String} [params.pubkey] - Specific public key requested by the application.
   * @param {String} [params.network] - Stellar network identifier or private network passphrase.
   * @param {Boolean} [params.submit] - If set, the signed transaction will be submitted to the Horizon server instead of returning it to the application.
   * @returns {Promise<PayIntentResult>}
   */
  pay(params) {
    return this.request("pay", params);
  },
  /**
   * Request an asset trustline creation.
   * @param {Object} params - Intent parameters.
   * @param {String} params.asset_code - Asset code.
   * @param {String} params.asset_issuer - Asset account issuer.
   * @param {String} [params.limit] - [Optional] Trustline limit.
   * @param {String} [params.pubkey] - Specific public key requested by the application.
   * @param {String} [params.network] - Stellar network identifier or private network passphrase.
   * @param {Boolean} [params.submit] - If set, the signed transaction will be submitted to the Horizon server instead of returning it to the application.
   * @returns {Promise<TrustIntentResult>}
   */
  trust(params) {
    return this.request("trust", params);
  },
  /**
   * Request token exchange on Stellar DEX.
   * @param {Object} params - Intent parameters.
   * @param {String} params.destination - Payment destination address.
   * @param {String} params.amount - Amount to pay.
   * @param {String} params.max_price - Maximum price to pay.
   * @param {String} [params.sell_asset_code] - [Optional] Selling asset code (if not set XLM is implied).
   * @param {String} [params.sell_asset_issuer] - [Optional] Selling asset issuer (if not set XLM is implied).
   * @param {String} [params.buy_asset_code] - [Optional] Selling asset code (if not set XLM is implied).
   * @param {String} [params.buy_asset_issuer] - [Optional] Selling asset issuer (if not set XLM is implied).
   * @return {Promise<ExchangeIntentResult>}
   */
  exchange(params) {
    return this.request("exchange", params);
  },
  /**
   * Request arbitrary data signing.
   * @param {Object} params - Intent parameters.
   * @param {String} params.message - Text message to sign.
   * @param {String} [params.pubkey] - Specific public key requested by the application.
   * @returns {Promise<SignMessageIntentResult>}
   */
  signMessage(params) {
    params = Object.assign({}, params, { message: normalizeMessageToSign(params.message) });
    return this.request("sign_message", params);
  },
  /**
   * Open account settings window for a given account.
   * @param {Object} params - Intent parameters.
   * @param {String} params.pubkey - Specific public key requested by the application.
   * @param {String} [params.network] - Stellar network identifier or private network passphrase.
   * @returns {Promise<ManageAccountIntentResult>}
   */
  manageAccount(params) {
    return this.request("manage_account", params);
  },
  /**
   * Generate random token that can be used for authentication or encryption
   * @return {String}
   */
  generateRandomToken() {
    return generateRandomToken();
  },
  /**
   * Check whether an implicit session exists for a given intent and pubkey.
   * @param {String} intent
   * @param {String} pubkey
   * @return {boolean}
   */
  isImplicitSessionAllowed(intent, pubkey) {
    return !!getImplicitSession(intent, pubkey);
  },
  /**
   * Enumerate all currently active implicit sessions.
   * @returns {Array<{pubkey: String, session: String, valid_until: Number, grants: Array<String>}>}
   */
  listImplicitSessions() {
    return getAllImplicitSessions();
  },
  /**
   * Revoke session permission granted for an account.
   * @param {String} pubkey
   */
  forgetImplicitSession(pubkey) {
    forgetSession(pubkey);
  }
};
function normalizeMessageToSign(message) {
  switch (typeof message) {
    case "string":
      return message;
    case "undefined":
      return "";
  }
  return JSON.stringify(message);
}
var albedo = new AlbedoIntent();
albedo.default = albedo;
bindWebStellarLinkHandler(albedo);
var src_default = albedo;

// node_modules/@creit.tech/stellar-wallets-kit/esm/sdk/modules/albedo.module.js
var albedo2 = src_default.default;
var ALBEDO_ID = "albedo";
var AlbedoModule = class {
  constructor() {
    Object.defineProperty(this, "moduleType", {
      enumerable: true,
      configurable: true,
      writable: true,
      value: ModuleType.HOT_WALLET
    });
    Object.defineProperty(this, "productId", {
      enumerable: true,
      configurable: true,
      writable: true,
      value: ALBEDO_ID
    });
    Object.defineProperty(this, "productName", {
      enumerable: true,
      configurable: true,
      writable: true,
      value: "Albedo"
    });
    Object.defineProperty(this, "productUrl", {
      enumerable: true,
      configurable: true,
      writable: true,
      value: "https://albedo.link/"
    });
    Object.defineProperty(this, "productIcon", {
      enumerable: true,
      configurable: true,
      writable: true,
      value: "https://stellar.creit.tech/wallet-icons/albedo.png"
    });
  }
  async isAvailable() {
    return true;
  }
  async getAddress() {
    try {
      const result = await albedo2.publicKey({});
      return { address: result.pubkey };
    } catch (e5) {
      throw parseError(e5);
    }
  }
  async signTransaction(xdr, opts) {
    try {
      const { signed_envelope_xdr } = await albedo2.tx({
        xdr,
        pubkey: opts?.address,
        network: opts?.networkPassphrase ? opts.networkPassphrase === Networks.PUBLIC ? AlbedoNetwork.PUBLIC : AlbedoNetwork.TESTNET : void 0
      });
      return {
        signedTxXdr: signed_envelope_xdr,
        signerAddress: opts?.address
      };
    } catch (e5) {
      throw parseError(e5);
    }
  }
  async signAuthEntry() {
    throw {
      code: -3,
      message: 'Albedo does not support the "signAuthEntry" function'
    };
  }
  /**
   * We understand that Albedo has a method to sign a message, but that method is not compatible with SEP-0043
   */
  async signMessage() {
    throw {
      code: -3,
      message: 'Albedo does not support the "signMessage" function'
    };
  }
  async getNetwork() {
    throw {
      code: -3,
      message: 'Albedo does not support the "getNetwork" function'
    };
  }
};
var AlbedoNetwork;
(function(AlbedoNetwork2) {
  AlbedoNetwork2["PUBLIC"] = "public";
  AlbedoNetwork2["TESTNET"] = "testnet";
})(AlbedoNetwork || (AlbedoNetwork = {}));

// node_modules/@creit.tech/stellar-wallets-kit/esm/sdk/modules/rabet.module.js
var RABET_ID = "rabet";
var RabetModule = class {
  constructor() {
    Object.defineProperty(this, "moduleType", {
      enumerable: true,
      configurable: true,
      writable: true,
      value: ModuleType.HOT_WALLET
    });
    Object.defineProperty(this, "productId", {
      enumerable: true,
      configurable: true,
      writable: true,
      value: RABET_ID
    });
    Object.defineProperty(this, "productName", {
      enumerable: true,
      configurable: true,
      writable: true,
      value: "Rabet"
    });
    Object.defineProperty(this, "productUrl", {
      enumerable: true,
      configurable: true,
      writable: true,
      value: "https://rabet.io/"
    });
    Object.defineProperty(this, "productIcon", {
      enumerable: true,
      configurable: true,
      writable: true,
      value: "https://stellar.creit.tech/wallet-icons/rabet.png"
    });
  }
  async runChecks() {
    if (!await this.isAvailable()) {
      throw new Error(`Rabet is not installed`);
    }
  }
  isAvailable() {
    return new Promise((resolve) => {
      setTimeout(() => {
        resolve(typeof window !== "undefined" && !!window.rabet);
      }, 100);
    });
  }
  async getAddress() {
    try {
      await this.runChecks();
      const { publicKey } = await window.rabet.connect();
      return { address: publicKey };
    } catch (e5) {
      throw parseError(e5);
    }
  }
  async signTransaction(xdr, opts) {
    if (opts?.networkPassphrase && opts.networkPassphrase !== Networks.PUBLIC && opts.networkPassphrase !== Networks.TESTNET) {
      throw new Error(`Rabet doesn't support the network: ${opts.networkPassphrase}`);
    }
    if (opts?.address) {
      console.warn(`Rabet doesn't allow specifying the network that should be used, we skip the value`);
    }
    try {
      await this.runChecks();
      const result = await window.rabet.sign(xdr, opts?.networkPassphrase === Networks.PUBLIC ? RabetNetwork.PUBLIC : RabetNetwork.TESTNET);
      return { signedTxXdr: result?.xdr };
    } catch (e5) {
      throw parseError(e5);
    }
  }
  signAuthEntry() {
    return Promise.reject({
      code: -3,
      message: 'Rabet does not support the "signAuthEntry" function'
    });
  }
  signMessage() {
    return Promise.reject({
      code: -3,
      message: 'Rabet does not support the "signMessage" function'
    });
  }
  getNetwork() {
    return Promise.reject({
      code: -3,
      message: 'Rabet does not support the "getNetwork" function'
    });
  }
};
var RabetNetwork;
(function(RabetNetwork2) {
  RabetNetwork2["PUBLIC"] = "mainnet";
  RabetNetwork2["TESTNET"] = "testnet";
})(RabetNetwork || (RabetNetwork = {}));

// node_modules/@creit.tech/stellar-wallets-kit/esm/sdk/modules/hana.module.js
var HANA_ID = "hana";
var HanaModule = class {
  constructor() {
    Object.defineProperty(this, "moduleType", {
      enumerable: true,
      configurable: true,
      writable: true,
      value: ModuleType.HOT_WALLET
    });
    Object.defineProperty(this, "productId", {
      enumerable: true,
      configurable: true,
      writable: true,
      value: HANA_ID
    });
    Object.defineProperty(this, "productName", {
      enumerable: true,
      configurable: true,
      writable: true,
      value: "Hana Wallet"
    });
    Object.defineProperty(this, "productUrl", {
      enumerable: true,
      configurable: true,
      writable: true,
      value: "https://hanawallet.io/"
    });
    Object.defineProperty(this, "productIcon", {
      enumerable: true,
      configurable: true,
      writable: true,
      value: "https://stellar.creit.tech/wallet-icons/hana.png"
    });
  }
  async runChecks() {
    if (!await this.isAvailable()) {
      throw new Error("Hana Wallet is not installed");
    }
  }
  async isAvailable() {
    return typeof window !== "undefined" && !!window.hanaWallet?.stellar;
  }
  async getAddress() {
    try {
      await this.runChecks();
      const address = await window.hanaWallet.stellar.getPublicKey();
      return { address };
    } catch (e5) {
      throw parseError(e5);
    }
  }
  async signTransaction(xdr, opts) {
    try {
      await this.runChecks();
      const signedTxXdr = await window.hanaWallet.stellar.signTransaction({
        xdr,
        accountToSign: opts?.address,
        networkPassphrase: opts?.networkPassphrase
      });
      return { signedTxXdr, signerAddress: opts?.address };
    } catch (e5) {
      throw parseError(e5);
    }
  }
  async signAuthEntry(authEntry, opts) {
    try {
      await this.runChecks();
      const signedAuthEntry = await window.hanaWallet.stellar.signAuthEntry({
        xdr: authEntry,
        accountToSign: opts?.address
      });
      return { signedAuthEntry, signerAddress: opts?.address };
    } catch (e5) {
      throw parseError(e5);
    }
  }
  async signMessage(message, opts) {
    try {
      await this.runChecks();
      const signedMessage = await window.hanaWallet.stellar.signMessage({
        message,
        accountToSign: opts?.address
      });
      return { signedMessage, signerAddress: opts?.address };
    } catch (e5) {
      throw parseError(e5);
    }
  }
  async getNetwork() {
    throw {
      code: -3,
      message: 'Hana does not support the "getNetwork" function'
    };
  }
};
export {
  AlbedoModule,
  FreighterModule,
  HanaModule,
  LobstrModule,
  Networks,
  RabetModule,
  StellarWalletsKit,
  xBullModule
};
