---
question: When are returns normal or lognormal, and how are simple returns, log returns, growth factors, and prices related?
mode: explainer
expected_tools_by_profile:
  catalog_expert_v1: [EXPERT_df_fineco_expert]
---

## Normal and Lognormal Quantities

Let the simple net return be $r_t$, the gross return or growth factor be $R_t=1+r_t$, and the log return be $g_t=\ln(1+r_t)$.

In the standard model used in the course:

- log returns $g_t$ are modeled as normally distributed;
- gross returns $R_t=e^{g_t}$ are then lognormally distributed;
- prices are products of positive growth factors and are therefore also modeled as lognormal;
- simple returns satisfy $r_t=R_t-1$, so they have a lower bound of $-100\%$ and are shifted-lognormal under this exact model.

Simple returns are also sometimes approximated as normal for short horizons and moderate volatility. That is a convenient approximation, not the same statement as lognormal prices.

## Sources

- Financial Economics script FS26, return distributions and random walks
- FinEco FS26 Guide, simple returns, gross returns, and log returns
