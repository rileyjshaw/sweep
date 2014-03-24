sweep.js
=====

A tiny javascript library for smooth HSL color transitions.

## Usage

__sweep.js__ has no dependencies, so as long it's included before it's called you should be fine.

```html
<html>
<head>
  <title>Sweep the leg, Johnny</title>
</head>
<body>
  <!-- body content -->
  <script src="path/to/sweep.js"></script>
  <script src="path/to/rest-of-your.js"></script>
</body>
</html>
```

Whenever you want to trigger an HSL sweep, call `sweepHSL(fromColor, toColor, property[, seconds, target])`, where:

- `fromColor` is the initial color before the transition
- `toColor` is the final color after the transition
- `property` is the property that you wish to animate
- `seconds` (optional) is how long the transition should last. Default is 1s.
- `target` (optional) is the element that you wish to animate. Default is the event target.

### Example
```html
<script>
  var coolButton = document.querySelector('#coolButton');
  coolButton.addEventListener('mouseover', function(e) {
    sweepHSL('#ff0000', '#00ff00', 'background-color', 3);
  }, false);
</script>
```

## Demos
- On [load](#)
- On [hover](#)
- On [repeat](#)
