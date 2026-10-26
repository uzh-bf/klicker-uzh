function invalidCleanCheckChanges(checkId, workflowRunId) {
  const repositoryUrl = 'https://github.com/uzh-bf/klicker-uzh'
  return [
    { id: 0 },
    { id: -1 },
    { id: String(checkId) },
    { id: Number.MAX_SAFE_INTEGER + 1 },
    { details_url: `${repositoryUrl}/runs/${workflowRunId}` },
    {
      details_url: `https://example.invalid/uzh-bf/klicker-uzh/runs/${checkId}`,
    },
    { details_url: `https://github.com/other/repo/runs/${checkId}` },
    { details_url: `${repositoryUrl}/runs/${checkId}?x=1` },
    { details_url: `${repositoryUrl}/runs/${checkId}/` },
    { details_url: `${repositoryUrl}/runs/${checkId}#x` },
    { external_id: String(checkId) },
    { app: { slug: 'other' } },
    { head_sha: 'e'.repeat(40) },
    { status: 'in_progress' },
    { conclusion: 'failure' },
  ]
}

module.exports = { invalidCleanCheckChanges }
