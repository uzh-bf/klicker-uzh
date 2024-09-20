/** @type {import("syncpack").RcFile} */
export default {
  semverGroups: [
    {
      range: '',
      dependencyTypes: [
        'prod',
        'resolutions',
        'overrides',
        'pnpmOverrides',
        'local',
      ],
      dependencies: ['**'],
      packages: ['**'],
    },
    {
      range: '~',
      dependencyTypes: ['dev'],
      dependencies: ['!@types/**'],
      packages: ['**'],
    },
    {
      range: '^',
      dependencyTypes: ['dev'],
      dependencies: ['@types/**'],
      packages: ['**'],
    },
    {
      range: '^',
      dependencyTypes: ['peer'],
      dependencies: ['**'],
      packages: ['**'],
    },
  ],
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
  // source: [
  //   'package.json',
  //   'apps/*/package.json',
  //   'packages/*/package.json',
  //   'cypress/package.json',
  //   'docs/package.json',
  // ],
}
