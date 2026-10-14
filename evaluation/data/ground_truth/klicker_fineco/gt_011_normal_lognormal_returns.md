---
question: When are returns normal or lognormal, and how are simple returns, log returns, growth factors, and prices related?
mode: explainer
expected_tools_by_profile:
  catalog_expert_v1: [EXPERT_df_fineco_expert]
---

## Normal and Lognormal Quantities

Let the simple net return be $r_t$, the gross return or growth factor be $R_t=1+r_t$, and the log return be $g_t=\ln(R_t)=\ln(1+r_t)$.

In the standard model used in the course:

- if $g_t$ is normally distributed, the gross return $R_t=e^{g_t}$ is lognormally distributed;
- the simple return $r_t=R_t-1$ is then shifted lognormal and bounded below by $-100\%$;
- with a fixed positive initial price and a normally distributed accumulated log return, the future price or price ratio is lognormal.

Positivity alone does not make prices lognormal. Simple returns are also sometimes approximated as normal, and $\ln(1+r_t)\approx r_t$ for small returns. That approximation is convenient for portfolio aggregation but is not the same statement as an exact lognormal price model. Normality is a modeling assumption, not a consequence of i.i.d. returns alone or of the central limit theorem in every finite sample.

## Sources

- Financial Economics script FS26, Chapter 1.4, normal and lognormal return distributions
- Financial Economics script FS26, Chapter 2, aggregation of normal portfolio returns and the small-return approximation
