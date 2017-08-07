/* eslint-disable import/no-extraneous-dependencies, import/no-unresolved, import/extensions */

import { addDecorator, configure } from '@storybook/react'

// integrate storybook-addon-knobs
import { withKnobs } from '@storybook/addon-knobs'

// integrate storybook-addon-intl for react-intl
import { setIntlConfig, withIntl } from 'storybook-addon-intl'
import { addLocaleData } from 'react-intl'
import enLocaleData from 'react-intl/locale-data/en'
import deLocaleData from 'react-intl/locale-data/de'

// load intl locale-data for DE and EN
addLocaleData(enLocaleData)
addLocaleData(deLocaleData)

// set the config for react-intl
setIntlConfig({
  defaultLocale: 'en',
  getMessages: locale => require(`../src/lang/${locale}.json`),
  locales: ['en', 'de'],
})

// add global decorators
addDecorator(withKnobs)
addDecorator(withIntl)

configure(() => require('../stories'), module)
