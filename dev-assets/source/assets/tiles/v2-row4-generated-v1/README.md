# Loopduel Tile Row 4 Replacements

These six generated source PNGs replace the clipped final row that used to live in
`dev-assets/source/assets/tiles/loopduel-tiles-retro-gothic-v2.png`.

The original atlas row only contained about 156px of a 256px tile, so the slicer
could only choose between neighbor bleed, vertical stretching, or duplicated edge
pixels. These replacements are complete square source images and are normalized by
`scripts/slice-tile-art.mjs` into 256x256 runtime sprites.

Generation source:

- Built-in image generation tool
- Thread image directory:
  `/home/orlovboros/.codex/generated_images/019ea985-0d36-7651-84be-99008f7a2aea`
- Prompt family: "single complete square Loopduel board tile sprite, retro-gothic
  pixel-painterly style, carved stone frame, gold corner inlays, connector
  ornaments, no cropping, no neighboring tiles, no labels"

Tile subjects:

- `thornmaze.png`: circular thorn labyrinth
- `graveyard.png`: mossy graveyard with low fog
- `reliquary.png`: treasure reliquary with candles
- `dragonroost.png`: wyrm egg and dragon bones
- `ambush.png`: crossed weapons and trap markings
- `scorch.png`: cracked lava ground
