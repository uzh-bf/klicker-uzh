---
question: Does the CML in the CAPM have the slope of the Sharpe ratio, and how does it differ from the SML?
mode: explainer
expected_tools_by_profile:
  catalog_expert_v1: [EXPERT_df_fineco_expert]
---

## CML, CAL, and SML

For any Capital Allocation Line built from the risk-free asset and a risky portfolio $P$, the slope is that portfolio's Sharpe ratio:

$$
\frac{\mu(R_P)-R_f}{\sigma_P}.
$$

The tangency portfolio maximizes this slope. Under the classical CAPM equilibrium assumptions, the tangency portfolio is the market portfolio, so the Capital Market Line has slope $(\mu^M-R_f)/\sigma_M$, the market portfolio's Sharpe ratio.

The CML plots expected return against total risk $\sigma$ and describes efficient complete portfolios. The Security Market Line instead plots expected return against beta, applies to individual assets and portfolios, and has slope $\mu^M-R_f$, the market risk premium.

## Sources

- Financial Economics script FS26, Section 2.3.3, Sharpe-ratio maximization and the tangency portfolio, Equation 2.18
- Financial Economics script FS26, Chapters 2–3, equilibrium identification of the tangency portfolio with the market portfolio and the CAPM Security Market Line
