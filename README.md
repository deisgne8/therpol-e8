# Therpol website: Direction B "Proof" (concept build)

A scroll-driven homepage concept by Element8 for RAI Global Distribution. As the visitor scrolls, a recycled-plastic test bar goes through a live tensile test in real-time 3D:

- without Therpol, it crazes and snaps;
- with Therpol, it yields, necks and keeps stretching.

A stress–strain plot is drawn from the same simulation.

This is a static site. It has no build step and no external requests: fonts and three.js are bundled.

## Files

```
index.html               Page markup: header, chapter copy, instrument panels, routes
css/therpol.css          All styles, including the self-hosted @font-face rules
js/therpol.js            Simulation, 3D scene, live plot and scroll choreography
js/vendor/three.min.js   three.js r128 (MIT, licence alongside)
fonts/                   Archivo (variable: weight and width), IBM Plex Mono 400/500 (OFL, licences alongside)
```

## Run it locally

Use any static server. Opening the file directly from disk also works, but a server is closer to production.

```
cd therpol-site
python3 -m http.server 8080      # then open http://localhost:8080
```

## Deploy

1. Upload the folder as it is to any web server or CDN (Apache, Nginx, S3/CloudFront, Netlify, and so on). Keep the relative paths.
2. Serve the `.woff2` files as `font/woff2`. Most servers do this already.
3. Cache `fonts/` and `js/vendor/` for a long time. Cache `index.html` for a short time.
4. Gzip or Brotli compression on `.js` and `.css` roughly halves the transfer size: three.min.js is about 600 KB raw and about 150 KB gzipped.

## Editing

### Copy

The copy is in `index.html`, in the `<section class="chp" data-a=".." data-b="..">` blocks.

- `data-a` and `data-b` set where each chapter appears and leaves, as a fraction of total scroll (0 to 1).
- Each headline line is wrapped in `<span class="ln"><span>…</span></span>` so it can slide in from behind a mask. Keep that wrapper when you change the text.

### Timeline

The timeline is set at the top of `js/therpol.js`:

- `BRK`: the scroll point where the untreated bar breaks.
- `DA` and `DMAX`: how far each bar extends.
- `dBk`, `camH`, `camTy`, `camAz`, `camEl`: keyframes for the Therpol bar's extension and the camera.
- `stateAt(p)` turns scroll progress into the full test state. The 3D scene, plot, instrument panel and copy all read from that one state, which is why they stay in sync.

The scroll length is `.track{height:1100vh}` in the CSS. Shorten it to make the test run faster.

### Curves (important before launch)

The curve shapes are illustrative, not Therpol data:

- `sigA()` is the untreated bar.
- `SD` / `sigB()` is the bar with Therpol.

Once RAI's technical team validates test results, replace these with the measured curves. Then update the "Simulation" labels and the disclaimer (`.disc`).

### Calls to action

Every `.cta` button currently shows a placeholder message and scrolls to the routes panel. Connect them to the real sample, data-sheet, trial and partner forms, and to the CRM. The handler is at the bottom of `js/therpol.js`.

### Brand

"Therpol" in the header is a placeholder wordmark. Replace it with the Therpol identity, including the infinity element, when it is supplied. The amber accent is `--amber` in `:root`.

## Behaviour notes

- **Smoothness:** scroll stays native. The animation follows it through an exponential smoother (`6.5` per second in `frame()`), so trackpads, wheels and touch all feel the same. The fracture recoil is time-based, so the snap keeps real speed however slowly someone scrolls.
- **Reduced motion:** if the visitor's system asks for reduced motion, smoothing, idle camera drift, recoil and camera shake are turned off. The test still follows the scroll.
- **No WebGL:** the 3D view is replaced by a short notice, and the copy and live plot still run.
- **Phones:** the camera frames the rig above the copy, the plot moves to the top right, and a sticky bar keeps "Request a sample" and "Data sheet" in reach. Pixel ratio is capped (1.6 on phones, 1.75 on desktop) to protect frame rate and battery.
- **Performance:** one render loop, about 10k vertices per bar, updated only when the extension changes. Particles exist only during "The mix" chapter.

## Before production

- Remove the QA hook `window.__therpol` at the end of `js/therpol.js`.
- Add analytics and consent handling to suit RAI's markets.
- Add `<link rel="canonical">`, Open Graph tags and favicons once the domain and brand are confirmed.
- three.js is pinned to r128 on purpose. Newer versions rename colour-management APIs (`outputEncoding` becomes `outputColorSpace`, `sRGBEncoding` becomes `SRGBColorSpace`), so retest if you upgrade.

## Licences

- three.js: MIT (`js/vendor/three-LICENSE.txt`)
- Archivo and IBM Plex Mono: SIL Open Font Licence 1.1 (`fonts/*-OFL.txt`)
- Page code and design: Element8, prepared for RAI Global Distribution.
