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
          (typeof step.uses === 'string' &&
            step.uses.startsWith('alibaba/open-code-review@')) ||
          /ocr-draft-review\.cjs run/.test(step.run ?? '')
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
  const runIndex = job.steps.findIndex((step) => step.id === 'review')
  const uploadIndex = job.steps.findIndex((step) =>
    step.uses?.startsWith('actions/upload-artifact@')
  )
  assert.ok(runIndex >= 0 && uploadIndex > runIndex)
  const upload = job.steps[uploadIndex]
  const paths = upload.with.path.trim().split('\n')
  assert.deepEqual(paths, [
    '${{ runner.temp }}/draft-ai-review-adapter-diagnostics.jsonl',
    '${{ runner.temp }}/draft-ai-review-outcome.json',
    '${{ runner.temp }}/draft-ai-review-tools.json',
    '${{ runner.temp }}/draft-ai-review-advisor-expectations.json',
    '${{ runner.temp }}/draft-ai-review-advisor-diagnostics.jsonl',
  ])
  assert.equal(upload.if, 'always()')
  assert.equal(
    upload.uses,
    'actions/upload-artifact@ea165f8d65b6e75b540449e92b4886f43607fa02'
  )
  assert.equal(upload.with['retention-days'], 7)
  assert.equal(upload.with['if-no-files-found'], 'warn')
})

test('routes automatic drafts through Mistral Flash without changing the final provider', () => {
  const job = YAML.parse(
    fs.readFileSync(
      path.join(__dirname, '../workflows/check-ocr-review.yml'),
      'utf8'
    )
  ).jobs['ocr-review']
  assert.equal(job.env.OCR_ADAPTER_PROVIDER, 'mistral-flash')
  const run = job.steps.find((step) => step.id === 'review')
  assert.equal(run.env.MISTRAL_API_KEY, '${{ secrets.MISTRAL_API_KEY }}')
  assert.equal(run.env.OPENROUTER_API_KEY, undefined)
  assert.equal(run.env.CONTEXT7_API_KEY, '${{ secrets.CONTEXT7_API_KEY }}')
  const publisher = job.steps.find(
    (step) => step.with?.repository === 'alibaba/open-code-review'
  )
  assert.equal(publisher.with.ref, '1672852136fc87748249d22bce0819f33419ea79')
  assert.equal(publisher.with['persist-credentials'], false)
  assert.ok(
    job.steps.some((step) =>
      step.run?.includes(
        'npm install -g @alibaba-group/open-code-review@1.13.0'
      )
    )
  )
  const summary = job.steps.find((step) =>
    step.run?.endsWith('ocr-draft-review.cjs summary')
  )
  assert.equal(summary.if, 'always()')
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
