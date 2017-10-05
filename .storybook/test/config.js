/* eslint-disable import/no-extraneous-dependencies, import/no-unresolved, import/extensions */

import { addDecorator, configure } from '@storybook/react'
import { IntlProvider } from 'react-intl'
// import { DragDropContext } from 'react-dnd'
// import TestBackend from 'react-dnd-test-backend';

// add global decorator for react-intl
addDecorator(story => <IntlProvider>{story()}</IntlProvider>)

// addDecorator(story => DragDropContext(TestBackend)(<div>{story()}</div>))

// dynamically load stories from the components directory
// load all files with *.stories.js in the end
const req = require.context('../../src/components', true, /\.stories\.js$/)

function loadStories() {
  req.keys().forEach(filename => req(filename))
}

configure(loadStories, module)
