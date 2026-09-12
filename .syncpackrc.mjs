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
      // Keep reviewed upgrade targets exact instead of floating across releases.
      range: '',
      dependencyTypes: ['dev'],
      dependencies: ['prisma', 'prisma-json-types-generator'],
      packages: ['@klicker-uzh/prisma'],
    },
    {
      // CI profile resolution must not change without a reviewed workflow bump.
      range: '',
      dependencyTypes: ['dev'],
      dependencies: ['@devrouter/cli'],
      packages: ['@klicker-uzh/monorepo'],
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
      // Rollup 4.59 fixes an arbitrary-file-write advisory. Keep the add-in
      // patched until the workspace-wide Rollup upgrade is handled separately.
      label: 'Office Add-in Rollup security floor can differ',
      dependencies: ['rollup'],
      packages: ['@klicker-uzh/office-addin'],
      isIgnored: true,
    },
    {
      // FIXME: update when consistent versions are possible (e.g., do other remark updates in apps)
      label: 'remark-math can be inconsistent between docs and apps',
      dependencies: ['remark-math'],
      isIgnored: true,
    },
    {
      // FIXME: drop once backend-docker migrates to the OpenTelemetry v2 SDK line;
      // chat is on v2 (required by @langfuse/otel v4) while backend-docker stays on v1.
      label: 'backend-docker stays on the OpenTelemetry v1 SDK line',
      dependencies: [
        '@opentelemetry/exporter-trace-otlp-http',
        '@opentelemetry/sdk-trace-node',
      ],
      packages: ['@klicker-uzh/backend-docker'],
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
  //   'docs/package.json',
  // ],
}
