/* eslint-disable import/no-extraneous-dependencies */

import React from 'react'
import { storiesOf } from '@storybook/react'

import { intlMock } from '../../../.storybook/utils'

import Session from './Session'
import SessionTimeline from './SessionTimeline'
import fixtures from '../../../.storybook/fixtures'

storiesOf('sessions', module)
  .add('Session', () => <Session {...fixtures.session} />)
  .add('SessionTimeline', () => <SessionTimeline blocks={[]} intl={intlMock} />)
