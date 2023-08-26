// @ts-check

/** @type {import('@docusaurus/types').Config} */
const config = {
  trailingSlash: false,
  title: 'KlickerUZH',
  tagline: 'Open Source Audience Interaction',
  url: 'https://www.klicker.uzh.ch',
  baseUrl: '/',
  organizationName: 'uzh-bf',
  projectName: 'klicker-uzh',
  // scripts: ['https://identity.netlify.com/v1/netlify-identity-widget.js'],
  stylesheets: [
    'https://fonts.googleapis.com/css2?family=Source+Sans+Pro:wght@400;700&display=swap',
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
          showLastUpdateAuthor: false,
          showLastUpdateTime: false,
          sidebarPath: require.resolve('./sidebars.js'),
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
        pages: {},
        sitemap: {},
        theme: {
          customCss: [require.resolve('./src/css/custom.css')],
        },
      },
    ],
  ],
  plugins: [
    async function docusaurusTailwindPlugin(context, options) {
      return {
        name: 'docusaurus-tailwindcss',
        configurePostCss(postcssOptions) {
          // ref: https://dev.to/sajclarke_62/using-tailwindcss-v3-in-docusaurus-in-5-steps-5c26
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
        href: '/home',
      },
      items: [
        {
          to: '/home',
          label: 'Home',
          position: 'left',
        },
        {
          to: 'use_cases',
          label: 'Use Cases',
          position: 'left',
        },
        {
          to: 'getting_started/welcome',
          label: 'Getting Started',
          position: 'left',
        },
        {
          to: 'development',
          label: 'Get Involved',
          position: 'left',
        },
        {
          to: 'faq',
          label: 'FAQ',
          position: 'left',
        },
        // {
        //   to: 'kb',
        //   label: 'Knowledge Base',
        //   position: 'left',
        // },
        {
          type: 'docsVersionDropdown',
          position: 'right',
        },
        {
          to: 'https://community.klicker.uzh.ch',
          label: 'Community',
          position: 'right',
        },
        {
          href: 'https://community.klicker.uzh.ch/c/announce/5',
          label: 'Announcements',
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
      copyright: `Copyright ${new Date().getFullYear()} Teaching Center, Department of Banking and Finance (https://www.bf.uzh.ch), University of Zurich. <br/>All rights reserved. Products and Services displayed herein are trademarks or registered trademarks of their respective owners.`,
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
      appId: 'TZ15XJ66MJ',
      apiKey: '591a723cb9f36f1a60d80180a3463d2f',
      indexName: 'klicker-uzh',
    },
  },
}

module.exports = config
