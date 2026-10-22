# cubit — mine from a browser tab, get paid in SOL

Rebrandad, egen version av **https://hexxlabs.io/** byggd som ett lokalt Vite + React + TypeScript-projekt.
Samma struktur, layout och beteende som referensen — men nytt namn (**cubit / $CUBIT**), ny logga, ny
färgpalett (kall stål + is-blå accent i stället för ben/rosa), nya sektionsnamn, omskriven copy och egna
ekonomiparametrar.

## Starta

**Windows:** dubbelklicka `start.bat` (installerar dependencies första gången och öppnar sidan).

Manuellt:

```bash
npm install
npm run dev        # http://localhost:5173
npm run build      # typecheck + produktionsbuild till dist/
npm run preview    # serverar dist/
```

Kräver Node 18+ (testat med Node 22).

## Routes

| Route | Sida | Kubens lager |
|---|---|---|
| `/` | **Mine** – konsolen: guide/rig, kuben, dock, nätverk | kärnan |
| `/rewards` | **Rewards** – din plånbok: pending, paid, lifetime, dina fönster | lager 2 |
| `/vault` | **Vault** – reward wallet, skulder, split, in/ut-flöden, plånböcker | lager 3 |
| `/ledger` | **Ledger** – alla poster med filter (All/Claims/Payouts/Burns/This tab) och expanderbara rader | lager 1 |
| `/miners` | **Miners** – live-siffror, topplista (Window/24 h/All time), tokendata | lager 4 |
| `/protocol` | **Protocol** – hur det funkar, algoritmen, payouts, hold-to-mine, avgifter, avvisningar | kärnan |
| `*` | 404 i samma ram | – |

(Referensens namn: Mine, Earnings, Treasury, Ledger, Network, Rules.)

## Vad som faktiskt fungerar

- **Riktig mining i webbläsaren.** `src/miner/` kör SHA-256 proof-of-work i Web Workers
  (`preimage = challenge ‖ wallet ‖ nonce`, midstate-optimerad, självtest mot WebCrypto vid start).
  CPU-last 25/50/75/100 % styr antal trådar. Svårighetsgraden kalibreras mot din hash rate så att
  ett bevis landar ungefär var 2,5:e sekund, och "challenge full" ger en ny, svårare ticket.
- **Verifiering.** Varje bevis räknas om oberoende med WebCrypto och avvisas vid dubblett,
  hash mismatch, stängt fönster eller för låg svårighet – precis som servern ska göra.
- **Fönster om 60 s.** Ditt krediterade arbete (2^d per bevis) räknas in i fönstret och delas ut
  efter arbete med cap per plånbok (överskott fördelas på plånböcker under cap).
- **Plånbok, bara adress.** Phantom / Solflare / Backpack via injicerad provider, eller klistra in en
  adress (base58-validerad). Ingen signatur, ingen transaktion.
- **Saldokoll.** CA:n `8zotsdhpt6U8SRrXiGC7XDMkxhgRUKx4Q1mMn4acpump` är satt i `BRAND.mint`. Ditt $CUBIT-saldo
  läses read-only via `/api/rpc` och ger hold units + cap. Publika RPC:er nekar anrop direkt från webbläsare,
  så `/api/rpc` är en liten proxy: `api/rpc.js` på Vercel (sätt gärna `SOLANA_RPC` till en egen endpoint,
  t.ex. Helius) och en Vite-proxy i dev/preview. Misslyckas läsningen visas "Balance read failed".
- **Pris och market cap** på Miners hämtas live från DexScreener när första paret är indexerat (annars "–").
  Holders länkar till Solscan.
- **Kuben.** Egen 2D-canvas-motor (`src/cube/engine.ts`): 4×4×4 hex-glyfblock i isometri med upplyst
  kärna, lagret för aktuell sida lyfts ut, kameran följer pekaren, bevis flyger in som glyfer och smälter
  in i kärnan (ripple) eller splittras, bloom, adaptiv kvalitet (Auto/Full/Lite/Off). En enda instans
  flyttas mellan "slots" (Mine ↔ sidkartan) med View Transition. Klicka på ett lager för att navigera.
- **Glyfströmmar** (desktop): prickade hex-kurvor från nätverkspanelen in i kuben och från kärnan ut
  till din dock, med ett paket per krediterat bevis.

## Mockat (TODO(backend))

`src/config/brand.ts → DEMO` (styrs av `VITE_DEMO`, standard `true`).

- **Nätverket** (`src/sim/network.ts`): andra miners, creator-fee-claims, utbetalningar, buyback/burn,
  topplista, ledger och tokenpris simuleras i webbläsaren. Samma `NetState`-form som en riktig ström
  behöver – byt modulen mot er backend-ström. Demo-signaturer länkas inte till Solscan, och en liten
  `demo`-etikett visas vid "Live".
- **Tickets och bevisinlämning** (`src/miner/miner.ts → issueTicket / verifyLocal`): sker lokalt.
  Ska hämtas från / skickas till servern.
- **Utbetalningar:** pending ackumuleras (sparas per adress i localStorage) men inget skickas.
  Servern ska skicka från reward wallet vid tröskeln (0,01 SOL).
- **GPU-mining:** knappen finns men är avstängd (WebGPU-miner i beta).
- **Innehavare:** antal holders i Miners är simulerat.

## Struktur

```
src/
  config/brand.ts       namn, ticker, mint, plånböcker, ekonomi, DEMO  ← rebranding börjar här
  styles/tokens.css     färger, typografi, spacing                    ← och här
  cube/                 kubmotorn + slot-komponenten
  miner/                sha256.ts (midstate), worker.ts, miner.ts (manager)
  sim/network.ts        demo-nätverket (byts mot backend)
  wallet/wallet.tsx     adress-only wallet + väljare + saldokoll
  components/           Header, Flows, Shade (dither), ui-primitiver
  layouts/              Shell (header + cube director), PageFrame (karta + sida + leader-linje)
  pages/                Mine, Rewards, Vault, Ledger, Miners, Protocol, NotFound
  lib/                  format, store, hooks, bus, hud (delad view-model), base58
public/
  favicon.svg, assets/brand/cubit-mark.svg, assets/brand/og.png
```

## Dependencies

react, react-dom, react-router-dom (v7, `viewTransition`), @fontsource-variable/geist och
geist-mono (lokala typsnitt). Inget annat – kuben, dithern och minern är egen kod.

## Responsivt

- **≥ 1200 px:** tre kolumner (guide/rig · kub · nätverk), allt i en skärm utan scroll.
- **900–1199 px:** nätverkskolumnen döljs, sidokolumnen smalnar.
- **< 900 px:** staplat flöde, meny-knapp med animerad panel, kuben ovanför dockan, sidor med kartan
  överst och docken sist. Testat på 390, 768, 1280 och 1440.

## Rebranda igen

1. `src/config/brand.ts` – namn, ticker, X-handle, mint, plånböcker, ekonomi.
2. `src/styles/tokens.css` – `--acc`/`--acc-rgb` + neutraler.
3. `src/cube/engine.ts` – `C_ACC`, `ACC_RGB` och `FACE.acc` (kubens kärnfärg).
4. `src/components/ui.tsx → Logo` och `public/favicon.svg` – loggan.
5. `public/assets/brand/og.png` – delningsbild.
6. `index.html` – titel och meta.

Se även `BRANDING_TODO.md` och `REFERENCE_ANALYSIS.md`.
