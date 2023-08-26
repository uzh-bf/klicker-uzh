// @ts-check

/** @type {import("syncpack").RcFile} */
const config = {
  customTypes: {},
  dependencyTypes: [
    'dev',
    'local',
    'overrides',
    'peer',
    'pnpmOverrides',
    'prod',
    'resolutions',
  ],
  filter: '.',
  indent: '  ',
  semverGroups: [],
  semverRange: '',
  sortAz: [
    'dependencies',
    'devDependencies',
    'peerDependencies',
    'resolutions',
    'scripts',
  ],
  sortFirst: [
    'private',
    'name',
    'description',
    'version',
    'repository',
    'homepage',
    'bugs',
    'license',
    'main',
    'types',
    'files',
    'maintainers',
    'contributors',
    'dependencies',
    'devDependencies',
    'peerDependencies',
    'scripts',
    'resolutions',
    'engines',
    'volta',
    'packageManager',
  ],
  source: [
    'package.json',
    'apps/*/package.json',
    'packages/*/package.json',
    'cypress/package.json',
    'docs/package.json',
  ],
  versionGroups: [],
}

module.exports = config
