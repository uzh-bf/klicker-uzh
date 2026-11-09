---
question: Is the slope of the Security Market Line multiplied by beta the risk premium of an individual stock?
mode: tutor
expected_tools_by_profile:
  catalog_expert_v1: [EXPERT_df_fineco_expert]
---

## SML Slope and Asset Risk Premium

Yes, under the CAPM. The slope of the Security Market Line is the market risk premium:

$$
E[R_M]-R_f
$$

Multiplying it by asset $k$'s beta gives that asset's risk premium:

$$
E[R_k]-R_f=\beta_k\bigl(E[R_M]-R_f\bigr)
$$

The three quantities should be kept separate:

- SML slope: $E[R_M]-R_f$
- asset risk premium: $\beta_k(E[R_M]-R_f)$
- total expected return: $R_f+\beta_k(E[R_M]-R_f)$

For example, $\beta_k=1.2$ means that the asset's CAPM risk premium is 1.2 times the market risk premium. It does not mean that the beta itself changes by 1.2% when the market moves.

If an asset's beta rises while the market risk premium stays constant, which part of its expected return changes?

## Sources

- Financial Economics script FS26, Sections 3.4–3.5, CAPM Security Market Line, Equation 3.17
