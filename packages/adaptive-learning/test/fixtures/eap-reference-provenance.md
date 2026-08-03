# EAP Reference Fixture Provenance

- Generator: `packages/adaptive-learning/scripts/generateEapReference.ts`
- Command: `pnpm --filter @klicker-uzh/adaptive-learning generate:eap-reference`
- Node: `v24.16.0` (repository pin: `24.16.0`)
- pnpm: `11.5.0`
- Discrete domain: `[-6, 6]`, step `0.1`, both endpoints included
- Continuous domain: `[-6, 6]`
- Continuous method: adaptive Simpson quadrature, absolute tolerance `1e-11`, maximum depth `24`
- Discrete comparison tolerance: mean/SD `1e-10`
- Continuous comparison tolerance: mean/SD `0.02`
- Fixture SHA-256: `d5ed5b3ca4034626ef09e64b2035037602db13c1fc012f847d826048d87310ef`
- Generator SHA-256: `f34db2bd4de97c6fb9f740c76ffdc7169fd50820722112bb2328233909c49453`

The generator imports no adaptive-learning production module. It independently
implements the normal prior, stable 2PL/fixed-c 3PL Bernoulli log likelihood,
discrete normalization, equal-tail quantiles, exact-cut atom splitting, and
continuous moment integration. CI reads and verifies this frozen evidence; it
does not regenerate it implicitly.
