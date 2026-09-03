---
question: How does the CAPM with heterogeneous behavior differ from the CAPM with heterogeneous expectations, and what do Rᴵ, rᴵ, and the modified beta mean?
mode: explainer
expected_tools_by_profile:
  catalog_expert_v1: [EXPERT_df_fineco_expert]
---

## Heterogeneous Behavior and Modified Beta

Under **heterogeneous expectations**, investors have different expected returns, although they may all still optimize according to mean-variance theory.

Under **heterogeneous behavior**, a different assumption is relaxed: in the course model, investors $1,\ldots,I-1$ use mean-variance optimization, while investor or group $I$ follows a different decision rule. The model again assumes homogeneous expectations and no background risks.

$r^I$ is this group's relative share of wealth, and $R^I=\sum_k\lambda_k^I R_k$ is the return on its portfolio. Provided that the denominator is nonzero, the modified beta is

$$
\hat\beta_k=
\frac{\operatorname{Cov}(R_k,R^M-r^I R^I)}
{\operatorname{Cov}(R^M,R^M-r^I R^I)}.
$$

This gives $\mu_k-R_f=\hat\beta_k(\mu^M-R_f)$. The expression accounts for the differently investing group and its share of wealth. If $r^I=0$, it reduces to the ordinary beta $\operatorname{Cov}(R_k,R^M)/\operatorname{Var}(R^M)$. The numerator and denominator must not be interchanged.

## Sources

- Financial Economics script FS26, Chapter 7, heterogeneous behavior, Equations 7.4–7.10
- Financial Economics script FS26, Sections 2.5, 3.1, and 4.1, two-fund separation under homogeneous and heterogeneous expectations
