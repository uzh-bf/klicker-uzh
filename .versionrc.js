module.exports = {
  packageFiles: [
    {
      filename: `package.json`,
      type: 'json',
    },
  ],
  bumpFiles: ['', 'backend/', 'frontend/', 'landing/', 'docs/website/'].reduce(
    (acc, path) => {
      return acc.concat(
        {
          filename: `${path}package.json`,
          type: 'json',
        },
        {
          filename: `${path}package-lock.json`,
          type: 'json',
        }
      )
    },
    []
  ),
  types: [
    {
      type: 'docs',
      section: 'Documentation',
    },
    {
      type: 'enhance',
      section: 'Enhancements',
    },
    {
      type: 'feat',
      section: 'Features',
    },
    {
      type: 'fix',
      section: 'Bug Fixes',
    },
    {
      type: 'refactor',
      section: 'Refactors',
    },
    {
      type: 'wip',
      section: 'Work in Progress',
    },
    {
      type: 'perf',
      section: 'Performance',
    },
    {
      type: 'deps',
      section: 'Dependencies',
    },
    {
      type: 'style',
      section: 'Styling',
    },
    {
      type: 'chore',
    },
    {
      type: 'test',
      section: 'Testing',
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
      type: 'deploy',
      section: 'Deployment',
    },
  ],
}
