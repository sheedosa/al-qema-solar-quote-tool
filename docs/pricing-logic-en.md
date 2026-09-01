# How the quote tool calculates a price

*Client-facing explanation. Keep in sync with `src/pricing/config.ts` — the figures below are
the current active values.*

The tool does not decide the price itself. It calculates how much energy the customer needs,
selects the smallest standard package that covers that need, and shows its fixed price. A custom
quote is only built when none of the five packages is sufficient.

**1. Converting the answers into a list of electrical loads**

Every item the customer mentions becomes "watts × hours of use per day". Air conditioners are
converted from BTU to watts, so an 18,000 BTU unit is around 1,800 watts, slightly less for an
inverter AC. If the customer does not know their AC's size, we assume 12,000 BTU. Fridges and
freezers are calculated on their average draw across the day, not their maximum draw.

**2. Totalling the loads in three ways**

- Daily energy: total consumption in kWh per day.
- Night energy: the energy needed to run through the evening and night, currently assumed at up
  to 12 hours. If the customer selects "essentials only during cuts", the air conditioners they
  did not prioritise are excluded.
- Peak power: the highest instantaneous draw, which determines the inverter size. Air
  conditioners are counted at full capacity and all other devices at 70%, since they are rarely
  all running at once, then a 25% safety margin is added.

**3. Calculating the required panel capacity**

Daily energy ÷ (5.5 effective sun hours × 75% system efficiency) = required panel capacity in kWp.

**4. Calculating the batteries' actual usable capacity**

A battery's full capacity cannot be used without damaging it: only 50% for liquid (lead-acid)
batteries and 90% for lithium. So the S package's two 200 Ah liquid batteries provide around
2.4 kWh of genuinely usable capacity, while the XXL package's four 5 kWh lithium batteries
provide around 18 kWh.

**5. Reviewing the packages from smallest to largest, stopping at the first sufficient one**

A package must satisfy all of these together: enough inverter capacity for the peak, enough
battery capacity for the night, enough panels for the daily energy, and the permitted number of
air conditioners. If even one condition fails, the customer moves up to the next package.

**6. Showing that package's fixed price**

S: 8,730 LYD — M: 15,417 LYD — L: 32,247 LYD — XL: 40,600 LYD — XXL: 55,500 LYD.
These prices are read as they are and never recalculated.

**7. If no package is sufficient, a custom system is built**

The tool determines the number of panels, batteries and inverter units from the customer's need,
prices each item from the component list, then rounds the total up to the nearest 500 LYD, with
a minimum of 55,500 LYD.

---

**Note:** some values are not asked of the customer — device wattages, lighting hours, battery
voltage and effective sun hours — and are currently preliminary engineering estimates that
directly affect both the package selected and the final price. See
[`PRICING-INPUTS.md`](PRICING-INPUTS.md) for the values awaiting confirmation.
