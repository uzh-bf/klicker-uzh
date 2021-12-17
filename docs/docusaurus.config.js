module.exports = {
  trailingSlash: false,
  title: 'KlickerUZH',
  tagline: 'Open source instant audience response system',
  url: 'https://www.klicker.uzh.ch',
  baseUrl: '/',
  organizationName: 'uzh-bf',
  projectName: 'klicker-uzh',
  scripts: ['https://buttons.github.io/buttons.js'],
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
          editUrl: 'https://github.com/uzh-bf/klicker-uzh/edit/dev/docs',
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
        href: '/',
      },
      items: [
        {
          to: '/home',
          label: 'Home',
          position: 'left',
        },
        {
          to: 'introduction/getting_started',
          label: 'Getting Started',
          position: 'left',
        },
        {
          to: 'use_cases/live_qa',
          label: 'Use Cases',
          position: 'left',
        },
        {
          to: 'faq',
          label: 'FAQ',
          position: 'left',
        },
        {
          to: 'blog',
          label: 'Project Updates',
          position: 'left',
        },
        {
          href: 'https://klicker-uzh.feedbear.com/updates',
          label: 'Release Notes',
          position: 'left',
        },
        {
          href: 'https://www.klicker.uzh.ch/roadmap',
          label: 'Roadmap',
          position: 'left',
        },
      ],
    },
    algolia: {
      apiKey: 'b945507eeedf6bb6f02688350c0ecc4b',
      indexName: 'klicker-uzh',
    },
    gtag: {
      trackingID: 'UA-33258666-20',
    },
  },
}
