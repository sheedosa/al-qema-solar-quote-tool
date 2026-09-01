# Pricing inputs we need from Al Qema

The quote tool works today, but a number of the engineering values behind it are **draft
estimates, not confirmed figures**. Those values decide which package a customer is offered,
and therefore what price they see. Some of them are worth more than 20,000 LYD per quote.

This document lists every open value. Each entry gives the question in plain language, why it
matters, what a wrong answer costs, and where the value lives in the system.

**How to use it:** answer the Tier A questions first — they change most quotes. Tier B affects
larger and custom systems. Tier C are quick confirmations that let us delete unused code.

Everything here is a **data** change. Answers marked *(admin panel)* can be applied by Al Qema
themselves in the pricing screen with no developer involvement.

---

## Tier A — Blocking

A wrong answer here mis-prices the majority of quotes.

### A1. Are the S and M package batteries 12 V or 48 V each?

*Confirm the rating of a **single battery**, not the total bank voltage.*

**Why it matters.** This is the largest single lever in the whole system. The S and M packages
use liquid (lead-acid) batteries, and battery capacity is what decides whether a customer fits
in a small package or gets pushed up two tiers.

| Battery rating | S usable | M usable |
|---|---|---|
| 12 V (current assumption) | 2.4 kWh | 4.8 kWh |
| 48 V | 9.6 kWh | 19.2 kWh |

**What a wrong answer costs.** A four-fold difference in stored energy, which moves customers
between packages. Two measured examples:

- A household with one 12,000 BTU AC used 6 hours a night: **L at 32,247 LYD** if the batteries
  are 12 V, **M at 15,417 LYD** if they are 48 V — a **16,830 LYD** swing.
- A household with no AC and mixed lighting: **M at 15,417** at 12 V, **S at 8,730** at 48 V —
  a **6,687 LYD** swing.

- Config key: `sizing.liquidBatteryVoltageV` *(admin panel: "Liquid battery V")*
- Current placeholder: **12**

---

### A2. Please sign off the appliance power table

These are the watt and hours-per-day figures we assume when the customer tells us they own
something. The customer only ever gives us a quantity — every other number comes from here.

| Device | Watts | Hours/day |
|---|---|---|
| Router / Internet | 15 | always on |
| TV | 100 | 5 |
| Phone / laptop charger | 65 | 3 |
| Fan | 60 | 8 |
| Water pump | 750 | 1 |
| Washing machine | 500 | 1 |
| Dryer | 2,500 | 1 |
| Oven / microwave | 1,200 | 0.5 |
| Coffee machine / kettle | 1,500 | 0.5 |
| Security cameras / NVR | 60 | always on |
| Server / network | 300 | always on |
| Fridge | 150 (at 40% duty cycle) | 24 |
| Freezer | 200 (at 45% duty cycle) | 24 |
| Air conditioner | 0.1 W per BTU (0.075 for inverter ACs) | customer tells us |
| Lighting | see A5 | 5 |

**Why it matters.** This table *is* the sizing model. It is not a rounding detail.

**What a wrong answer costs.** A 10% error in the AC figure is simultaneously a 10% error in
daily energy, night energy and peak power. The gaps between the lower packages are only 2–5 kWh
wide, so a 10% drift is enough to move a customer a whole tier.

- Config key: `loadDefaults` *(admin panel: "Appliance assumptions" and "Sizing constants")*
- Current placeholder: the table above, marked DRAFT in the code

**Specific sub-question:** the water pump is listed generically at 750 W (1 hp). Should we ask
the customer for the pump size instead? We already hold figures for 0.5, 1, 1.5 and 2 hp but
never use them.

---

### A3. Does the M package support an air conditioner, and up to what BTU?

The M package is documented only as "1 AC" with no size limit stated.

**Why it matters.** Because no limit is recorded, the S and M packages currently accept an AC of
**any** size on paper — including a 32,000 BTU unit they could not possibly run. The energy
calculation usually catches this, but the size limit itself is not enforced on the two cheapest
packages.

- Config key: `packages[M].maxAcBtu`
- Current placeholder: **blank / unconfirmed** (shows as an empty field in the admin panel)

For reference, the limits we do have: L = 18,000 BTU · XL = 12,000 BTU · XXL = 18,000 BTU.
Please confirm those are right too, and tell us the S and M figures.

---

### A4. The form offers 24,000 and 32,000 BTU ACs, but no package supports more than 18,000 per unit. What should happen?

Three options:

- **(a) Quote anyway, with a warning** — what the tool does today.
- **(b) Refuse to quote** and route the customer to a site survey.
- **(c) Add a larger package** to the range.

**What a wrong answer costs.** This one setting is worth **14,900 LYD** on a measured case: a
customer with two 18,000 BTU ACs used 3 hours a day, daytime only, is quoted **XL at 40,600**
under option (a) and **XXL at 55,500** under option (b).

- Config key: `acBtuCapMode`
- Current placeholder: **advisory** — i.e. option (a)
- Note: this is **not** currently editable in the admin panel. We will expose it.

---

### A5. For a home with a mix of LED and regular bulbs, what average wattage should we assume?

**Why it matters.** More than it looks. For a typical household with no air conditioning, the
bulb answer alone decides the package:

| Customer's answer | Assumed watts | Package | Price |
|---|---|---|---|
| LED | 10 W | S | 8,730 LYD |
| Mixed | 35 W (current guess) | M | 15,417 LYD |
| Regular | 60 W | M | 15,417 LYD |

**What a wrong answer costs.** **6,687 LYD** on that customer. And the figure is finely
balanced — at 30 W instead of 35 W the same customer falls back to S. We are currently using
the midpoint between LED and regular, which is a guess, not a measurement.

Please also confirm the LED (10 W) and regular (60 W) figures, and **how many hours per day**
lighting runs — we assume 5 and never ask the customer.

- Config keys: `loadDefaults.lightingWattsByType`, `loadDefaults.lightingHours`
- Current placeholders: LED 10 W · mixed 35 W · regular 60 W · 5 hours/day

---

### A6. Is VAT or any other tax included in the package prices? Is there a price validity period? Any standing discounts?

**Why it matters.** There is currently **nowhere in the system** to record tax, a validity
window, or a discount. The price shown is the raw package figure, presented with no tax
statement and no expiry.

**What we need:**
- Are the prices (8,730 / 15,417 / 32,247 / 40,600 / 55,500) tax-inclusive or tax-exclusive?
- If exclusive, what rate should be added and shown?
- How long is a quote valid — 7 days, 30 days, until further notice?
- Are there standard discounts (cash, referral, seasonal) the tool should apply or mention?

- Config key: **does not exist yet — we will add one**
- Current behaviour: no tax, no expiry

---

## Tier B — Refining

These mainly affect large systems, custom systems, and what we display.

### B1. How many peak sun hours should we use for your service area?

Used to calculate how many panels a system needs.

- **Impact:** small on package selection (panel count is rarely the deciding constraint), but
  meaningful on custom systems — dropping from 5.5 to 4.5 hours adds 22% more panels at
  1,100 LYD each, plus stands and cabling.
- Config key: `sizing.peakSunHours` *(admin panel)* · Current placeholder: **5.5**

### B2. Can the inverter kVA ratings be treated as kW, or should we apply a power factor?

- **Impact:** at a power factor of 0.8, every package loses 20% of its usable output — the L
  package drops from 5.5 kW to 4.4 kW — which can move customers from L to XL.
- Config key: `sizing.kvaToKw` · Current placeholder: **1.0** (no derating)
- Not currently editable in the admin panel; we will expose it.

### B3. Which solar panels do you actually stock?

The packages are specified with 605 W and 550 W panels, but custom systems are built with Jinko
590 W. At least one of these is out of date.

- **Impact:** we are quoting hardware on the result screen that may not be what ships, plus a
  price difference on custom builds.
- Config keys: `packages[].panel.watts`, `customBom.panel`

### B4. How many hours of night-time running do you promise?

We currently assume **12 hours** for every customer, and the result screen always says "up to
12 hours" regardless of how much headroom the system actually has.

- **Impact:** this drives all battery sizing.
- Worth noting: we **ask** the customer how many hours of cuts they get, then ignore the answer.
  Should outage hours drive the battery sizing instead of a flat 12?
- Config key: `sizing.alwaysOnNightHours` · Current placeholder: **12**

### B5. Below what price is a custom system not worth quoting?

**This is the most important commercial question in this document.**

When no package fits, we build a system from your component list and add up the parts. If that
total comes to less than 55,500 LYD, we quote 55,500 anyway.

Real example, reachable from the form: a customer with three small ACs used one hour a day gets
a system that costs **22,350 LYD** in parts and is quoted **55,500 LYD** — a **2.5× uplift**,
with nothing on screen telling them so. For the same 55,500, the XXL package would give them
roughly five times the hardware.

- Is that floor deliberate?
- If a custom build honestly costs less than XXL, would you rather just sell them XXL?
- Config key: `customBom.minimumLyd` · Current placeholder: **55,500**

### B6. Above what size should we stop quoting and book a survey?

There is currently no upper limit. Filling in the form at maximum produces a quote of
**1,872,000 LYD** for 298 kWp of panels, 402 kW of inverters and 445 kWh of batteries —
displayed to the customer as an ordinary price, with no sanity check.

- What is the largest system the tool should price? Give us a number in kWp, LYD, or battery
  count and above it the tool will say "we'll survey your site" and show no price.
- Config key: **does not exist yet — we will add one**

### B7. Should the battery box (350 LYD) be included in the price or stay an upsell?

Currently displayed on the result screen but never added to the total.

- Config key: `addOns`

### B8. Should roof size and shade affect the recommendation?

We ask the customer both, show the answers to your sales team, and then ignore them in the
calculation.

- Shade would naturally feed the system-efficiency figure, which is a flat 75% for everyone.
- Roof size should stop us proposing an array that cannot physically fit — related to B6.
- To use them we need: roughly how many m² one panel needs, and what "small", "medium" and
  "large" roof mean in m².

---

## Tier C — Quick confirmations

Short answers here let us remove unused code and settle small inconsistencies.

1. **Fridge condition.** We hold a 1.3× multiplier for old fridges, but the form no longer asks
   whether the fridge is old. Drop it, or start asking again?
2. **Water heater.** We hold a figure (2,000 W, 2 h/day) but never ask about it. Should the form
   ask?
3. **System type.** We ask whether the customer wants hybrid, off-grid or on-grid — and all
   three currently produce an identical quote. Should the choice change the price, or is it just
   information for the sales team?
4. **BTU per ton.** Recorded as 12,000 but used nowhere. Confirm we can remove it.
5. **Battery lifespan.** We display 4 years for liquid and 10 for lithium. Still accurate?

---

## Custom systems — a separate conversation

Beyond the individual values above, the custom-system path has a structural problem worth
discussing directly. Packages are priced by agreement; custom systems are priced by adding up
component costs. Nothing reconciles the two, which produces results like:

- A customer paying **85,000 LYD** for a custom system receives a **5 kW** inverter, while a
  customer paying **55,500** for XXL receives **11 kW**.
- A custom build with less hardware than XXL is quoted at exactly XXL's price.

Three questions settle most of it:

1. **Is the component price list your cost, or your customer-facing price?**
2. **What margin should a custom system carry?** The packages carry between 1.11× and 1.56×.
   Custom currently carries whatever the 55,500 floor happens to impose — about 2.5× at the
   bottom and roughly nothing above it. One clear rule replaces the floor entirely.
3. **Should a custom system ever ship a smaller inverter than the XXL package?** If not, we will
   set XXL's rating as the minimum.

---

## What happens when you answer

| Answer | How it is applied | Needs a developer? |
|---|---|---|
| A1 battery voltage | Admin panel → Sizing constants | No |
| A2 appliance table | Admin panel → Appliance assumptions | No |
| A3 M-tier AC limit | Admin panel → Packages | No |
| A4 oversized-AC policy | Config setting | Yes — we will expose it in the panel |
| A5 bulb wattages | Config setting | Yes — we will expose it in the panel |
| A6 tax and validity | New fields on the result screen and WhatsApp message | Yes |
| B1 peak sun hours | Admin panel → Sizing constants | No |
| B2 power factor | Config setting | Yes — we will expose it in the panel |
| B3 panel model | Admin panel → Packages and custom BOM | No |
| B4 night hours | Config setting | Yes — we will expose it in the panel |
| B5 custom floor / margin | Admin panel → minimum price, plus logic change | Partly |
| B6 maximum size | New setting and a "book a survey" result | Yes |
| B7 battery box | Config setting | Small change |
| B8 roof space and shade | New sizing input | Yes |

Every price change is published as a new version with a timestamp, takes effect immediately for
new visitors, and can be rolled back from the admin panel.
