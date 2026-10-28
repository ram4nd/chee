# Chee

Live chess analysis overlay powered by Stockfish WASM. A Chrome extension that reads the board from chess.com and lichess.org, runs Stockfish via WebAssembly, and plots the evaluation over the game as a chart in a panel beside the board.

## Setup

```bash
npm install
npm run build
```

Then load the extension in Chrome:

1. Go to `chrome://extensions`
2. Enable **Developer mode**
3. Click **Load unpacked** and select the `dist/` folder

## Development

```bash
npm run watch    # rebuild on file changes
npm run lint     # check code style
npm run lint:fix # auto-fix lint issues
```

Enable debug logging via the extension popup (toggle **Debug logging**), or manually in the browser console:

```js
localStorage.debug = 'chee:*'
```

## Supported Sites

- **chess.com** — `/game/*`, `/play/*` and `/daily/*` pages
- **lichess.org** — all pages with a board

## Features

- Eval chart: white-perspective score at each ply (clamped to ±5, mate = ±5), hover tooltip, cursor on the current ply
- Configurable search depth (15–22)
- Catppuccin theme system (Latte, Frappé, Macchiato, Mocha) + site-matching mode
- Draggable, resizable panel with hide/minimize controls (Alt+C toggles visibility)
- Copy debug info from the popup for troubleshooting

## License

[GPL-3.0](LICENSE)
