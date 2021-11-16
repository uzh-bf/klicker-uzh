const { RemoteBrowserTarget } = require('happo.io')

module.exports = {
  apiKey: process.env.HAPPO_API_KEY,
  apiSecret: process.env.HAPPO_API_SECRET,
  pages: [
    {
      url: 'https://app.klicker.uzh.ch',
      title: 'Landing Page',
    },
    {
      url: 'https://app.klicker.uzh.ch/user/login',
      title: 'Login',
    },
    {
      url: 'https://app.klicker.uzh.ch/user/registration',
      title: 'Registration',
    },
    {
      url: 'https://app.klicker.uzh.ch/user/requestPassword',
      title: 'Password Reset',
    },
    {
      url: 'https://app.klicker.uzh.ch/join/rol',
      title: 'Active Session',
    },
  ],
  targets: {
    firefox: new RemoteBrowserTarget('firefox', {
      viewport: '1024x768',
    }),
    chrome: new RemoteBrowserTarget('chrome', {
      viewport: '1024x768',
    }),
    edge: new RemoteBrowserTarget('edge', {
      viewport: '1024x768',
    }),
    safari: new RemoteBrowserTarget('safari', {
      viewport: '1024x768',
    }),
    'ios-safari': new RemoteBrowserTarget('ios-safari', {
      viewport: '375x667',
    }),
  },
}
