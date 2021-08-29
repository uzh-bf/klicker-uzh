require('dotenv').config()

const convict = require('convict')
const convictValidators = require('convict-format-with-validator')

convict.addFormats(convictValidators)
module.exports = convict({
  app: {
    baseUrl: {
      default: 'localhost:3000',
      env: 'APP_BASE_URL',
      format: 'url',
    },
    cookieDomain: {
      default: undefined,
      env: 'APP_COOKIE_DOMAIN',
      format: 'url',
    },
    domain: {
      default: 'localhost',
      env: 'APP_DOMAIN',
      format: 'url',
    },
    gzip: {
      default: true,
      env: 'APP_GZIP',
      format: 'Boolean',
    },
    https: {
      default: false,
      env: 'APP_HTTPS',
      format: 'Boolean',
    },
    path: {
      default: undefined,
      env: 'APP_PATH',
      format: String,
    },
    port: {
      default: 4000,
      env: 'APP_PORT',
      format: 'port',
    },
    secret: {
      default: undefined,
      env: 'APP_SECRET',
      format: String,
      sensitive: true,
    },
    secure: {
      default: false,
      env: 'APP_SECURE',
      format: 'Boolean',
    },
    trustProxy: {
      default: false,
      env: 'APP_TRUST_PROXY',
      format: 'Boolean',
    },
  },
  cache: {
    redis: {
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
      tls: {
        default: false,
        env: 'CACHE_REDIS_TLS',
        format: 'Boolean',
      },
    },
  },
  email: {
    from: {
      default: 'klicker@localhost.com',
      env: 'EMAIL_FROM',
      format: 'email',
    },
    host: {
      default: undefined,
      env: 'EMAIL_HOST',
      format: 'url',
    },
    port: {
      default: 587,
      env: 'EMAIL_PORT',
      format: 'port',
    },
    user: {
      default: undefined,
      env: 'EMAIL_USER',
      format: String,
      sensitive: true,
    },
    password: {
      default: undefined,
      env: 'EMAIL_PASSWORD',
      format: String,
      sensitive: true,
    },
    secure: {
      default: false,
      env: 'EMAIL_SECURE',
      format: 'Boolean',
    },
  },
  env: {
    arg: 'nodeEnv',
    default: 'development',
    env: 'NODE_ENV',
    format: ['production', 'development', 'test'],
  },
  mongo: {
    database: {
      default: 'klicker',
      env: 'MONGO_DATABASE',
      format: String,
    },
    debug: {
      default: false,
      env: 'MONGO_DEBUG',
      format: 'Boolean',
    },
    url: {
      default: 'localhost:27017',
      env: 'MONGO_URL',
      format: String,
      sensitive: true,
    },
    user: {
      default: undefined,
      env: 'MONGO_USER',
      format: String,
    },
    password: {
      default: undefined,
      env: 'MONGO_PASSWORD',
      format: String,
      sensitive: true,
    },
  },
  s3: {
    accessKey: {
      default: undefined,
      env: 'S3_ACCESS_KEY',
      format: String,
      sensitive: true,
    },
    bucket: {
      default: undefined,
      env: 'S3_BUCKET',
      format: String,
    },
    enabled: {
      default: false,
      env: 'S3_ENABLED',
      format: 'Boolean',
    },
    endpoint: {
      default: undefined,
      env: 'S3_ENDPOINT',
      format: 'url',
    },
    region: {
      default: 'eu-central-1',
      env: 'S3_REGION',
      format: String,
    },
    secretKey: {
      default: undefined,
      env: 'S3_SECRET_KEY',
      format: String,
      sensitive: true,
    },
  },
  security: {
    cors: {
      credentials: {
        default: true,
        env: 'SECURITY_CORS_CREDENTIALS',
        format: 'Boolean',
      },
      origin: {
        default: ['http://localhost:3000'],
        env: 'SECURITY_CORS_ORIGIN',
        format: Array,
      },
    },
    expectCt: {
      enabled: {
        default: false,
        env: 'SECURITY_EXPECT_CT_ENABLED',
        format: 'Boolean',
      },
      enforce: {
        default: false,
        env: 'SECURITY_EXPECT_CT_ENFORCE',
        format: 'Boolean',
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
    filtering: {
      byIP: {
        enabled: {
          default: true,
          env: 'SECURITY_FILTERING_BY_IP_ENABLED',
          format: 'Boolean',
        },
        strict: {
          default: false,
          env: 'SECURITY_FILTERING_BY_IP_STRICT',
          format: 'Boolean',
        },
      },
      byFP: {
        enabled: {
          default: true,
          env: 'SECURITY_FILTERING_BY_FP_ENABLED',
          format: 'Boolean',
        },
        strict: {
          default: false,
          env: 'SECURITY_FILTERING_BY_FP_STRICT',
          format: 'Boolean',
        },
      },
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
        format: 'Boolean',
      },
    },
    hsts: {
      enabled: {
        default: false,
        env: 'SECURITY_HSTS_ENABLED',
        format: 'Boolean',
      },
      includeSubdomains: {
        default: false,
        env: 'SECURITY_HSTS_INCLUDE_SUBDOMAINS',
        format: 'Boolean',
      },
      maxAge: {
        default: 0,
        env: 'SECURITY_HSTS_MAX_AGE',
        format: 'nat',
      },
      preload: {
        default: undefined,
        env: 'SECURITY_HSTS_PRELOAD',
        format: 'Boolean',
      },
    },
    rateLimit: {
      enabled: {
        default: false,
        env: 'SECURITY_RATE_LIMIT_ENABLED',
        format: 'Boolean',
      },
      max: {
        default: 2500,
        env: 'SECURITY_RATE_LIMIT_MAX',
        format: 'nat',
      },
      windowMs: {
        default: 5 * 60 * 1000,
        env: 'SECURITY_RATE_LIMIT_WINDOW_MS',
        format: 'nat',
      },
    },
  },
  services: {
    // Elastic APM
    apm: {
      enabled: {
        default: false,
        env: 'SERVICES_APM_ENABLED',
        format: 'Boolean',
      },
      monitorDev: {
        default: false,
        env: 'SERVICES_APM_DEV',
        format: 'Boolean',
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
        default: 'klicker-api',
        env: 'SERVICES_APM_SERVICE_NAME',
        format: String,
      },
    },
    apolloEngine: {
      apiKey: {
        default: undefined,
        env: 'SERVICES_APOLLO_ENGINE_API_KEY',
        format: String,
        sensitive: true,
      },
      enabled: {
        default: false,
        env: 'SERVICES_APOLLO_ENGINE_ENABLED',
        format: 'Boolean',
      },
    },
    sentry: {
      enabled: {
        default: false,
        env: 'SERVICES_SENTRY_ENABLED',
        format: 'Boolean',
      },
      dsn: {
        default: undefined,
        env: 'SERVICES_SENTRY_DSN',
        format: 'url',
        sensitive: true,
      },
    },
    slack: {
      enabled: {
        default: false,
        env: 'SERVICES_SLACK_ENABLED',
        format: 'Boolean',
      },
      webhook: {
        default: undefined,
        env: 'SERVICES_SLACK_WEBHOOK',
        format: 'url',
        sensitive: true,
      },
    },
  },
})
