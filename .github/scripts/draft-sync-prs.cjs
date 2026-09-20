const REPOSITORY = 'uzh-bf/klicker-uzh'
const PAIRS = [
  { head: 'v3', base: 'v3-ai' },
  { head: 'v3-ai', base: 'v3-audit' },
]

function acceptsEvent(context) {
  if (`${context.repo.owner}/${context.repo.repo}` !== REPOSITORY) return false
  if (context.ref !== 'refs/heads/v3') return false
  if (context.eventName === 'workflow_dispatch') return true
  const run = context.payload.workflow_run
  return (
    context.eventName === 'workflow_run' &&
    context.payload.action === 'completed' &&
    run?.event === 'push' &&
    run.name === 'Check codebase' &&
    run.head_repository?.full_name === REPOSITORY &&
    PAIRS.some(({ head }) => head === run.head_branch)
  )
}

async function maintainDraftSyncPrs({ github, context, dryRun = true }) {
  if (!acceptsEvent(context)) return []
  const repo = context.repo
  const results = []

  for (const { head, base } of PAIRS) {
    const findExisting = async () => {
      const prs = await github.paginate(github.rest.pulls.list, {
        ...repo,
        state: 'open',
        head: `${repo.owner}:${head}`,
        base,
        per_page: 100,
      })
      return prs.find(
        (pr) =>
          pr.head.ref === head &&
          pr.base.ref === base &&
          pr.head.repo?.full_name === REPOSITORY &&
          pr.base.repo?.full_name === REPOSITORY
      )
    }

    const existing = await findExisting()
    if (existing) {
      results.push({ head, base, action: 'existing', number: existing.number })
      continue
    }

    // Read current branches rather than replaying the triggering run's old SHA.
    const { data: comparison } =
      await github.rest.repos.compareCommitsWithBasehead({
        ...repo,
        basehead: `${base}...${head}`,
        per_page: 1,
      })
    if (comparison.ahead_by === 0 || comparison.files?.length === 0) {
      results.push({ head, base, action: 'up-to-date' })
      continue
    }
    if (dryRun) {
      results.push({ head, base, action: 'would-create' })
      continue
    }

    try {
      const { data: pr } = await github.rest.pulls.create({
        ...repo,
        head,
        base,
        draft: true,
        title: `chore(sync): merge ${head} into ${base}`,
        body: [
          `Integrate \`${head}\` into \`${base}\`. This draft follows the source branch automatically.`,
          '',
          'Mark ready when the accumulated changes should be reviewed and validated for integration. Use a merge commit to preserve branch ancestry.',
          '',
          'Creation is automated; readiness, conflict resolution, and merging remain manual. Some checks still run for drafts. If GitHub requests workflow approval, approve the runs before relying on their results.',
        ].join('\n'),
      })
      results.push({ head, base, action: 'created', number: pr.number })
    } catch (error) {
      if (error.status !== 422) throw error
      // A maintainer or another caller may have created the same PR meanwhile.
      const concurrent = await findExisting()
      if (!concurrent) throw error
      results.push({
        head,
        base,
        action: 'existing',
        number: concurrent.number,
      })
    }
  }
  return results
}

module.exports = { acceptsEvent, maintainDraftSyncPrs }
