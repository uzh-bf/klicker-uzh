/* eslint-disable babel/quotes */

require('dotenv').config()

const convict = require('convict')

module.exports = convict({
  api: {
    endpoint: {
      default: 'http://localhost:4000/graphql',
      env: 'API_ENDPOINT',
      format: 'url',
    },
    endpointSSR: {
      default: undefined,
      env: 'API_ENDPOINT_SSR',
      format: 'url',
    },
    endpointWS: {
      default: 'ws://localhost:4000/graphql',
      env: 'API_ENDPOINT_WS',
      format: String,
    },
  },
  app: {
    baseUrl: {
      default: 'http://localhost:3000',
      env: 'APP_BASE_URL',
      format: 'url',
    },
    gzip: {
      default: true,
      env: 'APP_GZIP',
      format: Boolean,
    },
    joinUrl: {
      default: undefined,
      env: 'APP_JOIN_URL',
      format: 'url',
    },
    persistQueries: {
      default: false,
      env: 'APP_PERSIST_QUERIES',
      format: Boolean,
    },
    port: {
      default: 3000,
      env: 'APP_PORT',
      format: 'port',
    },
    staticPath: {
      default: 'public',
      env: 'APP_STATIC_PATH',
      format: String,
    },
    trustProxy: {
      default: false,
      env: 'APP_TRUST_PROXY',
      format: Boolean,
    },
  },
  cache: {
    pages: {
      join: {
        default: 30,
        env: 'CACHE_PAGES_JOIN',
        format: 'int',
      },
      landing: {
        default: 600,
        env: 'CACHE_PAGES_LANDING',
        format: 'int',
      },
      qr: {
        default: 300,
        env: 'CACHE_PAGES_QR',
        format: 'int',
      },
    },
    redis: {
      db: {
        default: 0,
        env: 'CACHE_REDIS_DB',
        format: 'nat',
      },
      enabled: {
        default: false,
        env: 'CACHE_REDIS_ENABLED',
        format: Boolean,
      },
      host: {
        default: undefined,
        env: 'CACHE_REDIS_HOST',
        format: String,
      },
      password: {
        default: undefined,
        env: 'CACHE_REDIS_PASSWORD',
        format: String,
        sensitive: true,
      },
      port: {
        default: 6379,
        env: 'CACHE_REDIS_PORT',
        format: 'port',
      },
    },
  },
  env: {
    arg: 'nodeEnv',
    default: 'development',
    env: 'NODE_ENV',
    format: ['production', 'development', 'test'],
  },
  s3: {
    rootUrl: {
      default: undefined,
      env: 'S3_ROOT_URL',
      format: 'url',
    },
  },
  security: {
    csp: {
      connectSrc: {
        default: ["'self'", process.env.API_ENDPOINT, process.env.API_ENDPOINT_WS],
        env: 'SECURITY_CSP_CONNECT_SRC',
        format: Array,
      },
      defaultSrc: {
        default: ["'self'"],
        env: 'SECURITY_CSP_DEFAULT_SRC',
        format: Array,
      },
      enabled: {
        default: false,
        env: 'SECURITY_CSP_ENABLED',
        format: Boolean,
      },
      enforce: {
        default: false,
        env: 'SECURITY_CSP_ENFORCE',
        format: Boolean,
      },
      fontSrc: {
        default: ["'self'", 'fonts.gstatic.com'],
        env: 'SECURITY_CSP_FONT_SRC',
        format: Array,
      },
      imgSrc: {
        default: ["'self'"],
        env: 'SECURITY_CSP_IMG_SRC',
        format: Array,
      },
      reportUri: {
        default: undefined,
        env: 'SECURITY_CSP_REPORT_URI',
        format: 'url',
      },
      scriptSrc: {
        default: ["'self'", "'unsafe-inline'", 'cdn.polyfill.io'],
        env: 'SECURITY_CSP_SCRIPT_SRC',
        format: Array,
      },
      styleSrc: {
        default: [
          "'self'",
          "'unsafe-inline'",
          'maxcdn.bootstrapcdn.com',
          'fonts.googleapis.com',
          'cdnjs.cloudflare.com',
        ],
        env: 'SECURITY_CSP_STYLE_SRC',
        format: Array,
      },
    },
    expectCt: {
      enabled: {
        default: true,
        env: 'SECURITY_EXPECT_CT_ENABLED',
        format: Boolean,
      },
      enforce: {
        default: false,
        env: 'SECURITY_EXPECT_CT_ENFORCE',
        format: Boolean,
      },
      maxAge: {
        default: 0,
        env: 'SECURITY_EXPECT_CT_MAX_AGE',
        format: 'int',
      },
      reportUri: {
        default: undefined,
        env: 'SECURITY_EXPECT_CT_REPORT_URI',
        format: 'url',
      },
    },
    fingerprinting: {
      default: true,
      env: 'SECURITY_FINGERPRINTING',
      format: Boolean,
    },
    frameguard: {
      ancestors: {
        default: ["'none'"],
        env: 'SECURITY_FRAMEGUARD_ANCESTORS',
        format: Array,
      },
      enabled: {
        default: false,
        env: 'SECURITY_FRAMEGUARD_ENABLED',
        format: Boolean,
      },
    },
    hsts: {
      enabled: {
        default: false,
        env: 'SECURITY_HSTS_ENABLED',
        format: Boolean,
      },
      includeSubdomains: {
        default: false,
        env: 'SECURITY_HSTS_INCLUDE_SUBDOMAINS',
        format: Boolean,
      },
      maxAge: {
        default: 0,
        env: 'SECURITY_HSTS_MAX_AGE',
        format: 'nat',
      },
      preload: {
        default: undefined,
        env: 'SECURITY_HSTS_PRELOAD',
        format: Boolean,
      },
    },
    referrerPolicy: {
      default: undefined,
      env: 'SECURITY_REFERRER_POLICY',
      format: String,
    },
  },
  services: {
    // Elastic APM
    apm: {
      enabled: {
        default: false,
        env: 'SERVICES_APM_ENABLED',
        format: Boolean,
      },
      monitorDev: {
        default: false,
        env: 'SERVICES_APM_DEV',
        format: Boolean,
      },
      secretToken: {
        default: undefined,
        env: 'SERVICES_APM_SECRET_TOKEN',
        format: String,
        sensitive: true,
      },
      serverUrl: {
        default: undefined,
        env: 'SERVICES_APM_SERVER_URL',
        format: 'url',
      },
      serviceName: {
        default: 'klicker-react',
        env: 'SERVICES_APM_SERVICE_NAME',
        format: String,
      },
      withRum: {
        default: false,
        env: 'SERVICES_APM_WITH_RUM',
        format: Boolean,
      },
    },
    googleAnalytics: {
      enabled: {
        default: false,
        env: 'SERVICES_GOOGLE_ANALYTICS_ENABLED',
        format: Boolean,
      },
      trackingId: {
        default: undefined,
        env: 'SERVICES_GOOGLE_ANALYTICS_TRACKING_ID',
        format: String,
        sensitive: true,
      },
    },
    logrocket: {
      appId: {
        default: undefined,
        env: 'SERVICES_LOGROCKET_APP_ID',
        format: String,
        sensitive: true,
      },
      enabled: {
        default: false,
        env: 'SERVICES_LOGROCKET_ENABLED',
        format: Boolean,
      },
    },
    sentry: {
      dsn: {
        default: undefined,
        env: 'SERVICES_SENTRY_DSN',
        format: 'url',
      },
      enabled: {
        default: false,
        env: 'SERVICES_SENTRY_ENABLED',
        format: Boolean,
      },
    },
    slaask: {
      enabled: {
        default: false,
        env: 'SERVICES_SLAASK_ENABLED',
        format: Boolean,
      },
      widgetKey: {
        default: undefined,
        env: 'SERVICES_SLAASK_WIDGET_KEY',
        format: String,
        sensitive: true,
      },
    },
  },
})
