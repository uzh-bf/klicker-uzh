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
