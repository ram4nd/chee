// Header sub-renderer: drag handle with minimize/hide controls.

import { el } from '../../lib/dom.js';

export class HeaderRenderer {
  createDOM() {
    const header = el('div', 'chee-header');
    const topRow = el('div', 'chee-header-top');
    const hide = el('button', 'chee-hide');
    hide.title = 'Hide panel';
    hide.innerHTML = '&#x2039;';
    const toggle = el('button', 'chee-toggle');
    toggle.title = 'Minimize';
    toggle.innerHTML = '&#x2212;';
    topRow.append(hide, el('span', 'chee-title', 'Eval'), toggle);
    header.append(topRow);
    return header;
  }
}
