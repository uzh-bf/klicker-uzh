'use strict'

const fs = require('node:fs')
const path = require('node:path')

// Single inventory for the staging image publications.
//
// The staging controller promotes immutable image digests, and a candidate may
// not rename, add, remove or retarget an image without a trusted controller
// change. The controller reads this inventory from its own revision, so the
// list below is the trusted set and the consolidated workflow mirrors it.
//
// The declared list is identical on every branch and covers all sixteen images
// the promotion contract names, including the two MCP images that exist on the
// integration branches only. Availability is resolved from the tree at plan
// time instead of from the branch, so 'v3' and 'v3-audit' share one trusted
// inventory and neither can silently drop an image from the promoted set.
//
// 'globs' reproduce the pull-request path filters the replaced per-image
// workflows declared: a pull request builds only the targets whose inputs
// changed, while a push builds every available target. 'prep' is the exact
// staging-environment step each target ran before its build. 'stage' encodes
// build ordering, 'scan' marks the targets whose Trivy receipt the promotion
// controller admits, 'publishGuard' marks the targets that check the full-SHA
// tag before publishing, 'amd' marks the targets that also publish an AMD64
// image, 'syncSchema' marks the targets that run util/sync-schema.sh first, and
// 'optional' marks the targets whose dockerfile exists on the integration lines
// only. An optional target allocates no runner where it is absent, and the
// promotion controller tolerates its absence from a candidate tree while
// failing closed on the absence of any other target.
//
// 'reuse' marks the targets whose image may be adopted from an earlier
// publication by input fingerprint instead of being rebuilt. It is set only for
// targets whose configuration is injected at runtime, so the same image can
// serve another commit or environment without changing its contents. A Next.js
// image is deliberately excluded: its staging and production workflows pass
// different `NEXT_PUBLIC_*` build arguments and replace the app's environment
// file before building, and Next.js freezes those values into the browser
// bundle, so a reused frontend image would ship the wrong configuration.

// Root build inputs shared by every image whose docker build context is the
// repository root: 'turbo prune --docker' reads the workspace manifest, the
// lockfile and turbo.json, and .dockerignore decides which files reach that
// context at all, so a root dependency change can alter any node image. This
// repository has no root tsconfig.json, and .npmrc never reaches the docker
// context because of the '.**' rule in .dockerignore, so neither is listed.
const ROOT_BUILD_GLOBS = Object.freeze([
  '.dockerignore',
  'package.json',
  'pnpm-lock.yaml',
  'pnpm-workspace.yaml',
  'turbo.json',
])

// The consolidated workflow itself is a build input for every target: it
// carries the shared build steps, so a change to it can alter any image.
const CONSOLIDATED_WORKFLOW_PATH = '.github/workflows/v3_images-stg.yml'

const STAGING_IMAGE_TARGETS = Object.freeze([
  {
    dockerfile: 'apps/analytics/Dockerfile',
    globs: [
      'apps/analytics/**',
      'packages/prisma/src/prisma/schema/*.prisma',
      'util/sync-schema.sh',
      '.dockerignore',
    ],
    id: 'analytics-arm',
    jobBase: 'analytics',
    publishGuard: true,
    reuse: true,
    stage: 'independent',
    syncSchema: true,
  },
  {
    dockerfile: 'apps/auth/Dockerfile',
    globs: [
      'apps/auth/**',
      'packages/audit/**',
      'packages/doc-query-client/**',
      'packages/feature-flags/**',
      'packages/grading/**',
      'packages/graphql/**',
      'packages/hatchet/**',
      'packages/i18n/**',
      'packages/knowledge-graph/**',
      'packages/logging/**',
      'packages/markdown/**',
      'packages/next-config/**',
      'packages/prisma/**',
      'packages/shared-components/**',
      'packages/types/**',
      'packages/util/**',
      'packages/word-cloud/**',
      'package.json',
      'pnpm-lock.yaml',
      'pnpm-workspace.yaml',
      'turbo.json',
      '.dockerignore',
    ],
    id: 'auth-arm',
    jobBase: 'auth',
    prep: [
      'rm apps/auth/.env.production',
      'mv apps/auth/.env.stg apps/auth/.env.production',
    ],
    publishGuard: true,
    stage: 'independent',
  },
  {
    dockerfile: 'apps/backend-docker/Dockerfile',
    globs: [
      'apps/backend-docker/**',
      'packages/audit/**',
      'packages/doc-query-client/**',
      'packages/feature-flags/**',
      'packages/grading/**',
      'packages/graphql/**',
      'packages/hatchet/**',
      'packages/knowledge-graph/**',
      'packages/logging/**',
      'packages/prisma/**',
      'packages/types/**',
      'packages/util/**',
      'package.json',
      'pnpm-lock.yaml',
      'pnpm-workspace.yaml',
      'turbo.json',
      '.dockerignore',
    ],
    id: 'backend-docker-arm',
    jobBase: 'backend-docker',
    publishGuard: true,
    reuse: true,
    scan: true,
    stage: 'after-migrator',
  },
  {
    dockerfile: 'packages/prisma/Dockerfile',
    globs: [
      'apps/backend-docker/**',
      'packages/audit/**',
      'packages/doc-query-client/**',
      'packages/feature-flags/**',
      'packages/grading/**',
      'packages/graphql/**',
      'packages/hatchet/**',
      'packages/knowledge-graph/**',
      'packages/logging/**',
      'packages/prisma/**',
      'packages/types/**',
      'packages/util/**',
      'package.json',
      'pnpm-lock.yaml',
      'pnpm-workspace.yaml',
      'turbo.json',
      '.dockerignore',
    ],
    id: 'backend-docker-migrator-arm',
    jobBase: 'backend-docker-migrator',
    publishGuard: true,
    reuse: true,
    scan: true,
    stage: 'migrator',
  },
  {
    dockerfile: 'apps/chat/Dockerfile',
    globs: [
      'apps/chat/**',
      'packages/audit/**',
      'packages/doc-query-client/**',
      'packages/feature-flags/**',
      'packages/grading/**',
      'packages/graphql/**',
      'packages/hatchet/**',
      'packages/i18n/**',
      'packages/knowledge-graph/**',
      'packages/logging/**',
      'packages/markdown/**',
      'packages/next-config/**',
      'packages/prisma/**',
      'packages/prisma-data/**',
      'packages/shared-components/**',
      'packages/transactional/**',
      'packages/types/**',
      'packages/util/**',
      'packages/word-cloud/**',
      'package.json',
      'pnpm-lock.yaml',
      'pnpm-workspace.yaml',
      'turbo.json',
      '.dockerignore',
    ],
    id: 'chat-arm',
    jobBase: 'chat',
    prep: [
      'rm apps/chat/.env.production',
      'mv apps/chat/.env.stg apps/chat/.env.production',
    ],
    publishGuard: true,
    stage: 'independent',
  },
  {
    dockerfile: 'apps/frontend-pwa/Dockerfile',
    globs: [
      'apps/frontend-pwa/**',
      'packages/audit/**',
      'packages/doc-query-client/**',
      'packages/feature-flags/**',
      'packages/grading/**',
      'packages/graphql/**',
      'packages/hatchet/**',
      'packages/i18n/**',
      'packages/knowledge-graph/**',
      'packages/logging/**',
      'packages/markdown/**',
      'packages/next-config/**',
      'packages/prisma/**',
      'packages/shared-components/**',
      'packages/types/**',
      'packages/util/**',
      'packages/word-cloud/**',
      'package.json',
      'pnpm-lock.yaml',
      'pnpm-workspace.yaml',
      'turbo.json',
      '.dockerignore',
    ],
    id: 'frontend-assessment-arm',
    jobBase: 'frontend-assessment',
    prep: [
      'rm apps/frontend-pwa/.env.production',
      'mv apps/frontend-pwa/.env.assessment.stg apps/frontend-pwa/.env.production',
    ],
    publishGuard: true,
    stage: 'independent',
  },
  {
    dockerfile: 'apps/frontend-control/Dockerfile',
    globs: [
      'apps/frontend-control/**',
      'packages/audit/**',
      'packages/doc-query-client/**',
      'packages/feature-flags/**',
      'packages/grading/**',
      'packages/graphql/**',
      'packages/hatchet/**',
      'packages/i18n/**',
      'packages/knowledge-graph/**',
      'packages/logging/**',
      'packages/markdown/**',
      'packages/next-config/**',
      'packages/prisma/**',
      'packages/shared-components/**',
      'packages/types/**',
      'packages/util/**',
      'packages/word-cloud/**',
      'package.json',
      'pnpm-lock.yaml',
      'pnpm-workspace.yaml',
      'turbo.json',
      '.dockerignore',
    ],
    id: 'frontend-control-arm',
    jobBase: 'frontend-control',
    prep: [
      'rm apps/frontend-control/.env.production',
      'mv apps/frontend-control/.env.stg apps/frontend-control/.env.production',
    ],
    publishGuard: true,
    stage: 'independent',
  },
  {
    dockerfile: 'apps/frontend-manage/Dockerfile',
    globs: [
      'apps/frontend-manage/**',
      'packages/audit/**',
      'packages/doc-query-client/**',
      'packages/feature-flags/**',
      'packages/grading/**',
      'packages/graphql/**',
      'packages/hatchet/**',
      'packages/i18n/**',
      'packages/kb-management/**',
      'packages/knowledge-graph/**',
      'packages/logging/**',
      'packages/markdown/**',
      'packages/next-config/**',
      'packages/prisma/**',
      'packages/shared-components/**',
      'packages/types/**',
      'packages/util/**',
      'packages/word-cloud/**',
      'package.json',
      'pnpm-lock.yaml',
      'pnpm-workspace.yaml',
      'turbo.json',
      '.dockerignore',
    ],
    id: 'frontend-manage-arm',
    jobBase: 'frontend-manage',
    prep: [
      'rm apps/frontend-manage/.env.production',
      'mv apps/frontend-manage/.env.stg apps/frontend-manage/.env.production',
    ],
    publishGuard: true,
    stage: 'independent',
  },
  {
    dockerfile: 'apps/frontend-pwa/Dockerfile',
    globs: [
      'apps/frontend-pwa/**',
      'packages/audit/**',
      'packages/doc-query-client/**',
      'packages/feature-flags/**',
      'packages/grading/**',
      'packages/graphql/**',
      'packages/hatchet/**',
      'packages/i18n/**',
      'packages/knowledge-graph/**',
      'packages/logging/**',
      'packages/markdown/**',
      'packages/next-config/**',
      'packages/prisma/**',
      'packages/shared-components/**',
      'packages/types/**',
      'packages/util/**',
      'packages/word-cloud/**',
      'package.json',
      'pnpm-lock.yaml',
      'pnpm-workspace.yaml',
      'turbo.json',
      '.dockerignore',
    ],
    id: 'frontend-pwa-arm',
    jobBase: 'frontend-pwa',
    prep: [
      'rm apps/frontend-pwa/.env.production',
      'mv apps/frontend-pwa/.env.stg apps/frontend-pwa/.env.production',
    ],
    publishGuard: true,
    stage: 'independent',
  },
  {
    dockerfile: 'apps/hatchet-worker-general/Dockerfile',
    globs: [
      'apps/hatchet-worker-general/**',
      'packages/audit/**',
      'packages/doc-query-client/**',
      'packages/feature-flags/**',
      'packages/grading/**',
      'packages/graphql/**',
      'packages/hatchet/**',
      'packages/knowledge-graph/**',
      'packages/logging/**',
      'packages/prisma/**',
      'packages/types/**',
      'packages/util/**',
      'package.json',
      'pnpm-lock.yaml',
      'pnpm-workspace.yaml',
      'turbo.json',
      '.dockerignore',
    ],
    id: 'hatchet-worker-general-arm',
    jobBase: 'hatchet-worker-general',
    publishGuard: true,
    reuse: true,
    stage: 'independent',
  },
  {
    dockerfile: 'apps/hatchet-worker-response-processor/Dockerfile',
    globs: [
      'apps/hatchet-worker-response-processor/**',
      'packages/audit/**',
      'packages/grading/**',
      'packages/hatchet/**',
      'packages/knowledge-graph/**',
      'packages/logging/**',
      'packages/prisma/**',
      'packages/types/**',
      'packages/util/**',
      'package.json',
      'pnpm-lock.yaml',
      'pnpm-workspace.yaml',
      'turbo.json',
      '.dockerignore',
    ],
    id: 'hatchet-worker-response-processor-arm',
    jobBase: 'hatchet-worker-response-processor',
    publishGuard: true,
    reuse: true,
    stage: 'independent',
  },
  {
    dockerfile: 'apps/lti/Dockerfile',
    globs: [
      'apps/lti/**',
      'packages/grading/**',
      'packages/prisma/**',
      'packages/types/**',
      'packages/util/**',
      'packages/logging/**',
      'package.json',
      'pnpm-lock.yaml',
      'pnpm-workspace.yaml',
      'turbo.json',
      '.dockerignore',
    ],
    id: 'lti-arm',
    jobBase: 'lti',
    publishGuard: true,
    reuse: true,
    stage: 'independent',
  },
  {
    dockerfile: 'apps/mcp-lecturer/Dockerfile',
    globs: [
      'apps/mcp-lecturer/**',
      'packages/grading/**',
      'packages/prisma/**',
      'packages/types/**',
      'packages/util/**',
      'package.json',
      'pnpm-lock.yaml',
      'turbo.json',
      'pnpm-workspace.yaml',
      '.dockerignore',
    ],
    id: 'mcp-lecturer-arm',
    optional: true,
    jobBase: 'mcp-lecturer',
    amd: true,
    publishGuard: true,
    reuse: true,
    stage: 'independent',
  },
  {
    dockerfile: 'apps/mcp-student/Dockerfile',
    globs: [
      'apps/mcp-student/**',
      'packages/audit/**',
      'packages/doc-query-client/**',
      'packages/feature-flags/**',
      'packages/grading/**',
      'packages/graphql/**',
      'packages/hatchet/**',
      'packages/knowledge-graph/**',
      'packages/logging/**',
      'packages/prisma/**',
      'packages/types/**',
      'packages/util/**',
      'package.json',
      'pnpm-lock.yaml',
      'turbo.json',
      'pnpm-workspace.yaml',
      '.dockerignore',
    ],
    id: 'mcp-student-arm',
    optional: true,
    jobBase: 'mcp-student',
    amd: true,
    publishGuard: true,
    reuse: true,
    stage: 'independent',
  },
  {
    dockerfile: 'apps/olat-api/Dockerfile',
    globs: [
      'apps/olat-api/**',
      'packages/grading/**',
      'packages/prisma/**',
      'packages/types/**',
      'packages/util/**',
      'packages/logging/**',
      'package.json',
      'pnpm-lock.yaml',
      'pnpm-workspace.yaml',
      'turbo.json',
      '.dockerignore',
    ],
    id: 'olat-api-arm',
    jobBase: 'olat-api',
    publishGuard: true,
    reuse: true,
    stage: 'independent',
  },
  {
    dockerfile: 'apps/response-api/Dockerfile',
    globs: [
      'apps/response-api/**',
      'packages/grading/**',
      'packages/hatchet/**',
      'packages/knowledge-graph/**',
      'packages/logging/**',
      'packages/prisma/**',
      'packages/types/**',
      'packages/util/**',
      'package.json',
      'pnpm-lock.yaml',
      'pnpm-workspace.yaml',
      'turbo.json',
      '.dockerignore',
    ],
    id: 'response-api-arm',
    jobBase: 'response-api',
    publishGuard: true,
    reuse: true,
    stage: 'independent',
  },
])

const PREVIEW_DEPLOYMENT_INPUTS = Object.freeze([
  '.dockerignore',
  'deploy/preview/**',
  'util/deployment-build-env.mjs',
])

function stagingTarget(targetId) {
  const target = STAGING_IMAGE_TARGETS.find((entry) => entry.id === targetId)
  if (!target) throw new Error('missing staging inventory target ' + targetId)
  return target
}

function previewFromStaging({
  id,
  image,
  logicalTargets,
  stagingId,
  usesDeploymentConfig = false,
}) {
  const staging = stagingTarget(stagingId)
  return {
    dockerfile: staging.dockerfile,
    globs: [...new Set([...staging.globs, ...PREVIEW_DEPLOYMENT_INPUTS])],
    id,
    image,
    logicalTargets,
    stagingId,
    stagingImage: imageName(staging),
    stage: 'independent',
    usesDeploymentConfig,
  }
}

// Preview dispatch targets follow the public manifest vocabulary. The trusted
// plan resolves these names before it checks out a candidate. Each physical
// build has its own preview repository, so a preview tag can never move a
// staging branch or full-SHA tag.
//
// A Dockerfile shared by more than one logical target is listed once. Its
// receipt is duplicated for every logical target after the exact digest has
// passed the scan policy, so db-bootstrap, fixtures and local-mcp cannot build
// the same fixture image three times.
const PREVIEW_IMAGE_TARGETS = Object.freeze([
  previewFromStaging({
    id: 'api',
    image: 'preview-api',
    logicalTargets: ['api'],
    stagingId: 'backend-docker-arm',
  }),
  previewFromStaging({
    id: 'auth',
    image: 'preview-auth',
    logicalTargets: ['auth'],
    stagingId: 'auth-arm',
    usesDeploymentConfig: true,
  }),
  previewFromStaging({
    id: 'pwa',
    image: 'preview-pwa',
    logicalTargets: ['pwa'],
    stagingId: 'frontend-pwa-arm',
    usesDeploymentConfig: true,
  }),
  previewFromStaging({
    id: 'chat',
    image: 'preview-chat',
    logicalTargets: ['chat'],
    stagingId: 'chat-arm',
    usesDeploymentConfig: true,
  }),
  previewFromStaging({
    id: 'manage',
    image: 'preview-manage',
    logicalTargets: ['manage'],
    stagingId: 'frontend-manage-arm',
    usesDeploymentConfig: true,
  }),
  previewFromStaging({
    id: 'control',
    image: 'preview-control',
    logicalTargets: ['control'],
    stagingId: 'frontend-control-arm',
    usesDeploymentConfig: true,
  }),
  previewFromStaging({
    id: 'response-api',
    image: 'preview-response-api',
    logicalTargets: ['response-api'],
    stagingId: 'response-api-arm',
  }),
  previewFromStaging({
    id: 'lti',
    image: 'preview-lti',
    logicalTargets: ['lti'],
    stagingId: 'lti-arm',
  }),
  previewFromStaging({
    id: 'olat-api',
    image: 'preview-olat-api',
    logicalTargets: ['olat-api'],
    stagingId: 'olat-api-arm',
  }),
  previewFromStaging({
    id: 'mcp-lecturer',
    image: 'preview-mcp-lecturer',
    logicalTargets: ['mcp-lecturer'],
    stagingId: 'mcp-lecturer-arm',
  }),
  previewFromStaging({
    id: 'mcp-student',
    image: 'preview-mcp-student',
    logicalTargets: ['mcp-student'],
    stagingId: 'mcp-student-arm',
  }),
  previewFromStaging({
    id: 'worker-general',
    image: 'preview-worker-general',
    logicalTargets: ['worker-general'],
    stagingId: 'hatchet-worker-general-arm',
  }),
  previewFromStaging({
    id: 'worker-response',
    image: 'preview-worker-response',
    logicalTargets: ['worker-response'],
    stagingId: 'hatchet-worker-response-processor-arm',
  }),
  {
    dockerfile: 'deploy/preview/Dockerfile.fixtures',
    globs: ['.'],
    id: 'fixtures',
    image: 'preview-fixtures',
    logicalTargets: ['db-bootstrap', 'fixtures', 'local-mcp'],
    stage: 'independent',
    stagingImage: null,
    usesDeploymentConfig: false,
  },
  {
    dockerfile: 'deploy/preview/Dockerfile.azurite',
    globs: [
      '.dockerignore',
      'deploy/preview/Dockerfile.azurite',
      'deploy/preview/runtime.mjs',
    ],
    id: 'azurite',
    image: 'preview-azurite',
    logicalTargets: ['azurite'],
    stage: 'independent',
    stagingImage: null,
    usesDeploymentConfig: false,
  },
  {
    dockerfile: 'deploy/preview/Dockerfile.litellm',
    globs: [
      '.dockerignore',
      'deploy/preview/Dockerfile.litellm',
      'util/litellm/config.yaml',
    ],
    id: 'litellm',
    image: 'preview-litellm',
    logicalTargets: ['litellm'],
    stage: 'independent',
    stagingImage: null,
    usesDeploymentConfig: false,
  },
  {
    dockerfile: 'packages/prisma/Dockerfile',
    globs: [
      ...stagingTarget('backend-docker-migrator-arm').globs,
      '.dockerignore',
    ],
    id: 'backend-docker-migrator',
    image: 'preview-backend-docker-migrator',
    logicalTargets: ['backend-docker-migrator', 'migrator'],
    stagingId: 'backend-docker-migrator-arm',
    stagingImage: 'backend-docker-migrator',
    stage: 'independent',
    usesDeploymentConfig: false,
  },
])

const PREVIEW_LOGICAL_TARGETS = Object.freeze(
  PREVIEW_IMAGE_TARGETS.flatMap((target) =>
    target.logicalTargets.map((logicalTarget) => ({ logicalTarget, target }))
  )
)

// A preview dispatch may adopt a staging publication instead of rebuilding it.
// The resolver looks up a successful staging run for the same source revision,
// reads the build digest artifact, and requires the scan job of the same run to
// have passed. These names are the stable staging identities; a change to the
// staging job layout must update this inventory in the same commit.
const PREVIEW_STAGING_IMAGES = Object.freeze(
  PREVIEW_LOGICAL_TARGETS.flatMap(({ logicalTarget, target }) => {
    if (!target.stagingImage || !target.stagingId) return []
    const staging = stagingTarget(target.stagingId)
    return [
      Object.freeze({
        buildArtifact: 'build-digest-' + staging.id,
        buildJob: buildJobName(staging),
        configuration: Object.freeze({}),
        image: imageName(staging) + '-arm',
        jobBase: staging.jobBase,
        logicalTarget,
        platform: 'linux/arm64',
        scan: staging.scan === true,
        scanArtifact: 'image-scan-' + staging.jobBase + '-arm',
        scanJob: scanJobName(staging),
        stagingTarget: staging.id,
        workflow: CONSOLIDATED_WORKFLOW_PATH,
      }),
    ]
  })
)

const WORKFLOWS_DIRECTORY = '.github/workflows'

function globToRegExp(glob) {
  let pattern = ''
  for (let index = 0; index < glob.length; index += 1) {
    const character = glob[index]
    if (character === '*') {
      if (glob[index + 1] === '*') {
        pattern += '.*'
        index += 1
      } else {
        pattern += '[^/]*'
      }
    } else if (character === '?') {
      pattern += '[^/]'
    } else {
      pattern += character.replace(/[.+^$()|[\]{}]/g, '\\$&')
    }
  }
  return new RegExp('^' + pattern + '$')
}

const GLOB_CACHE = new Map()

function matchGlob(glob, filePath) {
  if (!GLOB_CACHE.has(glob)) GLOB_CACHE.set(glob, globToRegExp(glob))
  return GLOB_CACHE.get(glob).test(filePath)
}

// Matrix job names are part of the promotion contract: the controller matches
// them in candidate runs, so they are derived here rather than hand-written in
// the workflow.
function buildJobName(target) {
  return 'build-arm-' + target.jobBase
}

function scanJobName(target) {
  return 'scan-arm-' + target.jobBase
}

function amdJobName(target) {
  return 'build-amd-' + target.jobBase
}

// The registry image name without a platform suffix. The replaced workflows set
// IMAGE_NAME to exactly the target id minus its '-arm' suffix and published
// '<IMAGE_NAME>-arm' / '<IMAGE_NAME>-amd', so the consolidated matrix passes
// this value and the workflow appends the platform. It is derived rather than
// stored so the two cannot drift.
function imageName(target) {
  return target.id.replace(/-arm$/, '')
}

function targetById(targetId) {
  return STAGING_IMAGE_TARGETS.find((target) => target.id === targetId)
}

// A target is available when its dockerfile is in the checked-out tree. The
// two MCP images live on the integration branches only, so 'v3' resolves them
// as unavailable rather than failing the whole publication surface.
function availableTargets(rootDirectory = process.cwd()) {
  return STAGING_IMAGE_TARGETS.filter((target) =>
    fs.existsSync(path.join(rootDirectory, target.dockerfile))
  )
}

function unavailableTargetIds(rootDirectory = process.cwd()) {
  const available = new Set(availableTargets(rootDirectory).map((t) => t.id))
  return STAGING_IMAGE_TARGETS.filter((target) => !available.has(target.id))
    .map((target) => target.id)
    .sort()
}

// A push has no path filter and therefore builds every available target. A pull
// request builds the targets whose declared inputs changed. The consolidated
// workflow file is a shared input for every target, so changing it rebuilds
// everything instead of silently narrowing the selection.
function selectStagingTargets({ eventName, changedFiles = [], rootDirectory }) {
  const available = availableTargets(rootDirectory)
  if (eventName === 'push') {
    return { expected: available, mode: 'push-all' }
  }
  if (eventName !== 'pull_request') {
    throw new Error('staging image selection does not support ' + eventName)
  }
  if (changedFiles.includes(CONSOLIDATED_WORKFLOW_PATH)) {
    return { expected: available, mode: 'workflow-change' }
  }
  const expected = available.filter((target) =>
    target.globs.some((glob) =>
      changedFiles.some((file) => matchGlob(glob, file))
    )
  )
  return {
    expected,
    mode: expected.length > 0 ? 'affected' : 'no-change',
  }
}

// A surviving per-image workflow would publish outside the planned matrix, so
// any v3_*-stg.yml file in the tree fails the selection closed until the
// consolidation is complete on that branch.
function legacyImageWorkflows(rootDirectory = process.cwd()) {
  const directory = path.join(rootDirectory, WORKFLOWS_DIRECTORY)
  if (!fs.existsSync(directory)) return []
  const consolidated = path.basename(CONSOLIDATED_WORKFLOW_PATH)
  return fs
    .readdirSync(directory)
    .filter((name) => /^v3_.*-stg\.yml$/.test(name) && name !== consolidated)
    .sort()
}

module.exports = {
  CONSOLIDATED_WORKFLOW_PATH,
  PREVIEW_DEPLOYMENT_INPUTS,
  PREVIEW_IMAGE_TARGETS,
  PREVIEW_LOGICAL_TARGETS,
  PREVIEW_STAGING_IMAGES,
  ROOT_BUILD_GLOBS,
  STAGING_IMAGE_TARGETS,
  WORKFLOWS_DIRECTORY,
  amdJobName,
  availableTargets,
  buildJobName,
  globToRegExp,
  imageName,
  legacyImageWorkflows,
  matchGlob,
  scanJobName,
  selectStagingTargets,
  targetById,
  unavailableTargetIds,
}
