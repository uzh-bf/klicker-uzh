---
status: proposed
---

# Keep grading assertions outside the sandbox

The sandbox receives student code and test invocations but never expected outputs or instructor assertion code. Public and hidden invocations run in separate sandbox executions, and hidden artifacts never enter a student-facing response. The Klicker worker decides pass or fail from raw outcomes because codeapi isolates untrusted code from Klicker infrastructure but does not create a confidentiality boundary inside one execution.
