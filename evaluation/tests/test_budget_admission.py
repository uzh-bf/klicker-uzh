"""Synthetic consumer contracts; the private framework integration is opt-in."""

import json
import os
import subprocess
import sys
import threading
from contextlib import contextmanager
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "evaluation" / "adapters"))

from budget_admission import BudgetAdmission, BudgetAdmissionError  # noqa: E402

BUDGET_MODULE = (ROOT / "evaluation" / "evaluation-budget.mjs").as_uri()
POLICY_HASH = "a" * 64
MODEL = "synthetic-model"


def node(source, *arguments):
    result = subprocess.run(
        ["node", "--input-type=module", "-e", source, *map(str, arguments)],
        capture_output=True,
        text=True,
        timeout=10,
        check=True,
    )
    return json.loads(result.stdout) if result.stdout.strip() else None


@pytest.fixture
def ledger(tmp_path):
    path = tmp_path / "budget.json"
    node(
        f"import {{initializeBudget}} from {json.dumps(BUDGET_MODULE)};"
        "await initializeBudget(process.argv[1], process.argv[2]);",
        path,
        POLICY_HASH,
    )
    return path


def read_ledger(path):
    return json.loads(path.read_text())


def reserve(path, amount=100):
    node(
        f"import {{reserveProviderSpend}} from {json.dumps(BUDGET_MODULE)};"
        "await reserveProviderSpend(process.argv[1],process.argv[2],Number(process.argv[3]));",
        path,
        POLICY_HASH,
        amount,
    )


def admission(path, **kwargs):
    return BudgetAdmission(
        path, policy_hash=POLICY_HASH, model=MODEL, max_output_tokens=64, **kwargs
    )


def test_admitted_turn_reserves_and_releases_live_lease(ledger):
    with admission(ledger) as admit:
        with admit(turn_index=1, model=MODEL, max_output_tokens=64):
            reserve(ledger)
            assert read_ledger(ledger)["uncertain"]
        assert read_ledger(ledger)["activeTurn"] is None
    state = read_ledger(ledger)
    assert state["submittedTurns"] == 1
    assert state["reservedProviderMicroUsd"] == 100
    assert state["creditsUsed"] == 0
    assert not Path(str(ledger) + ".run").exists()
    assert not Path(str(ledger) + ".lease").exists()


@pytest.mark.parametrize("failure", [RuntimeError, KeyboardInterrupt])
def test_failed_turn_keeps_uncertainty_and_reservation(ledger, failure):
    with pytest.raises(failure):
        with admission(ledger) as admit:
            with admit(turn_index=1, model=MODEL, max_output_tokens=64):
                reserve(ledger)
                raise failure("synthetic")
    state = read_ledger(ledger)
    assert state["uncertain"] and state["activeTurn"]
    assert state["reservedProviderMicroUsd"] == 100
    assert not Path(str(ledger) + ".run").exists()
    with pytest.raises(BudgetAdmissionError):
        with admission(ledger):
            pytest.fail("uncertain allowance admitted")


@pytest.mark.parametrize(
    "model,bound", [("other-model", 64), (MODEL, 65), (MODEL, True)]
)
def test_configuration_mismatch_does_not_consume_turn(ledger, model, bound):
    with pytest.raises(BudgetAdmissionError):
        with admission(ledger) as admit:
            with admit(turn_index=1, model=model, max_output_tokens=bound):
                pytest.fail("mismatched request admitted")
    assert read_ledger(ledger)["submittedTurns"] == 0


def test_each_finished_turn_requires_its_own_reservation(ledger):
    with pytest.raises(BudgetAdmissionError):
        with admission(ledger) as admit:
            with admit(turn_index=1, model=MODEL, max_output_tokens=64):
                reserve(ledger)
            with admit(turn_index=2, model=MODEL, max_output_tokens=64):
                pass
    state = read_ledger(ledger)
    assert state["submittedTurns"] == 2
    assert state["uncertain"] and state["activeTurn"]
    assert state["reservedProviderMicroUsd"] == 100


def test_competing_run_and_wrong_policy_are_refused(ledger):
    with admission(ledger):
        with pytest.raises(BudgetAdmissionError):
            with admission(ledger):
                pytest.fail("overlapping run admitted")
    with pytest.raises(BudgetAdmissionError):
        with BudgetAdmission(
            ledger, policy_hash="b" * 64, model=MODEL, max_output_tokens=64
        ):
            pytest.fail("different policy admitted")
    assert read_ledger(ledger)["submittedTurns"] == 0


def test_exhausted_budget_is_not_extended(ledger):
    node(
        f"import {{mutateBudget}} from {json.dumps(BUDGET_MODULE)};"
        "await mutateBudget(process.argv[1],ledger=>{ledger.submittedTurns=ledger.maxSubmittedTurns});",
        ledger,
    )
    before = ledger.read_bytes()
    with pytest.raises(BudgetAdmissionError):
        with admission(ledger):
            pytest.fail("exhausted allowance admitted")
    assert ledger.read_bytes() == before


@pytest.mark.parametrize(
    "command", ["begin\nbegin\n", "finish\n", "unknown\n", "x" * 65, "begin"]
)
def test_invalid_protocol_stops_and_releases_run(ledger, command):
    result = subprocess.run(
        [
            "node",
            str(ROOT / "evaluation/evaluation-budget.mjs"),
            "--admission-session",
            str(ledger),
            POLICY_HASH,
        ],
        input=command,
        capture_output=True,
        text=True,
        timeout=10,
    )
    assert result.returncode != 0
    assert "error budget_" in result.stdout
    assert not Path(str(ledger) + ".run").exists()


def test_eof_during_turn_preserves_uncertainty(ledger):
    result = subprocess.run(
        [
            "node",
            str(ROOT / "evaluation/evaluation-budget.mjs"),
            "--admission-session",
            str(ledger),
            POLICY_HASH,
        ],
        input="begin\n",
        capture_output=True,
        text=True,
        timeout=10,
    )
    assert result.returncode == 0
    assert read_ledger(ledger)["activeTurn"]
    assert not Path(str(ledger) + ".run").exists()


def test_lost_finish_ack_keeps_commit_and_stops_further_admission(ledger):
    result = node(
        f"import {{runAdmissionSession,reserveProviderSpend,readBudgetLedger}} from {json.dumps(BUDGET_MODULE)};"
        "import {PassThrough,Writable} from 'node:stream';"
        "const input=new PassThrough(); let replies=0;"
        "const output=new Writable({write(chunk,encoding,done){replies++;"
        "if(replies===1){input.write('begin\\n');done();}"
        "else if(replies===2){reserveProviderSpend(process.argv[1],process.argv[2],100)"
        ".then(()=>{input.end('finish\\nbegin\\n');done()}).catch(done);}"
        "else {done(Object.assign(new Error('synthetic lost acknowledgement'),{code:'EPIPE'}));}}});"
        "output.on('error',()=>{});"
        "const result=await runAdmissionSession({budgetFile:process.argv[1],policyHash:process.argv[2],input,output});"
        "console.log(JSON.stringify({status:result.status,ledger:await readBudgetLedger(process.argv[1])}));",
        ledger,
        POLICY_HASH,
    )
    assert result["status"] != "closed"
    assert result["ledger"]["submittedTurns"] == 1
    assert result["ledger"]["activeTurn"] is None
    assert result["ledger"]["reservedProviderMicroUsd"] == 100
    assert not Path(str(ledger) + ".run").exists()


@pytest.fixture
def framework():
    if os.environ.get("KLICKER_EVAL_FRAMEWORK_INTEGRATION") != "1":
        pytest.skip("private-framework integration not requested")
    source = ROOT / "evaluation/framework/src"
    assert (source / "evaluators/query_agent.py").is_file(), (
        "initialize the pinned framework"
    )
    sys.path.insert(0, str(source))
    from clients import create_client
    from evaluators.query_agent import capture_conversation

    return create_client, capture_conversation


@contextmanager
def guarded_provider(tmp_path, *, fail_second=False):
    requests_seen = []

    class Handler(BaseHTTPRequestHandler):
        def do_POST(self):
            body = json.loads(self.rfile.read(int(self.headers["Content-Length"])))
            requests_seen.append((self.path, body))
            failed = fail_second and len(requests_seen) == 2
            if self.path.endswith("responses"):
                payload = {
                    "status": "incomplete" if failed else "completed",
                    "output": [
                        {
                            "type": "message",
                            "content": [
                                {"type": "output_text", "text": "Synthetic answer"}
                            ],
                        }
                    ],
                    "usage": {"input_tokens": 10, "output_tokens": 5},
                }
            else:
                payload = {
                    "choices": [
                        {
                            "message": {
                                "role": "assistant",
                                "content": "Synthetic answer",
                            },
                            "finish_reason": "length" if failed else "stop",
                        }
                    ],
                    "usage": {"prompt_tokens": 10, "completion_tokens": 5},
                }
            encoded = json.dumps(payload).encode()
            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self.send_header("Content-Length", str(len(encoded)))
            self.end_headers()
            self.wfile.write(encoded)

        def log_message(self, *args):
            pass

    provider = ThreadingHTTPServer(("127.0.0.1", 0), Handler)
    thread = threading.Thread(target=provider.serve_forever, daemon=True)
    thread.start()
    policy = {
        "version": 1,
        "provider": "synthetic",
        "upstreamOrigin": f"http://127.0.0.1:{provider.server_port}/v1",
        "qualification": "Synthetic offline fixture only",
        "models": {
            MODEL: {
                "contextTokens": 1000,
                "maxOutputTokens": 64,
                "inputMicroUsdPerMillion": 1_000_000,
                "outputMicroUsdPerMillion": 1_000_000,
                "outputIncludesReasoning": True,
            }
        },
    }
    path = tmp_path / "guard-budget.json"
    script = (
        f"import {{initializeBudget,fingerprint}} from {json.dumps(BUDGET_MODULE)};"
        f"import {{createSpendGuard}} from {json.dumps((ROOT / 'evaluation/evaluation-spend-guard.mjs').as_uri())};"
        "const policy=JSON.parse(process.argv[1]); const budgetFile=process.argv[2];"
        "await initializeBudget(budgetFile,fingerprint(policy));"
        "const guard=await createSpendGuard({policy,budgetFile,apiKey:'synthetic-key',"
        "upstreamOrigin:policy.upstreamOrigin,upstreamKey:'synthetic-upstream'});"
        "await new Promise(r=>guard.listen(0,'127.0.0.1',r));"
        "console.log(JSON.stringify({origin:'http://127.0.0.1:'+guard.address().port,policyHash:fingerprint(policy)}));"
        "process.stdin.resume(); process.stdin.on('end',()=>guard.close());"
    )
    process = subprocess.Popen(
        ["node", "--input-type=module", "-e", script, json.dumps(policy), str(path)],
        stdin=subprocess.PIPE,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        text=True,
    )
    try:
        import select

        assert select.select([process.stdout], [], [], 5)[0], (
            "guard fixture did not start"
        )
        status = json.loads(process.stdout.readline())
        yield path, status, requests_seen
    finally:
        process.stdin.close()
        try:
            process.wait(timeout=5)
        except subprocess.TimeoutExpired:
            process.kill()
            process.wait(timeout=5)
        process.stdout.close()
        process.stderr.close()
        provider.shutdown()
        provider.server_close()
        thread.join(timeout=5)


@pytest.mark.parametrize(
    "api_mode,endpoint,body_key,bound_key",
    [
        ("responses", "responses", "input", "max_output_tokens"),
        ("chat-completions", "chat/completions", "messages", "max_completion_tokens"),
    ],
)
def test_real_capture_replays_only_under_guarded_turns(
    framework, tmp_path, api_mode, endpoint, body_key, bound_key
):
    create_client, capture = framework
    with guarded_provider(tmp_path) as (path, status, requests_seen):
        client = create_client(
            api_mode,
            status["origin"] + "/v1/" + endpoint,
            "synthetic-key",
            stream=False,
            max_output_tokens=64,
        )
        with BudgetAdmission(
            path, policy_hash=status["policyHash"], model=MODEL, max_output_tokens=64
        ) as admit:
            artifact = capture(
                client=client,
                model=MODEL,
                system_prompt="Synthetic instruction",
                user_turns=["Synthetic question", "Synthetic revision"],
                max_attempts=2,
                admission_factory=admit,
                query_timeout=5,
                conversation_id="synthetic-conversation",
            )
        assert artifact["results"][0]["assessment_eligible"]
        assert len(requests_seen) == 2
        assert all(body[bound_key] == 64 for _, body in requests_seen)
        history = requests_seen[1][1][body_key]
        assert [message["role"] for message in history] == [
            "system",
            "user",
            "assistant",
            "user",
        ]
        state = read_ledger(path)
        assert state["submittedTurns"] == 2
        assert state["reservedProviderMicroUsd"] == 2128
        assert not state["uncertain"] and state["activeTurn"] is None


def test_real_capture_failure_stops_and_outer_context_reports_it(framework, tmp_path):
    create_client, capture = framework
    with guarded_provider(tmp_path, fail_second=True) as (path, status, requests_seen):
        client = create_client(
            "chat-completions",
            status["origin"] + "/v1/chat/completions",
            "synthetic-key",
            stream=False,
            max_output_tokens=64,
        )
        with pytest.raises(BudgetAdmissionError):
            with BudgetAdmission(
                path,
                policy_hash=status["policyHash"],
                model=MODEL,
                max_output_tokens=64,
            ) as admit:
                artifact = capture(
                    client=client,
                    model=MODEL,
                    system_prompt="",
                    user_turns=["Synthetic first", "Synthetic second", "Must not send"],
                    max_attempts=3,
                    admission_factory=admit,
                    query_timeout=5,
                    conversation_id="synthetic-failure",
                )
        assert not artifact["results"][0]["assessment_eligible"]
        assert artifact["results"][0]["capture"]["steps"][2]["status"] == "not_started"
        assert len(requests_seen) == 2
        state = read_ledger(path)
        assert state["reservedProviderMicroUsd"] == 2128
        assert state["uncertain"] and state["activeTurn"]


def test_real_capture_cannot_hide_an_admission_error(framework, ledger):
    create_client, capture = framework
    client = create_client(
        "chat-completions",
        "http://127.0.0.1:1/v1/chat/completions",
        "synthetic-key",
        stream=False,
        max_output_tokens=65,
    )
    with pytest.raises(BudgetAdmissionError):
        with admission(ledger) as admit:
            artifact = capture(
                client=client,
                model=MODEL,
                system_prompt="",
                user_turns=["Synthetic question"],
                max_attempts=1,
                admission_factory=admit,
                query_timeout=1,
                conversation_id="synthetic-mismatch",
            )
    assert artifact["results"][0]["capture"]["attempts"] == 0
    assert not artifact["results"][0]["assessment_eligible"]
    assert read_ledger(ledger)["submittedTurns"] == 0
