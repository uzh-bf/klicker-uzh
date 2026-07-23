---
status: proposed
---

# Keep grading assertions outside the sandbox

The sandbox receives student code and test invocations but never expected outputs or instructor assertion code. It returns raw outcomes, and the Klicker worker decides pass or fail, because codeapi isolates untrusted code from Klicker infrastructure but does not create a confidentiality boundary between student code and a test harness in the same execution.
