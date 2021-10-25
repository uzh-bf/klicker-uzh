module.exports = {
  title: 'KlickerUZH',
  tagline: 'Open source instant audience response system',
  url: 'https://klicker-uzh-docs.vercel.app',
  baseUrl: '/docs/',
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
          sidebarPath: require.resolve('./sidebars.json'),
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
  plugins: [],
  themeConfig: {
    navbar: {
      logo: {
        src: 'img/KlickerUZH_Gray_Transparent.png',
        href: '/',
      },
      items: [
        {
          to: 'introduction/getting_started',
          label: 'Getting Started',
          position: 'left',
        },
        {
          to: 'faq/faq',
          label: 'FAQ',
          position: 'left',
        },
        {
          to: 'blog/',
          label: 'Project Updates',
          position: 'left',
        },
        {
          to: 'faq/changelog',
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
    footer: {
      links: [],
      copyright: `Copyright ${new Date().getFullYear()} @ Teaching Center, Department of Banking and Finance, University of Zurich. All rights reserved.\nProducts and Services displayed herein are trademarks or registered trademarks of their respective owners.`,
      logo: {
        src: 'img/KlickerUZH_Gray_Transparent.png',
        href: 'https://www.klicker.uzh.ch',
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
