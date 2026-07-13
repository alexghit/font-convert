# Font Convert

Fast, local font converter — **TTF · OTF · WOFF · WOFF2**. Everything runs in the browser; fonts are never uploaded anywhere.

Select or drop one or many fonts, pick an output format, Convert, then Download. A single font downloads directly; multiple fonts download as a `.zip`. Click the title to clear and start over.

No build step, no dependencies to install.

## Conversions

Each input is decoded to raw SFNT (TTF/OTF), then re-encoded to the chosen output:

| Outlines | Valid outputs |
|----------|---------------|
| TrueType (glyf) | TTF · WOFF · WOFF2 |
| PostScript (CFF) | OTF · WOFF · WOFF2 |

TTF↔OTF is not offered because it would require rebuilding the glyph outlines (glyf ↔ CFF), which changes the font. In a batch, any font that can't reach the chosen format is skipped and marked in the list; the rest still convert.

## How it works

- **WOFF2** encode/decode — Google's `woff2` compiled to WebAssembly (vendored in `/lib`, self-contained, no CDN).
- **WOFF** encode/decode — native browser `CompressionStream`/`DecompressionStream('deflate')`.
- **TTF/OTF** — passed through as raw SFNT.
- **ZIP** for batch downloads — tiny built-in store-method writer, no dependency.

## Files

```
index.html          the app — deploy this
_headers             Cloudflare Pages header rules (JS MIME type for /lib)
site.webmanifest     PWA/homescreen icon manifest
icons/               favicon, apple-touch-icon, PWA icons
lib/                 vendored WOFF2 WASM (compress/decompress)
preview.html         self-contained build for local testing — open directly, no server needed
```

`preview.html` has the WOFF2 libraries and icons inlined so it works by double-clicking, with no `http://` server. It's for trying the app locally — deploy `index.html` (plus `_headers`, `site.webmanifest`, `icons/`, `lib/`), not `preview.html`.

## Deploy (Cloudflare Pages)

1. Push this folder to a GitHub repo.
2. Cloudflare dashboard → **Workers & Pages** → **Create** → **Pages** → connect the repo.
3. Framework preset: **None**. Build command: *(empty)*. Output directory: `/` (root).
4. Deploy.

Fully static, so any static host works. The `_headers` file ensures `/lib/*.js` is served with a JS MIME type on Cloudflare Pages.

> Opening `index.html` directly via `file://` won't load the modules — serve over http(s) (Cloudflare Pages, or any local static server). Use `preview.html` for a no-server local check instead.

## Credits

- WOFF2 WASM: [google/woff2](https://github.com/google/woff2) via bunny-woff2 (MIT)
- Made by Alex Ghit
