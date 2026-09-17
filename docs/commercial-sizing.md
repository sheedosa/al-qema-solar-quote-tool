# Commercial sizing — how the tool applies your method

This describes the calculator in the admin panel, under **Sizing**. It is built from the
sizing method Al Qema supplied, implemented as written. This document exists so you can check
it against the original and tell us where we have it wrong.

**It is an internal tool.** Nothing a customer sees uses any of this. The public quote wizard
asks about air conditioners, fridges and light bulbs, and cannot reach this scale — the
largest system it can offer is an 11 kVA package. The calculator starts where a 30 kW
inverter is the smallest thing that fits.

---

## What you type in

Three figures, from a bill or a site survey:

| | Meaning |
|---|---|
| **Daily battery energy (kWh)** | Energy that has to come out of the batteries — overnight and during cuts. |
| **Daytime load (kW)** | The load the panels carry directly, in real time, while the sun is up. |
| **Peak load (kW)** | The largest load the inverter must cover. Defaults to the daytime load. |

## What it works out

```
gross energy   = daily battery energy ÷ 0.8          (battery efficiency)
batteries      = gross energy ÷ 5 kWh, rounded up
charging power = installed bank ÷ 5 hours            (peak sun hours)
array (net)    = daytime load + charging power
array (DC)     = array (net) ÷ 0.8                   (system efficiency)
panels         = array ÷ 615 W, rounded up
inverter       = the smallest stocked size at or above the peak load
                 (30, 40, 50, 80, 100, 200, 300 kW)
```

Every constant above — 0.8, 0.8, 5 kWh, 5 hours, 615 W and the list of inverter sizes — is
held in the pricing configuration, so they can be changed without touching the code.

They are **deliberately separate** from the figures the household calculator uses, which are
5.5 sun hours, 75% system efficiency, a 90% usable depth of discharge and 590 W panels.
Changing one set must never move the other, or a change meant for a villa would silently
reprice a factory.

## Your three worked examples

| | Daily battery kWh | Daytime kW | Gross kWh | Batteries | Array | Panels | Inverter |
|---|---|---|---|---|---|---|---|
| Example 1 | 180 | 30 | 225 | 45 | 93.75 kW | 153 | 30 kW |
| Example 2 | 300 | 50 | 375 | 75 | 156.25 kW | 255 | 50 kW |
| Example 3 | 280 | 80 | 350 | 70 | 187.5 kW | 305 | 80 kW |

Examples 1 and 3 reproduce your figures exactly. There are two places where the tool departs
from the paper, both deliberate, and both worth a decision from you.

### 1. Panel counts are rounded up, not truncated

Your paper gives 152, 222 and 304 panels. The tool gives 153, 255 and 305. For Examples 1 and
3 the difference is a single panel: 93.75 kW ÷ 615 W is 152.4, which your notes write as
"≈152" while the method's own implementation note says "always round up battery and panel
counts to whole units." We rounded up, because a fifth of a panel cannot be installed. Say
the word and we will truncate instead.

### 2. Example 2's subtraction is not implemented

Example 2 has a step the other two do not: 50 is subtracted from the 375 kWh gross figure,
described as "the portion covered live by panels". We have left it out, for three reasons:

- **It is the only step that does not close arithmetically.** 375 − 50 = 325, but the paper
  then writes "~310", divides that to get "60–65 batteries", and finally uses 60.
- **The units do not match.** 375 is energy in kWh; 50 is power in kW. To take one from the
  other you need a number of hours, and the paper does not give one.
- **Examples 1 and 3 have no such step** and reproduce to the panel without it.

So Example 2 comes out as 75 batteries and 255 panels rather than 60 and 222. That is a
material difference, and it is the **first thing we need from you**: is there a daytime-offset
step in the method, and if so, what exactly is subtracted from what?

## Two things the calculator flags rather than decides

**The array is much bigger than the inverter.** The method picks the inverter from the
daytime load alone, but sizes the array to carry that load *and* recharge the whole battery
bank at the same time. In Example 1 that puts a **93.75 kW array behind a 30 kW inverter** —
a ratio of 3.1. If the inverter also has to carry the charging, Example 1 needs 75 kW, so an
80 kW unit. That is a large difference in cost, so the calculator shows both figures and
raises a flag rather than choosing. **We need to know whether the inverter carries the
battery charging, or whether separate charge controllers do.**

**Loads outside the ladder.** There is no stocked size below 30 kW or above 300 kW. Below it,
the calculator says the job belongs on the household packages. Above it, it caps the figure
and says an engineer is needed, rather than inventing a size.

## Prices

The parts list is priced from the same component list the rest of the tool uses, and is
labelled indicative and internal throughout. Two things are not priced yet, and appear in the
list as **"no price"** with the quantity still shown:

- the **615 W panel** — the price list only has the 590 W Jinko at 1,100 LYD, and we will not
  quietly reuse that price for a different panel;
- the **commercial inverters** at every size from 30 to 300 kW.

Add either in the admin panel under **Pricing → Component prices** — the parts this method still
needs are pinned at the top of that list with an *Add price* box — and the total completes
itself. Until then, Example 1 prices at **419,000 LYD** for the parts that *are* on the list —
the batteries alone are 337,500 — with the panels and the inverter still open.

## The customer path

The quote tool is fully automatic: every customer who finishes the form sees a price, and no
one at Al Qema has to confirm it. For large systems that price comes from this method.

- **When it runs:** a customer whose sized inverter demand is above **20 kW** (a setting under
  **Pricing → Advanced → Large-system method**) is routed here instead of to the household build. The battery energy is their
  night-time load; the daytime load is their daytime energy spread over the daylight hours; the
  peak is their peak. See D6 and D7 in the questionnaire for the two readings we chose.
- **What it needs:** every component in this method must have a price. The two that are
  missing today — the 615 W panel and the commercial inverters — are the only thing standing
  between the customer path and this method. Enter them and the switch happens by itself; the
  *Sizing* tab in the admin shows whether it is live and exactly what is still missing.
- **Until then:** large systems are still priced automatically, from the household component
  list, so the customer is never left without a number.
- **What the customer sees:** the same result screen as the packages — "From ~X LYD", the
  system's panels, batteries and inverter, and the standard "initial estimate, may change after
  a site assessment" note. Nothing about waiting for an engineer.

## What we need from you

1. The Example 2 subtraction — is it part of the method, and what exactly does it subtract?
2. Does the inverter carry the battery charging, or do separate charge controllers?
3. Prices for the 615 W panel and for each commercial inverter size you stock.
4. The balance-of-system quantities. The calculator currently reuses the household ratios
   (2 clamps and 4 m of DC cable per panel, one installation line, and so on). A 305-panel
   job almost certainly does not use the same figures as a 12-panel one.
5. Is 615 W the panel you are actually installing now? The household side of the tool builds
   with 590 W, so at least one of the two is out of date.
