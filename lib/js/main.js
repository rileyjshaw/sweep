var husl = require('../bower_components/husl/husl.js');
var convert = require('./convert.js');

var sweep = (function() {

  // keep current animations in a closure; deal with each in
  // a single tick to prevent dom thrashing and event hell
  var batch = [];

  function tick () {
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
      components[4] = from.a + deltas[3] * frame;

      if (space === 'HSL' || space === 'HUSL') {
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

      } else {
        // red
        components[0] = Math.floor(from.r + deltas[0] * frame);
        // green
        components[1] = Math.floor(from.g + deltas[1] * frame);
        // blue
        components[2] = Math.floor(from.b + deltas[2] * frame);

        composed = 'rgba(' + [components] + ')';
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

    // ++frame & remove finished animations step:
    batch.forEach(function (animation, index) {
      var fn, frame = (animation.frame += 1);
      if (frame === animation.end) {
        // remove the animation from batch and store its callback
        fn = batch.splice(index, 1)[0].callback;
        // call the callback if it exists
        if (typeof fn === 'function') callbacks.push(fn);
      }
    });

    if (batch.length) {
      requestAnimationFrame(tick);
    }

    // run this after checking batch length to avoid
    // calls to sweep() in callbacks altering batch
    callbacks.forEach(function (fn) { fn() });
  }

  function queueAnimation (animation) {
    if (batch.push(animation) === 1) {
      requestAnimationFrame(tick);
    }
  }

  return function (target, properties, from, to, args) {
    var steps, angle, callback, direction, duration, space, deltas = [];

    if (args) {
      callback = args.callback;
      direction = args.direction;
      duration = args.duration;
      space = args.space;
    } else args = {};

    // if a string argument is passed, put it into a length 1 array
    if (typeof properties === 'string') {
      properties = [properties];
    }

    if (properties.every(function (property) { return (typeof target.style[property] === 'string'); })) {

      // set defaults
      if (typeof duration !== "number" || duration < 0) {
        duration = 4000;
      }

      if (space) {
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
        if (space !== 'HUSL') space = 'HSL';

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

      return queueAnimation(args);

    } else return false;
  };
})();

window.sweep = sweep;
