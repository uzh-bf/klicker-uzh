module.exports = {
  env: {
    development: {
      presets: [
        [
          'next/babel',
          {
            'styled-jsx': {
              plugins: ['styled-jsx-plugin-sass'],
            },
          },
        ],
      ],
      plugins: [
        '@babel/plugin-proposal-pipeline-operator',
        '@babel/plugin-proposal-optional-chaining',
        'inline-dotenv',
        'add-react-displayname',
      ],
    },
    production: {
      presets: [
        [
          'next/babel',
          {
            'styled-jsx': {
              plugins: ['styled-jsx-plugin-sass'],
            },
          },
        ],
      ],
      plugins: [
        '@babel/plugin-proposal-pipeline-operator',
        '@babel/plugin-proposal-optional-chaining',
        'transform-inline-environment-variables',
        ['lodash', { id: ['lodash', 'recompose', 'semantic-ui-react', 'ramda'] }],
        'add-react-displayname',
      ],
    },
    test: {
      presets: [
        [
          'env',
          {
            modules: 'commonjs',
          },
        ],
        [
          'next/babel',
          {
            'styled-jsx': {
              plugins: ['styled-jsx-plugin-sass'],
            },
          },
        ],
      ],
      plugins: [
        '@babel/plugin-proposal-pipeline-operator',
        '@babel/plugin-proposal-optional-chaining',
        'babel-plugin-inline-import-graphql-ast',
      ],
    },
  },
}
