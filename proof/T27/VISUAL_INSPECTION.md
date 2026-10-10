T27 visual inspection receipt

Inspected with vision_analyze:
  assets/desktop/icon.png: original opaque 512px skull-and-crossed-swords mark,
    white/silver skull and blades with purple/magenta edging on near-black.
  proof/T27/icon-pixels.png: actual generated nearest-neighbour enlarged pixels
    and true-size icons on synthetic light, dark and high-contrast backgrounds.
    Template is nonblank, monochrome and recognizably source-derived; 16px has
    expected detail loss, 32px clearly retains skull/eye/sword shape. Background
    transparency verified separately in assets.json and executable Python tests.
    Colour version preserves white/silver/purple mark; white parts are naturally
    lower contrast against light surfaces than against dark. No palette edits or
    invented strokes were used to disguise that source-art limitation.
  proof/T27/native-fixture.png: actual isolated Electron BrowserWindow capture,
    synthetic labeling, real native Menu item labels reflected into fixture,
    explicit Settings-disabled/unresolved notice, true-size generated icons in
    light and dark panels. Legible. It is NOT an OS tray/menu screenshot.

No independent visual acceptance self-awarded. Installed OS appearance, physical
tray/menu click, Windows/Linux native rendering, and About dialog rendering remain
unverified. The macOS API probe is unpackaged repository Electron only.
