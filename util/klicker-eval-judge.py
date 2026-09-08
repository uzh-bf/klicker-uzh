#!/usr/bin/env python3
"""Run the disposable, loopback-only LiteLLM evaluation judge.

The upstream values are deliberately sent through the container bootstrap's
stdin. They are never included in Docker environment metadata, command-line
arguments, or launcher output.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import os
import shutil
import signal
import subprocess
import sys
from collections.abc import Mapping, Sequence
from pathlib import Path
from types import FrameType

REPO_ROOT = Path(__file__).resolve().parents[1]
CONFIG_PATH = REPO_ROOT / "evaluation" / "litellm.yaml"
IMAGE = (
    "ghcr.io/berriai/litellm-database:v1.96.2"
    "@sha256:80e5e92bdcca246cd4153d451e5f75b65e19c7e39c46cc88a38bed4b65cc5836"
)
CONTAINER_CONFIG_PATH = "/app/config.yaml"
CONTAINER_PORT = "4000"
REQUIRED_CREDENTIALS = ("AZURE_OPENAI_BASE_URL", "AZURE_OPENAI_API_KEY")
UPSTREAM_ENVIRONMENT = frozenset(
    {
        "AZURE_OPENAI_BASE_URL",
        "AZURE_OPENAI_API_KEY",
        "UPSTREAM_OPENAI_BASE_URL",
        "UPSTREAM_OPENAI_API_KEY",
        "OPENAI_API_KEY",
    }
)

# This source is passed as a command argument, but it contains no values from
# the host environment. The first line on stdin is the only credential input.
BOOTSTRAP = r"""
import json
import os
import sys


def fail(message):
    sys.stderr.write("klicker-eval-judge bootstrap: " + message + "\n")
    raise SystemExit(78)


line = sys.stdin.buffer.readline()
if not line:
    fail("credentials input missing")

try:
    values = json.loads(line)
except (TypeError, ValueError):
    fail("credentials input invalid")

required = ("AZURE_OPENAI_BASE_URL", "AZURE_OPENAI_API_KEY")
if not isinstance(values, dict) or set(values) != set(required):
    fail("credentials input invalid")

for name in required:
    value = values[name]
    if (
        not isinstance(value, str)
        or not value.strip()
        or "\x00" in value
        or "\r" in value
        or "\n" in value
    ):
        fail("credentials input invalid")
    os.environ[name] = value

try:
    null_fd = os.open(os.devnull, os.O_RDWR)
    os.dup2(null_fd, 1)
    os.dup2(null_fd, 2)
    if null_fd > 2:
        os.close(null_fd)
    os.execvp(
        "litellm",
        [
            "litellm",
            "--config",
            "/app/config.yaml",
            "--host",
            "0.0.0.0",
            "--port",
            "4000",
        ],
    )
except OSError:
    fail("LiteLLM process unavailable")
""".strip()


def container_name() -> str:
    """Return a per-invocation name derived from this repository path."""

    identity = str(REPO_ROOT.resolve()).encode("utf-8")
    suffix = hashlib.sha256(identity).hexdigest()[:12]
    invocation = os.getpid()
    return f"klicker-eval-judge-{suffix}-{invocation}"


def host_environment(environment: Mapping[str, str] | None = None) -> dict[str, str]:
    """Copy the host environment without forwarding upstream credential values."""

    result = dict(os.environ if environment is None else environment)
    for name in UPSTREAM_ENVIRONMENT:
        result.pop(name, None)
    return result


def select_local_docker(docker: str, environment: dict[str, str]) -> None:
    """Resolve and freeze the daemon endpoint before sending any credentials."""
    context = environment.get("DOCKER_CONTEXT")
    endpoint = environment.get("DOCKER_HOST") if not context else None
    if not endpoint:
        command = [docker, "context", "inspect"]
        if context:
            command.append(context)
        command += ["--format", "{{.Endpoints.docker.Host}}"]
        result = subprocess.run(
            command,
            env=environment,
            capture_output=True,
            text=True,
            timeout=10,
            check=True,
        )
        endpoint = result.stdout.strip()
    if not endpoint.startswith(("unix:///", "npipe:////./pipe/")):
        raise ValueError("Docker must use a local Unix socket or Windows named pipe")
    environment.pop("DOCKER_CONTEXT", None)
    environment["DOCKER_HOST"] = endpoint


def credentials_from_environment(
    environment: Mapping[str, str] | None = None,
) -> tuple[dict[str, str] | None, tuple[str, ...]]:
    values = os.environ if environment is None else environment
    missing = tuple(
        name
        for name in REQUIRED_CREDENTIALS
        if not isinstance(values.get(name), str) or not values[name].strip()
    )
    if missing:
        return None, missing
    return {name: values[name] for name in REQUIRED_CREDENTIALS}, ()


def docker_command(docker: str, name: str) -> list[str]:
    """Build the Docker invocation without embedding any credential values."""

    mount = f"type=bind,source={CONFIG_PATH},target={CONTAINER_CONFIG_PATH},readonly"
    return [
        docker,
        "run",
        "--rm",
        "-i",
        "--name",
        name,
        "--publish",
        "127.0.0.1:4000:4000",
        "--mount",
        mount,
        "--entrypoint",
        "python3",
        IMAGE,
        "-c",
        BOOTSTRAP,
    ]


def stop_container(docker: str, name: str, environment: Mapping[str, str]) -> None:
    """Stop only this launcher's exact named container, suppressing Docker output."""

    try:
        subprocess.run(
            [docker, "stop", "--time", "10", name],
            env=dict(environment),
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
            check=False,
            timeout=15,
        )
    except (OSError, subprocess.SubprocessError):
        # Signal cleanup is best effort. The foreground Docker process still
        # owns --rm and will clean up after a normal exit.
        return


def parse_args(arguments: Sequence[str] | None) -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Run the local, disposable LiteLLM evaluation judge"
    )
    return parser.parse_args(arguments)


def run(arguments: Sequence[str] | None = None) -> int:
    parse_args(arguments)

    credentials, missing = credentials_from_environment()
    if missing:
        for name in missing:
            print(f"missing required upstream setting: {name}", file=sys.stderr)
        return 2

    if not CONFIG_PATH.is_file():
        print("evaluation judge configuration is missing", file=sys.stderr)
        return 2

    docker = shutil.which("docker")
    if docker is None:
        print("docker is required to run the evaluation judge", file=sys.stderr)
        return 2

    name = container_name()
    environment = host_environment()
    try:
        select_local_docker(docker, environment)
    except (ValueError, OSError, subprocess.SubprocessError):
        print(
            "select a local Docker socket context before starting the judge",
            file=sys.stderr,
        )
        return 2
    command = docker_command(docker, name)
    payload = (json.dumps(credentials, separators=(",", ":")) + "\n").encode("utf-8")

    try:
        process = subprocess.Popen(
            command,
            cwd=REPO_ROOT,
            env=environment,
            stdin=subprocess.PIPE,
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
            start_new_session=True,
        )
    except OSError:
        print("could not start the evaluation judge container", file=sys.stderr)
        return 1

    stopping = False

    def handle_signal(signum: int, _frame: FrameType | None) -> None:
        nonlocal stopping
        if stopping:
            return
        stopping = True
        print("stopping evaluation judge", flush=True)
        stop_container(docker, name, environment)

    previous_handlers = {
        signal.SIGINT: signal.getsignal(signal.SIGINT),
        signal.SIGTERM: signal.getsignal(signal.SIGTERM),
    }
    signal.signal(signal.SIGINT, handle_signal)
    signal.signal(signal.SIGTERM, handle_signal)

    try:
        if process.stdin is None:
            print("evaluation judge input channel unavailable", file=sys.stderr)
            process.terminate()
            process.wait()
            return 1
        try:
            process.stdin.write(payload)
            process.stdin.close()
        except (BrokenPipeError, OSError):
            print("evaluation judge stopped before startup", file=sys.stderr)
            return 1

        print(
            f"starting evaluation judge on 127.0.0.1:4000 "
            f"(container {name}); press Ctrl-C to stop",
            flush=True,
        )
        exit_code = process.wait()
        if stopping:
            return 0
        if exit_code == 0:
            return 0
        print("evaluation judge stopped before becoming ready", file=sys.stderr)
        return 1
    finally:
        signal.signal(signal.SIGINT, previous_handlers[signal.SIGINT])
        signal.signal(signal.SIGTERM, previous_handlers[signal.SIGTERM])


def main() -> int:
    return run(sys.argv[1:])


if __name__ == "__main__":
    raise SystemExit(main())
