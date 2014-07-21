var husl = require('../bower_components/husl/husl.js');
var convert = require('./convert.js');

function sweep (target, properties, from, to, options) {
  function tick () {
    var h, s, l, r, g, b, composed, a = from.a + dA * frame;

    if (space === 'HSL' || space === 'HUSL') {
      s = Math.floor((from.s + dS * frame) * 100);
      l = Math.floor((from.l + dL * frame) * 100);
      h = (Math.floor(from.h + dH * frame) + 360) % 360;

      composed = space === 'HSL' ?
        'hsla(' + h + ',' + s + '%,' + l + '%,' + a + ')' :
        husl.toHex(h, s, l);
    } else {
      r = Math.floor(from.r + dR * frame);
      g = Math.floor(from.g + dG * frame);
      b = Math.floor(from.b + dB * frame);

      composed = 'rgba(' + [r, g, b, a] + ')';
    }
    properties.forEach(function (property) {
      target.style[property] = composed;
    });

    if ((frame += 1) !== steps) {
      return requestAnimationFrame(tick);
    } else if (typeof callback === 'function') {
      return callback();
    }
  }

  var steps, angle, dR, dG, dB, dH, dS, dL, dA, frame = 0;
  var callback = options.callback;
  var direction = options.direction;
  var duration = options.duration;
  var space = options.space;
  // if a string argument is passed, put it into a length 1 array
  if (typeof properties === 'string') {
    properties = [properties];
  }

  if (properties.every(function (property) {
    return (typeof target.style[property] === 'string');
  })) {
    // set defaults
    if (typeof duration !== "number" || duration < 0) duration = 4000;
    if (space) space = space.toUpperCase();
    if (space.slice(-1) === 'A') space = space.slice(0, -1);

    steps = Math.ceil(duration * 60 / 1000); // 60 fps

    if (space === 'RGB') {
      // convert colors to { r: _, g: _, b: _, a: _ } format
      from = convert.toRgba(from);
      to = convert.toRgba(to);
      dR = (to.r - from.r) / steps;
      dG = (to.g - from.g) / steps;
      dB = (to.b - from.b) / steps;
    } else {
      // convert colors to { h: _, s: _, l: _, a: _ } format
      from = convert.toHsla(from);
      to = convert.toHsla(to);

      // if we're transitioning to/from black, grey, or white, don't move the hue angle
      if (to.s * from.s * to.l * from.l === 0 || to.l == 100 || from.l === 100) {
        dH = 0;
      } else {
        // bind dH to [0, 360)
        dH = ((to.h - from.h) + 360) % 360;
        if (direction !== 1 && dH > 180 || direction === -1) {
          // spin counterclockwise
          dH -= 360;
        }
        dH /= steps;
      }
      dS = (to.s - from.s) / steps;
      dL = (to.l - from.l) / steps;
    }

    dA = (to.a - from.a) / steps;
    return requestAnimationFrame(tick);
  }

  return false;
}

window.sweep = sweep;
