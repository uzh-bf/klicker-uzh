module.exports = {
  packageFiles: [
    {
      filename: `package.json`,
      type: 'json',
    },
  ],
  bumpFiles: [
    '',
    'docs/',
    'apps/backend-sls/',
    'apps/frontend-learning/',
    'apps/frontend-manage/',
    'apps/frontend-pwa/',
    'packages/graphql/',
    'packages/lti/',
    'packages/prisma/',
  ].reduce(
    (acc, path) => {
      return acc.concat({
        filename: `${path}package.json`,
        type: 'json',
      })
    },
    [
      {
        filename: `package-lock.json`,
        type: 'json',
      },
    ]
  ),
  types: [
    {
      type: 'feat',
      section: 'Features',
    },
    {
      type: 'enhance',
      section: 'Enhancements',
    },
    {
      type: 'fix',
      section: 'Bug Fixes',
    },
    {
      type: 'docs',
      section: 'Documentation',
    },
    {
      type: 'refactor',
      section: 'Refactors',
    },
    {
      type: 'perf',
      section: 'Performance',
    },
    {
      type: 'deploy',
      section: 'Deployment',
    },
    {
      type: 'deps',
      section: 'Dependencies',
    },
    {
      type: 'build',
      section: 'Build and CI',
    },
    {
      type: 'ci',
      section: 'Build and CI',
    },
    {
      type: 'chore',
      section: 'Other',
    },
    {
      type: 'wip',
      section: 'Other',
    },
    {
      type: 'test',
      section: 'Other',
    },
    {
      type: 'style',
      section: 'Other',
    },
  ],
}
