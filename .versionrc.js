module.exports = {
  packageFiles: [
    {
      filename: `package.json`,
      type: 'json',
    },
  ],
  bumpFiles: [
    '',
    'apps/backend/',
    'apps/frontend/',
    'functions/',
    'apps/docs/',
    'packages/ui/',
    'packages/db/',
  ].reduce(
    (acc, path) => {
      return acc.concat({
        filename: `${path}package.json`,
        type: 'json',
      })
    },
    [
      {
        filename: `deploy/charts/klicker-uzh/Chart.yaml`,
        updater: 'util/yaml-updater.js',
      },
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
