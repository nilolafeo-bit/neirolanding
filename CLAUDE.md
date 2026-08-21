# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

`neirolanding.ru` — the marketing site of a one-person studio that sells turnkey landing pages
and small multi-page sites to Russian small businesses. All copy is Russian.

It is a **static site with no build step**: hand-written HTML, one shared stylesheet, three
vanilla JS files. It is served by GitHub Pages from the repo root, with `CNAME` binding the
apex domain. There is no framework, no bundler, no `package.json`, and adding one would break
the deploy. Every `.html` file is both the source and the artifact.

Product truth (users, positioning, tariffs, what may and may not be claimed) lives in
`PRODUCT.md`. Read it before touching copy — particularly the `Evidence on Hand` section,
which records which numbers and case studies are **not** real and must not be reintroduced.

## Commands

There is nothing to build, lint, or test. To work on it:

```bash
npx --yes serve -l 4321 .
```

`.claude/launch.json` defines the same server under the name `site` for the preview tooling.

Deploy is `git push` to `main` — GitHub Pages publishes the repo root directly. There is no
staging environment, so anything merged is live on the public domain within a minute.

## Architecture

### Shared chrome is duplicated, not templated

There is no include mechanism. The `<nav class="nl-nav">` block and the `<footer class="nl-footer">`
block are **copy-pasted into all 22 pages**. Editing one page's header fixes one page.

To change the header or footer, write a Node script that regex-replaces the whole
`<nav class="nl-nav">…</nav>` and `<footer class="nl-footer">…</footer>` blocks across every
`.html` file, then run it once. The same applies to the Google Fonts `<link>` and the Yandex
Metrika snippet. Do not hand-edit 22 files.

### `assets/css/main.css` is a public contract

Every page loads this one stylesheet, so its class names are an API. Renaming or deleting
`.glass-card`, `.section`, `.container`, `.container-narrow`, `.badge-green`, `.badge-accent`,
`.btn-primary`, `.btn-ghost`, `.nl-*`, `.faq-*`, `.article-card`, `.pricing-card`, `.reveal`,
`.nl-input` / `.nl-select` / `.nl-textarea`, or `.toast` silently breaks pages you are not
looking at. Redefine them instead of removing them; section 17 of the stylesheet exists purely
to keep older markup rendering inside the current design system.

The design system itself is documented in `DESIGN.md`. The short version: black stock,
paper-white inserts, one magenta printing ink, hairline rules, 2px corners, and a single
easing curve (`--press`) used for every transition on the site.

### `index.html` is the only page on the current system

The home page was rebuilt against the current design system and no longer loads Tailwind.
**The other 21 pages still load `cdn.tailwindcss.com`** and still use Tailwind utility classes
in their body markup, so their `tailwind.config` block (fonts and color tokens) has to stay in
sync with the CSS custom properties. When you migrate a page off Tailwind, delete its CDN
`<script>` and its config block in the same edit.

### JavaScript

Four files, all plain IIFEs, all loaded with `defer`, all no-ops when their markup is absent:

- `assets/js/main.js` — shared behaviour on every page: mobile menu, sticky nav, scroll reveal,
  FAQ accordion, order form, tariff preselect, Metrika goals. The webhook URL and the Metrika
  counter id are constants at the top and are product configuration, not implementation detail.
- `assets/js/press-grid.js` — the hero canvas. Vanilla port of the 21st.dev `kinetic-grid`
  React component. Mounts on `[data-press-grid]`, reads its colors from the CSS custom
  properties so the canvas cannot drift from the palette, and pauses its rAF loop when
  off-screen or on a hidden tab.
- `assets/js/samples.js` — the portfolio fan. Vanilla port of the 21st.dev `coverflow-carousel`
  React component. Mounts on `[data-samples]` and enhances progressively: without JS the same
  markup is a scroll-snapping strip. Slide metadata is read from `data-title`, `data-subtitle`
  and a pipe-delimited `data-meta` on each `.sample`.

- `assets/js/case-strip.js` — the portfolio filmstrip on `/portfolio/`. Vanilla port of the
  21st.dev `hero-carousel` React component. Mounts on `[data-case-strip]`. Slide data lives in
  `data-image`, `data-title` (pipe-separated lines), `data-credit` and `data-meta` on each
  `.strip-card`.

All three ports keep the original components' math verbatim (ring folding for the infinite loop,
power-curve falloff, edge pinning, exponential settle, and the 260/34/0.9 spring). If you change
constants, change them at the top of the file where they are named and commented — the formulas
below assume them.

Where a port deviates from its source it is because the original's assumption does not hold
here, and each deviation is commented at the point of change. `case-strip.js` carries three:
neighbouring cards are clipped with `clip-path` rather than animated in height (height is
layout, clip-path is not); cards are 2:1 top-anchored rather than 3:4 portrait, because the
slides are screenshots whose top edge is the recognisable part; and the vertical wheel is left
to the page instead of stepping the strip, because unlike the source this strip is a hero above
a list and hijacking vertical scroll would trap the reader.

### Forms

The order form posts JSON to `form-relay`, a small Express service on the owner's own VPS
(`https://hooks.neirolanding.ru/api/submit/neirolanding`), and reports via a toast; there is no
backend in this repo. That service prints every field it receives as `key: value` into the
notification, which is why the payload keys in `initForm` are Russian labels rather than code
names — renaming them changes what the owner reads in the notification. It also requires the
site's exact `Origin` to be whitelisted server-side, drops submissions whose hidden `_hp`
honeypot is filled, and rate-limits to 20 per IP per 10 minutes. Validation is client-side only
and lives in `initForm`. Metrika goals
(`form_submit_success`, `form_submit_error`, `cta_click`, `email_click`, `blog_read`) are
already wired to real conversion tracking — renaming them breaks reporting the owner depends on.

### SEO surface

Each page carries hand-written meta, OpenGraph, and JSON-LD. `sitemap.xml` is maintained by
hand and lists every URL, so a new page needs an entry there and existing URLs must not move —
they are indexed. Blog posts live at `blog/<slug>/index.html` with a sibling `cover.jpg`.
