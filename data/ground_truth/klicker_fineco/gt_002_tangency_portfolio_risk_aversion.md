---
question: How can I calculate the shares in the risk-free asset and risky portfolio if risk aversion is 5.6 and I already calculated the optimal tangency portfolio without risk aversion?
expected_tools_by_profile:
  catalog_expert_v1: [EXPERT_df_fineco_expert]
---

## Risk-Free Asset and Tangency Portfolio Shares

If the composition of the tangency portfolio is already known, risk aversion determines only how much total wealth is invested in that tangency portfolio.

Use:

$$
\lambda^* = \frac{\mu(R_T) - R_f}{\psi \sigma_T^2}
$$

With $\psi = 5.6$. Here $\lambda^*$ is the total share invested in the tangency portfolio, $\mu(R_T)$ is the expected return of the tangency portfolio, $R_f$ is the risk-free rate, and $\sigma_T^2$ is the variance of the tangency portfolio.

The share in the risk-free asset is:

$$
1 - \lambda^*
$$

The relative weights inside the tangency portfolio stay the same as before. Risk aversion only scales the total risky position up or down.

## Sources

- Financial Economics script FS26, utility-maximizing portfolios
- FinEco FS26 Guide, portfolio optimization
