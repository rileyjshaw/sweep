!function(e){if("object"==typeof exports&&"undefined"!=typeof module)module.exports=e();else if("function"==typeof define&&define.amd)define([],e);else{var f;"undefined"!=typeof window?f=window:"undefined"!=typeof global?f=global:"undefined"!=typeof self&&(f=self),f.sweep=e()}}(function(){var define,module,exports;return (function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);var f=new Error("Cannot find module '"+o+"'");throw f.code="MODULE_NOT_FOUND",f}var l=n[o]={exports:{}};t[o][0].call(l.exports,function(e){var n=t[o][1][e];return s(n?n:e)},l,l.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){
var husl = require('../bower_components/husl/husl.js');
var convert = require('./convert.js');

var sweep = (function() {

  // keep current animations in this closure; deal with each in
  // a single tick to prevent dom thrashing and event hell
  var batch = [];

  function tick () {
    // increment frames step:
    batch.forEach(function (animation) { ++animation.frame; });

    // calculation step:
    var computedSteps = [], callbacks = [];

    batch.forEach(function (animation) {
      var target = animation.target;
      var properties = animation.properties;
      var from = animation.from;
      var space = animation.space;
      var frame = animation.frame;
      var deltas = animation.deltas;

      // components = [h, s, l, a] || [r, g, b, a]
      var composed, components = new Array(4);

      // set alpha level
      components[3] = from.a + deltas[3] * frame;

      if (space === 'RGB') {
        // red
        components[0] = Math.floor(from.r + deltas[0] * frame);
        // green
        components[1] = Math.floor(from.g + deltas[1] * frame);
        // blue
        components[2] = Math.floor(from.b + deltas[2] * frame);

        composed = 'rgba(' + [components] + ')';

      } else {
        // hue
        components[0] = (Math.floor(from.h + deltas[0] * frame) + 360) % 360;
        // saturation
        components[1] = Math.floor((from.s + deltas[1] * frame) * 100);
        // lightness
        components[2] = Math.floor((from.l + deltas[2] * frame) * 100);

        if (space === 'HSL') {
          composed = 'hsla(' + components[0] + ',' +
                               components[1] + '%,' +
                               components[2] + '%,' +
                               components[3] + ')';
        } else composed = husl.toHex(components[0], components[1], components[2]);
      }

      computedSteps.push({
        target: target,
        properties: properties,
        composed: composed
      });
    });

    // DOM painting step:
    computedSteps.forEach(function (step) {
      step.properties.forEach(function (property) {
        step.target.style[property] = step.composed;
      });
    });

    // remove finished animations step:
    callbacks = batch.map(function (animation) {
      return animation.frame === animation.end ? animation.pause() : false;
    }).filter(function (animation) {
      return typeof animation === 'function';
    });

    if (batch.length) {
      requestAnimationFrame(tick);
    }

    // run callbacks after checking batch length to avoid
    // calls to sweep() in callbacks altering batch length
    while (callbacks.length) {
      callbacks.pop()();
    }
  }

  // push the animation to batch and start a tick if one doesn't already exist
  function queueAnimation () {
    if (batch.indexOf(this) === -1 && batch.push(this) === 1) requestAnimationFrame(tick);
  }

  // remove the animation from batch and return its callback
  function dequeueAnimation () {
    return (batch.splice(batch.indexOf(this), 1)[0] || {}).callback;
  }

  return function (target, properties, from, to, args) {
    var steps, angle, callback, direction, duration, space, deltas = [];

    // if a string argument is passed, put it into a length 1 array
    if (typeof properties === 'string') properties = [properties];

    // type checking
    if (!target instanceof Element)
      throw 'The first argument to sweep() must be a DOM element';

    if (properties.some(function (property) { return (typeof target.style[property] !== 'string'); }))
      throw 'The second argument to sweep() must be either a string or an array of strings';

    if (typeof from !== 'string')
      throw 'The third argument to sweep() must be a string';

    if (typeof to !== 'string')
      throw 'The fourth argument to sweep() must be a string';

    if (args) {
      if (typeof args !== 'object')
        throw 'The fifth argument to sweep() must be an object';

      callback = args.callback;
      direction = args.direction;
      duration = args.duration;
      space = args.space;
    } else args = {};

    // set default args
    if (typeof duration !== "number" || duration < 0) {
      duration = 800;
    }

    if (typeof space === 'string') {
      space = space.toUpperCase();
      if (space.slice(-1) === 'A') space = space.slice(0, -1);
    }

    steps = Math.ceil(duration * 60 / 1000); // 60 fps

    if (space === 'RGB') {
      // convert colors to { r: _, g: _, b: _, a: _ } format
      from = convert.toRgba(from);
      to = convert.toRgba(to);

      // deltas = [dR, dG, dB, dA]
      deltas = [
        (to.r - from.r) / steps,
        (to.g - from.g) / steps,
        (to.b - from.b) / steps,
        (to.a - from.a) / steps
      ];
    } else { // space is H(U)SL

      // sneaking another default in here...
      if (space !== 'HUSL') space = args.space = 'HSL';

      // convert colors to { h: _, s: _, l: _, a: _ } format
      from = convert.toHsla(from);
      to = convert.toHsla(to);

      // deltas = [dH, dS, dL, dA]
      deltas = [
        0,
        (to.s - from.s) / steps,
        (to.l - from.l) / steps,
        (to.a - from.a) / steps
      ];

      // if we're transitioning to/from black, grey, or white, don't move the hue angle. Otherwise...
      if (to.s * from.s * to.l * from.l || to.l !== 100 || from.l !== 100) {
        // bind dH to [0, 360)
        deltas[0] = ((to.h - from.h) + 360) % 360;
        if (direction !== 1 && deltas[0] > 180 || direction === -1) {
          // spin counterclockwise
          deltas[0] -= 360;
        }
        deltas[0] /= steps;
      }
    }

    // throw 'em all into args before passing into queueAnimation
    args.frame = 0;
    args.target = target;
    args.properties = properties;
    args.from = from;
    args.end = steps;
    args.deltas = deltas;
    args.pause = dequeueAnimation;
    args.resume = queueAnimation;

    args.resume();
    return args;
  };
})();

module.exports = sweep;

},{"../bower_components/husl/husl.js":2,"./convert.js":3}],2:[function(require,module,exports){
// Generated by CoffeeScript 1.7.1
(function() {
  var L_to_Y, Y_to_L, conv, dotProduct, epsilon, fromLinear, kappa, m, m_inv, maxChroma, maxChromaD, refU, refV, refX, refY, refZ, rgbPrepare, root, round, toLinear, _hradExtremum, _maxChroma;

  refX = 0.95047;

  refY = 1.00000;

  refZ = 1.08883;

  refU = (4 * refX) / (refX + (15 * refY) + (3 * refZ));

  refV = (9 * refY) / (refX + (15 * refY) + (3 * refZ));

  m = {
    R: [3.240454162114103, -1.537138512797715, -0.49853140955601],
    G: [-0.96926603050518, 1.876010845446694, 0.041556017530349],
    B: [0.055643430959114, -0.20402591351675, 1.057225188223179]
  };

  m_inv = {
    X: [0.41245643908969, 0.3575760776439, 0.18043748326639],
    Y: [0.21267285140562, 0.71515215528781, 0.072174993306559],
    Z: [0.019333895582329, 0.1191920258813, 0.95030407853636]
  };

  kappa = 24389 / 27;

  epsilon = 216 / 24389;

  _maxChroma = function(L, H) {
    var cosH, hrad, sinH, sub1, sub2;
    hrad = H / 360 * 2 * Math.PI;
    sinH = Math.sin(hrad);
    cosH = Math.cos(hrad);
    sub1 = Math.pow(L + 16, 3) / 1560896;
    sub2 = sub1 > epsilon ? sub1 : L / kappa;
    return function(channel) {
      var bottom, lbottom, m1, m2, m3, rbottom, top, _ref;
      _ref = m[channel], m1 = _ref[0], m2 = _ref[1], m3 = _ref[2];
      top = (12739311 * m3 + 11700000 * m2 + 11120499 * m1) * sub2;
      rbottom = 9608480 * m3 - 1921696 * m2;
      lbottom = 1441272 * m3 - 4323816 * m1;
      bottom = (rbottom * sinH + lbottom * cosH) * sub2;
      return function(limit) {
        return L * (top - 11700000 * limit) / (bottom + 1921696 * sinH * limit);
      };
    };
  };

  _hradExtremum = function(L) {
    var lhs, rhs, sub;
    lhs = (Math.pow(L, 3) + 48 * Math.pow(L, 2) + 768 * L + 4096) / 1560896;
    rhs = epsilon;
    sub = lhs > rhs ? lhs : L / kappa;
    return function(channel, limit) {
      var bottom, hrad, m1, m2, m3, top, _ref;
      _ref = m[channel], m1 = _ref[0], m2 = _ref[1], m3 = _ref[2];
      top = (20 * m3 - 4 * m2) * sub + 4 * limit;
      bottom = (3 * m3 - 9 * m1) * sub;
      hrad = Math.atan2(top, bottom);
      if (limit === 1) {
        hrad += Math.PI;
      }
      return hrad;
    };
  };

  maxChroma = function(L, H) {
    var C, channel, limit, mc1, mc2, result, _i, _j, _len, _len1, _ref, _ref1;
    result = Infinity;
    mc1 = _maxChroma(L, H);
    _ref = ['R', 'G', 'B'];
    for (_i = 0, _len = _ref.length; _i < _len; _i++) {
      channel = _ref[_i];
      mc2 = mc1(channel);
      _ref1 = [0, 1];
      for (_j = 0, _len1 = _ref1.length; _j < _len1; _j++) {
        limit = _ref1[_j];
        C = mc2(limit);
        if ((0 < C && C < result)) {
          result = C;
        }
      }
    }
    return result;
  };

  maxChromaD = function(L) {
    var C, channel, he1, hrad, limit, minima_C, _i, _j, _len, _len1, _ref, _ref1;
    minima_C = [];
    he1 = _hradExtremum(L);
    _ref = ['R', 'G', 'B'];
    for (_i = 0, _len = _ref.length; _i < _len; _i++) {
      channel = _ref[_i];
      _ref1 = [0, 1];
      for (_j = 0, _len1 = _ref1.length; _j < _len1; _j++) {
        limit = _ref1[_j];
        hrad = he1(channel, limit);
        C = maxChroma(L, hrad * 180 / Math.PI);
        minima_C.push(C);
      }
    }
    return Math.min.apply(Math, minima_C);
  };

  dotProduct = function(a, b) {
    var i, ret, _i, _ref;
    ret = 0;
    for (i = _i = 0, _ref = a.length - 1; 0 <= _ref ? _i <= _ref : _i >= _ref; i = 0 <= _ref ? ++_i : --_i) {
      ret += a[i] * b[i];
    }
    return ret;
  };

  round = function(num, places) {
    var n;
    n = Math.pow(10, places);
    return Math.round(num * n) / n;
  };

  fromLinear = function(c) {
    if (c <= 0.0031308) {
      return 12.92 * c;
    } else {
      return 1.055 * Math.pow(c, 1 / 2.4) - 0.055;
    }
  };

  toLinear = function(c) {
    var a;
    a = 0.055;
    if (c > 0.04045) {
      return Math.pow((c + a) / (1 + a), 2.4);
    } else {
      return c / 12.92;
    }
  };

  rgbPrepare = function(tuple) {
    var ch, n, _i, _j, _len, _len1, _results;
    tuple = (function() {
      var _i, _len, _results;
      _results = [];
      for (_i = 0, _len = tuple.length; _i < _len; _i++) {
        n = tuple[_i];
        _results.push(round(n, 3));
      }
      return _results;
    })();
    for (_i = 0, _len = tuple.length; _i < _len; _i++) {
      ch = tuple[_i];
      if (ch < -0.0001 || ch > 1.0001) {
        throw new Error("Illegal rgb value: " + ch);
      }
      if (ch < 0) {
        ch = 0;
      }
      if (ch > 1) {
        ch = 1;
      }
    }
    _results = [];
    for (_j = 0, _len1 = tuple.length; _j < _len1; _j++) {
      ch = tuple[_j];
      _results.push(Math.round(ch * 255));
    }
    return _results;
  };

  conv = {
    'xyz': {},
    'luv': {},
    'lch': {},
    'husl': {},
    'huslp': {},
    'rgb': {},
    'hex': {}
  };

  conv.xyz.rgb = function(tuple) {
    var B, G, R;
    R = fromLinear(dotProduct(m.R, tuple));
    G = fromLinear(dotProduct(m.G, tuple));
    B = fromLinear(dotProduct(m.B, tuple));
    return [R, G, B];
  };

  conv.rgb.xyz = function(tuple) {
    var B, G, R, X, Y, Z, rgbl;
    R = tuple[0], G = tuple[1], B = tuple[2];
    rgbl = [toLinear(R), toLinear(G), toLinear(B)];
    X = dotProduct(m_inv.X, rgbl);
    Y = dotProduct(m_inv.Y, rgbl);
    Z = dotProduct(m_inv.Z, rgbl);
    return [X, Y, Z];
  };

  Y_to_L = function(Y) {
    if (Y <= epsilon) {
      return (Y / refY) * kappa;
    } else {
      return 116 * Math.pow(Y / refY, 1 / 3) - 16;
    }
  };

  L_to_Y = function(L) {
    if (L <= 8) {
      return refY * L / kappa;
    } else {
      return refY * Math.pow((L + 16) / 116, 3);
    }
  };

  conv.xyz.luv = function(tuple) {
    var L, U, V, X, Y, Z, varU, varV;
    X = tuple[0], Y = tuple[1], Z = tuple[2];
    varU = (4 * X) / (X + (15 * Y) + (3 * Z));
    varV = (9 * Y) / (X + (15 * Y) + (3 * Z));
    L = Y_to_L(Y);
    if (L === 0) {
      return [0, 0, 0];
    }
    U = 13 * L * (varU - refU);
    V = 13 * L * (varV - refV);
    return [L, U, V];
  };

  conv.luv.xyz = function(tuple) {
    var L, U, V, X, Y, Z, varU, varV;
    L = tuple[0], U = tuple[1], V = tuple[2];
    if (L === 0) {
      return [0, 0, 0];
    }
    varU = U / (13 * L) + refU;
    varV = V / (13 * L) + refV;
    Y = L_to_Y(L);
    X = 0 - (9 * Y * varU) / ((varU - 4) * varV - varU * varV);
    Z = (9 * Y - (15 * varV * Y) - (varV * X)) / (3 * varV);
    return [X, Y, Z];
  };

  conv.luv.lch = function(tuple) {
    var C, H, Hrad, L, U, V;
    L = tuple[0], U = tuple[1], V = tuple[2];
    C = Math.pow(Math.pow(U, 2) + Math.pow(V, 2), 1 / 2);
    Hrad = Math.atan2(V, U);
    H = Hrad * 360 / 2 / Math.PI;
    if (H < 0) {
      H = 360 + H;
    }
    return [L, C, H];
  };

  conv.lch.luv = function(tuple) {
    var C, H, Hrad, L, U, V;
    L = tuple[0], C = tuple[1], H = tuple[2];
    Hrad = H / 360 * 2 * Math.PI;
    U = Math.cos(Hrad) * C;
    V = Math.sin(Hrad) * C;
    return [L, U, V];
  };

  conv.husl.lch = function(tuple) {
    var C, H, L, S, max;
    H = tuple[0], S = tuple[1], L = tuple[2];
    if (L > 99.9999999) {
      return [100, 0, H];
    }
    if (L < 0.00000001) {
      return [0, 0, H];
    }
    max = maxChroma(L, H);
    C = max / 100 * S;
    return [L, C, H];
  };

  conv.lch.husl = function(tuple) {
    var C, H, L, S, max;
    L = tuple[0], C = tuple[1], H = tuple[2];
    if (L > 99.9999999) {
      return [H, 0, 100];
    }
    if (L < 0.00000001) {
      return [H, 0, 0];
    }
    max = maxChroma(L, H);
    S = C / max * 100;
    return [H, S, L];
  };

  conv.huslp.lch = function(tuple) {
    var C, H, L, S, max;
    H = tuple[0], S = tuple[1], L = tuple[2];
    if (L > 99.9999999) {
      return [100, 0, H];
    }
    if (L < 0.00000001) {
      return [0, 0, H];
    }
    max = maxChromaD(L);
    C = max / 100 * S;
    return [L, C, H];
  };

  conv.lch.huslp = function(tuple) {
    var C, H, L, S, max;
    L = tuple[0], C = tuple[1], H = tuple[2];
    if (L > 99.9999999) {
      return [H, 0, 100];
    }
    if (L < 0.00000001) {
      return [H, 0, 0];
    }
    max = maxChromaD(L);
    S = C / max * 100;
    return [H, S, L];
  };

  conv.rgb.hex = function(tuple) {
    var ch, hex, _i, _len;
    hex = "#";
    tuple = rgbPrepare(tuple);
    for (_i = 0, _len = tuple.length; _i < _len; _i++) {
      ch = tuple[_i];
      ch = ch.toString(16);
      if (ch.length === 1) {
        ch = "0" + ch;
      }
      hex += ch;
    }
    return hex;
  };

  conv.hex.rgb = function(hex) {
    var b, g, r;
    if (hex.charAt(0) === "#") {
      hex = hex.substring(1, 7);
    }
    r = hex.substring(0, 2);
    g = hex.substring(2, 4);
    b = hex.substring(4, 6);
    return [r, g, b].map(function(n) {
      return parseInt(n, 16) / 255;
    });
  };

  conv.lch.rgb = function(tuple) {
    return conv.xyz.rgb(conv.luv.xyz(conv.lch.luv(tuple)));
  };

  conv.rgb.lch = function(tuple) {
    return conv.luv.lch(conv.xyz.luv(conv.rgb.xyz(tuple)));
  };

  conv.husl.rgb = function(tuple) {
    return conv.lch.rgb(conv.husl.lch(tuple));
  };

  conv.rgb.husl = function(tuple) {
    return conv.lch.husl(conv.rgb.lch(tuple));
  };

  conv.huslp.rgb = function(tuple) {
    return conv.lch.rgb(conv.huslp.lch(tuple));
  };

  conv.rgb.huslp = function(tuple) {
    return conv.lch.huslp(conv.rgb.lch(tuple));
  };

  root = {};

  root.fromRGB = function(R, G, B) {
    return conv.rgb.husl([R, G, B]);
  };

  root.fromHex = function(hex) {
    return conv.rgb.husl(conv.hex.rgb(hex));
  };

  root.toRGB = function(H, S, L) {
    return conv.husl.rgb([H, S, L]);
  };

  root.toHex = function(H, S, L) {
    return conv.rgb.hex(conv.husl.rgb([H, S, L]));
  };

  root.p = {};

  root.p.toRGB = function(H, S, L) {
    return conv.xyz.rgb(conv.luv.xyz(conv.lch.luv(conv.huslp.lch([H, S, L]))));
  };

  root.p.toHex = function(H, S, L) {
    return conv.rgb.hex(conv.xyz.rgb(conv.luv.xyz(conv.lch.luv(conv.huslp.lch([H, S, L])))));
  };

  root.p.fromRGB = function(R, G, B) {
    return conv.lch.huslp(conv.luv.lch(conv.xyz.luv(conv.rgb.xyz([R, G, B]))));
  };

  root.p.fromHex = function(hex) {
    return conv.lch.huslp(conv.luv.lch(conv.xyz.luv(conv.rgb.xyz(conv.hex.rgb(hex)))));
  };

  root._conv = conv;

  root._round = round;

  root._maxChroma = maxChroma;

  root._maxChromaD = maxChromaD;

  root._hradExtremum = _hradExtremum;

  root._rgbPrepare = rgbPrepare;

  if (!((typeof module !== "undefined" && module !== null) || (typeof jQuery !== "undefined" && jQuery !== null) || (typeof requirejs !== "undefined" && requirejs !== null))) {
    this.HUSL = root;
  }

  if (typeof module !== "undefined" && module !== null) {
    module.exports = root;
  }

  if (typeof jQuery !== "undefined" && jQuery !== null) {
    jQuery.husl = root;
  }

  if ((typeof requirejs !== "undefined" && requirejs !== null) && (typeof define !== "undefined" && define !== null)) {
    define(root);
  }

}).call(this);

},{}],3:[function(require,module,exports){
/**
 * Lightweight module to convert colors from
 * rgb, rgba, hex, hsl, hsla, or CSS named colors
 * to an hsla or rgba object.
 */

function rgbaToHsla (color) {
  var r = color.r / 255, g = color.g / 255, b = color.b / 255;
  var max = Math.max(r, g, b), min = Math.min(r, g, b);
  var h, s, l = (max + min) / 2;

  if (max == min){
    h = s = 0; // achromatic
  } else {
    var d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max){
      case r: h = (g - b) / d + (g < b ? 6 : 0);
      break;
      case g: h = (b - r) / d + 2;
      break;
      case b: h = (r - g) / d + 4;
      break;
    }
    h /= 6;
  }
  return {
    h: h * 360,
    s: s,
    l: l,
    a: color.a
  };
}

function hslaToRgba (color) {
  function hueToRgb (p, q, t) {
    if (t < 0) t += 1;
    if (t > 1) t -= 1;
    if (t < 1/6) return p + (q - p) * 6 * t;
    if (t < 1/2) return q;
    if (t < 2/3) return p + (q - p) * (2/3 - t) * 6;
    return p;
  }

  var r, g, b, q, p, h = color.h, s = color.s, l = color.l;

  if (s === 0) {
    r = g = b = l; // achromatic
  } else {
    q = l < 0.5 ? l * (1 + s) : l + s - l * s;
    p = 2 * l - q;
    r = hueToRgb(p, q, h + 1/3);
    g = hueToRgb(p, q, h);
    b = hueToRgb(p, q, h - 1/3);
  }

  return {
    r: Math.round(r * 255),
    g: Math.round(g * 255),
    b: Math.round(b * 255),
    a: color.a
  };
}

function convert (color, outRgb) {
  var trimLeft = /^[\s,#]+/;
  var trimRight = /\s+$/;
  var match, inRgb = true;

  color = color.replace(trimLeft, '').replace(trimRight, '').toLowerCase();

  if (color === 'transparent') {
    return outRgb ?
      { r: 0, g: 0, b: 0, a: 0 } :
      { h: 0, s: 0, l: 0, a: 0 };
  }
  else if ((match = matchers.rgb.exec(color)) || (match = matchers.rgba.exec(color))) {
    color = {
      r: parseInt(match[1]),
      g: parseInt(match[2]),
      b: parseInt(match[3]),
      a: parseInt(match[4]) || 1
    };
  }
  else if ((match = matchers.hsl.exec(color)) || (match = matchers.hsla.exec(color))) {
    inRgb = false;
    color = {
      h: parseFloat(match[1]),
      s: parseFloat(match[2]),
      l: parseFloat(match[3]),
      a: parseFloat(match[4]) || 1
    };
  }
  else if ((match = matchers.hex8.exec(color))) {
    color = {
      r: parseInt(match[2], 16),
      g: parseInt(match[3], 16),
      b: parseInt(match[4], 16),
      a: parseInt(match[1], 16) / 255
    };
  }
  else if ((match = matchers.hex6.exec(color)) || (match = matchers.hex6.exec(cssNames[color]))) {
    color = {
      r: parseInt(match[1], 16),
      g: parseInt(match[2], 16),
      b: parseInt(match[3], 16),
      a: 1
    };
  }
  else if ((match = matchers.hex3.exec(color)) || (match = matchers.hex3.exec(cssNames[color]))) {
    color = {
      r: parseInt(match[1] + '' + match[1], 16),
      g: parseInt(match[2] + '' + match[2], 16),
      b: parseInt(match[3] + '' + match[3], 16),
      a: 1
    };
  } else return false;

  return outRgb === inRgb ?
    color : outRgb ?
      hslaToRgba(color) :
      rgbaToHsla(color);
}

function toRgba (color) {
  return convert(color, true);
}

function toHsla (color) {
  return convert(color, false);
}

// From tinycolor.js http://bgrins.github.io/TinyColor/docs/tinycolor.html
var matchers = (function () {
  // <http://www.w3.org/TR/css3-values/#integers>
  var CSS_INTEGER = "[-\\+]?\\d+%?";

  // <http://www.w3.org/TR/css3-values/#number-value>
  var CSS_NUMBER = "[-\\+]?\\d*\\.\\d+%?";

  // Allow positive/negative integer/number.  Don't capture the either/or, just the entire outcome.
  var CSS_UNIT = "(?:" + CSS_NUMBER + ")|(?:" + CSS_INTEGER + ")";

  // Actual matching.
  // Parentheses and commas are optional, but not required.
  // Whitespace can take the place of commas or opening paren
  var PERMISSIVE_MATCH3 = "[\\s|\\(]+(" + CSS_UNIT + ")[,|\\s]+(" + CSS_UNIT + ")[,|\\s]+(" + CSS_UNIT + ")\\s*\\)?";
  var PERMISSIVE_MATCH4 = "[\\s|\\(]+(" + CSS_UNIT + ")[,|\\s]+(" + CSS_UNIT + ")[,|\\s]+(" + CSS_UNIT + ")[,|\\s]+(" + CSS_UNIT + ")\\s*\\)?";

  return {
    rgb: new RegExp("rgb" + PERMISSIVE_MATCH3),
    rgba: new RegExp("rgba" + PERMISSIVE_MATCH4),
    hsl: new RegExp("hsl" + PERMISSIVE_MATCH3),
    hsla: new RegExp("hsla" + PERMISSIVE_MATCH4),
    hsv: new RegExp("hsv" + PERMISSIVE_MATCH3),
    hex3: /^([0-9a-fA-F]{1})([0-9a-fA-F]{1})([0-9a-fA-F]{1})$/,
    hex6: /^([0-9a-fA-F]{2})([0-9a-fA-F]{2})([0-9a-fA-F]{2})$/,
    hex8: /^([0-9a-fA-F]{2})([0-9a-fA-F]{2})([0-9a-fA-F]{2})([0-9a-fA-F]{2})$/
  };
})();

// From tinycolor.js http://bgrins.github.io/TinyColor/docs/tinycolor.html
var cssNames = {
  aliceblue: 'f0f8ff',
  antiquewhite: 'faebd7',
  aqua: '0ff',
  aquamarine: '7fffd4',
  azure: 'f0ffff',
  beige: 'f5f5dc',
  bisque: 'ffe4c4',
  black: '000',
  blanchedalmond: 'ffebcd',
  blue: '00f',
  blueviolet: '8a2be2',
  brown: 'a52a2a',
  burlywood: 'deb887',
  burntsienna: 'ea7e5d',
  cadetblue: '5f9ea0',
  chartreuse: '7fff00',
  chocolate: 'd2691e',
  coral: 'ff7f50',
  cornflowerblue: '6495ed',
  cornsilk: 'fff8dc',
  crimson: 'dc143c',
  cyan: '0ff',
  darkblue: '00008b',
  darkcyan: '008b8b',
  darkgoldenrod: 'b8860b',
  darkgray: 'a9a9a9',
  darkgreen: '006400',
  darkgrey: 'a9a9a9',
  darkkhaki: 'bdb76b',
  darkmagenta: '8b008b',
  darkolivegreen: '556b2f',
  darkorange: 'ff8c00',
  darkorchid: '9932cc',
  darkred: '8b0000',
  darksalmon: 'e9967a',
  darkseagreen: '8fbc8f',
  darkslateblue: '483d8b',
  darkslategray: '2f4f4f',
  darkslategrey: '2f4f4f',
  darkturquoise: '00ced1',
  darkviolet: '9400d3',
  deeppink: 'ff1493',
  deepskyblue: '00bfff',
  dimgray: '696969',
  dimgrey: '696969',
  dodgerblue: '1e90ff',
  firebrick: 'b22222',
  floralwhite: 'fffaf0',
  forestgreen: '228b22',
  fuchsia: 'f0f',
  gainsboro: 'dcdcdc',
  ghostwhite: 'f8f8ff',
  gold: 'ffd700',
  goldenrod: 'daa520',
  gray: '808080',
  green: '008000',
  greenyellow: 'adff2f',
  grey: '808080',
  honeydew: 'f0fff0',
  hotpink: 'ff69b4',
  indianred: 'cd5c5c',
  indigo: '4b0082',
  ivory: 'fffff0',
  khaki: 'f0e68c',
  lavender: 'e6e6fa',
  lavenderblush: 'fff0f5',
  lawngreen: '7cfc00',
  lemonchiffon: 'fffacd',
  lightblue: 'add8e6',
  lightcoral: 'f08080',
  lightcyan: 'e0ffff',
  lightgoldenrodyellow: 'fafad2',
  lightgray: 'd3d3d3',
  lightgreen: '90ee90',
  lightgrey: 'd3d3d3',
  lightpink: 'ffb6c1',
  lightsalmon: 'ffa07a',
  lightseagreen: '20b2aa',
  lightskyblue: '87cefa',
  lightslategray: '789',
  lightslategrey: '789',
  lightsteelblue: 'b0c4de',
  lightyellow: 'ffffe0',
  lime: '0f0',
  limegreen: '32cd32',
  linen: 'faf0e6',
  magenta: 'f0f',
  maroon: '800000',
  mediumaquamarine: '66cdaa',
  mediumblue: '0000cd',
  mediumorchid: 'ba55d3',
  mediumpurple: '9370db',
  mediumseagreen: '3cb371',
  mediumslateblue: '7b68ee',
  mediumspringgreen: '00fa9a',
  mediumturquoise: '48d1cc',
  mediumvioletred: 'c71585',
  midnightblue: '191970',
  mintcream: 'f5fffa',
  mistyrose: 'ffe4e1',
  moccasin: 'ffe4b5',
  navajowhite: 'ffdead',
  navy: '000080',
  oldlace: 'fdf5e6',
  olive: '808000',
  olivedrab: '6b8e23',
  orange: 'ffa500',
  orangered: 'ff4500',
  orchid: 'da70d6',
  palegoldenrod: 'eee8aa',
  palegreen: '98fb98',
  paleturquoise: 'afeeee',
  palevioletred: 'db7093',
  papayawhip: 'ffefd5',
  peachpuff: 'ffdab9',
  peru: 'cd853f',
  pink: 'ffc0cb',
  plum: 'dda0dd',
  powderblue: 'b0e0e6',
  purple: '800080',
  red: 'f00',
  rosybrown: 'bc8f8f',
  royalblue: '4169e1',
  saddlebrown: '8b4513',
  salmon: 'fa8072',
  sandybrown: 'f4a460',
  seagreen: '2e8b57',
  seashell: 'fff5ee',
  sienna: 'a0522d',
  silver: 'c0c0c0',
  skyblue: '87ceeb',
  slateblue: '6a5acd',
  slategray: '708090',
  slategrey: '708090',
  snow: 'fffafa',
  springgreen: '00ff7f',
  steelblue: '4682b4',
  tan: 'd2b48c',
  teal: '008080',
  thistle: 'd8bfd8',
  tomato: 'ff6347',
  turquoise: '40e0d0',
  violet: 'ee82ee',
  wheat: 'f5deb3',
  white: 'fff',
  whitesmoke: 'f5f5f5',
  yellow: 'ff0',
  yellowgreen: '9acd32'
};

module.exports = {
  toHsla: toHsla,
  toRgba: toRgba
};

},{}]},{},[1])(1)
});