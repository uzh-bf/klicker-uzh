import initStoryshots from '@storybook/addon-storyshots'

initStoryshots({
  configPath: '.storybook/test',
  storyNameRegex: /^((?!.*?\[NoTest\]).)*$/,
})
