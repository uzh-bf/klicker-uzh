---
question: What is the CAPM?
mode: tutor
expected_tools_by_profile:
  catalog_expert_v1: [EXPERT_df_fineco_expert]
---

## CAPM Intuition

The CAPM links an asset's expected return to its systematic market risk:

$$
E[R_k]=R_f+\beta_k\bigl(E[R_M]-R_f\bigr)
$$

The asset receives the risk-free rate plus the market risk premium scaled by beta. Beta can be written as $\beta_k=\operatorname{Cov}(R_k,R_M)/\operatorname{Var}(R_M)$: it measures the asset's contribution to market risk, not its standalone volatility.

For example, $\beta_k=1.2$ means that the asset's CAPM risk premium is 1.2 times the market risk premium. It does not mean that beta changes by 1.2% when the market moves by 1%. CAPM concerns expected returns; it does not guarantee the realized return in a particular period. Firm-specific risk is not rewarded because it can be diversified away.

As a first step, how would you describe beta in your own words if you think of it as the asset's tendency to move with the market?

## Sources

- Financial Economics script FS26, Sections 3.4–3.5, Capital Asset Pricing Model, beta, and the Security Market Line, Equation 3.17
