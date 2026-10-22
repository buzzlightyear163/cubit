# Referensanalys — hexxlabs.io

Inspekterad 2026-10-20 i webbläsare (DOM, CSS, nätverk, JS-bundle) på 1280×800, 1440×900 och mobil.

## Teknik
- Next.js (Turbopack) + Tailwind v4-lager, men nästan all styling är handskriven CSS med `hx-*`-klasser.
- Typsnitt: Geist + Geist Mono (variabla). `html` font-size skalar med `clamp(15px, .3947vw + 10.316px, 18.4px)`
  och begränsas av höjden (`1.7778vh`) så Mine-konsolen alltid får plats i en skärm.
- Kuben: egen 2D-canvas-renderer (ingen WebGL): glyf-atlas med 16 hex-tecken i två färger, ytor
  ritas med affina transformer, ytcache i små offscreen-canvas, bloom via nedskalad blur.
  Fast logisk storlek 704×576 som skalas med `transform` till varje slot. View Transition (`hx-cube`).
- Dither-bakgrunder i sidokolumnerna: Paper Shaders (WebGL) renderade en gång till data-URL.
- Live-data via en server-ström (`useStream`), wallet via Wallet Standard + "klistra in adress".
- Mining: Web Worker + valfri WebGPU.

## Routes
`/` Mine · `/earnings` · `/treasury` · `/ledger` · `/network` · `/rules` (ingen sitemap/robots).

## Layout
- Header: glas-bar (blur 14px), brand, nav med aktiv indikator (2 px), X-länk, Connect wallet.
  Mobil: Menu-knapp med två streck → kryss, panel som fälls ut med `grid-template-rows 0fr→1fr`.
- Mine (desktop): grid `side | viz | side` med rader `lede | viz | dock(6rem)`; sidokolumner
  `clamp(20rem, 21vw, 21.5rem)`, max 105rem, 100vh utan scroll.
- Sidor: `pf`-ram med karta (head, kub-slot, lagernyckel L4→core, dock) + scrollande ark med titel,
  leader-linje från kuben till titeln, "heroes"-rad med 4 siffror, paneler med linjal-headers.
- Breakpoints: 900 px (desktop/mobil), 1200 px (nätverkskolumn), höjd 820/940/1100 px döljer detaljer.

## Designsystem
- Bakgrund `#08090b`, panel `#0a0b0d`, linjer `#15161a…#2a2b31`, text `#f0eadf` (ben), accent `#d6a0b0` (rosa).
- Typskala: label .6875rem (mono, versaler, .08em), small .78rem, body .875rem, head 1.125rem,
  num 1.375rem, figure 1.75rem, title 2.25rem. Siffror i mono 300 med −.04em.
- Mönster: tick-linjaler (`repeating-linear-gradient` 8/64 px) under rubriker, hex-glyf-mätare
  (`0123456789abcdef` som gauge), statusformer (cirkel = lokal, ram = pending, fylld = server, accent = on chain).
- Knappar: primär ljus fylld 10 px radie, ghost med `--l6`-kant, "console action" med rullande etikett och pil-ruta.

## Animationer
- Kub: lager lyfts/exploderar per sektion (easeInOutCubic .7–1.1 s), kamera följer pekaren, idle-svaj,
  skannerlinje var 6:e sekund, mining-band, bevis: gather → rise → in/drop, ripple vid merge.
- Siffror rullar (`lv-in/out` .18 s), odometer på saldon, scramble-titlar (.4 s), burst-dither vid nya avgifter.
- Rader: hover-fyllnad som skalas in från vänster, expanderbara rader med clip-path.

## Funktioner
- Connect (adress), start/stop mining, CPU-last, visuals-läge, hash rate + sparkline, samplade hashar med
  ledande nollor markerade, bevis-markörer, andel av arbete vs cap, händelselogg, ledger-filter, topplista
  per period, linjal med scroll-spy.

## Externa integrationer
- Solscan-länkar, pump.fun creator fees, Phantom/Solflare deep links, X.

## Vår version
Struktur och beteende enligt ovan, med nytt varumärke och ny palett. Se README för vad som är mockat.
