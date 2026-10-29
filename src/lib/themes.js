const THEMES = {
  chesscom: {
    base: '#302e2b',
    mantle: '#262421',
    surface0: '#3d3b38',
    surface1: '#4a4845',
    overlay0: '#6b6966',
    subtext0: '#a09d99',
    text: '#c8c5c0',
    green: '#81b64c',
    peach: '#e8833a',
  },
  latte: {
    base: '#eff1f5',
    mantle: '#e6e9ef',
    surface0: '#ccd0da',
    surface1: '#bcc0cc',
    overlay0: '#9ca0b0',
    subtext0: '#6c6f85',
    text: '#4c4f69',
    green: '#40a02b',
    peach: '#fe640b',
  },
  frappe: {
    base: '#303446',
    mantle: '#292c3c',
    surface0: '#414559',
    surface1: '#51576d',
    overlay0: '#737994',
    subtext0: '#a5adce',
    text: '#c6d0f5',
    green: '#a6d189',
    peach: '#ef9f76',
  },
  macchiato: {
    base: '#24273a',
    mantle: '#1e2030',
    surface0: '#363a4f',
    surface1: '#494d64',
    overlay0: '#6e738d',
    subtext0: '#a5adcb',
    text: '#cad3f5',
    green: '#a6da95',
    peach: '#f5a97f',
  },
  mocha: {
    base: '#1e1e2e',
    mantle: '#181825',
    surface0: '#313244',
    surface1: '#45475a',
    overlay0: '#6c7086',
    subtext0: '#a6adc8',
    text: '#cdd6f4',
    green: '#a6e3a1',
    peach: '#fab387',
  },
};

export function applyTheme(el, name) {
  const resolved = name === 'site' ? 'chesscom' : name;
  const palette = THEMES[resolved] || THEMES.chesscom;
  for (const [key, value] of Object.entries(palette)) {
    el.style.setProperty(`--chee-${key}`, value);
  }
}
