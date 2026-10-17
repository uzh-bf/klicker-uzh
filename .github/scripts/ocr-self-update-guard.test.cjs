const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const test = require('node:test')
const YAML = require('yaml')

const root = path.join(__dirname, '../..')
const workflowDir = path.join(root, '.github/workflows')

// The OpenCodeReview CLI starts a detached `npm i -g <latest>` on its first
// invocation unless OCR_NO_UPDATE is set. That global reinstall deletes and
// re-extracts the package while the same job is starting its review, so the
// review dies on a module-resolution error. Any job running the action without
// the guard also silently reviews with a self-updated version instead of the
// pinned ocr_version.
test('every OpenCodeReview job disables the CLI self-update', () => {
  const workflowNames = fs
    .readdirSync(workflowDir)
    .filter((name) => name.endsWith('.yml') || name.endsWith('.yaml'))

  const guarded = []

  for (const name of workflowNames) {
    const workflow = YAML.parse(
      fs.readFileSync(path.join(workflowDir, name), 'utf8')
    )

    for (const [jobName, job] of Object.entries(workflow.jobs ?? {})) {
      const ocrSteps = (job.steps ?? []).filter(
        (step) =>
          typeof step.uses === 'string' &&
          step.uses.startsWith('alibaba/open-code-review@')
      )
      if (ocrSteps.length === 0) continue

      guarded.push(`${name}:${jobName}`)

      const jobGuard =
        String(job.env?.OCR_NO_UPDATE ?? '')
          .trim()
          .toLowerCase() === '1' || job.env?.OCR_NO_UPDATE === 1

      for (const step of ocrSteps) {
        const stepGuard =
          String(step.env?.OCR_NO_UPDATE ?? '')
            .trim()
            .toLowerCase() === '1' || step.env?.OCR_NO_UPDATE === 1
        assert.ok(
          jobGuard || stepGuard,
          `${name} job ${jobName} runs the OpenCodeReview action without OCR_NO_UPDATE: '1'`
        )
      }
    }
  }

  assert.ok(
    guarded.length > 0,
    'expected at least one job to run the OpenCodeReview action'
  )
})

test('attempts draft diagnostics upload even after startup failure', () => {
  const job = YAML.parse(
    fs.readFileSync(
      path.join(__dirname, '../workflows/check-ocr-review.yml'),
      'utf8'
    )
  ).jobs['ocr-review']
  const start = job.steps.find((step) => step.id === 'adapter')
  const diagnosticsPath = start.env.OCR_ADAPTER_DIAGNOSTICS_PATH
  const stopIndex = job.steps.findIndex((step) =>
    step.run?.includes('stop "${ADAPTER_STATE}"')
  )
  const uploadIndex = job.steps.findIndex((step) =>
    step.uses?.startsWith('actions/upload-artifact@')
  )
  assert.ok(diagnosticsPath.includes('runner.temp'))
  assert.ok(
    diagnosticsPath.endsWith('/draft-ai-review-adapter-diagnostics.jsonl')
  )
  assert.ok(stopIndex >= 0)
  assert.ok(uploadIndex > stopIndex)
  const upload = job.steps[uploadIndex]
  assert.equal(upload.with.path, diagnosticsPath)
  assert.equal(upload.if, 'always()')
  assert.equal(
    upload.uses,
    'actions/upload-artifact@ea165f8d65b6e75b540449e92b4886f43607fa02'
  )
  assert.equal(upload.with['retention-days'], 7)
  assert.equal(upload.with['if-no-files-found'], 'warn')
})

test('routes automatic drafts through the pinned adapter with OpenRouter max reasoning', () => {
  const job = YAML.parse(
    fs.readFileSync(
      path.join(__dirname, '../workflows/check-ocr-review.yml'),
      'utf8'
    )
  ).jobs['ocr-review']
  assert.equal(job.env.OCR_ADAPTER_PROVIDER, 'openrouter')
  const startIndex = job.steps.findIndex((step) => step.id === 'adapter')
  const actionIndex = job.steps.findIndex((step) =>
    step.uses?.startsWith('alibaba/open-code-review@')
  )
  assert.ok(startIndex >= 0 && actionIndex > startIndex)
  const action = job.steps[actionIndex]
  assert.equal(
    action.uses,
    'alibaba/open-code-review@1672852136fc87748249d22bce0819f33419ea79'
  )
  assert.equal(action.with.llm_model, 'deepseek/deepseek-v4.1-flash-1017')
  assert.equal(action.with.ocr_version, '1.13.0')
  assert.deepEqual(JSON.parse(action.with.llm_extra_body), {
    reasoning_effort: 'max',
    prompt_cache_key: '{ocr_session_key}',
  })
  assert.equal(action.with.llm_auth_token, '${{ steps.adapter.outputs.token }}')
  assert.equal(
    job.steps[startIndex].env.OPENROUTER_API_KEY,
    '${{ secrets.OPENROUTER_API_KEY }}'
  )
  assert.equal(job.steps[startIndex].env.MISTRAL_API_KEY, undefined)
  const stop = job.steps.find((step) =>
    step.run?.includes('stop "${ADAPTER_STATE}"')
  )
  assert.equal(stop.if, "always() && steps.adapter.outcome == 'success'")
  const summary = job.steps.find((step) => step.run?.includes(' summary '))
  assert.equal(summary.env.OCR_ADAPTER_PROVIDER, undefined)
  const manual = YAML.parse(
    fs.readFileSync(
      path.join(__dirname, '../workflows/check-ocr-final-review.yml'),
      'utf8'
    )
  )
  for (const finalJob of Object.values(manual.jobs)) {
    assert.equal(finalJob.env?.OCR_ADAPTER_PROVIDER, undefined)
    for (const step of finalJob.steps ?? [])
      assert.equal(step.env?.OCR_ADAPTER_PROVIDER, undefined)
  }
})
