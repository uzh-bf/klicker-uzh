---
question: A synthetic month has 28 calendar days and begins on a Monday. Trading occurs only from Monday to Friday, with no holidays. Prices rise independently on each trading day with probability 0.6 and fall otherwise. What is the probability of exactly 12 upward-move days?
mode: explainer
expected_tools_by_profile:
  catalog_expert_v1: [EXPERT_df_fineco_expert]
---

## Binomial Probability over Trading Days

Four complete weeks contain **20 trading days**. Therefore, the number of upward-move days satisfies $X\sim\operatorname{Bin}(20,0.6)$.

The event is exactly twelve successes, not at least twelve:

$$
P(X=12)=\binom{20}{12}(0.6)^{12}(0.4)^8
\approx0.1797058.
$$

The probability is **approximately 17.97%**. The 28 calendar days must not be used as the number of independent trading observations. The binomial coefficient counts the possible arrangements of the twelve upward-move days among the twenty trading days.

## Sources

- Financial Economics script FS26, Section 1.3, binomial probabilities, Equation 1.17
