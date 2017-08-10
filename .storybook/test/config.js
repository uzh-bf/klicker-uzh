/* eslint-disable import/no-extraneous-dependencies, import/no-unresolved, import/extensions */

import { addDecorator, configure } from '@storybook/react'
import { IntlProvider } from 'react-intl'

// add global decorator for react-intl
addDecorator(story => <IntlProvider>{story()}</IntlProvider>)

// dynamically load stories from the components directory
// load all files with *.stories.js in the end
const req = require.context('../../src/components', true, /\.stories\.js$/)

function loadStories() {
  req.keys().forEach((filename) => req(filename))
}

configure(loadStories, module);
