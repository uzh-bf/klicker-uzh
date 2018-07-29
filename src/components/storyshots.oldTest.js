/**
 * @jest-environment jsdom
 */

// eslint-disable-next-line
import initStoryshots from '@storybook/addon-storyshots'

// HACK: workaround for https://github.com/Semantic-Org/Semantic-UI-React/issues/1702
jest.mock('react-dom', () => ({
  findDOMNode: jest.fn(() => {}),
}))

initStoryshots({
  configPath: '.storybook/test',
  storyNameRegex: /^((?!.*?\[NoTest\]).)*$/,
})
