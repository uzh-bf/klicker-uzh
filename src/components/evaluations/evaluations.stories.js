/* eslint-disable import/no-extraneous-dependencies, react/prop-types */

import React from 'react'
import { storiesOf } from '@storybook/react'

import Graph from './Graph'
import Possibilities from './Possibilities'
import SampleSolution from './SampleSolution'
import Visualization from './Visualization'

import { intlMock } from '../../../.storybook/utils'

storiesOf('evaluations', module)
  .add('Graph', () => <Graph intl={intlMock} />)
  .add('Possibilities', () => <Possibilities intl={intlMock} />)
  .add('SampleSolution', () => <SampleSolution intl={intlMock} />)
  .add('Visualization', () => <Visualization intl={intlMock} />)
