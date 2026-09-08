#!/usr/bin/env python3
"""Synthetic tests for the standalone evaluation judge launcher."""

from __future__ import annotations

import contextlib
import importlib.util
import io
import json
import os
import stat
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

MODULE_PATH = Path(__file__).with_name("klicker-eval-judge.py")
SPEC = importlib.util.spec_from_file_location("klicker_eval_judge", MODULE_PATH)
if SPEC is None or SPEC.loader is None:
    raise RuntimeError("could not load judge launcher")
JUDGE = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(JUDGE)


class JudgeTests(unittest.TestCase):
    def test_missing_credentials_fails_before_docker(self) -> None:
        environment = {"PATH": os.environ.get("PATH", "")}
        values, missing = JUDGE.credentials_from_environment(environment)
        self.assertIsNone(values)
        self.assertEqual(missing, JUDGE.REQUIRED_CREDENTIALS)

    def test_infisical_fills_only_missing_settings_without_extra_config(self) -> None:
        supplied = "https://synthetic.invalid/openai/v1"
        with (
            patch.dict(os.environ, {"AZURE_OPENAI_BASE_URL": supplied}, clear=True),
            patch.object(JUDGE.shutil, "which", return_value="/synthetic/infisical"),
            patch.object(
                JUDGE.subprocess,
                "run",
                return_value=subprocess.CompletedProcess([], 0, "synthetic-key\n", ""),
            ) as run,
        ):
            self.assertEqual(
                JUDGE.resolve_credentials(),
                {
                    "AZURE_OPENAI_BASE_URL": supplied,
                    "AZURE_OPENAI_API_KEY": "synthetic-key",
                },
            )
        self.assertEqual(run.call_count, 1)
        args = run.call_args.args[0]
        self.assertEqual(args[1:4], ["secrets", "get", "AZURE_OPENAI_API_KEY"])
        self.assertEqual(args[-4:], ["--env", "dev", "--path", "/"])
        self.assertEqual(run.call_args.kwargs["cwd"], JUDGE.REPO_ROOT)
        self.assertNotIn(supplied, str(run.call_args))

    def test_complete_environment_does_not_require_infisical(self) -> None:
        supplied = {name: "synthetic-value" for name in JUDGE.REQUIRED_CREDENTIALS}
        with (
            patch.dict(os.environ, supplied, clear=True),
            patch.object(JUDGE.subprocess, "run") as run,
        ):
            self.assertEqual(JUDGE.resolve_credentials(), supplied)
            run.assert_not_called()

    def test_infisical_failure_does_not_expose_cli_output(self) -> None:
        for status, output in [(1, "synthetic-secret"), (0, ""), (0, "one\ntwo")]:
            with (
                patch.dict(os.environ, {}, clear=True),
                patch.object(
                    JUDGE.shutil, "which", return_value="/synthetic/infisical"
                ),
                patch.object(
                    JUDGE.subprocess,
                    "run",
                    return_value=subprocess.CompletedProcess(
                        [], status, output, "synthetic-secret"
                    ),
                ),
                self.assertRaises(ValueError) as error,
            ):
                JUDGE.resolve_credentials()
            self.assertNotIn("synthetic-secret", str(error.exception))

    def test_run_sends_credentials_only_on_bootstrap_stdin(self) -> None:
        class Sink:
            def __init__(self) -> None:
                self.data = b""

            def write(self, data: bytes) -> int:
                self.data += data
                return len(data)

            def close(self) -> None:
                return

        class Process:
            def __init__(self) -> None:
                self.stdin = Sink()

            def wait(self) -> int:
                return 0

        process = Process()
        synthetic = {
            "AZURE_OPENAI_BASE_URL": "https://synthetic.invalid/v1",
            "AZURE_OPENAI_API_KEY": "synthetic-upstream-key",
            "DOCKER_HOST": "unix:///synthetic/docker.sock",
        }
        output = io.StringIO()
        errors = io.StringIO()
        with (
            patch.dict(os.environ, synthetic, clear=True),
            patch.object(JUDGE.shutil, "which", return_value="/synthetic/docker"),
            patch.object(JUDGE.subprocess, "Popen", return_value=process) as popen,
            contextlib.redirect_stdout(output),
            contextlib.redirect_stderr(errors),
        ):
            self.assertEqual(JUDGE.run(()), 0)

        command = popen.call_args.args[0]
        options = popen.call_args.kwargs
        rendered_command = "\0".join(command)
        self.assertNotIn(synthetic["AZURE_OPENAI_BASE_URL"], rendered_command)
        self.assertNotIn(synthetic["AZURE_OPENAI_API_KEY"], rendered_command)
        self.assertNotIn("AZURE_OPENAI_BASE_URL", options["env"])
        self.assertNotIn("AZURE_OPENAI_API_KEY", options["env"])
        self.assertEqual(
            json.loads(process.stdin.data),
            {name: synthetic[name] for name in JUDGE.REQUIRED_CREDENTIALS},
        )
        self.assertIn("--rm", command)
        self.assertIn("-i", command)
        self.assertIn("127.0.0.1:4000:4000", command)
        self.assertIn(JUDGE.IMAGE, command)
        self.assertNotIn("synthetic-upstream-key", output.getvalue())
        self.assertNotIn("synthetic-upstream-key", errors.getvalue())

    def test_remote_docker_fails_before_credentials_are_sent(self) -> None:
        for endpoint in ("ssh://remote", "tcp://127.0.0.1:2375"):
            with (
                patch.dict(
                    os.environ,
                    {
                        "AZURE_OPENAI_BASE_URL": "https://synthetic.invalid/v1",
                        "AZURE_OPENAI_API_KEY": "synthetic-upstream-key",
                        "DOCKER_HOST": endpoint,
                    },
                    clear=True,
                ),
                patch.object(JUDGE.shutil, "which", return_value="/synthetic/docker"),
                patch.object(JUDGE.subprocess, "Popen") as popen,
                contextlib.redirect_stderr(io.StringIO()),
            ):
                self.assertEqual(JUDGE.run(()), 2)
                popen.assert_not_called()

    def test_context_takes_precedence_and_endpoint_is_frozen(self) -> None:
        for endpoint, accepted in (
            ("ssh://remote", False),
            ("unix:///local.sock", True),
        ):
            env = {"DOCKER_CONTEXT": "selected", "DOCKER_HOST": "unix:///ignored.sock"}
            with patch.object(
                JUDGE.subprocess,
                "run",
                return_value=subprocess.CompletedProcess([], 0, endpoint),
            ):
                if accepted:
                    JUDGE.select_local_docker("docker", env)
                    self.assertNotIn("DOCKER_CONTEXT", env)
                    self.assertEqual(env["DOCKER_HOST"], endpoint)
                else:
                    with self.assertRaises(ValueError):
                        JUDGE.select_local_docker("docker", env)

    def test_bootstrap_rejects_missing_stdin(self) -> None:
        result = subprocess.run(
            [sys.executable, "-c", JUDGE.BOOTSTRAP],
            input=b"",
            capture_output=True,
            check=False,
            timeout=5,
        )
        self.assertNotEqual(result.returncode, 0)
        self.assertIn(b"credentials input missing", result.stderr)

    def test_bootstrap_sets_only_synthetic_credentials(self) -> None:
        with tempfile.TemporaryDirectory(prefix="klicker-eval-judge-test-") as root:
            root_path = Path(root)
            record = root_path / "record.json"
            executable = root_path / "litellm"
            executable.write_text(
                f"#!{sys.executable}\n"
                "import json, os\n"
                f"with open({str(record)!r}, 'w', encoding='utf-8') as stream:\n"
                "    json.dump({'base': bool(os.environ.get('AZURE_OPENAI_BASE_URL')), "
                "'key': bool(os.environ.get('AZURE_OPENAI_API_KEY'))}, stream)\n"
                "print('synthetic child output')\n",
                encoding="utf-8",
            )
            executable.chmod(executable.stat().st_mode | stat.S_IXUSR)
            environment = dict(os.environ)
            environment.pop("AZURE_OPENAI_BASE_URL", None)
            environment.pop("AZURE_OPENAI_API_KEY", None)
            environment["PATH"] = str(root_path)
            payload = {
                "AZURE_OPENAI_BASE_URL": "https://synthetic.invalid/v1",
                "AZURE_OPENAI_API_KEY": "synthetic-upstream-key",
            }
            result = subprocess.run(
                [sys.executable, "-c", JUDGE.BOOTSTRAP],
                input=(json.dumps(payload) + "\n").encode("utf-8"),
                capture_output=True,
                env=environment,
                check=False,
                timeout=5,
            )
            self.assertEqual(result.returncode, 0)
            self.assertEqual(
                json.loads(record.read_text(encoding="utf-8")),
                {
                    "base": True,
                    "key": True,
                },
            )
            self.assertEqual(result.stdout, b"")
            self.assertEqual(result.stderr, b"")
            self.assertNotIn(b"synthetic-upstream-key", result.stdout + result.stderr)


if __name__ == "__main__":
    unittest.main()
