/**
 * Copyright (c) 2017-present, Facebook, Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

const users = []

const siteConfig = {
  gaTrackingId: 'UA-33258666-20',
  algolia: {
    apiKey: 'b945507eeedf6bb6f02688350c0ecc4b',
    indexName: 'klicker-uzh',
  },
  title:
    '' /* empty, as we have the logo in the header title for your website */,
  title_index: 'Klicker',
  subtitle_index: 'UZH',
  tagline: 'Open source instant audience response system',
  url: 'https://uzh-bf.github.io' /* your website url */,
  baseUrl: '/klicker-uzh/' /* base url for your project */,
  projectName: 'klicker-uzh',
  organizationName: 'uzh-bf',
  headerLinks: [
    { doc: 'introduction/getting_started', label: 'Docs' },
    { doc: 'faq/faq', label: 'FAQ' },
    {
      href: 'https://github.com/orgs/uzh-bf/projects/4',
      label: 'Roadmap',
    },
  ],
  /* path to images for header/footer */
  headerIcon: 'img/klicker_uzh_logo.png',
  footerIcon: 'img/favicon.png',
  favicon: 'img/favicon.png',
  /* colors for website */
  colors: {
    primaryColor: '#1e70bf' /* header, navigation bar and sidebar */,
    secondaryColor:
      '#1e70bf' /* second row of header for narrow and mobile view */,
    customHeaderColor: '#375164',
  },
  users,
  /* custom fonts for website */
  fonts: {
    myFont: ['Open Sans', 'Serif'],
  },
  // This copyright info is used in /core/Footer.js and blog rss/atom feeds.
  copyright:
    'Copyright ' +
    new Date().getFullYear() +
    ' @ Teaching Center, Department of Banking and Finance, University of Zurich. All rights reserved.\n' +
    'Products and Services displayed herein are trademarks or registered trademarks of their respective owners.',
  highlight: {
    // Highlight.js theme to use for syntax highlighting in code blocks
    theme: 'default',
  },
  scripts: ['https://buttons.github.io/buttons.js'],
  stylesheets: ['https://fonts.googleapis.com/css?family=Open+Sans'],
  // You may provide arbitrary config keys to be used as needed by your template.
  repoUrl: 'https://github.com/uzh-bf/klicker-uzh',

  // On page navigation for the current documentation page.
  onPageNav: 'separate',
  // No .html extensions for paths.
  cleanUrl: true,
  // Collapsible categories in the side navigation.
  docsSideNavCollapsible: true,
}

module.exports = siteConfig
