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
    'contributors',
    'dependencies',
    'devDependencies',
    'keywords',
    'peerDependencies',
    'resolutions',
    'scripts',
  ],
  sortFirst: ['name', 'description', 'version', 'author'],
  source: ['package.json', 'packages/*/package.json'],
  versionGroups: [],
}

module.exports = config
