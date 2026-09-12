---
question: In Evolutionary Finance, what is the market strategy and why is it wealth-weighted rather than equally weighted?
mode: explainer
expected_tools_by_profile:
  catalog_expert_v1: [EXPERT_df_fineco_expert]
---

## Market Strategy in Evolutionary Finance

If strategy $i$ invests the fraction $\lambda_{k,t}^i$ in asset $k$ and owns the relative wealth share $r_t^i$, the market strategy for that asset is:

$$
\lambda_{k,t}^M=\sum_i r_t^i\lambda_{k,t}^i
$$

It is wealth-weighted because a strategy controlling more wealth creates more market demand and therefore has more influence on aggregate holdings and prices. An equal-weighted average would incorrectly give a small investor the same market impact as a large investor.

As relative wealth changes over time, the strategies that perform better receive more weight in the future market strategy. This selection mechanism is central to Evolutionary Finance.

## Sources

- Financial Economics script FS26, Chapter 10.3, Evolutionary Finance model and market strategy, pp. 86–89
- FinEco FS26 Guide, Chapter 10.3, relative wealth and market strategy, pp. 86–89
