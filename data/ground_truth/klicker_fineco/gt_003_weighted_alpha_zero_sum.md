---
question: What is the formula where the weighted sum of alpha and a equals zero, and how should I interpret it?
expected_tools_by_profile:
  catalog_expert_v1: [EXPERT_df_fineco_expert]
---

## Weighted Zero-Sum Condition for Alpha

The condition is:

$$
\sum_{i=1}^{I} a^i \alpha^i = 0
$$

The $a^i$ are weights for the investors, for example based on wealth and risk aversion. The $\alpha^i$ are the investors' expected alphas.

The interpretation is: in market equilibrium, the weighted average alpha across investors must be zero. If some influential investors expect a positive alpha, other investors must have negative alphas with enough weight to offset it.

For two investors, the condition becomes:

$$
a^1\alpha^1 + a^2\alpha^2 = 0
$$

So the two weighted alpha contributions must cancel each other out.

## Sources

- Financial Economics script FS26, CAPM with heterogeneous expectations
- FinEco FS26 Guide, alpha and investor weights
