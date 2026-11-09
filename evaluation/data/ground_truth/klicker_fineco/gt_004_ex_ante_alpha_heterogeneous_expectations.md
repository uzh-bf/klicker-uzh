---
question: Are the formulas for ex-ante and ex-post alpha different under homogeneous and heterogeneous expectations? If yes, what is the formula under heterogeneous expectations?
mode: tutor
expected_tools_by_profile:
  catalog_expert_v1: [EXPERT_df_fineco_expert]
---

## Ex-Ante Alpha Under Heterogeneous Expectations

Ex-ante alpha uses expected returns, whereas ex-post alpha uses realized returns. Under homogeneous expectations, the course defines

$$
\alpha_k=\mu_k-\left[R_f+\beta_k(\mu^M-R_f)\right]
$$

and the realized one-period deviation as

$$
\hat\alpha_k=R_k-\left[R_f+\beta_k(R^M-R_f)\right].
$$

Under heterogeneous expectations, investor $i$ can have an individual expected return $\mu_k^i$. The investor-specific ex-ante alpha is

$$
\alpha_k^i = (\mu_k^i - R_f) - \beta_k(\bar{\mu}^M - R_f)
$$

Here $\bar{\mu}^M$ is the aggregate market expectation. The investor index belongs on the expected return and alpha because beliefs differ.

Heterogeneous expectations do not imply that every ex-ante or ex-post alpha must be nonzero. The formula can still evaluate to zero, and ex-post alpha depends on realized returns rather than directly on investors' prior disagreement.

Looking at the formula, which term makes the ex-ante alpha specific to investor $i$?

## Sources

- Financial Economics script FS26, Section 3.6, ex-ante and ex-post alpha, Equations 3.20–3.21
- Financial Economics script FS26, Section 4.2, ex-ante alpha under heterogeneous expectations, Equations 4.11–4.13
