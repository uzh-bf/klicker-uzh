module.exports = {
  trailingSlash: false,
  title: 'KlickerUZH',
  tagline: 'Open source instant audience response system',
  url: 'https://www.klicker.uzh.ch',
  baseUrl: '/',
  organizationName: 'uzh-bf',
  projectName: 'klicker-uzh',
  scripts: [
    'https://buttons.github.io/buttons.js',
    {
      src: 'https://betteruptime.com/widgets/announcement.js',
      'data-id': '133428',
      async: true,
    },
  ],
  stylesheets: ['https://fonts.googleapis.com/css?family=Open+Sans'],
  favicon: 'img/KlickerUZH_Orange_Favicon.png',
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
  // plugins: ['@docusaurus/plugin-ideal-image'],
  themeConfig: {
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
      apiKey: 'b945507eeedf6bb6f02688350c0ecc4b',
      indexName: 'klicker-uzh',
    },
    matomo: {
      matomoUrl: 'https://webstats.uzh.ch/',
      siteId: '356',
      phpLoader: 'matomo.php',
      jsLoader: 'matomo.js',
    },
  },
}
