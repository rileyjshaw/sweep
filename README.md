sweep.js
=====

A JavaScript library for smoother color transitions. Project page lives [here](http://rileyjshaw.com/sweep/).

## About

__sweep.js__ is a small JavaScript library (5kb zipped) that enables proper color transitions through the HSL and HUSL spaces. Ordinary CSS transitions or existing frameworks convert HSL colors to RGB _before_ transitioning. __sweep.js__ addresses this by letting you transition through the color spectrum.

I've written an in-depth post about the need for HSL transitions [here](http://rileyjshaw.com/blog/hue-angle-transitions/).

## Install

```.bash
bower install -S sweep
```

...or just [download it from here](https://github.com/rileyjshaw/sweep/blob/master/bin/sweep.min.js).

Sweep's dependencies are bundled; all you have to do is include the script.

```.html
<script src="path/to/sweep.js"></script>
```

Sweep is wrapped with [UMD](https://github.com/umdjs/umd), so it'll also work as a module in your system of choice.

## Usage

Using sweep.js to transition an element's color is easy. Whenever you want to trigger an HSL sweep, call:

```.js
sweep(target, properties, fromColor, toColor[, options])
```

 - `target` - element that you wish to animate
 - `properties` - CSS properties that you wish to animate (string or array of strings)
 - `fromColor` - initial color before the transition
 - `toColor` - final color after the transition
 - `options` (optional) - an object that can set the following:
   - `callback` - function to be called once the animation finishes
   - `direction` - clockwise (1) or counterclockwise (-1)
   - `duration` - time (in ms) to complete the animation
   - `space` - 'HSL', 'HUSL', or 'RGB'

## Examples

Trigger a full color cycle on click:

```.js
//click

var ex1 = document.querySelector('#ex1');
ex1.addEventListener('click', function() {
  sweep(ex1, 'backgroundColor', '#a8f', '#a8f', {direction: -1, duration: 2000});
}, false);
```

Animate from purple to green on hover:

```.js
//hover

var ex2 = document.querySelector('#ex2');

ex2.addEventListener('mouseenter', function() {
  sweep(ex2, 'backgroundColor', getStyle(ex2, 'background-color'), '#0fa');
}, false);

ex2.addEventListener('mouseleave', function() {
  sweep(ex2, 'backgroundColor', getStyle(ex2, 'background-color'), '#a8f');
}, false);
```

Licensed under [MIT](https://github.com/rileyjshaw/sweep/blob/master/LICENSE). Created by [rileyjshaw](http://rileyjshaw.com/).
