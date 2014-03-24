sweep.js
=====

A tiny javascript library for smooth HSL color transitions.

## Usage

sweep.js has no dependencies, so as long as you include it before you try to use it you should be fine.

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

Whenever you want to trigger an HSL sweep, call `sweepHSL(element, fromColor, toColor, property, seconds)`, where:

- `element` is the element that you wish to animate
- `fromColor` is the initial color before the transition
- `toColor` is the final color after the transition
- `property` is the property that you wish to animate
- `seconds` is how long the transition should last

## Example
```html
<script>
  var coolButton = document.querySelector('#coolButton');
  coolButton.addEventListener('hover', function() {
    sweepHSL(coolButton, '#ff0000', '#00ff00', 'background-color', 3);
  }, false);
</script>
```

## Demos
- On [load](#)
- On [hover](#)
- On [repeat](#)
