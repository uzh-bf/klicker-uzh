---
question: 'Synthetic Evolutionary Finance example with two equally likely i.i.d. states: the relative dividends are d₁=(0.4, 0.6) and d₂=(0.8, 0.2). The common consumption rate is λ₀=0.1. In the fixed comparison market λᴹ=(0.45, 0.45), a strategy uses λⁱ=(0.63, 0.27). Both vectors contain the wealth shares actually invested and sum to 0.9. Calculate g=E[ln(1−λ₀+λ₀ Σₖ dₖ,ω λₖⁱ/λₖᴹ)] and interpret its sign.'
mode: explainer
expected_tools_by_profile:
  catalog_expert_v1: [EXPERT_df_fineco_expert]
---

## Evolutionary Relative-Growth Calculation

The weights relative to the market are $0.63/0.45=1.4$ and $0.27/0.45=0.6$.

In the first state, the weighted dividend sum is

$$0.4\cdot1.4+0.6\cdot0.6=0.92,$$

so the factor is $F_1=0.9+0.1\cdot0.92=0.992$.

In the second state,

$$0.8\cdot1.4+0.2\cdot0.6=1.24,$$

so $F_2=0.9+0.1\cdot1.24=1.024$.

Using natural logarithms gives

$$
g=\tfrac12\ln(0.992)+\tfrac12\ln(1.024)
\approx0.00784218>0.
$$

In this fixed comparison market, the strategy has a positive average logarithmic growth advantage. Its relative wealth nevertheless falls in the first state: positive $g$ does not imply growth in every state. The calculation does not guarantee unlimited growth in a market whose strategy weights change endogenously.

## Sources

- Financial Economics script FS26, Section 10.3, logarithmic relative-wealth growth, Equations 10.13–10.14
