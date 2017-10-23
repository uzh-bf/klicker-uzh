/* eslint-disable import/no-extraneous-dependencies, react/prop-types */

import React from 'react'
import { storiesOf } from '@storybook/react'

import {
  Chart,
  Info,
  Possibilities,
  VisualizationType,
  BarChart,
  PieChart,
  TableChart,
  CloudChart,
} from '.'

import { intlMock } from '../../../.storybook/utils'

const dataSC = [
  { value: 'option1', count: 56, correct: false },
  { value: 'option2', count: 344, correct: true },
  { value: 'some other option', count: 9, correct: false },
]

const dataFREE = [
  { count: 10, value: 'hello world' },
  { count: 5, value: 'blablabla ' },
  { count: 100, value: 'hehe' },
  { count: 1, value: 'asdasd' },
  { count: 10, value: 'hello worlds' },
  { count: 5, value: 'blaaaali ' },
]

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
  .add('BarChart [NoTest]', () => <BarChart data={dataSC} />)
  .add('BarChart (with solution) [NoTest]', () => <BarChart isSolutionShown data={dataSC} />)
  .add('PieChart [NoTest]', () => <PieChart data={dataSC} />)
  .add('PieChart (with solution) [NoTest]', () => <PieChart isSolutionShown data={dataSC} />)
  .add('TableChart (FREE)', () => <TableChart data={dataFREE} />)
  .add('CloudChart (FREE) [NoTest]', () => <CloudChart data={dataFREE} />)
