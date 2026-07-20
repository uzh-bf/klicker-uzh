/** @type {import("syncpack").RcFile} */
export default {
  dependencyTypes: [
    'dev',
    'prod',
    'peer',
    'resolutions',
    'overrides',
    'pnpmOverrides',
    // 'local',
  ],
  semverGroups: [
    // design-system should always be used with an exact version
    {
      range: '',
      dependencies: ['@uzh-bf/design-system'],
      packages: ['**'],
    },
    {
      range: '',
      dependencyTypes: [
        'prod',
        'resolutions',
        'overrides',
        'pnpmOverrides',
        // 'local',
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
  versionGroups: [
    {
      // A separate PR replaces the Office Add-in; keep its manifest on the v3 versions.
      label: 'Office Add-in React versions can differ',
      dependencies: ['react', 'react-dom', '@types/react', '@types/react-dom'],
      packages: ['@klicker-uzh/office-addin'],
      isIgnored: true,
    },
    {
      // Office Add-in compiler/tooling is owned by a separate upgrade PR.
      label: 'Office Add-in TypeScript can differ from the workspace',
      dependencies: ['typescript'],
      packages: ['@klicker-uzh/office-addin'],
      isIgnored: true,
    },
    {
      // FIXME: update when consistent versions are possible (e.g., do other remark updates in apps)
      label: 'remark-math can be inconsistent between docs and apps',
      dependencies: ['remark-math'],
      isIgnored: true,
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
