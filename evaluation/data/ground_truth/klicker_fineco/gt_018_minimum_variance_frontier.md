---
question: Is the global minimum-variance portfolio the same thing as choosing the minimum variance for every target return on the efficient frontier?
mode: tutor
expected_tools_by_profile:
  catalog_expert_v1: [EXPERT_df_fineco_expert]
---

## Minimum Variance and the Efficient Frontier

They are related but not identical. There is one global minimum-variance portfolio: it has the lowest variance among all feasible portfolios. To trace the portfolio frontier, one instead minimizes variance subject to a chosen target return $Z$:

$$
\min_{\lambda}\ \sigma_P^2
\quad\text{subject to}\quad
\mu(R_P)=Z,\qquad \sum_k\lambda_k=1
$$

Repeating this problem for different values of $Z$ produces the frontier; only its upper branch above the global minimum-variance portfolio is efficient.

The tangency portfolio is another distinct portfolio: after a risk-free asset is introduced, it maximizes the Sharpe ratio and determines the optimal Capital Allocation Line. The global minimum-variance portfolio need not be the tangency portfolio and need not lie on that line, except in a special case.

Which additional constraint turns the single global minimum-variance problem into the problem for one particular point on the frontier?

## Sources

- Financial Economics script FS26, Section 2.3.2, minimum-variance frontier with target-return and budget constraints, Equations 2.14–2.16
- Financial Economics script FS26, Section 2.3.3, Sharpe-ratio maximization and the tangency portfolio, Equation 2.18
