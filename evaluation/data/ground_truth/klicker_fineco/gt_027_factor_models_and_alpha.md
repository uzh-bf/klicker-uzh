---
question: Why can alpha be positive in the CAPM but smaller or no longer statistically significant in the Fama-French or Carhart model?
mode: explainer
expected_tools_by_profile:
  catalog_expert_v1: [EXPERT_df_fineco_expert]
---

## Alpha across Factor Models

Alpha is defined relative to a particular return model. The CAPM includes the market as its risk factor. The Fama-French three-factor model adds size and value factors, commonly SMB and HML. The Carhart four-factor model adds momentum, commonly called UMD.

Some of the return left unexplained by the CAPM may be attributable to these additional factor exposures. After controlling for them, the estimated alpha may become smaller or lose statistical significance.

This is not inevitable: the sign, magnitude, and significance depend on the data, sample period, and estimation. A positive alpha in one model therefore proves neither a positive alpha in every other model nor persistent skill. Comparisons must use the same return series and period.

## Sources

- Financial Economics script FS26, Chapter 5, one-factor and multifactor models, including the Carhart model, Equation 5.3
