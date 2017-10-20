/* eslint-disable import/no-extraneous-dependencies, react/prop-types */

import React from 'react'
import { storiesOf } from '@storybook/react'

import { Chart, Possibilities, VisualizationType, BarChart, PieChart } from '.'

import { intlMock } from '../../../.storybook/utils'

const results = {
  options: [
    { correct: false, name: 'option 1', numberOfVotes: 56 },
    {
      correct: true,
      name: 'option 2',
      numberOfVotes: 344,
    },
    { correct: false, name: 'some other option', numberOfVotes: 9 },
  ],
  totalResponses: 409,
}

storiesOf('evaluations', module)
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
  .add('Visualization', () => (
    <VisualizationType intl={intlMock} onChangeType={console.log('State changed')} type="SC" />
  ))
  .add('Chart', () => <Chart />)
  .add('BarChart', () => <BarChart results={results} />)
  .add('PieChart', () => <PieChart results={results} />)
  .add('BarChart (with solution)', () => <BarChart isSolutionShown results={results} />)
  .add('PieChart (with solution)', () => <PieChart isSolutionShown results={results} />)
