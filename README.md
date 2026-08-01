# Al Qema Solar — Quote Tool

A mobile-first, multi-step wizard that gives customers an instant solar system
estimate (panel array, inverter, battery, indicative price) and hands off to the
Al Qema sales team on WhatsApp with a pre-filled message.

Built from the Claude Design handoff prototype (`project/Al Qema Solar Quote.dc.html`)
as a real **Vite + React + TypeScript** single-page app. The sizing model, option
lists, validation, and copy are ported faithfully from the prototype.

## Languages (Arabic / English)

The app is fully bilingual. **Arabic (RTL) is the default** on load; a header
toggle (`ع` / `EN`) switches languages live. Switching flips the document
direction (`<html dir>`), swaps the full string bundle, and preserves the user's
progress. The Arabic type is set in **Tajawal**.

All translations live in [`src/i18n.tsx`](src/i18n.tsx). Option *values* stored in
form state are language-neutral; only their *labels* are translated, so the sizing
logic is identical in both languages. Technical units (kWp, kW, kWh, BTU) stay in
Latin as is conventional in Libyan Arabic technical copy.

## Getting started

```bash
npm install
npm run dev      # start the dev server (http://localhost:5173)
npm run build    # type-check + production build to dist/
npm run preview  # preview the production build
```

It's a fully client-side static app — `dist/` can be deployed to any static host
(Netlify, Vercel, Cloudflare Pages, S3, etc.). No backend required.

## The flow

Eight screens (`step` 0–7):

0. **Welcome** — intro + trust badges
1. **Your details** — name, WhatsApp number, property type, city _(validated)_
2. **Power situation** — daily outages, what you want to keep running, night economy _(validated)_
3. **Cooling** — dynamic AC units (0–10, fixed BTU capacity) + fridge/freezer
4. **Lighting & appliances** — bulbs, preset/custom appliance builder (quantity only)
5. **Preferences** — system type, cut priority, roof space/shade, optional photos
6. **Review** — editable summary + free-text notes
7. **Result** — recommended package (S/M/L/XL/XXL or custom), "From X LYD" price, WhatsApp CTA

Steps 1 and 2 gate the **Continue** button until required fields are filled; steps
3–5 are optional. The recommendation recomputes live from all inputs.

## Pricing engine

The result screen is driven by a pure, deterministic engine in `src/pricing/`:

- [`config.ts`](src/pricing/config.ts) — **all client-editable data**: the five package
  definitions with their fixed contractual prices (looked up, never computed), the retail
  component rate card, DRAFT load defaults, and sizing constants. **To update prices: edit the
  numbers, bump `configVersion`, run `npm run deploy`.** No logic changes are ever needed. The
  file header lists the open questions awaiting client confirmation (liquid-battery voltage,
  M-tier AC rating, peak sun hours, …) — each is a single config value.
- [`engine.ts`](src/pricing/engine.ts) — normalizes the form answers into uniform load records,
  computes daily/night energy and peak power, and matches the smallest package that satisfies
  every constraint. No match → a custom-system recommendation with **no invented price**.
  Unknown answers never crash: documented defaults apply and the result is flagged
  `confidence: 'low'`.
- [`persist.ts`](src/pricing/persist.ts) — auditable quote records (input payload + computed
  output + `configVersion`). Currently a no-op stub; swap in Supabase/API here and nothing else
  changes.
- [`engine.test.ts`](src/pricing/engine.test.ts) — `npm test` (Vitest). Includes a
  reconciliation test that rebuilds the client's 16/07/2026 quotation from the component rates
  to exactly 84,300 LYD.

Customers only ever pick a quantity for appliances; per-device watts/hours live in
`config.ts → loadDefaults` and are hidden assumptions — changing them changes every quote.
Custom "Add other" devices are modelled at 100 W / 4 h; the typed name still reaches the
sales engineer.

## Configuration

Deployment-tunable values live in [`src/config.ts`](src/config.ts):

- `WA_NUMBER` — the WhatsApp business number the estimate is sent to
- `SHOW_PRICE` — toggle the indicative price card on the result screen

## Project structure

```
src/
  App.tsx              step routing, navigation, quote persistence trigger
  i18n.tsx             AR + EN string bundles, language context, RTL handling
  logic.ts             form defaults, validation, preset names, WhatsApp link
  pricing/             sizing & pricing engine (config, engine, persist, tests)
  review.ts            builds the localized review-screen summary groups
  useQuoteForm.ts      form state + all mutations
  types.ts             form data types
  theme.ts / index.css color tokens & global styles
  config.ts            deployment config
  components/          Header, FooterNav, shared UI primitives, icons
  screens/             Screen0Welcome … Screen7Result
```

## Design source

The original prototype and its runtime are kept under `project/` for reference.
They are not part of the build.
