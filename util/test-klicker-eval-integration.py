#!/usr/bin/env python3
"""Run one real evaluation query against a synthetic loopback target."""

from __future__ import annotations

import json
import os
import shutil
import subprocess
import sys
import tempfile
import textwrap
import threading
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
WRAPPER = ROOT / "util" / "_run_klicker_eval.sh"
FRAMEWORK = ROOT / "evaluation" / "framework"
FRAMEWORK_SHA = "2a75632a98a8f8e8382a7f7ecaa4fda9f715e12b"
MODEL = "synthetic-loopback-model"
API_KEY = "synthetic-target-key"
ANSWER = "KLICKER_EVAL_INTEGRATION_OK"
TARGET_PATH = "/v1/chat/completions"

NETWORK_GUARD = r"""
import ipaddress
import json
import os
import socket

LOG = os.environ.get("EVAL_NETWORK_GUARD_LOG")


def loopback(host):
    if isinstance(host, bytes):
        host = host.decode("ascii", errors="ignore")
    if not isinstance(host, str):
        return False
    try:
        return ipaddress.ip_address(host.strip("[]").split("%", 1)[0]).is_loopback
    except ValueError:
        return False


def deny(kind, address):
    if LOG:
        with open(LOG, "a", encoding="utf-8") as stream:
            json.dump({"kind": kind, "address": str(address)}, stream)
            stream.write("\n")
    raise OSError("non-loopback network access blocked")


def check_address(address):
    host = address[0] if isinstance(address, tuple) else address
    if not loopback(host):
        deny("network", address)


_original_getaddrinfo = socket.getaddrinfo
_original_connect = socket.socket.connect
_original_create_connection = socket.create_connection


def getaddrinfo(host, *args, **kwargs):
    check_address(host)
    return _original_getaddrinfo(host, *args, **kwargs)


def connect(self, address):
    check_address(address)
    return _original_connect(self, address)


def create_connection(address, *args, **kwargs):
    check_address(address)
    return _original_create_connection(address, *args, **kwargs)


socket.getaddrinfo = getaddrinfo
socket.socket.connect = connect
socket.create_connection = create_connection
"""


class TargetHandler(BaseHTTPRequestHandler):
    requests: list[tuple[str, str | None, object]] = []

    def do_POST(self) -> None:  # noqa: N802 - BaseHTTPRequestHandler hook
        raw_body = self.rfile.read(int(self.headers.get("Content-Length", "0")))
        self.__class__.requests.append(
            (self.path, self.headers.get("Authorization"), json.loads(raw_body))
        )
        body = json.dumps(
            {
                "id": "synthetic-loopback-response",
                "choices": [
                    {
                        "index": 0,
                        "message": {"role": "assistant", "content": ANSWER},
                        "finish_reason": "stop",
                    }
                ],
            }
        ).encode()
        self.send_response(200 if self.path == TARGET_PATH else 404)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def log_message(self, _format: str, *_args: object) -> None:
        return


def require(condition: bool, message: str) -> None:
    if not condition:
        raise AssertionError(message)


def read_events(path: Path) -> list[dict[str, object]]:
    return (
        [
            json.loads(line)
            for line in path.read_text(encoding="utf-8").splitlines()
            if line
        ]
        if path.exists()
        else []
    )


def guard_self_test(guard_dir: Path, log: Path) -> None:
    (guard_dir / "sitecustomize.py").write_text(NETWORK_GUARD, encoding="utf-8")
    log.write_text("", encoding="utf-8")
    probe = textwrap.dedent(
        """
        import socket
        failures = 0
        for operation in (
            lambda: socket.getaddrinfo("example.invalid", 443),
            lambda: socket.create_connection(("192.0.2.1", 9), timeout=0.1),
        ):
            try:
                operation()
            except OSError:
                failures += 1
        raise SystemExit(0 if failures == 2 else 1)
        """
    )
    result = subprocess.run(
        [sys.executable, "-c", probe],
        env={"PYTHONPATH": str(guard_dir), "EVAL_NETWORK_GUARD_LOG": str(log)},
        capture_output=True,
        text=True,
        timeout=5,
        check=False,
    )
    require(result.returncode == 0, "network guard self-test failed")
    events = read_events(log)
    require(
        len(events) == 2 and all(event.get("kind") == "network" for event in events),
        "network guard did not record exactly two blocked probes",
    )
    log.write_text("", encoding="utf-8")


def main() -> int:
    require(WRAPPER.is_file(), f"launcher is missing: {WRAPPER}")
    require(
        (FRAMEWORK / "scripts" / "_run_eval.sh").is_file(),
        "framework runner is missing",
    )
    require(sys.version_info[:2] == (3, 12), "Python 3.12 is required")
    bash = shutil.which("bash")
    uv = shutil.which("uv")
    require(bash and uv, "bash and uv are required")
    revision = subprocess.run(
        ["git", "-C", str(FRAMEWORK), "rev-parse", "HEAD"],
        cwd=ROOT,
        capture_output=True,
        text=True,
        timeout=5,
        check=False,
    )
    require(
        revision.returncode == 0 and revision.stdout.strip() == FRAMEWORK_SHA,
        "framework SHA is not pinned",
    )

    with tempfile.TemporaryDirectory(prefix="klicker eval integration ") as temporary:
        root = Path(temporary)
        caller, fake_bin, gt_dir, output_dir, guard_dir = (
            root / "caller with spaces",
            root / "fake bin",
            root / "ground truth with spaces",
            root / "output with spaces",
            root / "guard",
        )
        for path in (
            caller,
            fake_bin,
            gt_dir,
            output_dir,
            guard_dir,
            root / "home",
            root / "tmp",
        ):
            path.mkdir()
        (gt_dir / "01-loopback.md").write_text(
            "---\nquestion: What marker proves the integration path works?\n"
            "expected_calls: []\n---\nSynthetic loopback fixture.\n",
            encoding="utf-8",
        )
        tools = root / "tools.yaml"
        metrics = root / "metrics.yaml"
        tools.write_text("[]\n", encoding="utf-8")
        metrics.write_text("metrics: []\n", encoding="utf-8")
        infisical_log = root / "infisical.log"
        (fake_bin / "infisical").write_text(
            '#!/bin/sh\nprintf "%s\\n" "$*" >> "$KLICKER_TEST_INFISICAL_LOG"\nexit 91\n',
            encoding="utf-8",
        )
        (fake_bin / "infisical").chmod(0o755)
        guard_log = root / "guard.log"
        guard_self_test(guard_dir, guard_log)

        TargetHandler.requests = []
        server = ThreadingHTTPServer(("127.0.0.1", 0), TargetHandler)
        thread = threading.Thread(target=server.serve_forever, daemon=True)
        thread.start()
        try:
            endpoint = f"http://127.0.0.1:{server.server_port}{TARGET_PATH}"
            path_dirs = [fake_bin, Path(bash).parent, Path(uv).parent]
            for name in ("dirname", "git", "rm", "sleep"):
                if executable := shutil.which(name):
                    path_dirs.append(Path(executable).parent)
            environment = {
                "PATH": os.pathsep.join(dict.fromkeys(map(str, path_dirs))),
                "HOME": str(root / "home"),
                "TMPDIR": str(root / "tmp"),
                "PYTHONPATH": str(guard_dir),
                "LC_ALL": "C",
                "UV_OFFLINE": "true",
                "UV_NO_CONFIG": "1",
                "DEEPEVAL_TELEMETRY_OPT_OUT": "true",
                "EVAL_NETWORK_GUARD_LOG": str(guard_log),
                "KLICKER_TEST_INFISICAL_LOG": str(infisical_log),
                "KLICKER_EVAL_CONFIG": str(root / "missing config.json"),
                "EVAL_API_MODE": "chat-completions",
                "EVAL_ENDPOINT_URL": endpoint,
                "EVAL_API_KEY": API_KEY,
                "EVAL_STREAM": "false",
                "AGENT_ID": MODEL,
                "EVAL_EVIDENCE_PROFILE": "generic",
                "EVAL_OUTPUT_DIR": str(output_dir),
                "EVAL_TOOLS_PATH": str(tools),
                "EVAL_METRICS_PATH": str(metrics),
                "GT_ROOT_DIR": str(gt_dir),
                "DEFAULT_GT_DIR": str(gt_dir),
                "TOOL_PROFILE": "catalog_expert_v1",
            }
            completed = subprocess.run(
                [
                    bash,
                    str(WRAPPER),
                    "--mode",
                    "query",
                    "--gt-dir",
                    str(gt_dir),
                    "--agent-id",
                    MODEL,
                    "--limit",
                    "1",
                    "--query-timeout",
                    "5",
                ],
                cwd=caller,
                env=environment,
                capture_output=True,
                text=True,
                timeout=30,
                check=False,
            )
            require(
                completed.returncode == 0,
                f"launcher failed: {(completed.stdout + completed.stderr)[-4000:]}",
            )
        finally:
            server.shutdown()
            server.server_close()
            thread.join(timeout=5)

        require(len(TargetHandler.requests) == 1, "expected one target request")
        path, authorization, body = TargetHandler.requests[0]
        require(
            path == TARGET_PATH and authorization == f"Bearer {API_KEY}",
            "target contract failed",
        )
        require(
            body["model"] == MODEL and body["stream"] is False,
            "query body contract failed",
        )
        qa_files = list((output_dir / "qa_pairs").glob("*.json"))
        require(len(qa_files) == 1, "expected one QA artifact")
        result = json.loads(qa_files[0].read_text(encoding="utf-8"))["results"][0]
        require(
            result["actual_answer"] == ANSWER
            and result["actual_calls"] == []
            and result["calls_match"] is True
            and result["success"] is True,
            "artifact failed",
        )
        require(not read_events(guard_log), "blocked network access was attempted")
        require(
            not infisical_log.exists() or not infisical_log.read_text(encoding="utf-8"),
            "Infisical was invoked",
        )

    print(f"PASS: framework {FRAMEWORK_SHA} produced one loopback artifact")
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except (AssertionError, OSError, subprocess.SubprocessError) as error:
        print(f"FAIL: {error}", file=sys.stderr)
        raise SystemExit(1) from error
