/* eslint-disable import/no-extraneous-dependencies, react/prop-types */

import React from 'react'
import { storiesOf } from '@storybook/react'

import { Chart, Info, Possibilities, VisualizationType, BarChart, PieChart } from '.'

import { intlMock } from '../../../.storybook/utils'

const results = {
  choices: [
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

storiesOf('evaluation/components', module)
  .add('Chart', () => <Chart />)
  .add('Info', () => <Info />)
  .add('Possibilities (SC)', () => (
    <Possibilities
      intl={intlMock}
      questionOptions={{
        choices: [
          { name: 'This is the first possible answer' },
          { name: 'This is the second possible answer' },
          { name: 'This is the third possible answer' },
          { name: 'This is the fourth possible answer' },
        ],
      }}
      questionType="SC"
    />
  ))
  .add('Possibilities (FREE)', () => (
    <Possibilities
      intl={intlMock}
      questionOptions={{
        restrictions: {
          max: 20,
          min: 10,
          type: 'RANGE',
        },
      }}
      questionType="FREE"
    />
  ))
  .add('Visualization', () => (
    <VisualizationType intl={intlMock} onChangeType={console.log('State changed')} type="SC" />
  ))

storiesOf('evaluation/charts', module)
  .add('BarChart [NoTest]', () => <BarChart results={results} />)
  .add('BarChart (with solution) [NoTest]', () => <BarChart isSolutionShown results={results} />)
  .add('PieChart [NoTest]', () => <PieChart results={results} />)
  .add('PieChart (with solution) [NoTest]', () => <PieChart isSolutionShown results={results} />)
