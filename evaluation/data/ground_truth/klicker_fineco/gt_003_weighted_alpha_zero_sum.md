---
question: Under heterogeneous expectations, what do aⁱ and αⁱ mean in the condition that their weighted sum is zero?
mode: tutor
expected_tools_by_profile:
  catalog_expert_v1: [EXPERT_df_fineco_expert]
---

## Weighted Zero-Sum Condition for Alpha

The condition is

$$
\sum_{i=1}^{I} a^i \alpha^i = 0
$$

Here $\alpha^i$ is investor $i$'s expected alpha for the market portfolio, and

$$
a^i=\frac{r^i/\psi^i}{\sum_{j=1}^{I}r^j/\psi^j},
$$

where $r^i$ is relative wealth and $\psi^i$ is risk aversion. Thus, $a^i$ reflects both market influence through wealth and risk tolerance; it is not the alpha itself.

The interpretation is: in market equilibrium, the weighted average alpha across investors must be zero. If some influential investors expect a positive alpha, other investors must have negative alphas with enough weight to offset it.

If all investors have the same risk aversion, then $a^i=r^i$. Otherwise, the $a^i$ generally differ from relative-wealth weights. Positive and negative expected alpha contributions must cancel only after applying the correct weights.

For two investors, how would you describe the relationship between their alphas when the first investor has the larger weight?

## Sources

- Financial Economics script FS26, Section 4.2, investor-specific alpha and the weighted zero-sum condition, Equations 4.11–4.13
- Financial Economics script FS26, Chapter 4, equality of risk-tolerance and relative-wealth weighting under common risk aversion, Equation 4.22
