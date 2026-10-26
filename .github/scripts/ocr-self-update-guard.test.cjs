const assert = require('node:assert/strict')
const { execFileSync } = require('node:child_process')
const fs = require('node:fs')
const path = require('node:path')
const test = require('node:test')
const YAML = require('yaml')

const root = path.join(__dirname, '../..')
const workflowDir = path.join(root, '.github/workflows')

function loadPinnedDraftPolicy() {
  const workflow = YAML.parse(
    fs.readFileSync(path.join(workflowDir, 'check-ocr-review.yml'), 'utf8')
  )
  const job = workflow.jobs['ocr-review']
  const actionStep = (job.steps ?? []).find(
    (step) =>
      typeof step.uses === 'string' &&
      step.uses.startsWith('uzh-bf/klicker-uzh/.github/actions/ocr-review@')
  )
  assert.ok(actionStep, 'expected the pinned OCR composite action')

  const match =
    /^uzh-bf\/klicker-uzh\/\.github\/actions\/ocr-review@([0-9a-f]{40})$/.exec(
      actionStep.uses
    )
  assert.ok(
    match,
    'expected the OCR action in the fixed namespace at a full SHA'
  )

  const revision = match[1]
  const readPinned = (file) =>
    execFileSync('git', ['show', `${revision}:${file}`], {
      cwd: root,
      encoding: 'utf8',
    })
  const action = YAML.parse(readPinned('.github/actions/ocr-review/action.yml'))
  const manifest = YAML.parse(
    readPinned('.github/open-code-review/runtime-manifest.json')
  )

  return { job, actionStep, action, manifest }
}

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
            (step.uses.startsWith('alibaba/open-code-review@') ||
              step.uses.startsWith(
                'uzh-bf/klicker-uzh/.github/actions/ocr-review@'
              ))) ||
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
  assert.ok(guarded.includes('check-ocr-review.yml:ocr-review'))
})

test('preserves draft cancellation, publication and diagnostics policy', () => {
  const { action } = loadPinnedDraftPolicy()
  assert.equal(action.runs.using, 'composite')
  const validation = action.runs.steps.find((step) => step.id === 'validate')
  const publication = action.runs.steps.find((step) =>
    step.with?.script?.includes('publishReview')
  )
  assert.equal(
    validation.if,
    "${{ !cancelled() && (steps.review.outcome == 'success' || steps.review.outcome == 'failure') }}"
  )
  assert.equal(
    publication.if,
    "${{ !cancelled() && steps.validate.outcome == 'success' }}"
  )
  const runIndex = action.runs.steps.findIndex((step) => step.id === 'review')
  const uploadIndex = action.runs.steps.findIndex((step) =>
    step.uses?.startsWith('actions/upload-artifact@')
  )
  assert.ok(runIndex >= 0 && uploadIndex > runIndex)
  const upload = action.runs.steps[uploadIndex]
  const paths = upload.with.path.trim().split('\n')
  assert.deepEqual(paths, [
    '${{ runner.temp }}/draft-ai-review-adapter-diagnostics.jsonl',
    '${{ runner.temp }}/draft-ai-review-adapter-diagnostics.jsonl.events.jsonl',
    '${{ runner.temp }}/draft-ai-review-outcome.json',
    '${{ runner.temp }}/draft-ai-review-tools.json',
    '${{ runner.temp }}/draft-ai-review-advisor-expectations.json',
    '${{ runner.temp }}/draft-ai-review-advisor-diagnostics.jsonl',
    '${{ runner.temp }}/draft-ai-review-advisor-diagnostics.jsonl.events.jsonl',
    '${{ runner.temp }}/ocr-runtime-identity.json',
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
  const { job, actionStep, action, manifest } = loadPinnedDraftPolicy()
  assert.equal(job.env.OCR_ADAPTER_PROVIDER, 'mistral-flash')
  assert.deepEqual(actionStep.with, {
    'mistral-api-key': '${{ secrets.MISTRAL_API_KEY }}',
    'context7-api-key': '${{ secrets.CONTEXT7_API_KEY }}',
    'github-token': '${{ github.token }}',
  })
  const trustedCheckout = action.runs.steps.find(
    (step) =>
      step.uses?.startsWith('actions/checkout@') &&
      step.with?.repository === '${{ github.repository }}'
  )
  assert.equal(trustedCheckout.with.token, '${{ inputs.github-token }}')
  assert.equal(
    trustedCheckout.with.ref,
    '${{ github.event.repository.default_branch }}'
  )
  assert.equal(trustedCheckout.with['persist-credentials'], false)
  assert.equal(trustedCheckout.with['fetch-depth'], 0)
  assert.equal(trustedCheckout.with['sparse-checkout'], undefined)
  assert.equal(trustedCheckout.with.filter, undefined)
  const run = action.runs.steps.find((step) => step.id === 'review')
  assert.equal(run.env.MISTRAL_API_KEY, '${{ inputs.mistral-api-key }}')
  assert.equal(run.env.OPENROUTER_API_KEY, undefined)
  assert.equal(run.env.CONTEXT7_API_KEY, '${{ inputs.context7-api-key }}')
  assert.equal(run.env.OCR_ADAPTER_PROVIDER, 'mistral-flash')
  const publisher = action.runs.steps.find(
    (step) => step.with?.repository === 'alibaba/open-code-review'
  )
  assert.equal(
    publisher.with.ref,
    '${{ steps.release.outputs.publisher-revision }}'
  )
  assert.equal(publisher.with['persist-credentials'], false)
  const install = action.runs.steps.find((step) =>
    step.run?.includes('npm install -g')
  )
  assert.equal(install.env.OCR_PACKAGE, '${{ steps.release.outputs.package }}')
  assert.ok(install.run.includes('npm install -g "${OCR_PACKAGE}"'))
  assert.equal(install.env.OCR_NO_UPDATE, '1')
  assert.equal(manifest.draft.package, '@alibaba-group/open-code-review@1.13.0')
  const summary = action.runs.steps.find((step) =>
    step.run?.endsWith('ocr-draft-review.cjs summary')
  )
  assert.equal(summary, undefined)
  const controllerSummary = action.runs.steps.find((step) =>
    step.run?.endsWith('ocr-controller.cjs" summary')
  )
  assert.equal(controllerSummary.if, 'always()')
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
