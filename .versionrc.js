const fs = require('fs')
const path = require('path')

function subdirsWithPackageJson(baseDir) {
  try {
    return fs
      .readdirSync(baseDir, { withFileTypes: true })
      .filter((d) => d.isDirectory())
      .map((d) => `${baseDir}/${d.name}`)
      .filter((dir) => fs.existsSync(path.join(dir, 'package.json')))
  } catch {
    return []
  }
}

const rootPackage = 'package.json'
const appDirs = subdirsWithPackageJson('apps')
const packageDirs = subdirsWithPackageJson('packages')
const cypressDir = fs.existsSync(path.join('cypress', 'package.json'))
  ? ['cypress']
  : []

const packageJsonFiles = [
  rootPackage,
  ...appDirs.map((d) => `${d}/package.json`),
  ...packageDirs.map((d) => `${d}/package.json`),
  ...cypressDir.map((d) => `${d}/package.json`),
]

module.exports = {
  packageFiles: [
    {
      filename: rootPackage,
      type: 'json',
    },
  ],
  bumpFiles: [
    {
      filename: `deploy/charts/klicker-uzh-v2/Chart.yaml`,
      updater: 'util/yaml-updater.js',
    },
    ...packageJsonFiles.map((filename) => ({ filename, type: 'json' })),
  ],
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
