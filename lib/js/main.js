var tinycolor = require('../bower_components/tinycolor/tinycolor.js');
var husl = require('../bower_components/husl/husl.js');

function sweep (target, properties, from, to, options) {
  function tick () {
    var saturation = Math.floor((from.s + deltaS * frame) * 100);
    var lightness = Math.floor((from.l + deltaL * frame) * 100);
    var hue = (Math.floor(from.h + deltaH * frame) + 360) % 360;
    var composed;

    if (space === 'HSL') {
      composed = 'hsl(' + hue + ',' + saturation + '%,' + lightness + '%)';
    } else if (space === 'HUSL') {
      composed = husl.toHex(hue, saturation, lightness);
    } else {
      // TODO: rgb
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

  var steps, angle, deltaH, deltaS, deltaL, frame = 0;
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
  })) { console.log('y');
    // set defaults
    if (typeof duration !== "number" || duration < 0) duration = 4000;
    if (space) space = space.toUpperCase();
    if (space !== 'HUSL' && space !== 'RGB') space = 'HSL';

    // convert colors to { h: _, s: _, l: _, a: _ } format
    from = tinycolor(from).toHsl();
    to = tinycolor(to).toHsl();

    steps = Math.ceil(duration * 60 / 1000); // 60 fps
    // if we're transitioning to/from black, grey, or white, don't move the hue angle
    if (to.s * from.s * to.l * from.l === 0 || to.l == 100 || from.l === 100) {
      deltaH = 0;
    } else {
      // bind deltaH to [0, 360)
      deltaH = ((to.h - from.h) + 360) % 360;
      if (direction !== 1 && deltaH > 180 || direction === -1) {
        // spin counterclockwise
        deltaH -= 360;
      }
      deltaH /= steps;
    }
    deltaS = (to.s - from.s) / steps;
    deltaL = (to.l - from.l) / steps;

    return requestAnimationFrame(tick);
  }

  return false;
}

window.sweep = sweep;
