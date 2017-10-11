/* eslint-disable import/no-extraneous-dependencies, react/prop-types */

import React from 'react'
import { storiesOf } from '@storybook/react'

import Graph from './Graph'
import Possibilities from './Possibilities'
import SampleSolution from './SampleSolution'
import Visualization from './Visualization'

import { intlMock } from '../../../.storybook/utils'

const objectIGet = {
  type: 'SC', // SC, FREE ...
}

storiesOf('evaluations', module)
  .add('Graph', () => <Graph intl={intlMock} visualization={'pieChart'} />)
  .add('Possibilities', () => (
    <Possibilities
      intl={intlMock}
      options={[
        { text: 'This is the first possible answer' },
        { text: 'This is the second possible answer' },
        { text: 'This is the third possible answer' },
        { text: 'This is the fourth possible answer' },
      ]}
    />
  ))
  .add('SampleSolution', () => <SampleSolution intl={intlMock} />)
  .add('Visualization', () => (
    <Visualization intl={intlMock} onChangeType={console.log('State changed')} type={objectIGet.type} />
  ))
