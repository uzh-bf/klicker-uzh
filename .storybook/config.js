/* eslint-disable import/no-extraneous-dependencies, import/no-unresolved, import/extensions */

import { addDecorator, configure } from '@storybook/react'
import { IntlProvider, addLocaleData } from 'react-intl'
// import { DragDropContext } from 'react-dnd'
// import HTML5Backend from 'react-dnd-html5-backend'

import enLocaleData from 'react-intl/locale-data/en'
import deLocaleData from 'react-intl/locale-data/de'

// load intl locale-data for DE and EN
addLocaleData(enLocaleData)
addLocaleData(deLocaleData)

// add a react-intl provider such that components can render
addDecorator(story => <IntlProvider locale="en">{story()}</IntlProvider>)

// addDecorator(story => DragDropContext(HTML5Backend)(<div>{story()}</div>))

// dynamically load stories from the components directory
// load all files with *.stories.js in the end
const req = require.context(
  '../src/components/__stories__',
  true,
  /\.stories\.js$/,
)

function loadStories() {
  // load css needed for each story
  require('../src/lib/semantic/dist/semantic.min.css')
  require('./base.css')

  req.keys().forEach(filename => req(filename))
}

configure(loadStories, module)
