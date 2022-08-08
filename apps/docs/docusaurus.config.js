module.exports = {
  trailingSlash: false,
  title: 'KlickerUZH',
  tagline: 'Open source instant audience response system',
  url: 'https://www.klicker.uzh.ch',
  baseUrl: '/',
  organizationName: 'uzh-bf',
  projectName: 'klicker-uzh',
  scripts: [
    // 'https://buttons.github.io/buttons.js',
    {
      src: 'https://betteruptime.com/widgets/announcement.js',
      'data-id': '133428',
      async: true,
    },
  ],
  stylesheets: ['https://fonts.googleapis.com/css?family=Open+Sans'],
  favicon: '/favicon.ico',
  customFields: {
    title_index: 'Klicker',
    subtitle_index: 'UZH',
    users: [],
    fonts: {
      myFont: ['Open Sans', 'Serif'],
    },
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
          editUrl: 'https://github.com/uzh-bf/klicker-uzh/edit/dev/apps/docs',
          routeBasePath: '/',
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
            from: '/',
            to: '/home',
          },
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
    metadata: [
      {
        name: 'keywords',
        content:
          'audience interaction, audience interactivity, digital classroom interaction, open source audience interaction, ask questions live, ask anonymous questions, anonymous live q&a',
      },
    ],
    navbar: {
      logo: {
        src: 'img/KlickerUZH_Gray_Transparent_borderless.png',
        srcDark: 'img/KlickerUZH_Gray_Transparent_borderless_inverted.png',
        href: '/home',
      },
      items: [
        {
          to: '/home',
          label: 'Home',
          position: 'left',
        },
        {
          to: 'use_cases/live_qa',
          label: 'Use Cases',
          position: 'left',
        },
        {
          to: 'introduction/getting_started',
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
    algolia: {
      appId: 'TZ15XJ66MJ',
      apiKey: '1c175419aef4dbdbff3c5becd8613a8a',
      indexName: 'klicker-uzh',
    },
  },
}
