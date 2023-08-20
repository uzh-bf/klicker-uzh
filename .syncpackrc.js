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
    'author',
    'maintainers',
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
    'engines',
    'volta',
    'packageManager',
    'maintainers',
    'contributors',
  ],
  source: ['package.json', 'apps/*/package.json', 'packages/*/package.json'],
  versionGroups: [],
}

module.exports = config
