// ==UserScript==
// @name         Work Dark — Jira, Confluence, GitLab, Allure
// @namespace    https://github.com/Rufim/work-dark-theme
// @version      1.1.0
// @description  Единая тёмная тема для Jira, Confluence, GitLab и Allure TestOps: своя палитра и перекраска стилей страницы на лету
// @author       Rufim
// @homepageURL  https://github.com/Rufim/work-dark-theme
// @supportURL   https://github.com/Rufim/work-dark-theme/issues
// @updateURL    https://raw.githubusercontent.com/Rufim/work-dark-theme/main/work-dark.user.js
// @downloadURL  https://raw.githubusercontent.com/Rufim/work-dark-theme/main/work-dark.user.js
// @match        https://jira.mts.ru/*
// @match        https://confluence.mts.ru/*
// @match        https://gitlab.services.mts.ru/*
// @match        https://allure.services.mts.ru/*
// @run-at       document-start
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_registerMenuCommand
// @grant        GM_xmlhttpRequest
// @connect      *
// ==/UserScript==

(function () {
  'use strict';

  // ---------------------------------------------------------------------------
  // Настройки
  // ---------------------------------------------------------------------------

  const hasGM = typeof GM_getValue === 'function';
  const settings = {
    get(key, fallback) {
      try {
        if (hasGM) return GM_getValue(key, fallback);
        const v = localStorage.getItem('work-dark:' + key);
        return v === null ? fallback : v;
      } catch (e) {
        return fallback;
      }
    },
    set(key, value) {
      try {
        if (hasGM) GM_setValue(key, value);
        else localStorage.setItem('work-dark:' + key, value);
      } catch (e) { /* хранилище недоступно — режим просто не запомнится */ }
    },
  };

  // dark — всегда тёмная, auto — как в системе, off — выключена
  const MODES = { dark: 'всегда', auto: 'как в системе', off: 'выключена' };
  const mode = MODES[settings.get('mode', 'dark')] ? settings.get('mode', 'dark') : 'dark';
  const systemDark = window.matchMedia('(prefers-color-scheme: dark)');

  function setMode(next) {
    settings.set('mode', next);
    location.reload();
  }

  if (typeof GM_registerMenuCommand === 'function' && window.top === window) {
    for (const [key, label] of Object.entries(MODES)) {
      GM_registerMenuCommand((key === mode ? '● ' : '○ ') + 'Тёмная тема: ' + label, () => setMode(key));
    }
  }

  window.addEventListener('keydown', (e) => {
    if (e.altKey && e.shiftKey && !e.ctrlKey && !e.metaKey && e.code === 'KeyD') {
      e.preventDefault();
      setMode(mode === 'off' ? 'dark' : 'off');
    }
  }, true);

  if (mode === 'off') return;
  if (mode === 'auto') {
    systemDark.addEventListener('change', () => location.reload());
    if (!systemDark.matches) return;
  }

  // ---------------------------------------------------------------------------
  // Цвет: разбор, OKLab, преобразование по роли свойства
  // ---------------------------------------------------------------------------

  const NAMED = {
    white: '#ffffff', black: '#000000', silver: '#c0c0c0', gray: '#808080', grey: '#808080',
    red: '#ff0000', green: '#008000', blue: '#0000ff', navy: '#000080', maroon: '#800000',
    purple: '#800080', orange: '#ffa500', yellow: '#ffff00', lightgray: '#d3d3d3', lightgrey: '#d3d3d3',
    whitesmoke: '#f5f5f5', gainsboro: '#dcdcdc', darkgray: '#a9a9a9', darkgrey: '#a9a9a9',
    dimgray: '#696969', dimgrey: '#696969', lightyellow: '#ffffe0', aliceblue: '#f0f8ff',
    ghostwhite: '#f8f8ff', snow: '#fffafa', ivory: '#fffff0', beige: '#f5f5dc', linen: '#faf0e6',
    lavender: '#e6e6fa', honeydew: '#f0fff0', mintcream: '#f5fffa', azure: '#f0ffff',
    seashell: '#fff5ee', oldlace: '#fdf5e6', floralwhite: '#fffaf0',
  };

  function parseColor(input) {
    let s = input.trim().toLowerCase();
    if (NAMED[s]) s = NAMED[s];
    if (s[0] === '#') {
      let h = s.slice(1);
      if (!/^[0-9a-f]+$/.test(h) || ![3, 4, 6, 8].includes(h.length)) return null;
      if (h.length <= 4) h = [...h].map((c) => c + c).join('');
      const n = parseInt(h.slice(0, 6), 16);
      return [(n >> 16) & 255, (n >> 8) & 255, n & 255, h.length === 8 ? parseInt(h.slice(6), 16) / 255 : 1];
    }
    const m = s.match(/^(rgba?|hsla?)\((.*)\)$/);
    if (!m) return null;
    const parts = m[2].split(/[\s,/]+/).filter(Boolean);
    if (parts.length < 3 || parts.length > 4 || parts.some((p) => !/^[-+.\d]/.test(p))) return null;
    const alpha = parts[3] === undefined ? 1
      : parts[3].endsWith('%') ? parseFloat(parts[3]) / 100 : parseFloat(parts[3]);
    let rgb;
    if (m[1][0] === 'r') {
      rgb = parts.slice(0, 3).map((p) => (p.endsWith('%') ? parseFloat(p) * 2.55 : parseFloat(p)));
    } else {
      const hue = (((parseFloat(parts[0]) * (parts[0].endsWith('turn') ? 360 : 1)) % 360) + 360) % 360;
      const sat = parseFloat(parts[1]) / 100;
      const lig = parseFloat(parts[2]) / 100;
      const k = (n) => (n + hue / 30) % 12;
      const a = sat * Math.min(lig, 1 - lig);
      const f = (n) => lig - a * Math.max(-1, Math.min(k(n) - 3, 9 - k(n), 1));
      rgb = [f(0) * 255, f(8) * 255, f(4) * 255];
    }
    const out = [...rgb, alpha];
    return out.some((v) => Number.isNaN(v)) ? null : out;
  }

  function formatColor([r, g, b, a]) {
    const c = (v) => Math.round(Math.max(0, Math.min(255, v)));
    if (a < 1) return `rgba(${c(r)}, ${c(g)}, ${c(b)}, ${Math.round(a * 1000) / 1000})`;
    return '#' + [r, g, b].map((v) => c(v).toString(16).padStart(2, '0')).join('');
  }

  const toLinear = (v) => { v /= 255; return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; };
  const fromLinear = (v) => 255 * (v <= 0.0031308 ? 12.92 * v : 1.055 * v ** (1 / 2.4) - 0.055);

  function rgbToOklab([r, g, b]) {
    const lr = toLinear(r), lg = toLinear(g), lb = toLinear(b);
    const l = Math.cbrt(0.4122214708 * lr + 0.5363325363 * lg + 0.0514459929 * lb);
    const m = Math.cbrt(0.2119034982 * lr + 0.6806995451 * lg + 0.1073969566 * lb);
    const s = Math.cbrt(0.0883024619 * lr + 0.2817188376 * lg + 0.6299787005 * lb);
    return [
      0.2104542553 * l + 0.7936177850 * m - 0.0040720468 * s,
      1.9779984951 * l - 2.4285922050 * m + 0.4505937099 * s,
      0.0259040371 * l + 0.7827717662 * m - 0.8086757660 * s,
    ];
  }

  function oklabToLinear(L, A, B) {
    const l = (L + 0.3963377774 * A + 0.2158037573 * B) ** 3;
    const m = (L - 0.1055613458 * A - 0.0638541728 * B) ** 3;
    const s = (L - 0.0894841775 * A - 1.2914855480 * B) ** 3;
    return [
      4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
      -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
      -0.0041960863 * l - 0.7034186147 * m + 1.7076147010 * s,
    ];
  }

  // Собирает цвет из L, хромы и угла; если не влезает в sRGB — уменьшает хрому
  function fromLch(L, C, h, alpha) {
    let lo = 0, hi = C, lin = oklabToLinear(L, C * Math.cos(h), C * Math.sin(h));
    const inGamut = (v) => v.every((x) => x >= -0.0005 && x <= 1.0005);
    if (!inGamut(lin)) {
      for (let i = 0; i < 14; i++) {
        const mid = (lo + hi) / 2;
        const probe = oklabToLinear(L, mid * Math.cos(h), mid * Math.sin(h));
        if (inGamut(probe)) { lo = mid; lin = probe; } else hi = mid;
      }
      lin = oklabToLinear(L, lo * Math.cos(h), lo * Math.sin(h));
    }
    return [...lin.map(fromLinear), alpha];
  }

  // Нейтральные серые уводим в общий холодный оттенок палитры
  const NEUTRAL_HUE = Math.atan2(-0.016, -0.004);
  const NEUTRAL_CHROMA = 0.0125;
  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

  function remap(rgba, role) {
    const [L, A, B] = rgbToOklab(rgba);
    const C = Math.hypot(A, B);
    const h = Math.atan2(B, A);
    const alpha = rgba[3];
    // Серые Atlassian заметно синеватые: для текста считаем их нейтральными, для фона — только почти чистые серые,
    // чтобы бледные подложки (зелёная, красная, жёлтая) сохранили оттенок
    const neutral = C < (role === 'fg' ? 0.075 : 0.012);
    const hueOut = neutral ? NEUTRAL_HUE : h;

    // Полупрозрачная тёмная подложка (наведение, выделение) на тёмном фоне не видна — делаем светлой
    const lightOverlay = () => fromLch(0.93, Math.min(C, 0.05) * 0.5, hueOut, Math.min(1, alpha * 1.15));

    switch (role) {
      case 'bg': {
        if (alpha < 0.5) return L < 0.6 ? lightOverlay() : null;
        if (L < 0.5) return null;
        const L2 = clamp(0.215 + (1 - L) * 0.95, 0.2, 0.42);
        const C2 = neutral ? NEUTRAL_CHROMA : clamp(C * 1.2, 0.02, 0.1);
        return fromLch(L2, C2, hueOut, alpha);
      }
      case 'fg': {
        if (L >= 0.62) return null;
        const L2 = clamp(0.9 - Math.max(0, L - 0.2) * 0.45, 0.7, 0.9);
        const C2 = neutral ? NEUTRAL_CHROMA * 0.8 : Math.min(C, 0.13);
        return fromLch(L2, C2, hueOut, alpha);
      }
      case 'border': {
        if (alpha < 0.5) return L < 0.6 ? fromLch(0.93, NEUTRAL_CHROMA, NEUTRAL_HUE, Math.min(1, alpha * 1.1)) : null;
        if (C >= 0.07) return remap(rgba, 'fg');
        if (L >= 0.5) return fromLch(clamp(0.27 + (1 - L) * 0.8, 0.27, 0.48), NEUTRAL_CHROMA, NEUTRAL_HUE, alpha);
        if (L < 0.25) return fromLch(0.32, NEUTRAL_CHROMA, NEUTRAL_HUE, alpha);
        return null;
      }
      case 'shadow': {
        if (L < 0.5) return [0, 0, 0, Math.min(0.7, alpha * 1.8)];
        return [255, 255, 255, Math.min(0.06, alpha * 0.06)];
      }
    }
    return null;
  }

  const colorCache = new Map();
  function mapColorText(text, role) {
    const key = role + text;
    if (colorCache.has(key)) return colorCache.get(key);
    const rgba = parseColor(text);
    const mapped = rgba && remap(rgba, role);
    const out = mapped ? formatColor(mapped) : text;
    colorCache.set(key, out);
    return out;
  }

  // Палитра: те же функции, что красят страницу, — поэтому всё в одной системе
  const tone = (hex, role) => mapColorText(hex, role);
  const PALETTE = {
    chrome: formatColor(fromLch(0.19, NEUTRAL_CHROMA, NEUTRAL_HUE, 1)),
    surface: tone('#ffffff', 'bg'),
    subtle: tone('#f4f5f7', 'bg'),
    raised: tone('#ebecf0', 'bg'),
    overlay: formatColor(fromLch(0.255, NEUTRAL_CHROMA, NEUTRAL_HUE, 1)),
    hover: tone('#dfe1e6', 'bg'),
    pressed: tone('#c1c7d0', 'bg'),
    line: tone('#dfe1e6', 'border'),
    lineStrong: tone('#a5adba', 'border'),
    text: tone('#172b4d', 'fg'),
    heading: formatColor(fromLch(0.95, NEUTRAL_CHROMA * 0.6, NEUTRAL_HUE, 1)),
    muted: tone('#5e6c84', 'fg'),
    faint: tone('#7a869a', 'fg'),
    disabled: formatColor(fromLch(0.55, NEUTRAL_CHROMA, NEUTRAL_HUE, 1)),
    link: '#7aaeff',
    linkHover: '#9cc2ff',
    visited: '#b9a4f8',
    primary: '#3b78e0',
    primaryHover: '#4f89ec',
    primaryPressed: '#2f66c4',
    accentTint: 'rgba(122, 174, 255, 0.14)',
    success: '#57c88f',
    successTint: 'rgba(87, 200, 143, 0.15)',
    warning: '#f2b84b',
    warningTint: 'rgba(242, 184, 75, 0.15)',
    danger: '#f27b72',
    dangerTint: 'rgba(242, 123, 114, 0.15)',
    discovery: '#ad94fa',
    discoveryTint: 'rgba(173, 148, 250, 0.16)',
    neutralTint: 'rgba(214, 220, 230, 0.10)',
  };

  // ---------------------------------------------------------------------------
  // Роль свойства: фон, текст, рамка или тень
  // ---------------------------------------------------------------------------

  const FG_PROPS = new Set([
    'color', 'fill', 'stroke', 'caret-color', 'accent-color', '-webkit-text-fill-color',
    '-webkit-text-stroke-color', 'text-decoration-color', 'text-emphasis-color', 'text-decoration',
  ]);
  const BG_PROPS = new Set(['background', 'background-color', 'background-image']);
  const BORDER_SHORTHANDS = [
    'border', 'border-top', 'border-right', 'border-bottom', 'border-left', 'border-color',
    'border-block', 'border-inline', 'border-block-start', 'border-block-end',
    'border-inline-start', 'border-inline-end', 'outline', 'column-rule',
  ];
  const BORDER_PROPS = new Set([...BORDER_SHORTHANDS, 'outline-color', 'column-rule-color']);
  const SHADOW_PROPS = new Set(['box-shadow', 'text-shadow', '-webkit-box-shadow']);
  const SHORTHANDS = ['background', ...BORDER_SHORTHANDS, 'text-decoration'];

  const varRoleCache = new Map();
  function varRole(name) {
    if (varRoleCache.has(name)) return varRoleCache.get(name);
    const n = name.toLowerCase();
    let role = null;
    if (n.startsWith('--work-dark-')) role = null;
    else if (/shadow/.test(n)) role = 'shadow';
    // Примитивы палитры (--gl-color-neutral-0 и т. п.) встречаются и в фоне, и в тексте — их не трогаем,
    // а подставляем уже по месту использования
    else if (/(?:^|-)(?:neutral|gray|grey|blue|red|green|orange|purple|yellow|magenta|teal|alpha|white|black|palette|data-viz)(?:-[a-z]+)?-\d+$|-n\d+a?$|-[a-z]\d{2,3}a?$/.test(n)) role = null;
    else if (/background|(?:^|-)bg(?:colou?r)?(?:-|$)|blanket|backdrop|surface|overlay|highlight|track|fill-color|-fill$/.test(n)) role = 'bg';
    else if (/text|link|icon|heading|caret|(?:^|-)fg(?:-|$)|foreground|font-color/.test(n)) role = 'fg';
    else if (/border|outline|divider|separator|(?:^|-)line(?:-|$)|(?:^|-)rule(?:-|$)|focus|ring/.test(n)) role = 'border';
    else if (/color|colour/.test(n)) role = 'fg';
    varRoleCache.set(name, role);
    return role;
  }

  function propRole(p) {
    if (p.startsWith('--')) return varRole(p);
    if (FG_PROPS.has(p)) return 'fg';
    if (BG_PROPS.has(p)) return 'bg';
    if (BORDER_PROPS.has(p) || (p.startsWith('border-') && p.endsWith('-color'))) return 'border';
    if (SHADOW_PROPS.has(p)) return 'shadow';
    return null;
  }

  // ---------------------------------------------------------------------------
  // Преобразование значения свойства
  // ---------------------------------------------------------------------------

  const COLOR_SRC = String.raw`#(?:[0-9a-f]{8}|[0-9a-f]{6}|[0-9a-f]{3,4})(?![\w-])|(?:rgba?|hsla?)\([^()]*\)|(?<![\w-])(?:${Object.keys(NAMED).join('|')})(?![\w-])`;
  const TOKEN_RE = new RegExp(
    String.raw`(url\((?:"[^"]*"|'[^']*'|[^)]*)\))|var\(\s*(--[\w-]+)\s*(?:,\s*((?:rgba?|hsla?)\([^()]*\)|[^()]*?))?\s*\)|(${COLOR_SRC})`,
    'gi',
  );
  const SVG_COLOR_RE = /(%23|#)([0-9a-f]{6}|[0-9a-f]{3})(?![0-9a-z])/gi;

  // Иконки, зашитые в фон как data:image/svg+xml, перекрашиваем как текст
  function recolorSvgUrl(url) {
    if (!/data:image\/svg\+xml/i.test(url)) return url;
    if (/;base64,/i.test(url)) {
      const m = url.match(/^(url\(["']?data:image\/svg\+xml[^,]*;base64,)([^"')]+)(["']?\))$/i);
      if (!m) return url;
      try {
        const svg = atob(m[2]).replace(SVG_COLOR_RE, (_, p, hex) => mapColorText('#' + hex, 'fg'));
        return m[1] + btoa(svg) + m[3];
      } catch (e) {
        return url;
      }
    }
    return url.replace(SVG_COLOR_RE, (_, prefix, hex) => {
      const mapped = mapColorText('#' + hex, 'fg');
      return mapped.startsWith('#') ? prefix + mapped.slice(1) : prefix + hex;
    });
  }

  class Engine {
    constructor(doc) {
      this.doc = doc;
      this.win = doc.defaultView;
      this.doneRules = new WeakSet();
      this.doneSheets = new WeakSet();
      this.roleVars = new Set();
      this.resolved = new Map();
      this.written = new WeakMap();
      this.pendingInline = new Set();
      this.inlineScheduled = false;
      this.signature = '';
    }

    resolveVar(name) {
      if (this.resolved.has(name)) return this.resolved.get(name);
      const v = this.win.getComputedStyle(this.doc.documentElement).getPropertyValue(name).trim();
      this.resolved.set(name, v);
      return v;
    }

    transform(value, role, inCustomProp) {
      if (!value || role === null) return value;
      return value.replace(TOKEN_RE, (match, url, varName, fallback, color) => {
        if (url) return role === 'bg' ? recolorSvgUrl(url) : url;
        if (varName) {
          const fb = fallback ? this.transform(fallback, role, inCustomProp) : '';
          if (this.roleVars.has(varName) || varName.startsWith('--work-dark-')) {
            return fallback ? `var(${varName}, ${fb})` : match;
          }
          // Значение-примитив: разворачиваем и красим по роли места использования
          const raw = this.resolveVar(varName);
          if (raw && parseColor(raw)) return mapColorText(raw, role);
          return fallback ? `var(${varName}, ${fb})` : match;
        }
        return mapColorText(color, role);
      });
    }

    processStyle(style, varsPass) {
      const changes = [];
      for (let i = 0; i < style.length; i++) {
        const prop = style[i];
        const isVar = prop.startsWith('--');
        if (isVar !== varsPass) continue;
        const role = propRole(prop);
        if (!role) continue;
        if (isVar) this.roleVars.add(prop);
        const value = style.getPropertyValue(prop);
        const next = this.transform(value, role, isVar);
        if (next !== value) changes.push([prop, next, style.getPropertyPriority(prop)]);
      }
      if (!varsPass) {
        // Шорткаты с var() не раскладываются на лонгхенды — их правим целиком
        for (const prop of SHORTHANDS) {
          const value = style.getPropertyValue(prop);
          if (!value || !value.includes('var(')) continue;
          const next = this.transform(value, propRole(prop), false);
          if (next !== value) changes.push([prop, next, style.getPropertyPriority(prop)]);
        }
      }
      for (const [prop, value, priority] of changes) {
        try { style.setProperty(prop, value, priority); } catch (e) { /* значение не принято — оставляем как было */ }
      }
    }

    collectRules(rules, out) {
      for (const rule of rules) {
        if (this.doneRules.has(rule)) continue;
        if (rule.style) out.push(rule);
        if (rule.styleSheet) this.collectSheet(rule.styleSheet, out);
        if (rule.cssRules) this.collectRules(rule.cssRules, out);
      }
    }

    collectSheet(sheet, out) {
      const owner = sheet.ownerNode;
      if (owner && owner.id === 'work-dark-theme') return;
      if (sheet.disabled) return;
      let rules;
      try {
        rules = sheet.cssRules;
      } catch (e) {
        this.inlineForeignSheet(sheet);
        return;
      }
      if (rules) this.collectRules(rules, out);
    }

    // Стили с чужого домена через CSSOM не прочитать: скачиваем и вставляем рядом своей копией
    inlineForeignSheet(sheet) {
      if (this.doneSheets.has(sheet) || !sheet.href || typeof GM_xmlhttpRequest !== 'function') return;
      this.doneSheets.add(sheet);
      const owner = sheet.ownerNode;
      GM_xmlhttpRequest({
        method: 'GET',
        url: sheet.href,
        onload: (res) => {
          if (res.status !== 200 || !owner || !owner.parentNode) return;
          const base = sheet.href;
          const css = res.responseText.replace(/url\(\s*(["']?)(?!data:|https?:|\/\/)([^"')]+)\1\s*\)/gi,
            (m, q, path) => `url("${new URL(path, base).href}")`);
          const copy = this.doc.createElement('style');
          copy.textContent = css;
          copy.media = owner.media || 'all';
          owner.after(copy);
          sheet.disabled = true;
          this.scanSheets(true);
        },
      });
    }

    scanSheets(force) {
      const sheets = [...this.doc.styleSheets];
      let signature = sheets.length + ':';
      for (const s of sheets) {
        try { signature += s.cssRules.length + ','; } catch (e) { signature += 'x,'; }
      }
      if (!force && signature === this.signature) return;
      this.signature = signature;

      const rules = [];
      for (const sheet of sheets) this.collectSheet(sheet, rules);
      if (!rules.length) return;
      // Сначала переменные (чтобы знать, какие из них уже перекрашены), потом обычные свойства
      for (const rule of rules) this.processStyle(rule.style, true);
      this.resolved.clear();
      for (const rule of rules) {
        this.processStyle(rule.style, false);
        this.doneRules.add(rule);
      }
      this.signature = '';
      for (const s of sheets) {
        try { this.signature += s.cssRules.length + ','; } catch (e) { this.signature += 'x,'; }
      }
      this.signature = sheets.length + ':' + this.signature;
    }

    processElement(el) {
      if (el.nodeType !== 1) return;
      const attr = el.getAttribute('style');
      if (attr !== null && attr !== this.written.get(el) && el.style) {
        this.processStyle(el.style, true);
        this.processStyle(el.style, false);
        this.written.set(el, el.getAttribute('style'));
      }
      // Старые атрибуты цвета: <td bgcolor>, <font color>, fill/stroke у SVG
      const bg = el.getAttribute('bgcolor');
      if (bg && !el.dataset.workDarkBg) {
        el.dataset.workDarkBg = '1';
        el.style.backgroundColor = mapColorText(bg, 'bg');
        this.written.set(el, el.getAttribute('style'));
      }
      if (el.tagName === 'FONT' && el.hasAttribute('color')) {
        el.setAttribute('color', mapColorText(el.getAttribute('color'), 'fg'));
      }
      if (el instanceof this.win.SVGElement) {
        for (const name of ['fill', 'stroke']) {
          const v = el.getAttribute(name);
          if (v && v[0] === '#') {
            const next = mapColorText(v, 'fg');
            if (next !== v) el.setAttribute(name, next);
          }
        }
      }
    }

    queueInline(el) {
      this.pendingInline.add(el);
      if (this.inlineScheduled) return;
      this.inlineScheduled = true;
      this.win.requestAnimationFrame(() => {
        this.inlineScheduled = false;
        const batch = [...this.pendingInline];
        this.pendingInline.clear();
        for (const node of batch) this.processElement(node);
      });
    }

    scanInline(root) {
      const sel = '[style], [bgcolor], font[color], svg [fill], svg [stroke]';
      if (root.nodeType === 1 && root.matches(sel)) this.processElement(root);
      if (root.querySelectorAll) for (const el of root.querySelectorAll(sel)) this.processElement(el);
    }

    attachFrame(frame) {
      const tryInit = () => {
        try {
          const doc = frame.contentDocument;
          if (doc && doc.documentElement && !doc.documentElement.hasAttribute('data-work-dark')) start(doc);
        } catch (e) { /* чужой домен — не наше */ }
      };
      if (!frame.dataset.workDarkFrame) {
        frame.dataset.workDarkFrame = '1';
        frame.addEventListener('load', tryInit);
      }
      tryInit();
    }

    run() {
      const doc = this.doc;
      doc.documentElement.setAttribute('data-work-dark', '');
      injectTheme(doc);
      this.scanSheets(true);

      const onReady = () => {
        this.scanSheets(true);
        this.scanInline(doc.documentElement);
        for (const f of doc.querySelectorAll('iframe, frame')) this.attachFrame(f);
      };
      if (doc.readyState === 'loading') doc.addEventListener('DOMContentLoaded', onReady, { once: true });
      else onReady();
      this.win.addEventListener('load', () => this.scanSheets(true), { once: true });

      new this.win.MutationObserver((mutations) => {
        let sheetsChanged = false;
        for (const m of mutations) {
          if (m.type === 'attributes') {
            if (m.target !== doc.documentElement || m.attributeName !== 'data-work-dark') this.queueInline(m.target);
            continue;
          }
          for (const node of m.addedNodes) {
            if (node.nodeType !== 1) continue;
            const tag = node.tagName;
            if (tag === 'LINK' || tag === 'STYLE') {
              sheetsChanged = true;
              if (tag === 'LINK') node.addEventListener('load', () => this.scanSheets(true), { once: true });
              continue;
            }
            if (tag === 'IFRAME' || tag === 'FRAME') this.attachFrame(node);
            else if (node.querySelector && node.querySelector('iframe')) {
              for (const f of node.querySelectorAll('iframe')) this.attachFrame(f);
            }
            this.scanInline(node);
          }
        }
        if (sheetsChanged) this.scanSheets(true);
        if (!doc.getElementById('work-dark-theme')) injectTheme(doc);
      }).observe(doc, {
        childList: true,
        subtree: true,
        attributes: true,
        attributeFilter: ['style', 'bgcolor', 'fill', 'stroke'],
      });

      // Правила, добавленные через insertRule, мутаций не дают — сверяем количество правил
      this.win.setInterval(() => this.scanSheets(false), 1500);
    }
  }

  // ---------------------------------------------------------------------------
  // Свой слой: палитра и точечная полировка Jira / Confluence / GitLab
  // ---------------------------------------------------------------------------

  const P = PALETTE;
  const THEME_CSS = `
:root {
  color-scheme: dark;
  --work-dark-chrome: ${P.chrome};
  --work-dark-surface: ${P.surface};
  --work-dark-subtle: ${P.subtle};
  --work-dark-raised: ${P.raised};
  --work-dark-overlay: ${P.overlay};
  --work-dark-hover: ${P.hover};
  --work-dark-pressed: ${P.pressed};
  --work-dark-line: ${P.line};
  --work-dark-line-strong: ${P.lineStrong};
  --work-dark-text: ${P.text};
  --work-dark-heading: ${P.heading};
  --work-dark-muted: ${P.muted};
  --work-dark-faint: ${P.faint};
  --work-dark-disabled: ${P.disabled};
  --work-dark-link: ${P.link};
  --work-dark-link-hover: ${P.linkHover};
  --work-dark-visited: ${P.visited};
  --work-dark-primary: ${P.primary};
  --work-dark-primary-hover: ${P.primaryHover};
  --work-dark-primary-pressed: ${P.primaryPressed};
  --work-dark-accent-tint: ${P.accentTint};
  --work-dark-success: ${P.success};
  --work-dark-success-tint: ${P.successTint};
  --work-dark-warning: ${P.warning};
  --work-dark-warning-tint: ${P.warningTint};
  --work-dark-danger: ${P.danger};
  --work-dark-danger-tint: ${P.dangerTint};
  --work-dark-discovery: ${P.discovery};
  --work-dark-discovery-tint: ${P.discoveryTint};
  --work-dark-neutral-tint: ${P.neutralTint};
}

html { background-color: var(--work-dark-surface); color: var(--work-dark-text); }
body { background-color: var(--work-dark-surface); }
::selection { background-color: rgba(122, 174, 255, 0.32); color: inherit; }
* { scrollbar-color: var(--work-dark-line-strong) transparent; }
:focus-visible { outline-color: var(--work-dark-link); }

/* ---------- AUI: Jira и Confluence ---------- */
html:root {
  --aui-body-text: var(--work-dark-text);
  --aui-lesser-body-text: var(--work-dark-muted);
  --aui-lesser-header-text: var(--work-dark-muted);
  --aui-body-background: var(--work-dark-surface);
  --aui-page-background: var(--work-dark-surface);
  --aui-page-border: var(--work-dark-line);
  --aui-border: var(--work-dark-line);
  --aui-border-strong: var(--work-dark-line-strong);
  --aui-shadow1: rgba(0, 0, 0, 0.35);
  --aui-shadow2: rgba(0, 0, 0, 0.55);
  --aui-blanket: rgba(4, 6, 10, 0.62);
  --aui-focus: var(--work-dark-link);
  --aui-link-color: var(--work-dark-link);
  --aui-link-hover-color: var(--work-dark-link-hover);
  --aui-link-active-color: var(--work-dark-link);
  --aui-link-visited-color: var(--work-dark-visited);
  --aui-itemheading-text: var(--work-dark-muted);
  --aui-item-text: var(--work-dark-text);
  --aui-item-focus-bg: var(--work-dark-hover);
  --aui-item-focus-text: var(--work-dark-heading);
  --aui-item-active-text: var(--work-dark-link);
  --aui-item-active-bg: var(--work-dark-accent-tint);
  --aui-item-disabled-text: var(--work-dark-disabled);
  --aui-tooltip-bg-color: #333a47;
  --aui-tooltip-border-color: #333a47;
  --aui-tooltip-content-text-color: var(--work-dark-heading);
  --aui-tooltip-title-text-color: var(--work-dark-heading);
  --aui-dropdown-bg-color: var(--work-dark-overlay);
  --aui-dropdown-border-color: var(--work-dark-line);
  --aui-dialog-bg-color: var(--work-dark-overlay);
  --aui-dialog-border-color: var(--work-dark-line);
  --aui-inline-dialog-bg-color: var(--work-dark-overlay);
  --aui-inline-dialog-border-color: var(--work-dark-line);
  --aui-flag-bg-color: var(--work-dark-overlay);

  --aui-appheader-bg-color: var(--work-dark-chrome);
  --aui-appheader-text-color: var(--work-dark-text);
  --aui-appheader-item-focus-bg-color: var(--work-dark-hover);
  --aui-appheader-item-focus-text-color: var(--work-dark-heading);
  --aui-appheader-item-active-bg-color: var(--work-dark-hover);
  --aui-appheader-item-active-text-color: var(--work-dark-heading);
  --aui-appheader-quicksearch-bg-color: var(--work-dark-raised);
  --aui-appheader-quicksearch-text-color: var(--work-dark-text);
  --aui-appheader-quicksearch-placeholder-text-color: var(--work-dark-faint);
  --aui-appheader-quicksearch-focus-bg-color: var(--work-dark-raised);
  --aui-appheader-quicksearch-focus-text-color: var(--work-dark-heading);
  --aui-sidebar-bg-color: var(--work-dark-subtle);
  --aui-sidebar-icon-color: var(--work-dark-muted);
  --aui-sidebar-toggle-icon-color: var(--work-dark-muted);

  --aui-button-default-bg-color: var(--work-dark-raised);
  --aui-button-default-text-color: var(--work-dark-text);
  --aui-button-default-hover-bg-color: var(--work-dark-hover);
  --aui-button-default-active-bg-color: var(--work-dark-pressed);
  --aui-button-default-active-text-color: var(--work-dark-heading);
  --aui-button-default-selected-bg-color: var(--work-dark-accent-tint);
  --aui-button-default-selected-text-color: var(--work-dark-link);
  --aui-button-default-disabled-bg-color: var(--work-dark-subtle);
  --aui-button-default-disabled-text-color: var(--work-dark-disabled);
  --aui-button-primary-bg-color: var(--work-dark-primary);
  --aui-button-primary-text-color: #ffffff;
  --aui-button-primary-hover-bg-color: var(--work-dark-primary-hover);
  --aui-button-primary-active-bg-color: var(--work-dark-primary-pressed);
  --aui-button-light-bg-color: var(--work-dark-raised);
  --aui-button-subtle-text-color: var(--work-dark-text);

  --aui-form-field-default-bg-color: var(--work-dark-subtle);
  --aui-form-field-default-text-color: var(--work-dark-text);
  --aui-form-field-border-color: var(--work-dark-line);
  --aui-form-field-hover-border-color: var(--work-dark-line-strong);
  --aui-form-field-hover-bg-color: var(--work-dark-raised);
  --aui-form-field-focus-bg-color: var(--work-dark-surface);
  --aui-form-select-bg-color: var(--work-dark-raised);
  --aui-form-select-border-color: var(--work-dark-raised);
  --aui-form-select-hover-bg-color: var(--work-dark-hover);
  --aui-form-option-bg-color: var(--work-dark-overlay);
  --aui-form-placeholder-text-color: var(--work-dark-faint);
  --aui-form-label-text-color: var(--work-dark-muted);
  --aui-form-description-text-color: var(--work-dark-faint);
  --aui-form-disabled-field-bg-color: var(--work-dark-subtle);
  --aui-form-disabled-field-text-color: var(--work-dark-disabled);
  --aui-form-glyph-fill-color: var(--work-dark-primary);

  --aui-lozenge-bg-color: #556074;
  --aui-lozenge-text-color: #ffffff;
  --aui-lozenge-subtle-bg-color: var(--work-dark-neutral-tint);
  --aui-lozenge-subtle-text-color: var(--work-dark-text);
  --aui-lozenge-success-bg-color: #2f8a5f;
  --aui-lozenge-success-subtle-bg-color: var(--work-dark-success-tint);
  --aui-lozenge-success-subtle-text-color: var(--work-dark-success);
  --aui-lozenge-current-bg-color: var(--work-dark-primary);
  --aui-lozenge-current-subtle-bg-color: var(--work-dark-accent-tint);
  --aui-lozenge-current-subtle-text-color: var(--work-dark-link);
  --aui-lozenge-moved-subtle-bg-color: var(--work-dark-warning-tint);
  --aui-lozenge-moved-subtle-text-color: var(--work-dark-warning);
  --aui-lozenge-error-bg-color: #c4483f;
  --aui-lozenge-error-subtle-bg-color: var(--work-dark-danger-tint);
  --aui-lozenge-error-subtle-text-color: var(--work-dark-danger);
  --aui-lozenge-new-bg-color: #7a62d6;
  --aui-lozenge-new-subtle-bg-color: var(--work-dark-discovery-tint);
  --aui-lozenge-new-subtle-text-color: var(--work-dark-discovery);

  --aui-message-info-bg-color: var(--work-dark-accent-tint);
  --aui-message-info-icon-color: var(--work-dark-link);
  --aui-message-info-text-color: var(--work-dark-text);
  --aui-message-success-bg-color: var(--work-dark-success-tint);
  --aui-message-success-icon-color: var(--work-dark-success);
  --aui-message-success-text-color: var(--work-dark-text);
  --aui-message-warning-bg-color: var(--work-dark-warning-tint);
  --aui-message-warning-icon-color: var(--work-dark-warning);
  --aui-message-warning-text-color: var(--work-dark-text);
  --aui-message-error-bg-color: var(--work-dark-danger-tint);
  --aui-message-error-icon-color: var(--work-dark-danger);
  --aui-message-error-text-color: var(--work-dark-text);
  --aui-message-change-bg-color: var(--work-dark-discovery-tint);
  --aui-message-change-icon-color: var(--work-dark-discovery);
  --aui-message-change-text-color: var(--work-dark-text);

  --aui-badge-bg-color: var(--work-dark-hover);
  --aui-badge-text-color: var(--work-dark-text);
  --aui-label-bg-color: var(--work-dark-raised);
  --aui-label-hover-bg-color: var(--work-dark-hover);
  --aui-tabs-tab-border-color: var(--work-dark-line);
  --aui-tabs-tab-text-color: var(--work-dark-muted);
  --aui-tabs-tab-hover-text-color: var(--work-dark-heading);
  --aui-tabs-tab-active-border-color: var(--work-dark-link);
  --aui-tabs-tab-active-text-color: var(--work-dark-link);
  --aui-table-row-text-color: var(--work-dark-text);
  --aui-table-heading-text-color: var(--work-dark-muted);
  --aui-table-border-color: var(--work-dark-line);
  --aui-table-list-row-hover-color: var(--work-dark-subtle);
  --aui-table-caption-bg-color: var(--work-dark-subtle);
  --aui-table-sortable-active-bg-color: var(--work-dark-accent-tint);
  --aui-table-sortable-active-text-color: var(--work-dark-link);
  --aui-datepicker-panel-bg-color: var(--work-dark-overlay);
  --aui-datepicker-heading-bg-color: var(--work-dark-raised);
  --aui-datepicker-option-text-color: var(--work-dark-link);
  --aui-datepicker-option-focus-bg-color: var(--work-dark-hover);
  --aui-datepicker-option-selected-bg-color: var(--work-dark-primary);
  --aui-select2-chosen-bg-color: var(--work-dark-overlay);
  --aui-select2-chosen-text-color: var(--work-dark-text);
  --aui-select2-chosen-hover-bg-color: var(--work-dark-overlay);
  --aui-select2-active-chosen-bg-color: var(--work-dark-hover);
  --aui-select2-active-chosen-text-color: var(--work-dark-heading);
  --aui-progressbar-color: var(--work-dark-link);
  --aui-progressbar-track-color: var(--work-dark-hover);
  --aui-spinner-color: var(--work-dark-muted);
  --aui-toggle-default-bg-color: var(--work-dark-pressed);
  --aui-toggle-on-color: #2f8a5f;
}

/* Шапка у всех трёх сайтов одна: тёмная полоса с тонкой линией снизу */
#header .aui-header,
.aui-header {
  background-color: var(--work-dark-chrome) !important;
  border-bottom: 1px solid var(--work-dark-line) !important;
  box-shadow: none !important;
}
.aui-header .aui-nav > li > a,
.aui-header .aui-nav-link,
.aui-header .aui-dropdown2-trigger { color: var(--work-dark-text) !important; }
.aui-header .aui-nav > li > a:hover,
.aui-header .aui-nav > li > a:focus { background-color: var(--work-dark-hover) !important; color: var(--work-dark-heading) !important; }
.aui-header .aui-quicksearch input,
.aui-header .aui-quicksearch input:focus { background-color: var(--work-dark-raised) !important; color: var(--work-dark-text) !important; }
/* Свой логотип — обычно PNG с тёмной надписью: кладём на светлую плашку */
.aui-header-logo-custom img { background-color: #eef0f4; border-radius: 5px; padding: 2px 6px; box-sizing: content-box; }

/* Заголовки чуть ярче основного текста */
h1, h2, h3, h4, h5, h6,
#summary-val, #title-text, .page-header .aui-page-header-main h1 { color: var(--work-dark-heading); }

/* Выпадашки и диалоги приподняты над страницей */
.aui-dropdown2, .aui-layer.aui-dropdown2, .aui-inline-dialog .aui-inline-dialog-contents,
.aui-dialog2, .jira-dialog, .select2-drop, .ajs-layer .contents {
  border: 1px solid var(--work-dark-line) !important;
  box-shadow: 0 8px 28px rgba(0, 0, 0, 0.55) !important;
}

/* Картинки в тексте: подложка, чтобы прозрачные схемы с тёмными линиями оставались читаемыми */
.wiki-content img.confluence-embedded-image:not(.emoticon),
.user-content-block img:not(.emoticon):not(.avatar),
.md img:not(.emoji):not(.avatar):not(.gl-avatar) {
  background-color: #eef0f4;
  border-radius: 4px;
}

/* Код в Confluence/Jira */
.wiki-content pre, .wiki-content code, .code.panel, .preformatted.panel,
.user-content-block pre, .user-content-block code {
  border-color: var(--work-dark-line) !important;
}

/* ---------- GitLab ---------- */
html:root {
  --gl-background-color-default: var(--work-dark-surface);
  --gl-background-color-subtle: var(--work-dark-subtle);
  --gl-background-color-strong: var(--work-dark-hover);
  --gl-background-color-overlap: var(--work-dark-overlay);
  --gl-background-color-section: var(--work-dark-subtle);
  --gl-text-color-default: var(--work-dark-text);
  --gl-text-color-heading: var(--work-dark-heading);
  --gl-text-color-strong: var(--work-dark-heading);
  --gl-text-color-subtle: var(--work-dark-muted);
  --gl-text-color-link: var(--work-dark-link);
  --gl-text-color-disabled: var(--work-dark-disabled);
  --gl-border-color-default: var(--work-dark-line);
  --gl-border-color-subtle: var(--work-dark-line);
  --gl-border-color-strong: var(--work-dark-line-strong);
  --gl-icon-color-default: var(--work-dark-text);
  --gl-icon-color-subtle: var(--work-dark-muted);
  --gl-control-background-color-default: var(--work-dark-subtle);
  --gl-control-border-color-default: var(--work-dark-line-strong);
  --gl-action-neutral-background-color-default: var(--work-dark-raised);
  --gl-action-neutral-background-color-hover: var(--work-dark-hover);
  --gl-action-neutral-background-color-active: var(--work-dark-pressed);
  --gl-action-confirm-background-color-default: var(--work-dark-primary);
  --gl-action-confirm-background-color-hover: var(--work-dark-primary-hover);
  --gl-action-confirm-background-color-active: var(--work-dark-primary-pressed);
  --gl-button-confirm-primary-background-color-default: var(--work-dark-primary);
  --gl-button-confirm-primary-background-color-hover: var(--work-dark-primary-hover);
  --gl-button-confirm-primary-background-color-active: var(--work-dark-primary-pressed);
  --gl-button-confirm-primary-border-color-default: var(--work-dark-primary-pressed);
  --gl-button-confirm-primary-foreground-color-default: #ffffff;
  --super-sidebar-bg: var(--work-dark-chrome);
  --super-sidebar-border-color: var(--work-dark-line);
  --super-sidebar-user-bar-bg: var(--work-dark-chrome);
  --super-sidebar-nav-item-hover-bg: var(--work-dark-hover);
  --super-sidebar-nav-item-active-bg: var(--work-dark-accent-tint);
  --super-sidebar-nav-item-current-bg: var(--work-dark-accent-tint);
}
.super-sidebar { border-right: 1px solid var(--work-dark-line); }
`;

  function injectTheme(doc) {
    if (doc.getElementById('work-dark-theme')) return;
    const style = doc.createElement('style');
    style.id = 'work-dark-theme';
    style.textContent = THEME_CSS;
    (doc.head || doc.documentElement).appendChild(style);
  }

  // ---------------------------------------------------------------------------
  // Запуск
  // ---------------------------------------------------------------------------

  // У GitLab включена своя тёмная тема — не мешаем ей
  const nativeDark = (doc) => doc.documentElement && doc.documentElement.classList.contains('gl-dark');

  // Allure TestOps: у него есть встроенная тёмная тема по data-theme="dark" на html —
  // включаем её вместо перекраски (родная палитра точнее, а перекрашивать готовую тему не нужно)
  const nativeThemeHosts = {
    'allure.services.mts.ru': (doc) => doc.documentElement.setAttribute('data-theme', 'dark'),
  };

  function startNativeTheme(doc, forceDark) {
    doc.documentElement.setAttribute('data-work-dark', '');
    const sync = () => {
      if (doc.documentElement.getAttribute('data-theme') !== 'dark') forceDark(doc);
    };
    sync();
    new MutationObserver(sync).observe(doc.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
  }

  function start(doc) {
    if (!doc.documentElement || doc.documentElement.hasAttribute('data-work-dark') || nativeDark(doc)) return;
    const forceDark = nativeThemeHosts[location.hostname];
    if (forceDark) { startNativeTheme(doc, forceDark); return; }
    new Engine(doc).run();
  }

  if (document.documentElement) start(document);
  else document.addEventListener('readystatechange', () => start(document), { once: true });
})();
