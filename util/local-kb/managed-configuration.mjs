import { join } from 'node:path'
import { validateIsolatedConfig } from './isolated-config.mjs'

const redisServices = ['redis_exec', 'redis_assessment', 'redis_cache']
const applicationRoutes = ['api', 'auth', 'manage', 'pwa', 'chat', 'blob']

// Render for a fresh runtime-only checkout, never the implementation checkout.
// This function performs no filesystem, Docker, or lifecycle operation.
export function renderManagedConfiguration(config, source, ...unexpected) {
  validateIsolatedConfig(config)
  if (unexpected.length !== 0) {
    throw new Error(
      'Devrouter must supply the workspace at Compose resolution.'
    )
  }
  const workspace = `\${WORKSPACE:?Devrouter must supply the workspace}`
  const checkout = config.project.runtimeCheckoutPath
  if (/[$\r\n]/.test(checkout)) {
    throw new Error('Compose paths must not contain interpolation or newlines.')
  }
  const { compose, devcontainer, devrouter } = structuredClone(source)
  if (
    devcontainer.service !== 'app' ||
    devcontainer.waitFor !== 'postCreateCommand' ||
    !compose.services?.app ||
    !Array.isArray(devrouter.apps)
  ) {
    throw new Error('The managed Klicker source configuration is required.')
  }
  const services = {}
  for (const name of ['app', ...redisServices, 'litellm']) {
    if (!compose.services[name]) {
      throw new Error(`Missing managed application service: ${name}`)
    }
    services[name] = compose.services[name]
    delete services[name].ports
  }
  const app = services.app
  app.ports = [`127.0.0.1:${config.bindings.ports.klicker.backend}:3000`]
  services.litellm.ports = [
    `127.0.0.1:${config.bindings.ports.klicker.model}:4000`,
  ]
  // This credential-free renderer must not inherit a host's paid AI capability.
  // A later explicitly authorized AI overlay supplies the real upstream.
  services.litellm.environment = {
    LITELLM_LOG: 'INFO',
    LITELLM_REASONING_AUTO_SUMMARY: 'true',
  }
  if (
    !Array.isArray(app.volumes) ||
    app.volumes.some((volume) => typeof volume !== 'string')
  ) {
    throw new Error('Unsupported managed application mount configuration.')
  }
  // Local generated settings take precedence over committed development values.
  app.env_file = [
    'devcontainer.env',
    ...['klicker', 'chat', 'hatchet-client'].map((name) => ({
      path: join(checkout, '.local-kb', `${name}.env`),
      required: true,
    })),
  ]
  app.environment = {
    WORKSPACE: `\${WORKSPACE:?Devrouter must supply the workspace}`,
    DEVROUTER_WORKSPACE: `\${DEVROUTER_WORKSPACE:?Devrouter must supply the workspace}`,
    KLICKER_LOCAL_KB_RUNTIME_ONLY: '1',
    BLOB_STORAGE_ACCOUNT_URL: `https://blob.klicker.${workspace}.localhost/klickerdev`,
    BLOB_STORAGE_INTERNAL_ACCOUNT_URL: `http://${workspace}-azurite:10000/klickerdev`,
  }
  app.depends_on = {}
  app.networks = {
    default: { aliases: ['klicker'] },
    devnet: { aliases: [`${workspace}-app`] },
  }
  app.extra_hosts = applicationRoutes.map(
    (name) => `${name}.klicker.${workspace}.localhost:host-gateway`
  )
  app.volumes = app.volumes.filter(
    (volume) => !volume.startsWith('hatchet_lite_config:')
  )
  app.volumes.push({
    type: 'bind',
    source: `\${DEVROUTER_GIT_COMMON_DIR:?Devrouter must supply Git metadata}`,
    target: `\${DEVROUTER_GIT_COMMON_DIR:?Devrouter must supply Git metadata}`,
  })
  const volumeNames = new Set()
  for (const service of Object.values(services)) {
    for (const mount of service.volumes ?? []) {
      if (typeof mount !== 'string') continue
      const name = mount.split(':')[0]
      if (Object.hasOwn(compose.volumes ?? {}, name)) volumeNames.add(name)
    }
  }
  const apps = applicationRoutes.map((name) => {
    const route = devrouter.apps.find((entry) => entry.name === name)
    if (route?.runtime !== 'proxy' || route.protocol !== 'http') {
      throw new Error(`Missing managed HTTP route: ${name}`)
    }
    return route
  })
  const profiles = {}
  for (const name of ['manage', 'chat', 'ai']) {
    if (!devrouter.profiles?.[name]) {
      throw new Error(`Missing managed application profile: ${name}`)
    }
    profiles[name] = devrouter.profiles[name]
    delete profiles[name].default
  }
  profiles.manage.default = true
  profiles['local-kb-setup'] = {
    apps: [],
    devcontainerServices: [],
    processes: [],
  }
  return {
    devcontainer: {
      ...devcontainer,
      dockerComposeFile: ['docker-compose.local-kb.json'],
      runServices: Object.keys(services),
      forwardPorts: [],
    },
    devrouter: {
      ...devrouter,
      apps,
      profiles,
      managedRuntime: {
        devcontainer: {
          baseServices: [],
          profileServices: [...redisServices, 'litellm'],
        },
        processes: ['klicker-dev'],
      },
    },
    compose: {
      services,
      volumes: Object.fromEntries(
        [...volumeNames].map((name) => [name, compose.volumes[name]])
      ),
      networks: {
        default: { external: true, name: `${config.project.identity}_default` },
        devnet: { external: true },
      },
    },
  }
}

// Use only the identity returned by the exact checkout's successful ensure.
export function renderProviderRouting(workspace) {
  if (!/^[a-z0-9][a-z0-9-]*$/.test(workspace ?? '')) {
    throw new Error('A resolved Devrouter workspace identity is required.')
  }
  return {
    services: {
      blob: {
        networks: {
          default: {},
          devnet: { aliases: [`${workspace}-azurite`] },
        },
      },
    },
    networks: { devnet: { external: true } },
  }
}
