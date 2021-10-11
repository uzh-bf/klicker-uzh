module.exports = {
  title: 'KlickerUZH',
  tagline: 'Open source instant audience response system',
  url: 'https://uzh-bf.github.io',
  baseUrl: '/',
  organizationName: 'uzh-bf',
  projectName: 'klicker-uzh',
  scripts: ['https://buttons.github.io/buttons.js'],
  stylesheets: ['https://fonts.googleapis.com/css?family=Open+Sans'],
  favicon: 'img/favicon.png',
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
          showLastUpdateTime: true,
          sidebarPath: require.resolve('./sidebars.json'),
        },
        blog: {},
        theme: {
          customCss: [require.resolve('./src/css/customTheme.css')],
        },
      },
    ],
  ],
  plugins: [],
  themeConfig: {
    navbar: {
      title: '',
      logo: {
        src: 'img/klicker_uzh_logo.png',
      },
      items: [
        {
          to: 'docs/',
          label: 'Docs',
          position: 'left',
        },
        {
          to: 'docs/faq/faq',
          label: 'FAQ',
          position: 'left',
        },
        {
          href: 'https://www.klicker.uzh.ch/roadmap',
          label: 'Roadmap',
          position: 'left',
        },
      ],
    },
    footer: {
      links: [],
      copyright:
        'Copyright 2021 @ Teaching Center, Department of Banking and Finance, University of Zurich. All rights reserved.\nProducts and Services displayed herein are trademarks or registered trademarks of their respective owners.',
      logo: {
        src: 'img/favicon.png',
      },
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
