# The Pricing page (admin)

How a sales or pricing manager changes what customers are quoted, and what protects the
quotes from a bad edit. The page is at **#/admin → Pricing** and works in Arabic and English,
on a phone or a desktop.

## What the page shows

It opens on **prices only**:

- **Package prices** — one row per package (S to XXL). Each row shows what the package
  contains, derived live from its hardware (inverter kVA, panels and kWp, batteries and usable
  kWh, the AC allowance), and **one** price box. *Edit hardware* opens that package under
  Advanced.
- **Custom and large systems** — the minimum price, the round-up increments for household
  builds and for large systems, and what a custom build starts from (one-off items, the
  all-in cost of each panel and each extra inverter) at the current component prices.
- **Add-ons** — name and price, add or remove.
- **Component prices** — the unit prices custom builds are priced from. Searchable, grouped
  by kind (for reading only), each row saying which build uses it. Parts the large-system
  method needs but that have no price yet are pinned at the top with an *Add price* box;
  once every one has a price, quotes above the hand-over size switch to Al Qema’s commercial
  method automatically. A part a recipe uses cannot be deleted; rename it instead and every
  recipe follows.

Everything else is under **Advanced**, collapsed by default and opened on purpose:

1. **Package hardware** — a card per package: inverter, panels, battery type and count,
   AC limits, with kWp / usable kWh / inverter kW read-outs that update as you type.
2. **Custom build recipe** — the panel, battery, inverters and stand a custom build uses,
   and the per-panel, per-inverter and one-off line lists.
3. **Appliance assumptions** — watts, hours per day, runs at night, always on, for every
   device a customer can tick; the default for a device they type in; bulb wattages; fridge
   and freezer; AC watts per BTU.
4. **Household sizing** — sun hours and losses, battery usable share, night hours, safety and
   diversity factors, surge multipliers, what happens when an AC is bigger than the package
   allows, roof areas, battery lifespans.
5. **Large-system method** — the hand-over size, the method’s constants, its parts, the
   inverter sizes stocked with each one’s price status.

A line at the foot of Advanced names what is deliberately not editable there.

## Checking as you type

Every value is checked about a third of a second after it changes. A bad value gets a red
ring and a plain-language message under the field — “must be a number above 0”, “package
prices must not go down from S to XXL”, “names a part that is not in the component price
list” — in the admin’s language. The bottom bar counts the problems and *Show* scrolls to the
first one; Advanced shows a count per section. Nothing can be reviewed or published while a
problem exists.

## Publishing: review, then confirm

The bottom bar’s button is **Review N changes**. It opens a sheet with three parts:

1. **What changed** — every edited field, grouped by section, before → after.
2. **What it does to real quotes** — seven reference households (a small flat, a family home
   with one AC, a home with an AC and a freezer, a home with two ACs, a shop, a large villa and
   a workshop) priced with what is live now and with the draft. Rows that move are highlighted
   and say where they moved to. At the shipped prices these land on S, M, L, XL, XXL and two
   custom builds, so every price on the page moves at least one row.
3. **Confirm** — *Publish as pricing-YYYY-MM-DD.N*. The version number is assigned from the
   database at the moment of publishing.

The outcome is stated exactly: published and live; nothing saved (the database refused it, or
the version number was taken twice); or **saved but not live**, in which case the version is
in the history and can be activated from there.

**Activating an older version** goes through the same sheet, comparing that version against
what is live now. A version that no longer passes the current checks cannot be activated. If
the draft has unsaved edits, the sheet says so and asks for an explicit *Discard my edits and
continue*.

Leaving the page with unsaved edits asks for confirmation.

## Where things live in the code

- `src/admin/PricingEditor.tsx` — the shell (load, draft, review state, bar).
- `src/admin/pricing/` — `PricesPanel`, `ComponentPrices`, `AdvancedPanel` and its five
  sections, `PublishReview`, `VersionHistory`, `ActionBar`; `useConfigDraft` (draft state and
  live validation), `configRepo` (database calls and the version rule), `bound.tsx`
  (controls bound to a config path), `componentTools` (grouping, used-by, rename).
- `src/admin/configLabels.ts` — human labels for every config path and validator message.
- `src/pricing/paths.ts`, `diff.ts`, `referenceCases.ts` — the path grammar, the diff and
  household comparison, and the seven reference households (with a golden test).
