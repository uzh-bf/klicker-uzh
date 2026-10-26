---
question: How can I calculate the shares in the risk-free asset and risky portfolio if risk aversion is 5.6 and I already calculated the optimal tangency portfolio without risk aversion?
mode: tutor
expected_tools_by_profile:
  catalog_expert_v1: [EXPERT_df_fineco_expert]
---

## Risk-Free Asset and Tangency Portfolio Shares

If the composition of the tangency portfolio is already known, risk aversion determines how much total wealth is invested in it. Risk aversion alone is not enough for a numerical answer: the tangency portfolio's expected return, variance, and the risk-free rate are also required.

Use:

$$
\lambda^* = \frac{\mu(R_T) - R_f}{\psi \sigma_T^2}
$$

With $\psi=5.6$, substitute the other three inputs into this expression. Use the variance $\sigma_T^2$, not the standard deviation $\sigma_T$.

The share in the risk-free asset is:

$$
1 - \lambda^*
$$

The relative weights inside the tangency portfolio stay unchanged. If $0<\lambda^*<1$, the remaining wealth is invested risk-free. If $\lambda^*>1$ and borrowing is allowed, $1-\lambda^*<0$ represents borrowing at the risk-free rate.

Which of $\mu(R_T)$, $R_f$, and $\sigma_T^2$ have you already calculated, so that you can substitute them into the formula for $\lambda^*$?

## Sources

- Financial Economics script FS26, Section 2.5, utility-maximizing complete portfolios, Equations 2.28–2.30
