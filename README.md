# Chee

A Stockfish eval bar for games against chess.com's computer bots. While you play a bot, a bar beside the board shows the evaluation, and your inaccuracies, mistakes and blunders get marked in the move list as you make them.

It only works against bots. On any other page, including games against people, the engine is not loaded and nothing is shown.

This is a fork of [hong4rc/chee](https://github.com/hong4rc/chee).

## Install

```bash
git clone git@github.com:ram4nd/chee.git
cd chee
npm install
npm run build
```

Then load it in Chrome:

1. Open `chrome://extensions`
2. Turn on **Developer mode**
3. Click **Load unpacked** and select the `dist/` folder

After rebuilding, click the reload icon on the Chee card.

## Usage

Open chess.com's **Play → Bots** page (`/play/computer`) and start a game. Then:

- the eval bar in the column left of the board follows the game: white fills from your side when white is better, and the score shows at the end of the side that is ahead
- your moves get `?!` (inaccuracy), `?` (mistake) or `??` (blunder) in the move list once both positions around them are analysed
- stepping back through moves shows the eval for that position

The side at the bottom of the board is treated as you. Variant games (Chess960, crazyhouse) show an error on the bar instead of an eval.

The popup sets the search depth (12, 15, 18 or 20) and debug logging.

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
