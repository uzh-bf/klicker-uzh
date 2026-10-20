---
question: If I keep adding securities whose correlations are below one to a portfolio, does the portfolio variance always fall to zero?
mode: explainer
expected_tools_by_profile:
  catalog_expert_v1: [EXPERT_df_fineco_expert]
---

## Diversification and the Remaining Risk

No. In the standard equal-weighted example with $N$ securities, portfolio variance can be written as

$$
\sigma_P^2 = \frac{1}{N}\bar{\sigma}^2 + \frac{N-1}{N}\overline{\operatorname{Cov}}
$$

Under the required boundedness and convergence assumptions, the first term approaches zero as $N$ grows, while the average covariance remains:

$$
\lim_{N\to\infty}\sigma_P^2 = \overline{\operatorname{Cov}}
$$

Diversification can therefore remove the average individual-variance component while common covariance risk remains. Correlation below one is not enough to guarantee zero variance. It also does not guarantee that every newly added security lowers risk if its portfolio weight is chosen arbitrarily; the resulting covariance with the existing portfolio matters.

## Sources

- Financial Economics script FS26, Section 2.2, equal-weighted portfolio variance and the diversification limit, Equations 2.12–2.13
