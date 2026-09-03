---
question: Given the four matrices A=(1 2; -2 4), B=(1 2; 2 -1), C=(4 -2; -2 3), and D=(5 3; 3 1), which of them can be covariance matrices?
mode: explainer
expected_tools_by_profile:
  catalog_expert_v1: [EXPERT_df_fineco_expert]
---

## Covariance Matrix Conditions

A covariance matrix must be symmetric and positive semidefinite; its diagonal entries are variances and must therefore be non-negative. For a symmetric $2\times2$ matrix, these requirements can be checked using the diagonal entries and a non-negative determinant. Negative off-diagonal covariances are allowed.

For the given matrices:

- $A = \begin{pmatrix}1 & 2 \\ -2 & 4\end{pmatrix}$ is not symmetric, so it cannot be a covariance matrix.
- $B = \begin{pmatrix}1 & 2 \\ 2 & -1\end{pmatrix}$ has a negative diagonal element, so it cannot be a covariance matrix.
- $C = \begin{pmatrix}4 & -2 \\ -2 & 3\end{pmatrix}$ is symmetric, has positive diagonal entries, and $\det(C) = 4 \cdot 3 - (-2)^2 = 8 > 0$, so it is positive definite and can be a covariance matrix.
- $D = \begin{pmatrix}5 & 3 \\ 3 & 1\end{pmatrix}$ is symmetric, but $\det(D) = 5 \cdot 1 - 3^2 = -4 < 0$, so it is not positive semidefinite.

Therefore, only matrix C can be a covariance matrix.

## Sources

- Financial Economics script FS26, Section 2.2, covariance-matrix structure and portfolio variance, Equations 2.6 and 2.8–2.9
