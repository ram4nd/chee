// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import {
  el, svgEl, indexOfNode, SVG_NS,
} from '../../src/lib/dom.js';

describe('el', () => {
  it('creates an element with tag', () => {
    const node = el('div');
    expect(node.tagName).toBe('DIV');
  });

  it('sets className when provided', () => {
    const node = el('span', 'my-class');
    expect(node.className).toBe('my-class');
  });

  it('sets textContent when provided', () => {
    const node = el('p', null, 'hello');
    expect(node.textContent).toBe('hello');
  });

  it('sets both className and text', () => {
    const node = el('div', 'cls', 'text');
    expect(node.className).toBe('cls');
    expect(node.textContent).toBe('text');
  });

  it('leaves className empty when not provided', () => {
    const node = el('div');
    expect(node.className).toBe('');
  });
});

describe('svgEl', () => {
  it('creates an SVG element with correct namespace', () => {
    const node = svgEl('circle');
    expect(node.namespaceURI).toBe(SVG_NS);
    expect(node.tagName).toBe('circle');
  });

  it('sets attributes when provided', () => {
    const node = svgEl('rect', { width: '100', height: '50', fill: 'red' });
    expect(node.getAttribute('width')).toBe('100');
    expect(node.getAttribute('height')).toBe('50');
    expect(node.getAttribute('fill')).toBe('red');
  });

  it('creates element without attributes', () => {
    const node = svgEl('g');
    expect(node.tagName).toBe('g');
  });
});

describe('indexOfNode', () => {
  it('returns index of target in list', () => {
    const nodes = [document.createElement('a'), document.createElement('b'), document.createElement('c')];
    expect(indexOfNode(nodes, nodes[1])).toBe(1);
  });

  it('returns -1 when target is not in list', () => {
    const nodes = [document.createElement('a')];
    const other = document.createElement('b');
    expect(indexOfNode(nodes, other)).toBe(-1);
  });

  it('returns -1 when target is null', () => {
    const nodes = [document.createElement('a')];
    expect(indexOfNode(nodes, null)).toBe(-1);
  });

  it('returns -1 when target is undefined', () => {
    const nodes = [document.createElement('a')];
    expect(indexOfNode(nodes, undefined)).toBe(-1);
  });
});
