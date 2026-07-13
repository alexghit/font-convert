# Font Convert

My local font converter — **TTF · OTF · WOFF · WOFF2**. Everything runs in the browser; fonts never leave your machine.

Live at [fonts.hey5.studio](https://fonts.hey5.studio).

Drop in one or many fonts, pick an output format, Convert, then Download. A single font downloads directly; a batch downloads as a `.zip`. Click the title to clear and start over.

Vanilla HTML/CSS/JS, no framework or build step, deployed on Cloudflare Pages — same setup as [Name a Color](https://colors.hey5.studio) and the fluid-size generator.

## Conversions

Each input is decoded to raw SFNT (TTF/OTF), then re-encoded to the chosen output:

| Outlines | Valid outputs |
|----------|---------------|
| TrueType (glyf) | TTF · WOFF · WOFF2 |
| PostScript (CFF) | OTF · WOFF · WOFF2 |

TTF↔OTF isn't offered since it'd mean rebuilding the glyph outlines (glyf ↔ CFF), which changes the font. In a batch, anything that can't reach the chosen format is skipped and marked in the list; the rest still convert.

## How it works

- **WOFF2** encode/decode — Google's `woff2` compiled to WebAssembly (vendored in `/lib`, self-contained, no CDN).
- **WOFF** encode/decode — native browser `CompressionStream`/`DecompressionStream('deflate')`.
- **TTF/OTF** — passed through as raw SFNT.
- **ZIP** for batch downloads — tiny built-in store-method writer, no dependency.

## Files

```
index.html          the app — this is what's deployed
_headers             Cloudflare Pages header rules (JS MIME type for /lib)
site.webmanifest     homescreen icon manifest
icons/               favicon, apple-touch-icon, PWA icons
lib/                 vendored WOFF2 WASM (compress/decompress)
preview.html         self-contained build for testing locally — open directly, no server needed
```

`preview.html` has the WOFF2 libraries and icons inlined so it opens straight from disk. It's just for checking changes locally before pushing — the live site runs `index.html`.

## Credits

- WOFF2 WASM: [google/woff2](https://github.com/google/woff2) via bunny-woff2 (MIT)
- Made with ♥ by Alex Ghit
