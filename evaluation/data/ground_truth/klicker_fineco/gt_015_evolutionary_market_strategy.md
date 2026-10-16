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

It is wealth-weighted because a strategy controlling more wealth creates more market demand and has more influence on aggregate holdings and prices. It becomes an equally weighted average only in the special case where all investors have equal relative wealth.

The formula averages each investor's **strategy weights** $\lambda_{k,t}^i$ using investor wealth shares $r_t^i$; it does not describe how much wealth investor $i$ puts into a separate object called "strategy $k$." As relative wealth changes, the contribution of each strategy to the future market strategy changes as well.

## Sources

- Financial Economics script FS26, Section 10.3, relative-growth model and the wealth-weighted market identity, Equations 10.13–10.14
