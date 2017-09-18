var hsluv = require("../node_modules/hsluv/hsluv.js");
var convert = require("./convert.js");

var sweep = (function() {
  // keep current animations in this closure; deal with each in
  // a single tick to prevent dom thrashing and event hell
  var batch = [];

  function tick() {
    // increment frames step:
    batch.forEach(function(animation) {
      ++animation.frame;
    });

    // calculation step:
    var computedSteps = [],
      callbacks = [];

    batch.forEach(function(animation) {
      var targets = animation.targets;
      var properties = animation.properties;
      var from = animation.from;
      var space = animation.space;
      var frame = animation.frame;
      var deltas = animation.deltas;

      // components = [h, s, l, a] || [r, g, b, a]
      var composed,
        components = new Array(4);

      // set alpha level
      components[3] = from.a + deltas[3] * frame;

      if (space === "RGB") {
        // red
        components[0] = Math.floor(from.r + deltas[0] * frame);
        // green
        components[1] = Math.floor(from.g + deltas[1] * frame);
        // blue
        components[2] = Math.floor(from.b + deltas[2] * frame);

        composed = "rgba(" + [components] + ")";
      } else {
        // it's HSL(uv)
        // hue
        components[0] = (Math.floor(from.h + deltas[0] * frame) + 360) % 360;
        // saturation
        components[1] = Math.floor((from.s + deltas[1] * frame) * 100);
        // lightness
        components[2] = Math.floor((from.l + deltas[2] * frame) * 100);
        if (space === "HSL") {
          composed =
            "hsla(" +
            components[0] +
            "," +
            components[1] +
            "%," +
            components[2] +
            "%," +
            components[3] +
            ")";
        } else {
          composed =
            "rgba(" +
            hsluv
            .hsluvToRgb([components[0], components[1], components[2]])
            .map(function(component) {
              return Math.floor(component * 255);
            }) +
            "," +
            components[3] +
            ")";
        }
      }

      computedSteps.push({
        targets: targets,
        properties: properties,
        composed: composed
      });
    });

    // DOM painting step:
    computedSteps.forEach(function(step) {
      step.properties.forEach(function(property) {
        step.targets.forEach(function(target) {
          target.style[property] = step.composed;
        });
      });
    });

    // remove finished animations step:
    callbacks = batch
      .map(function(animation) {
        return animation.frame === animation.end ? animation.pause() : false;
      })
      .filter(function(animation) {
        return typeof animation === "function";
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
  function queueAnimation() {
    if (batch.indexOf(this) === -1 && batch.push(this) === 1)
      requestAnimationFrame(tick);
  }

  // remove the animation from batch and return its callback
  function dequeueAnimation() {
    return (batch.splice(batch.indexOf(this), 1)[0] || {}).callback;
  }

  return function(targets, properties, from, to, args) {
    var steps,
      angle,
      callback,
      direction,
      duration,
      space,
      deltas = [];

    if (typeof properties === "string") properties = [properties];
    if (!NodeList.prototype.isPrototypeOf(targets)) {
      if (!Array.isArray(targets)) targets = [targets];
      if (targets.some(function(target) {
          return !(target instanceof Element);
        }))
        throw 'The first argument to sweep() must be an array of DOM elements or a single DOM element';
    }
    if (
      properties.some(function(property) {
        return typeof targets[0].style[property] !== "string";
      })
    )
      throw "The second argument to sweep() must be either a string or an array of strings";

    if (typeof from !== "string")
      throw "The third argument to sweep() must be a string";

    if (typeof to !== "string")
      throw "The fourth argument to sweep() must be a string";

    if (args) {
      if (typeof args !== "object")
        throw "The fifth argument to sweep() must be an object";

      callback = args.callback;
      direction = args.direction;
      duration = args.duration;
      space = args.space;
    } else args = {};

    // set default args
    if (typeof duration !== "number" || duration < 0) {
      duration = 800;
    }

    if (typeof space === "string") {
      space = space.toUpperCase();
      if (space.slice(-1) === "A") space = space.slice(0, -1);
    }

    steps = Math.ceil(duration * 60 / 1000); // 60 fps

    if (space === "RGB") {
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
    } else {
      if (space === "HSL") {
        // space is HSL
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
      } else {
        // space is HSLuv
        from = convert.toRgba(from);
        to = convert.toRgba(to);
        var fromHSLuv = hsluv.rgbToHsluv([
          from.r / 255,
          from.g / 255,
          from.b / 255
        ]);
        var toHSLuv = hsluv.rgbToHsluv([to.r / 255, to.g / 255, to.b / 255]);
        from.h = fromHSLuv[0];
        from.s = fromHSLuv[1] / 100;
        from.l = fromHSLuv[2] / 100;
        to.h = toHSLuv[0];
        to.s = toHSLuv[1] / 100;
        to.l = toHSLuv[2] / 100;
        // deltas = [dH, dS, dL, dA]
        deltas = [
          0,
          (to.s - from.s) / steps,
          (to.l - from.l) / steps,
          (from.a - to.a) / steps
        ];
      }
      // if we're transitioning to/from black, grey, or white, don't move the hue angle. Otherwise...
      if (to.s * from.s * to.l * from.l || to.l !== 100 || from.l !== 100) {
        // bind dH to [0, 360)
        deltas[0] = (to.h - from.h + 360) % 360;
        if ((direction !== 1 && deltas[0] > 180) || direction === -1) {
          // spin counterclockwise
          deltas[0] -= 360;
        }
        deltas[0] /= steps;
      }
    }
    // throw 'em all into args before passing into queueAnimation
    args.frame = 0;
    args.targets = targets;
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
