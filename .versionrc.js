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
    'apps/backend-docker/',
    'apps/backend-responses/',
    'apps/backend-response-processor/',
    'apps/backend-sls/',
    'apps/frontend-learning/',
    'apps/frontend-manage/',
    'apps/frontend-pwa/',
    'apps/frontend-control/',
    'packages/grading/',
    'packages/graphql/',
    'packages/lti/',
    'packages/prisma/',
    'packages/markdown/',
    'packages/shared-components',
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
      {
        filename: `deploy/charts/klicker-uzh-v3/Chart.yaml`,
        updater: 'util/yaml-updater.js',
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
