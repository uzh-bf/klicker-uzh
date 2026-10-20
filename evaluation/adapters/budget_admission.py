"""Caller-owned budget admission for the framework's provider-direct capture."""

from contextlib import contextmanager
import os
from pathlib import Path
import re
import select
import shutil
import subprocess
import time


class BudgetAdmissionError(RuntimeError):
    """The local budget session could not establish a successful transition."""


class BudgetAdmission:
    """Hold one existing run lease and provide a per-turn admission factory.

    Use with a bounded framework client pointed at the matching spend guard.
    This adapter neither initializes allowances nor qualifies provider routing.
    Persist capture output only after this outer context exits successfully.
    """

    def __init__(self, budget_file, *, policy_hash, model, max_output_tokens):
        if not isinstance(policy_hash, str) or not re.fullmatch(
            "[a-f0-9]{64}", policy_hash
        ):
            raise ValueError("policy_hash must be a SHA-256 identity")
        if not isinstance(model, str) or not model.strip():
            raise ValueError("model must be nonblank")
        if type(max_output_tokens) is not int or max_output_tokens < 1:
            raise ValueError("max_output_tokens must be a positive integer")
        self.budget_file = Path(budget_file).resolve()
        self.policy_hash = policy_hash
        self.model = model
        self.max_output_tokens = max_output_tokens
        self._process = None
        self._failure = None
        self._body_failed = False
        self._active = False

    def _fail(self, code):
        error = BudgetAdmissionError(code)
        self._failure = self._failure or error
        raise error

    def _read(self, expected):
        deadline = time.monotonic() + 5
        data = b""
        while b"\n" not in data:
            remaining = deadline - time.monotonic()
            if (
                remaining <= 0
                or not select.select([self._process.stdout], [], [], remaining)[0]
            ):
                self._fail("budget_admission_timeout")
            chunk = os.read(self._process.stdout.fileno(), 129)
            if not chunk or len(data) + len(chunk) > 128:
                self._fail("budget_admission_protocol")
            data += chunk
        if data != expected.encode("ascii") + b"\n":
            if re.fullmatch(rb"error budget_[a-z_]+\n", data):
                self._fail(data.decode("ascii").strip().split(" ", 1)[1])
            self._fail("budget_admission_protocol")

    def _request(self, command):
        try:
            self._process.stdin.write(command.encode("ascii") + b"\n")
            self._process.stdin.flush()
            self._read("ok")
        except BudgetAdmissionError:
            raise
        except (OSError, ValueError):
            self._fail("budget_admission_unavailable")

    def __enter__(self):
        if self._process is not None or self._failure is not None:
            self._fail("budget_admission_reused")
        node = shutil.which("node")
        if node is None:
            self._fail("budget_admission_unavailable")
        module = Path(__file__).resolve().parents[1] / "evaluation-budget.mjs"
        # The budget child needs no provider credentials or Node execution hooks.
        environment = {
            name: os.environ[name]
            for name in ("PATH", "SYSTEMROOT")
            if name in os.environ
        }
        try:
            self._process = subprocess.Popen(
                [
                    node,
                    str(module),
                    "--admission-session",
                    str(self.budget_file),
                    self.policy_hash,
                ],
                stdin=subprocess.PIPE,
                stdout=subprocess.PIPE,
                stderr=subprocess.DEVNULL,
                env=environment,
            )
            self._read("ready")
        except BaseException as error:
            try:
                self._stop()
            except BaseException as cleanup:
                raise BaseExceptionGroup(
                    "Admission startup and cleanup failed", [error, cleanup]
                )
            raise
        return self

    def _stop(self):
        process = self._process
        if process is None:
            return
        try:
            if process.stdin and not process.stdin.closed:
                try:
                    process.stdin.close()
                except BrokenPipeError:
                    pass
            try:
                process.wait(timeout=5)
            except subprocess.TimeoutExpired:
                process.terminate()
                try:
                    process.wait(timeout=5)
                except subprocess.TimeoutExpired:
                    process.kill()
                    process.wait(timeout=5)
                self._fail("budget_admission_shutdown")
            if process.returncode != 0 and self._failure is None:
                self._fail("budget_admission_shutdown")
        finally:
            if process.stdout:
                process.stdout.close()

    def __exit__(self, exc_type, exc, traceback):
        cleanup_error = None
        try:
            if self._failure is None and not self._body_failed:
                self._request("close")
        except BaseException as error:
            cleanup_error = error
        try:
            self._stop()
        except BaseException as error:
            cleanup_error = (
                BaseExceptionGroup("Admission cleanup failed", [cleanup_error, error])
                if cleanup_error is not None
                else error
            )
        errors = []
        if exc is not None:
            errors.append(exc)
        for error in (self._failure, cleanup_error):
            if error is not None and all(error is not previous for previous in errors):
                errors.append(error)
        if len(errors) > 1:
            raise BaseExceptionGroup("Capture admission and cleanup failed", errors)
        if errors and errors[0] is not exc:
            raise errors[0]
        if exc is None and self._body_failed:
            raise BudgetAdmissionError("budget_capture_failed")
        return False

    @contextmanager
    def __call__(self, *, turn_index, model, max_output_tokens):
        if self._failure is not None or self._body_failed:
            self._fail("budget_admission_stopped")
        if (
            self._process is None
            or self._process.poll() is not None
            or self._active
            or type(turn_index) is not int
            or turn_index < 1
            or model != self.model
            or type(max_output_tokens) is not int
            or max_output_tokens != self.max_output_tokens
        ):
            self._fail("budget_admission_configuration")
        self._request("begin")
        self._active = True
        try:
            yield
        except BaseException:
            self._body_failed = True
            raise
        else:
            self._request("finish")
        finally:
            self._active = False
