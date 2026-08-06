---
question: Are the formulas for ex-ante and ex-post alpha different under homogeneous and heterogeneous expectations? If yes, what is the formula under heterogeneous expectations?
mode: tutor
expected_tools_by_profile:
  catalog_expert_v1: [EXPERT_df_fineco_expert]
---

## Ex-Ante Alpha Under Heterogeneous Expectations

Yes, ex-ante alpha differs because under heterogeneous expectations each investor $i$ can have their own expected return $\mu_k^i$.

A useful form is:

$$
\alpha_k^i = (\mu_k^i - R_f) - \beta_k(\bar{\mu}^M - R_f)
$$

Here $\mu_k^i$ is investor $i$'s expected return for asset $k$, and $\bar{\mu}^M$ is the market expectation aggregated across investors.

Under homogeneous expectations, everyone uses the same expected returns, so there is no investor-specific $\mu_k^i$. Under heterogeneous expectations, the alpha is investor-specific.

Looking at the formula, which term makes the ex-ante alpha specific to investor $i$?

## Sources

- Financial Economics script FS26, homogeneous CAPM and alpha
- Financial Economics script FS26, CAPM with heterogeneous expectations
