---
question: If I keep adding securities whose correlations are below one to a portfolio, does the portfolio variance always fall to zero?
mode: explainer
expected_tools_by_profile:
  catalog_expert_v1: [EXPERT_df_fineco_expert]
---

## Diversification and the Remaining Risk

Not necessarily. In the standard equal-weighted diversification example, adding securities that are not perfectly positively correlated reduces the firm-specific component of variance. For $N$ comparable securities:

$$
\sigma_P^2 = \frac{1}{N}\bar{\sigma}^2 + \frac{N-1}{N}\overline{\operatorname{Cov}}
$$

As $N$ becomes large, the first term approaches zero, but the average covariance remains:

$$
\lim_{N\to\infty}\sigma_P^2 = \overline{\operatorname{Cov}}
$$

Diversification can therefore remove unsystematic risk, while systematic market risk normally remains. Correlation below one creates a diversification benefit, but it does not by itself guarantee zero variance or even a variance reduction for every arbitrarily weighted new security.

## Sources

- Financial Economics script FS26, Chapter 2.2, portfolio variance and naive diversification, p. 28
- FinEco FS26 Guide, Chapter 2.2, systematic and unsystematic risk, p. 28
