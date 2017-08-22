!function(e){if("object"==typeof exports&&"undefined"!=typeof module)module.exports=e();else if("function"==typeof define&&define.amd)define([],e);else{var f;"undefined"!=typeof window?f=window:"undefined"!=typeof global?f=global:"undefined"!=typeof self&&(f=self),f.sweep=e()}}(function(){var define,module,exports;return (function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);var f=new Error("Cannot find module '"+o+"'");throw f.code="MODULE_NOT_FOUND",f}var l=n[o]={exports:{}};t[o][0].call(l.exports,function(e){var n=t[o][1][e];return s(n?n:e)},l,l.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){
var hsluv = require('../node_modules/hsluv/hsluv.js');
var convert = require('./convert.js');

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

            } else { // it's HSL(uv)
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
                } else {
                    composed = 'rgba(' + hsluv.hsluvToRgb([
                        components[0],
                        components[1],
                        components[2]
                    ]).map(function(component) {
                        return Math.floor(component * 255);
                    }) + ',' + components[3] + ')';
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
        callbacks = batch.map(function(animation) {
            return animation.frame === animation.end ? animation.pause() : false;
        }).filter(function(animation) {
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
    function queueAnimation() {
        if (batch.indexOf(this) === -1 && batch.push(this) === 1) requestAnimationFrame(tick);
    }

    // remove the animation from batch and return its callback
    function dequeueAnimation() {
        return (batch.splice(batch.indexOf(this), 1)[0] || {}).callback;
    }

    return function(targets, properties, from, to, args) {
        var steps, angle, callback, direction, duration, space, deltas = [];

        if (typeof properties === 'string') properties = [properties];
        if (targets.constructor !== Array) targets = [targets];
        var targetsIsNodelist = false;
        if (NodeList.prototype.isPrototypeOf(targets[0])) {
            targets = targets[0];
            targetsIsNodelist = true;
        } // accounts for nodelists
        // type checking
        if (!targetsIsNodelist && targets.some(function(target) {
                return !(target instanceof Element);
            }))
            throw 'The first argument to sweep() must be an array DOM elements or a single DOM element';

        if (properties.some(function(property) {
                return (typeof targets[0].style[property] !== 'string');
            }))
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
        } else if (space === 'HSL') { // space is HSL
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
        } else { // space is HSLuv
            from = convert.toRgba(from);
            to = convert.toRgba(to);
            var fromHSLuv = hsluv.rgbToHsluv([from.r / 255, from.g / 255, from.b / 255]);
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

},{"../node_modules/hsluv/hsluv.js":3,"./convert.js":2}],2:[function(require,module,exports){
/**
 * Lightweight module to convert colors from
 * rgb, rgba, hex, hsl, hsla, or CSS named colors
 * to an hsla or rgba object.
 */

function rgbaToHsla(color) {
    var r = color.r / 255,
        g = color.g / 255,
        b = color.b / 255;
    var max = Math.max(r, g, b),
        min = Math.min(r, g, b);
    var h, s, l = (max + min) / 2;

    if (max == min) {
        h = s = 0; // achromatic
    } else {
        var d = max - min;
        s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
        switch (max) {
            case r:
                h = (g - b) / d + (g < b ? 6 : 0);
                break;
            case g:
                h = (b - r) / d + 2;
                break;
            case b:
                h = (r - g) / d + 4;
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

function hslaToRgba(color) {
    function hueToRgb(p, q, t) {
        if (t < 0) t += 1;
        if (t > 1) t -= 1;
        if (t < 1 / 6) return p + (q - p) * 6 * t;
        if (t < 1 / 2) return q;
        if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
        return p;
    }

    var r, g, b, q, p, h = color.h,
        s = color.s,
        l = color.l;

    if (s === 0) {
        r = g = b = l; // achromatic
    } else {
        q = l < 0.5 ? l * (1 + s) : l + s - l * s;
        p = 2 * l - q;
        r = hueToRgb(p, q, h + 1 / 3);
        g = hueToRgb(p, q, h);
        b = hueToRgb(p, q, h - 1 / 3);
    }

    return {
        r: Math.round(r * 255),
        g: Math.round(g * 255),
        b: Math.round(b * 255),
        a: color.a
    };
}

function convert(color, outRgb) {
    var trimLeft = /^[\s,#]+/;
    var trimRight = /\s+$/;
    var match, inRgb = true;

    color = color.replace(trimLeft, '').replace(trimRight, '').toLowerCase();

    if (color === 'transparent') {
        return outRgb ? {
            r: 0,
            g: 0,
            b: 0,
            a: 0
        } : {
            h: 0,
            s: 0,
            l: 0,
            a: 0
        };
    } else if ((match = matchers.rgba.exec(color)) || (match = matchers.rgb.exec(color))) {
        color = {
            r: parseInt(match[1]),
            g: parseInt(match[2]),
            b: parseInt(match[3]),
            a: parseFloat(match[4]) || 1
        };
    } else if ((match = matchers.hsla.exec(color)) || (match = matchers.hsl.exec(color))) {
        inRgb = false;
        color = {
            h: parseFloat(match[1]),
            s: parseFloat(match[2]),
            l: parseFloat(match[3]),
            a: parseFloat(match[4]) || 1
        };
    } else if ((match = matchers.hex8.exec(color))) {
        color = {
            r: parseInt(match[2], 16),
            g: parseInt(match[3], 16),
            b: parseInt(match[4], 16),
            a: parseFloat(match[1], 16) / 255
        };
    } else if ((match = matchers.hex6.exec(color)) || (match = matchers.hex6.exec(cssNames[color]))) {
        color = {
            r: parseInt(match[1], 16),
            g: parseInt(match[2], 16),
            b: parseInt(match[3], 16),
            a: 1
        };
    } else if ((match = matchers.hex3.exec(color)) || (match = matchers.hex3.exec(cssNames[color]))) {
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

function toRgba(color) {
    return convert(color, true);
}

function toHsla(color) {
    return convert(color, false);
}

// From tinycolor.js http://bgrins.github.io/TinyColor/docs/tinycolor.html
var matchers = (function() {
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

},{}],3:[function(require,module,exports){
(function() {
var HxOverrides = function() { };
HxOverrides.cca = function(s,index) {
	var x = s.charCodeAt(index);
	if(x != x) return undefined;
	return x;
};
HxOverrides.substr = function(s,pos,len) {
	if(pos != null && pos != 0 && len != null && len < 0) return "";
	if(len == null) len = s.length;
	if(pos < 0) {
		pos = s.length + pos;
		if(pos < 0) pos = 0;
	} else if(len < 0) len = s.length + len - pos;
	return s.substr(pos,len);
};
var Std = function() { };
Std.parseInt = function(x) {
	var v = parseInt(x,10);
	if(v == 0 && (HxOverrides.cca(x,1) == 120 || HxOverrides.cca(x,1) == 88)) v = parseInt(x);
	if(isNaN(v)) return null;
	return v;
};
var StringTools = function() { };
StringTools.hex = function(n,digits) {
	var s = "";
	var hexChars = "0123456789ABCDEF";
	do {
		s = hexChars.charAt(n & 15) + s;
		n >>>= 4;
	} while(n > 0);
	if(digits != null) while(s.length < digits) s = "0" + s;
	return s;
};
var hsluv = hsluv || {};
hsluv.Geometry = function() { };
hsluv.Geometry.intersectLineLine = function(a,b) {
	var x = (a.intercept - b.intercept) / (b.slope - a.slope);
	var y = a.slope * x + a.intercept;
	return { x : x, y : y};
};
hsluv.Geometry.distanceFromOrigin = function(point) {
	return Math.sqrt(Math.pow(point.x,2) + Math.pow(point.y,2));
};
hsluv.Geometry.distanceLineFromOrigin = function(line) {
	return Math.abs(line.intercept) / Math.sqrt(Math.pow(line.slope,2) + 1);
};
hsluv.Geometry.perpendicularThroughPoint = function(line,point) {
	var slope = -1 / line.slope;
	var intercept = point.y - slope * point.x;
	return { slope : slope, intercept : intercept};
};
hsluv.Geometry.angleFromOrigin = function(point) {
	return Math.atan2(point.y,point.x);
};
hsluv.Geometry.normalizeAngle = function(angle) {
	var m = 2 * Math.PI;
	return (angle % m + m) % m;
};
hsluv.Geometry.lengthOfRayUntilIntersect = function(theta,line) {
	return line.intercept / (Math.sin(theta) - line.slope * Math.cos(theta));
};
hsluv.Hsluv = function() { };
hsluv.Hsluv.getBounds = function(L) {
	var result = [];
	var sub1 = Math.pow(L + 16,3) / 1560896;
	var sub2;
	if(sub1 > hsluv.Hsluv.epsilon) sub2 = sub1; else sub2 = L / hsluv.Hsluv.kappa;
	var _g = 0;
	while(_g < 3) {
		var c = _g++;
		var m1 = hsluv.Hsluv.m[c][0];
		var m2 = hsluv.Hsluv.m[c][1];
		var m3 = hsluv.Hsluv.m[c][2];
		var _g1 = 0;
		while(_g1 < 2) {
			var t = _g1++;
			var top1 = (284517 * m1 - 94839 * m3) * sub2;
			var top2 = (838422 * m3 + 769860 * m2 + 731718 * m1) * L * sub2 - 769860 * t * L;
			var bottom = (632260 * m3 - 126452 * m2) * sub2 + 126452 * t;
			result.push({ slope : top1 / bottom, intercept : top2 / bottom});
		}
	}
	return result;
};
hsluv.Hsluv.maxSafeChromaForL = function(L) {
	var bounds = hsluv.Hsluv.getBounds(L);
	var min = 1.7976931348623157e+308;
	var _g = 0;
	while(_g < 2) {
		var i = _g++;
		var length = hsluv.Geometry.distanceLineFromOrigin(bounds[i]);
		min = Math.min(min,length);
	}
	return min;
};
hsluv.Hsluv.maxChromaForLH = function(L,H) {
	var hrad = H / 360 * Math.PI * 2;
	var bounds = hsluv.Hsluv.getBounds(L);
	var min = 1.7976931348623157e+308;
	var _g = 0;
	while(_g < bounds.length) {
		var bound = bounds[_g];
		++_g;
		var length = hsluv.Geometry.lengthOfRayUntilIntersect(hrad,bound);
		if(length >= 0) min = Math.min(min,length);
	}
	return min;
};
hsluv.Hsluv.dotProduct = function(a,b) {
	var sum = 0;
	var _g1 = 0;
	var _g = a.length;
	while(_g1 < _g) {
		var i = _g1++;
		sum += a[i] * b[i];
	}
	return sum;
};
hsluv.Hsluv.fromLinear = function(c) {
	if(c <= 0.0031308) return 12.92 * c; else return 1.055 * Math.pow(c,0.416666666666666685) - 0.055;
};
hsluv.Hsluv.toLinear = function(c) {
	if(c > 0.04045) return Math.pow((c + 0.055) / 1.055,2.4); else return c / 12.92;
};
hsluv.Hsluv.xyzToRgb = function(tuple) {
	return [hsluv.Hsluv.fromLinear(hsluv.Hsluv.dotProduct(hsluv.Hsluv.m[0],tuple)),hsluv.Hsluv.fromLinear(hsluv.Hsluv.dotProduct(hsluv.Hsluv.m[1],tuple)),hsluv.Hsluv.fromLinear(hsluv.Hsluv.dotProduct(hsluv.Hsluv.m[2],tuple))];
};
hsluv.Hsluv.rgbToXyz = function(tuple) {
	var rgbl = [hsluv.Hsluv.toLinear(tuple[0]),hsluv.Hsluv.toLinear(tuple[1]),hsluv.Hsluv.toLinear(tuple[2])];
	return [hsluv.Hsluv.dotProduct(hsluv.Hsluv.minv[0],rgbl),hsluv.Hsluv.dotProduct(hsluv.Hsluv.minv[1],rgbl),hsluv.Hsluv.dotProduct(hsluv.Hsluv.minv[2],rgbl)];
};
hsluv.Hsluv.yToL = function(Y) {
	if(Y <= hsluv.Hsluv.epsilon) return Y / hsluv.Hsluv.refY * hsluv.Hsluv.kappa; else return 116 * Math.pow(Y / hsluv.Hsluv.refY,0.333333333333333315) - 16;
};
hsluv.Hsluv.lToY = function(L) {
	if(L <= 8) return hsluv.Hsluv.refY * L / hsluv.Hsluv.kappa; else return hsluv.Hsluv.refY * Math.pow((L + 16) / 116,3);
};
hsluv.Hsluv.xyzToLuv = function(tuple) {
	var X = tuple[0];
	var Y = tuple[1];
	var Z = tuple[2];
	var divider = X + 15 * Y + 3 * Z;
	var varU = 4 * X;
	var varV = 9 * Y;
	if(divider != 0) {
		varU /= divider;
		varV /= divider;
	} else {
		varU = NaN;
		varV = NaN;
	}
	var L = hsluv.Hsluv.yToL(Y);
	if(L == 0) return [0,0,0];
	var U = 13 * L * (varU - hsluv.Hsluv.refU);
	var V = 13 * L * (varV - hsluv.Hsluv.refV);
	return [L,U,V];
};
hsluv.Hsluv.luvToXyz = function(tuple) {
	var L = tuple[0];
	var U = tuple[1];
	var V = tuple[2];
	if(L == 0) return [0,0,0];
	var varU = U / (13 * L) + hsluv.Hsluv.refU;
	var varV = V / (13 * L) + hsluv.Hsluv.refV;
	var Y = hsluv.Hsluv.lToY(L);
	var X = 0 - 9 * Y * varU / ((varU - 4) * varV - varU * varV);
	var Z = (9 * Y - 15 * varV * Y - varV * X) / (3 * varV);
	return [X,Y,Z];
};
hsluv.Hsluv.luvToLch = function(tuple) {
	var L = tuple[0];
	var U = tuple[1];
	var V = tuple[2];
	var C = Math.sqrt(U * U + V * V);
	var H;
	if(C < 0.00000001) H = 0; else {
		var Hrad = Math.atan2(V,U);
		H = Hrad * 180.0 / 3.1415926535897932;
		if(H < 0) H = 360 + H;
	}
	return [L,C,H];
};
hsluv.Hsluv.lchToLuv = function(tuple) {
	var L = tuple[0];
	var C = tuple[1];
	var H = tuple[2];
	var Hrad = H / 360.0 * 2 * Math.PI;
	var U = Math.cos(Hrad) * C;
	var V = Math.sin(Hrad) * C;
	return [L,U,V];
};
hsluv.Hsluv.hsluvToLch = function(tuple) {
	var H = tuple[0];
	var S = tuple[1];
	var L = tuple[2];
	if(L > 99.9999999) return [100,0,H];
	if(L < 0.00000001) return [0,0,H];
	var max = hsluv.Hsluv.maxChromaForLH(L,H);
	var C = max / 100 * S;
	return [L,C,H];
};
hsluv.Hsluv.lchToHsluv = function(tuple) {
	var L = tuple[0];
	var C = tuple[1];
	var H = tuple[2];
	if(L > 99.9999999) return [H,0,100];
	if(L < 0.00000001) return [H,0,0];
	var max = hsluv.Hsluv.maxChromaForLH(L,H);
	var S = C / max * 100;
	return [H,S,L];
};
hsluv.Hsluv.hpluvToLch = function(tuple) {
	var H = tuple[0];
	var S = tuple[1];
	var L = tuple[2];
	if(L > 99.9999999) return [100,0,H];
	if(L < 0.00000001) return [0,0,H];
	var max = hsluv.Hsluv.maxSafeChromaForL(L);
	var C = max / 100 * S;
	return [L,C,H];
};
hsluv.Hsluv.lchToHpluv = function(tuple) {
	var L = tuple[0];
	var C = tuple[1];
	var H = tuple[2];
	if(L > 99.9999999) return [H,0,100];
	if(L < 0.00000001) return [H,0,0];
	var max = hsluv.Hsluv.maxSafeChromaForL(L);
	var S = C / max * 100;
	return [H,S,L];
};
hsluv.Hsluv.rgbToHex = function(tuple) {
	var h = "#";
	var _g1 = 0;
	var _g = tuple.length;
	while(_g1 < _g) {
		var i = _g1++;
		var chan = tuple[i];
		h += StringTools.hex(Math.round(chan * 255),2).toLowerCase();
	}
	return h;
};
hsluv.Hsluv.hexToRgb = function(hex) {
	hex = hex.toUpperCase();
	return [Std.parseInt("0x" + HxOverrides.substr(hex,1,2)) / 255.0,Std.parseInt("0x" + HxOverrides.substr(hex,3,2)) / 255.0,Std.parseInt("0x" + HxOverrides.substr(hex,5,2)) / 255.0];
};
hsluv.Hsluv.lchToRgb = function(tuple) {
	return hsluv.Hsluv.xyzToRgb(hsluv.Hsluv.luvToXyz(hsluv.Hsluv.lchToLuv(tuple)));
};
hsluv.Hsluv.rgbToLch = function(tuple) {
	return hsluv.Hsluv.luvToLch(hsluv.Hsluv.xyzToLuv(hsluv.Hsluv.rgbToXyz(tuple)));
};
hsluv.Hsluv.hsluvToRgb = function(tuple) {
	return hsluv.Hsluv.lchToRgb(hsluv.Hsluv.hsluvToLch(tuple));
};
hsluv.Hsluv.rgbToHsluv = function(tuple) {
	return hsluv.Hsluv.lchToHsluv(hsluv.Hsluv.rgbToLch(tuple));
};
hsluv.Hsluv.hpluvToRgb = function(tuple) {
	return hsluv.Hsluv.lchToRgb(hsluv.Hsluv.hpluvToLch(tuple));
};
hsluv.Hsluv.rgbToHpluv = function(tuple) {
	return hsluv.Hsluv.lchToHpluv(hsluv.Hsluv.rgbToLch(tuple));
};
hsluv.Hsluv.hsluvToHex = function(tuple) {
	return hsluv.Hsluv.rgbToHex(hsluv.Hsluv.hsluvToRgb(tuple));
};
hsluv.Hsluv.hpluvToHex = function(tuple) {
	return hsluv.Hsluv.rgbToHex(hsluv.Hsluv.hpluvToRgb(tuple));
};
hsluv.Hsluv.hexToHsluv = function(s) {
	return hsluv.Hsluv.rgbToHsluv(hsluv.Hsluv.hexToRgb(s));
};
hsluv.Hsluv.hexToHpluv = function(s) {
	return hsluv.Hsluv.rgbToHpluv(hsluv.Hsluv.hexToRgb(s));
};
hsluv.Hsluv.m = [[3.240969941904521,-1.537383177570093,-0.498610760293],[-0.96924363628087,1.87596750150772,0.041555057407175],[0.055630079696993,-0.20397695888897,1.056971514242878]];
hsluv.Hsluv.minv = [[0.41239079926595,0.35758433938387,0.18048078840183],[0.21263900587151,0.71516867876775,0.072192315360733],[0.019330818715591,0.11919477979462,0.95053215224966]];
hsluv.Hsluv.refY = 1.0;
hsluv.Hsluv.refU = 0.19783000664283;
hsluv.Hsluv.refV = 0.46831999493879;
hsluv.Hsluv.kappa = 903.2962962;
hsluv.Hsluv.epsilon = 0.0088564516;
var root = {
    "hsluvToRgb": hsluv.Hsluv.hsluvToRgb,
    "rgbToHsluv": hsluv.Hsluv.rgbToHsluv,
    "hpluvToRgb": hsluv.Hsluv.hpluvToRgb,
    "rgbToHpluv": hsluv.Hsluv.rgbToHpluv,
    "hsluvToHex": hsluv.Hsluv.hsluvToHex,
    "hexToHsluv": hsluv.Hsluv.hexToHsluv,
    "hpluvToHex": hsluv.Hsluv.hpluvToHex,
    "hexToHpluv": hsluv.Hsluv.hexToHpluv
};// CommonJS module system (including Node)
if (typeof module !== 'undefined') {
    module['exports'] = root;
}

// AMD module system
if (typeof define !== 'undefined') {
    define(root);
}

// Export to browser
if (typeof window !== 'undefined') {
    window['hsluv'] = root;
}
})();

},{}]},{},[1])(1)
});