---
question: In Evolutionary Finance, g is the average logarithmic growth rate of relative wealth. Does a strategy grow when g > 0 or only when g > 1?
mode: tutor
expected_tools_by_profile:
  catalog_expert_v1: [EXPERT_df_fineco_expert]
---

## Logarithmic Growth Threshold

For the **logarithmic** growth rate, the threshold is **zero**:

- $g>0$: positive average logarithmic growth relative to the comparison market
- $g=0$: no positive or negative logarithmic growth advantage
- $g<0$: negative average logarithmic growth relative to the comparison market

For the corresponding geometric growth factor $G=e^g$, the threshold is instead **one**. Thus, $g=0$ corresponds to $G=1$. A positive long-run relative growth rate does not guarantee an increase in every state or period.

If a strategy exactly holds the market portfolio, the course model gives $g(\lambda^M,\lambda^M)=0$: it cannot gain relative to itself.

Which value of $G$ corresponds to $g=0$?

## Sources

- Financial Economics script FS26, Section 10.3, logarithmic relative-wealth growth, Equations 10.13–10.14
- Financial Economics script FS26, Section 10.3.7, growth of the market strategy relative to itself, Equations 10.19–10.20
