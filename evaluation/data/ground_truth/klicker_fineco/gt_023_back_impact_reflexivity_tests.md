---
question: How do the Back-Test, Impact-Test, and Reflexivity-Test differ in Evolutionary Finance, and what do Crowding-In and Crowding-Out mean?
mode: explainer
expected_tools_by_profile:
  catalog_expert_v1: [EXPERT_df_fineco_expert]
---

## Back-Test, Impact-Test, and Reflexivity-Test

The tests differ in how prices are determined:

- **Back-Test:** The strategy is evaluated using given historical, and therefore exogenous, prices $q$. Its own effect on those prices is not modeled.
- **Impact-Test:** Prices are partly endogenous. The test examines how more capital or demand following the same strategy changes prices and the strategy's growth rate.
- **Reflexivity-Test:** Prices are generated entirely within the simulated market from strategies and relative wealth. Prices affect returns and wealth, which in turn affect subsequent demand and price formation.

In the Impact-Test, **Crowding-In** means that the additional impact improves the average growth rate; **Crowding-Out** means that it worsens it. Strong historical Back-Test results therefore do not guarantee that a strategy will perform equally well after attracting substantial additional capital.

## Sources

- Financial Economics script FS26, Chapter 8, Back-Test, Impact-Test, Reflexivity-Test, and Crowding-In/Out in Evolutionary Finance
