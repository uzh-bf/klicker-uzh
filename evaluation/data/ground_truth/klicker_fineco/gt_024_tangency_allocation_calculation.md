---
question: 'Numerical example: μ(R_T)=8%, R_f=2%, σ_T=20%, and ψ=4. For U=μ−(ψ/2)σ², with borrowing allowed at the risk-free rate, how should wealth be allocated between the tangency portfolio and the risk-free asset? Show the full calculation.'
mode: explainer
expected_tools_by_profile:
  catalog_expert_v1: [EXPERT_df_fineco_expert]
---

## Tangency and Risk-Free Allocation

First convert the standard deviation to variance: $\sigma_T^2=0.20^2=0.04$.

$$
\lambda^*=\frac{0.08-0.02}{4\cdot0.04}
=\frac{0.06}{0.16}=0.375.
$$

Therefore, invest **37.5% in the tangency portfolio** and **62.5% in the risk-free asset**. The relative weights within the tangency portfolio remain unchanged. Borrowing is allowed but is not required for these inputs.

The key is to use the variance $0.04$, not the standard deviation $0.20$, in the denominator and to express all inputs consistently as decimals.

## Sources

- Financial Economics script FS26, Section 2.5, utility-maximizing allocation to the tangency portfolio, Equations 2.28–2.30
