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

Which additional constraint turns the single global minimum-variance problem into the problem for one particular point on the frontier?

## Sources

- Financial Economics script FS26, Chapter 2.3.2, minimum-variance portfolio and efficient frontier, pp. 31–34
- FinEco FS26 Guide, Chapter 2, portfolio optimization and the efficient frontier, pp. 22–33
