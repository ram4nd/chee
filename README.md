# Chee

Game review for chess.com, powered by Stockfish WASM. Once your game ends, a panel above the move list shows the eval chart and your mistakes. Nothing is shown and the engine is not loaded while the game is in progress, so it stays within fair-play rules.

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

- **chess.com** — `/game/*`, `/play/*` and `/daily/*` pages, after the game has ended

## Features

- Locked during live games: no eval, no engine
- Eval chart of the whole game: hover for scores, click to jump to a move, dots on your mistakes
- Your inaccuracies (?!), mistakes (?) and blunders (??) listed and marked in the move list
- Click a mistake to see the position before it and look for the better move; "Best move?" reveals the engine's choice
- Search depth of 12, 15, 18 or 20
- Catppuccin theme system (Latte, Frappé, Macchiato, Mocha) + site-matching mode
- Copy debug info from the popup for troubleshooting

## License

[GPL-3.0](LICENSE)
