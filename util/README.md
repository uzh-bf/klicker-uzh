# Util Scripts

## Azure OpenAI Reachability Test

Use `/Users/rolandschlaefli/gitlocal/klicker/klicker-uzh/util/azureOpenAiTest.ts` to verify model reachability for the chat app, with a responses-first flow.

Run from repo root with Infisical dev secrets:

```bash
./util/_run_with_infisical.sh --env dev pnpm --filter @klicker-uzh/graphql exec tsx ../../util/azureOpenAiTest.ts
```

### Common examples

All models from registry (default), responses mode:

```bash
./util/_run_with_infisical.sh --env dev pnpm --filter @klicker-uzh/graphql exec tsx ../../util/azureOpenAiTest.ts --no-stream
```

All models + preview fallback probe on failure:

```bash
./util/_run_with_infisical.sh --env dev pnpm --filter @klicker-uzh/graphql exec tsx ../../util/azureOpenAiTest.ts --no-stream --probe-preview-on-fail
```

Single model with explicit API version override:

```bash
./util/_run_with_infisical.sh --env dev pnpm --filter @klicker-uzh/graphql exec tsx ../../util/azureOpenAiTest.ts --model gpt-5.1 --api-version preview --no-stream
```

Responses + legacy chat comparison:

```bash
./util/_run_with_infisical.sh --env dev pnpm --filter @klicker-uzh/graphql exec tsx ../../util/azureOpenAiTest.ts --no-stream --also-chat
```

JSON output (CI-friendly):

```bash
./util/_run_with_infisical.sh --env dev pnpm --filter @klicker-uzh/graphql exec tsx ../../util/azureOpenAiTest.ts --no-stream --json
```

### Key flags

- `--mode <responses|chat>` primary probe mode (default: `responses`)
- `--all-models` / `--no-all-models` probe all registry models (default: all)
- `--model <id>` select one registry model id
- `--deployment <name>` legacy single deployment mode
- `--api-version <version>` override model/default API version
- `--also-chat` run chat/completions probe in addition to responses
- `--probe-preview-on-fail` retry failed primary responses probe with `api-version=preview` (diagnostic only)
- `--json` emit machine-readable results
- `--stream` / `--no-stream` control streaming
- `--verbose` print SSE events
