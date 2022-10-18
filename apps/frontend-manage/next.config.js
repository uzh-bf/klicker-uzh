/** @type {import('next').NextConfig} */

// const { withSentryConfig } = require('@sentry/nextjs')

const withTM = require('next-transpile-modules')(['shared-components'])

const nextConfig = {
  experimental: {
    modularizeImports: {
      ramda: {
        transform: 'ramda/es/{{member}}',
      },
      lodash: {
        transform: 'lodash/{{member}}',
      },
    },
  },
  // TODO: disable compression if it is done on the ingress
  compress: true,
  output: 'standalone',
  reactStrictMode: true,
  swcMinify: true,
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  i18n: {
    locales: ['de', 'en'],
    defaultLocale: 'en',
  },
  images: {
    domains: [process.env.S3_HOSTNAME],
    remotePatterns: [
      {
        protocol: 'https',
        hostname: process.env.S3_HOSTNAME,
        port: '443',
        pathname: process.env.S3_PATHNAME,
      },
    ],
  },
  publicRuntimeConfig: {
    API_URL: process.env.NEXT_PUBLIC_API_URL,
  },
  serverRuntimeConfig: {
    API_URL_SSR: process.env.NEXT_PUBLIC_API_URL_SSR,
    APP_DOMAIN: process.env.APP_DOMAIN,
    COOKIE_DOMAIN: process.env.COOKIE_DOMAIN,
  },
  // sentry: {
  //   // Use `hidden-source-map` rather than `source-map` as the Webpack `devtool`
  //   // for client-side builds. (This will be the default starting in
  //   // `@sentry/nextjs` version 8.0.0.) See
  //   // https://webpack.js.org/configuration/devtool/ and
  //   // https://docs.sentry.io/platforms/javascript/guides/nextjs/manual-setup/#use-hidden-source-map
  //   // for more information.
  //   hideSourceMaps: true,
  // },
}

// const sentryWebpackPluginOptions = {
//   // Additional config options for the Sentry Webpack plugin. Keep in mind that
//   // the following options are set automatically, and overriding them is not
//   // recommended:
//   //   release, url, org, project, authToken, configFile, stripPrefix,
//   //   urlPrefix, include, ignore

//   silent: true, // Suppresses all logs
//   // For all available options, see:
//   // https://github.com/getsentry/sentry-webpack-plugin#options.
// }

// Make sure adding Sentry options is the last code to run before exporting, to
// ensure that your source maps include changes from all other Webpack plugins
// module.exports = withSentryConfig(nextConfig, sentryWebpackPluginOptions)
module.exports = withTM(nextConfig)
// module.exports = nextConfig
