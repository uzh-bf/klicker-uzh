import type * as Preset from '@docusaurus/preset-classic'
import type { Config } from '@docusaurus/types'
import rehypeKatex from 'rehype-katex'
import remarkMath from 'remark-math'

const config: Config = {
  trailingSlash: true,
  title: 'KlickerUZH',
  tagline: 'Open Source Audience Interaction',
  url: 'https://www.klicker.uzh.ch',
  baseUrl: '/',
  organizationName: 'uzh-bf',
  projectName: 'klicker-uzh',
  // scripts: ['https://identity.netlify.com/v1/netlify-identity-widget.js'],
  stylesheets: [
    'https://fonts.googleapis.com/css2?family=Source+Sans+Pro:wght@400;700&display=swap',
    'https://cdn.jsdelivr.net/npm/katex@0.16.4/dist/katex.min.css',
  ],
  favicon: '/favicon.ico',
  customFields: {
    repoUrl: 'https://github.com/uzh-bf/klicker-uzh',
  },
  onBrokenLinks: 'log',
  onBrokenMarkdownLinks: 'log',
  presets: [
    [
      '@docusaurus/preset-classic',
      {
        docs: {
          remarkPlugins: [remarkMath],
          rehypePlugins: [rehypeKatex],
          showLastUpdateAuthor: false,
          showLastUpdateTime: false,
          sidebarPath: './sidebars.js',
          editUrl: 'https://github.com/uzh-bf/klicker-uzh/edit/v3/apps/docs',
          routeBasePath: '/',
          lastVersion: 'current',
          versions: {
            current: {
              label: 'v3',
              path: '',
            },
          },
        },
        pages: {
          editUrl:
            'https://github.com/facebook/docusaurus/tree/main/website/src/pages',
          editLocalizedFiles: true,
          showLastUpdateAuthor: true,
          showLastUpdateTime: true,
        },
        sitemap: {},
        theme: {
          customCss: ['./src/css/custom.css'],
        },
      } satisfies Preset.Options,
    ],
  ],
  plugins: [
    async function docusaurusTailwindPlugin(context, options) {
      return {
        name: 'docusaurus-tailwindcss',
        configurePostCss(postcssOptions) {
          // ref: https://dev.to/sajclarke_62/using-tailwindcss-v3-in-docusaurus-in-5-steps-5c26
          // postcssOptions.plugins.push(require('postcss-import'))
          postcssOptions.plugins.push(require('tailwindcss'))
          postcssOptions.plugins.push(require('autoprefixer'))
          return postcssOptions
        },
      }
    },
    [
      '@gabrielcsapo/docusaurus-plugin-matomo',
      {
        matomoUrl: 'https://webstats.uzh.ch',
        siteUrl: 'https://www.klicker.uzh.ch',
        siteId: '356',
        matomoPhpScript: 'matomo.php',
        matomoJsScript: 'matomo.js',
        dev: true,
      },
    ],
    [
      '@docusaurus/plugin-ideal-image',
      {
        quality: 85,
        max: 1400, // max resized image's size.
        min: 400, // min resized image's size. if original is lower, use that size.
        steps: 5, // the max number of images generated between min and max (inclusive)
        disableInDev: false,
      },
    ],
    [
      '@docusaurus/plugin-client-redirects',
      {
        redirects: [
          {
            from: '/tos',
            to: '/terms_of_service',
          },
          {
            from: '/privacy',
            to: '/privacy_policy',
          },
        ],
      },
    ],
  ],
  themeConfig: {
    announcementBar: {
      id: 'release_v3',
      content:
        'We are offering introductory courses on Zoom. For more details see <a target="_blank" href="https://community.klicker.uzh.ch/t/2024-01-10-2024-02-08-klickeruzh-v3-0-introduction-and-didactic-use-cases/257">the following page</a>.',
      backgroundColor: '#fafbfc',
      textColor: '#091E42',
      isCloseable: false,
    },
    colorMode: {
      defaultMode: 'light',
      disableSwitch: true,
    },
    metadata: [
      {
        name: 'keywords',
        content:
          'audience interaction, audience interactivity, digital classroom interaction, open source audience interaction, ask questions live, ask anonymous questions, anonymous live q&a',
      },
    ],
    navbar: {
      hideOnScroll: false,
      logo: {
        src: '/img/KlickerLogo.png',
        srcDark: '/img/KlickerLogo.png',
        href: '/',
      },
      items: [
        {
          to: '/',
          label: 'Home',
          position: 'left',
          activeBasePath: 'landing',
        },
        {
          to: 'use_cases',
          label: 'Use Cases',
          position: 'left',
        },
        {
          to: 'getting_started/welcome',
          label: 'Docs',
          position: 'left',
        },
        {
          to: 'development',
          label: 'Roadmap',
          position: 'left',
        },
        // {
        //   to: 'faq',
        //   label: 'FAQ',
        //   position: 'left',
        // },
        // {
        //   to: 'kb',
        //   label: 'Knowledge Base',
        //   position: 'left',
        // },
        // {
        //   type: 'docsVersionDropdown',
        //   position: 'right',
        // },
        {
          to: 'https://community.klicker.uzh.ch',
          label: 'Community',
          position: 'right',
        },
        // {
        //   href: 'https://community.klicker.uzh.ch/c/announce/5',
        //   label: 'Announcements',
        //   position: 'right',
        // },
        {
          href: 'https://auth.klicker.uzh.ch',
          label: 'Login',
          position: 'right',
        },
        {
          href: 'https://klicker-uzh.feedbear.com',
          label: 'Feedback',
          position: 'right',
        },
      ],
    },
    footer: {
      logo: {
        alt: 'KlickerUZH Logo',
        src: '/img/KlickerLogo.png',
        width: 250,
        // height: 51,
      },
      copyright: `Copyright ${new Date().getFullYear()} Teaching Center, Department of Finance (https://www.df.uzh.ch), University of Zurich. <br/>All rights reserved. Products and Services displayed herein are trademarks or registered trademarks of their respective owners.`,
      links: [
        {
          title: 'Docs',
          items: [
            {
              label: 'Home',
              to: '/',
            },
            {
              label: 'Privacy Policy',
              to: '/privacy_policy',
            },
            {
              label: 'Terms of Service',
              to: '/terms_of_service',
            },
          ],
        },
        {
          title: 'Support',
          items: [
            {
              label: 'FAQ',
              to: '/faq',
            },
            {
              label: 'Feedback',
              href: 'https://klicker-uzh.feedbear.com',
            },
            {
              label: 'Community',
              href: 'https://community.klicker.uzh.ch',
            },
          ],
        },
        {
          title: 'Technical',
          items: [
            {
              label: 'System Status',
              href: 'https://klicker-uzh.betteruptime.com/',
            },
            {
              label: 'Source Code',
              href: 'https://github.com/uzh-bf/klicker-uzh',
            },
          ],
        },
      ],
    },
    algolia: {
      // The application ID provided by Algolia
      appId: 'TZ15XJ66MJ',

      // Public API key: it is safe to commit it
      apiKey: '591a723cb9f36f1a60d80180a3463d2f',

      indexName: 'klicker-uzh',

      // Optional: see doc section below
      contextualSearch: true,

      // Optional: Specify domains where the navigation should occur through window.location instead on history.push. Useful when our Algolia config crawls multiple documentation sites and we want to navigate with window.location.href to them.
      externalUrlRegex: 'external\\.com|domain\\.com',

      // Optional: Replace parts of the item URLs from Algolia. Useful when using the same search index for multiple deployments using a different baseUrl. You can use regexp or string in the `from` param. For example: localhost:3000 vs myCompany.com/docs
      replaceSearchResultPathname: {
        from: '/docs/', // or as RegExp: /\/docs\//
        to: '/',
      },

      // Optional: Algolia search parameters
      searchParameters: {},

      // Optional: path for search page that enabled by default (`false` to disable it)
      searchPagePath: 'search',

      // Optional: whether the insights feature is enabled or not on Docsearch (`false` by default)
      insights: false,

      //... other Algolia params
    },
  },
}

module.exports = config
