---
question: If the ordering is λ=(λ₀,λ_A,λ_B)=(0.2,0.5,0.3), where λ₀ is the risk-free share, how much is invested in the risk-free asset and risky assets A and B?
mode: explainer
expected_tools_by_profile:
  catalog_expert_v1: [EXPERT_df_fineco_expert]
---

## Interpreting Portfolio Weights

The interpretation follows from the ordering stated in the question:

- $\lambda_0 = 0.2$: 20% in the risk-free asset
- $\lambda_A = 0.5$: 50% in risky asset A
- $\lambda_B = 0.3$: 30% in risky asset B

The weights sum to one, so they allocate 100% of wealth. If the entries were only the risky-asset weights, the risk-free share would instead be calculated as one minus their sum.

The portfolio return can be written as:

$$
R_P = \lambda_0 R_f + \lambda_A R_A + \lambda_B R_B
$$

The symbol $\lambda_0$ is model-dependent. In the Evolutionary Finance model it denotes the consumption rate rather than a risk-free investment, so the model and vector ordering must always be stated before interpreting it.

## Sources

- Financial Economics script FS26, Chapter 3, risk-free budget identity and aggregation, Equations 3.11–3.12
