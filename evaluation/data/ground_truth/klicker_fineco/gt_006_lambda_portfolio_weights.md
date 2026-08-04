---
question: If lambda equals (0.2, 0.5, 0.3), what do the individual entries mean, and how much is invested in the risk-free asset and portfolios A and B?
mode: explainer
expected_tools_by_profile:
  catalog_expert_v1: [EXPERT_df_fineco_expert]
---

## Interpreting Portfolio Weights

The vector $\lambda = (0.2, 0.5, 0.3)$ describes portfolio weights.

In the usual notation:

- $\lambda_0 = 0.2$: 20% in the risk-free asset
- $\lambda_1 = 0.5$: 50% in risky portfolio or asset A
- $\lambda_2 = 0.3$: 30% in risky portfolio or asset B

The weights sum to $0.2 + 0.5 + 0.3 = 1$, so they represent 100% of invested wealth.

The portfolio return can be written as:

$$
R_P = \lambda_0 R_f + \lambda_1 R_A + \lambda_2 R_B
$$

## Sources

- Financial Economics script FS26, portfolio weights
- FinEco FS26 Guide, portfolio theory
