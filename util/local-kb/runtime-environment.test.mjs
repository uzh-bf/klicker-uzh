import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

test('isolated environment refuses missing settings and preserves values across defaults', () => {
  const helper = fileURLToPath(
    new URL('./runtime-environment.sh', import.meta.url)
  )
  const result = spawnSync(
    'bash',
    [
      '-c',
      `
set -euo pipefail
. "$1"
if local_kb_capture_environment >/dev/null 2>&1; then exit 9; fi
for key in "\${LOCAL_KB_ENV_KEYS[@]}"; do export "$key=synthetic"; done
export DATABASE_URL="$EXPECTED_DATABASE"
export DOC_QUERY_SCOPE_PRIVATE_KEY="$EXPECTED_KEY"
local_kb_capture_environment
for key in "\${LOCAL_KB_ENV_KEYS[@]}"; do export "$key=wrong-default"; done
local_kb_restore_environment
[ "$DATABASE_URL" = "$EXPECTED_DATABASE" ]
[ "$DOC_QUERY_SCOPE_PRIVATE_KEY" = "$EXPECTED_KEY" ]
[ "$KB_INGESTION_API_URL" = synthetic ]
`,
      '--',
      helper,
    ],
    {
      encoding: 'utf8',
      env: {
        PATH: process.env.PATH,
        EXPECTED_DATABASE:
          'postgresql://local:synthetic@postgres/klicker?schema=public',
        EXPECTED_KEY:
          'synthetic key with spaces\nand=punctuation;not-a-command',
      },
    }
  )
  assert.equal(result.status, 0, result.stderr)
  assert.equal(result.stdout, '')
})
