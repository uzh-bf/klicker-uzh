---
module: evaluation
date: 2026-09-08
problem_type: test_failure
severity: medium
symptoms:
  - 'Evaluation launcher fails with an unbound array on macOS Bash 3.2.'
root_cause: The test parent used Bash 3.2 while launcher subprocesses selected Homebrew Bash through PATH.
tags: [evaluation, bash, portability, testing]
---

# Shell subprocesses can invalidate a portability test

Running `/bin/bash util/test-klicker-eval-wrapper.sh` initially passed even
though the launcher failed on macOS's Bash 3.2. The fixture executed the
launcher through its `#!/usr/bin/env bash` shebang, and its `PATH` selected
Homebrew Bash. Testing the parent interpreter did not test the child interpreter.

Bash 3.2 treats an empty array expansion under `set -u` as an unbound variable.
The launcher uses conditional array expansion when forwarding an empty argument
list or iterating optional source aliases. Its test fixture puts a symlink to
the actual `$BASH` interpreter first in each child search path, and uses portable
variable-presence checks in its stubs.

The regression lives in [the wrapper suite](../../../util/test-klicker-eval-wrapper.sh).
Run it with `/bin/bash` on macOS and with Bash on Linux. The same suite must
exercise the same selected interpreter in its subprocesses. Keep the separate
[real-framework loopback test](../../../util/test-klicker-eval-integration.py)
for runner and artifact behavior; mocked executable wiring cannot prove that path.
