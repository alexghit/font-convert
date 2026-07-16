# Font Convert

Convert fonts between **TTF · OTF · WOFF · WOFF2**, entirely in the browser.

Live at [fonts.hey5.studio](https://fonts.hey5.studio).

## What it does

Drop in one font or many, pick an output format, hit Convert, then Download. A single font downloads directly; a batch comes back as a `.zip`. Click the title to clear and start over.

Nothing is uploaded. The conversion runs on your own machine via WebAssembly, so the fonts never leave it — which matters when you're working with licensed or unreleased typefaces you can't put through a random web service.

## Conversions

Each input is decoded to raw SFNT (TTF/OTF), then re-encoded to the chosen output:

| Outlines | Valid outputs |
|----------|---------------|
| TrueType (glyf) | TTF · WOFF · WOFF2 |
| PostScript (CFF) | OTF · WOFF · WOFF2 |

TTF↔OTF isn't offered — it would mean rebuilding the glyph outlines (glyf ↔ CFF), which changes the font rather than repackaging it. In a batch, anything that can't reach the chosen format is skipped and marked in the list; the rest still convert.

## How it works

- **WOFF2** encode/decode — Google's `woff2` compiled to WebAssembly, vendored in `lib/` so there's no CDN dependency
- **WOFF** encode/decode — the browser's native `CompressionStream`/`DecompressionStream('deflate')`
- **TTF/OTF** — passed through as raw SFNT
- **ZIP** for batch downloads — a small built-in store-method writer, no dependency

## How it's built

Vanilla HTML/CSS/JS, no framework or build step. The app is a single `index.html` with its logic inline; `base.css` holds the styles.

```
site/      the deployed app — index.html, base.css, icons, manifest,
           and Cloudflare's _headers
site/lib/  vendored WOFF2 WebAssembly + its license
```

`wrangler.jsonc` points Cloudflare's asset root at `site/`.

## Credits

- WOFF2 WASM: [google/woff2](https://github.com/google/woff2) via bunny-woff2 (MIT) — see `site/lib/LICENSE-bunny-woff2.txt`
- Made with ♥ by Alex Ghit — alex@hey5.studio
