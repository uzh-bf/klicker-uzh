module.exports = {
  siteMetadata: {
    title: 'Klicker UZH - Instant Class Response',
  },
  plugins: [
    'gatsby-plugin-react-helmet',
    'gatsby-plugin-styled-jsx',
    {
      resolve: 'gatsby-plugin-matomo',
      options: {
        siteId: '355',
        matomoUrl: 'https://webstats.uzh.ch',
        siteUrl: 'https://www.klicker.uzh.ch',
      },
    },
  ],
}
