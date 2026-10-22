# Branding TODO

Allt nedan är redan rebrandat och körbart — listan är vad som behöver fyllas i inför launch.

## Måste
- [ ] **X-handle** – `src/config/brand.ts → BRAND.xHandle` (nu platshållaren `usecubit`).
- [x] **Mint / CA** – `8zotsdhpt6U8SRrXiGC7XDMkxhgRUKx4Q1mMn4acpump` i `BRAND.mint`. CA-chippet på Mine, mint-länkar
      på Vault/Miners, saldokollen (hold units → cap) och live-pris från DexScreener är på.
- [ ] **Plånböcker** – `BRAND.wallets.reward / burn / infra` (visas som "set at launch" tills de finns).
- [ ] **Backend** – byt `src/sim/network.ts` mot riktig ström och koppla tickets/proofs i
      `src/miner/miner.ts`. Sätt sedan `VITE_DEMO=false` så försvinner demo-etiketten och signaturer länkas.

## Kolla
- [ ] **Namnet "cubit"** – kontrollera att ticker/handle/domän är lediga. Byts på ett ställe (`brand.ts`)
      + `index.html` + OG-bilden.
- [ ] **Ekonomi** – `ECON` i `brand.ts`: 75 / 15 / 10 split, 2 % cap per unit upp till 10 %,
      hold unit 400 000 tokens, payout-tröskel 0,01 SOL. Justera till era riktiga värden.
- [ ] **Logga** – egen SVG-kub (2×2×2 med en upplyst cell) i `src/components/ui.tsx → Logo`,
      `public/favicon.svg`, `public/assets/brand/cubit-mark.svg`. Byt om ni gör en riktig logga
      (t.ex. med tech-coin-gfx).
- [ ] **OG-bild** – `public/assets/brand/og.png` (1200×630, renderad från kuben). Säger "Live".
- [ ] **Domän** – sätt `og:url` i `index.html` när domänen finns.

## Ersatt från referensen
- Namn hexx → cubit, $hexx → $CUBIT, @usehexx → @usecubit.
- Logga (hexx-kub-PNG) → egen SVG.
- Rosa accent `#d6a0b0` + benvit text → is-blå `#7fd6f7` + kall vit `#e7edf2`; kubens kärna i samma accent.
- Sektioner: Earnings → Rewards, Treasury → Vault, Network → Miners, Rules → Protocol.
- All text omskriven; ekonomin har egna siffror.
- Paper Shaders-dither → egen ordnad Bayer-dither (canvas, cachad).
