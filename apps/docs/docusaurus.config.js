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
        blog: {},
        pages: {},
        sitemap: {},
        theme: {
          customCss: [require.resolve('./src/css/custom.css')],
        },
      },
    ],
  ],
  plugins: [
    [
      '@gabrielcsapo/docusaurus-plugin-matomo',
      {
        matomoUrl: 'https://webstats.uzh.ch/',
        siteUrl: 'https://www.klicker.uzh.ch',
        siteId: '356',
        // phpLoader: 'matomo.php',
        // jsLoader: 'matomo.js',
      },
    ],
    [
      '@docusaurus/plugin-ideal-image',
      {
        quality: 75,
        max: 1000, // max resized image's size.
        min: 200, // min resized image's size. if original is lower, use that size.
        steps: 4, // the max number of images generated between min and max (inclusive)
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
        src: 'img/KlickerUZH_Gray_Transparent.png',
        srcDark: 'img/KlickerUZH_Gray_Transparent_inverted.png',
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
          to: 'blog',
          label: 'Blog',
          position: 'right',
        },
        {
          href: 'https://klicker-uzh.feedbear.com/updates',
          label: 'Releases',
          position: 'right',
        },
      ],
    },
    algolia: {
      appId: 'TZ15XJ66MJ',
      apiKey: 'de28b18d3790067e12c8586ba80d70a2',
      indexName: 'klicker-uzh',
    },
  },
}
