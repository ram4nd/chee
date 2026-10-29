# Chee

Post-game review for chess.com, powered by Stockfish WASM. When your game ends, a panel above the move list shows an eval chart of the whole game and lists your mistakes. While a game is in progress nothing is shown and the engine is not loaded, so it stays within fair-play rules.

This is a fork of [hong4rc/chee](https://github.com/hong4rc/chee), reworked from a live analysis overlay into a review-only tool.

## Install

```bash
git clone git@github.com:ram4nd/chee.git
cd chee
git checkout eval-chart-only
npm install
npm run build
```

Then load it in Chrome:

1. Open `chrome://extensions`
2. Turn on **Developer mode**
3. Click **Load unpacked** and select the `dist/` folder

After rebuilding, click the reload icon on the Chee card.

## Usage

Finish a game on chess.com, or open a finished one (`/game/*`, `/play/*` or `/daily/*`). The **Chee review** panel analyses every position, then:

- shows the eval chart: hover for scores, click to jump to a move, coloured dots mark your mistakes
- lists your inaccuracies (?!), mistakes (?) and blunders (??) and marks them in the move list
- jumps to the position before a mistake when you click it, so you can look for the better move yourself; **Best move?** reveals the engine's choice

The side at the bottom of the board is treated as you. Variant games (Chess960, crazyhouse) are not reviewed.

The popup sets the theme (Catppuccin Latte, Frappé, Macchiato, Mocha, or match the site), the search depth (12, 15, 18 or 20) and debug logging.

## Development

```bash
npm run watch    # rebuild on file changes
npm test         # run the test suite
npm run lint     # check code style
npm run lint:fix # auto-fix lint issues
```

Turn on **Debug** in the popup to log to the console, or set it manually:

```js
localStorage.debug = 'chee:*'
```

**Copy debug info** in the popup copies settings, page state and recent logs for bug reports.

## License

[GPL-3.0](LICENSE)
