---
question: In the Evolutionary Finance model, λ₀ denotes the consumption rate. Is this the same as the risk-free share in portfolio theory, and what does λ₀ = 0.1 mean for the budget?
mode: tutor
expected_tools_by_profile:
  catalog_expert_v1: [EXPERT_df_fineco_expert]
---

## Consumption Rate and Investment Budget

No. The meaning of the symbol depends on the model. In this Evolutionary Finance model, $\lambda_0$ is the consumption rate, not an investment in a risk-free security.

For wealth $w_t^i$, the amount $\lambda_0 w_t^i$ is consumed and the remaining fractions are invested in the $K$ securities:

$$\sum_{k=1}^{K}\lambda_{k,t}^i=1-\lambda_0.$$

With $\lambda_0=0.1$, 10% of wealth is consumed and 90% is invested. These are shares of wealth; this does not automatically mean that 10% of each individual dividend is consumed.

In the market equilibrium considered in the course, with a common consumption rate, $\lambda_0\sum_i w_t^i=\sum_k D_{k,t}$ also holds. This aggregate identity must not be confused with the individual budget definition.

What must the invested weights sum to when the consumption rate is 0.1?

## Sources

- Financial Economics script FS26, Section 10.3, consumption and investment budget, Equation 10.5 and its derivation
- Financial Economics script FS26, Sections 2.1 and 3.3, portfolio weights and budget identities in mean-variance portfolio theory
