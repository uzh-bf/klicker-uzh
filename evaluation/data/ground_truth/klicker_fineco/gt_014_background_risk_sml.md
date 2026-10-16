---
question: How do non-tradable background risks change the CAPM relation between beta and expected return?
mode: explainer
expected_tools_by_profile:
  catalog_expert_v1: [EXPERT_df_fineco_expert]
---

## CAPM with Background Risk

Background risk is non-tradable risk, such as labor-income risk. In the course model, expected excess return is determined by a modified beta:

$$
\mu_k-R_f=
\frac{\operatorname{Cov}(R_k,R^M)+\operatorname{Cov}(R_k,R_y)}
{\operatorname{Var}(R^M)+\operatorname{Cov}(R^M,R_y)}
(\mu^M-R_f).
$$

Assuming the relevant denominators and the market risk premium are positive, asset $k$ lies at or above the classical SML when

$$
\operatorname{Cov}(R_k,R_y)
\geq \beta_k\operatorname{Cov}(R^M,R_y).
$$

The sign of $\operatorname{Cov}(R_k,R_y)$ alone is not sufficient because background risk also changes the denominator through its covariance with the market. The classical CAPM is recovered when both background-risk covariance terms are zero. Correlation and covariance must not be treated as interchangeable: covariance also depends on the relevant volatilities.

## Sources

- Financial Economics script FS26, Chapter 6, Security Market Line with non-tradable background risk, Equation 6.15
