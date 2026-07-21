---
question: How can I derive the alpha of a third portfolio if I know investor i's wealth and alpha, investor j's wealth and alpha, and only investor 3's wealth?
expected_tools_by_profile:
  catalog_expert_v1: [EXPERT_df_fineco_expert]
---

## Alpha of the Third Investor

Use the zero-sum property of alpha with wealth weights:

$$
\alpha^i r^i + \alpha^j r^j + \alpha^3 r^3 = 0
$$

Solve for the unknown alpha of investor 3:

$$
\alpha^3 = -\frac{\alpha^i r^i + \alpha^j r^j}{r^3}
$$

So you multiply each known investor's alpha by their wealth, add those terms, change the sign, and divide by the third investor's wealth.

## Sources

- Financial Economics script FS26, alpha and market equilibrium
- FinEco FS26 Guide, CAPM alpha properties
