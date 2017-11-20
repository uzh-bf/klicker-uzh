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
  Statistics,
  EvaluationListItem,
} from '.'

import { intlMock } from '../../../.storybook/utils'

const dataSC = [
  { correct: false, count: 56, value: 'option1' },
  { correct: true, count: 344, value: 'option2' },
  { correct: false, count: 9, value: 'some other option' },
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
  .add('EvaluationListItem', () => (
    <div>
      <EvaluationListItem color="red" marker="MIN">
        hello world
      </EvaluationListItem>
      <EvaluationListItem color="blue">hello world 2</EvaluationListItem>
      <EvaluationListItem marker="MAX">hello world 3</EvaluationListItem>
      <EvaluationListItem>hello world 4</EvaluationListItem>
    </div>
  ))
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
  .add('Possibilities (FREE:RANGE)', () => (
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
  .add('Statistics', () => <Statistics max={100} mean={34.3453421} median={23} min={10} />)
  .add('Visualization', () => (
    <VisualizationType intl={intlMock} type="SC" onChangeType={console.log('State changed')} />
  ))

storiesOf('evaluation/charts', module)
  .add('BarChart [NoTest]', () => <BarChart data={dataSC} />)
  .add('BarChart (with solution) [NoTest]', () => <BarChart isSolutionShown data={dataSC} />)
  .add('PieChart [NoTest]', () => <PieChart data={dataSC} />)
  .add('PieChart (with solution) [NoTest]', () => <PieChart isSolutionShown data={dataSC} />)
  .add('TableChart (FREE)', () => <TableChart data={dataFREE} />)
  .add('CloudChart (FREE) [NoTest]', () => <CloudChart data={dataFREE} />)
