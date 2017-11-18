/* eslint-disable import/no-extraneous-dependencies, react/no-multi-comp */

import React from 'react'
import { storiesOf } from '@storybook/react'
import { compose, mapProps, withHandlers, withState, withProps } from 'recompose'

import { intlMock } from '../../../.storybook/utils'

import TypeChooser from './TypeChooser'
import {
  SCAnswerOptions,
  SCCreationOption,
  SCCreationOptions,
  SCCreationPlaceholder,
  SCCreationPreview,
  FREEAnswerOptions,
  FREECreationPreview,
  FREECreationOptions,
} from '.'

const options = [
  { correct: false, name: 'answer 1' },
  { correct: true, name: 'antwort 2' },
  { correct: false, name: 'option 3' },
]

const SCAnswerOptionsWithState = compose(
  withState('activeOption', 'setActiveOption', 1),
  withHandlers({
    onChange: ({ setActiveOption }) => index => () => setActiveOption(index),
  }),
)(SCAnswerOptions)

const SCCreationOptionsWithState = compose(
  withState('options', 'setOptions', options),
  withHandlers({
    onChange: ({ setOptions }) => newOptions => setOptions(newOptions),
  }),
  mapProps(({ onChange, options: value }) => ({ input: { onChange, value } })),
  withProps({
    meta: {},
  }),
)(SCCreationOptions)

const FREECreationOptionsWithState = compose(
  withState('value', 'setValue', {
    restrictions: {
      max: null,
      min: null,
      type: 'NUMBERS',
    },
  }),
  withHandlers({
    onChange: ({ setValue }) => newValue => setValue(newValue),
  }),
  mapProps(({ onChange, value }) => ({ input: { onChange, value } })),
  withProps({
    meta: {},
  }),
)(FREECreationOptions)

storiesOf('questionTypes/components', module).add('TypeChooser [NoTest]', () => (
  <TypeChooser
    input={{
      onChange: (a) => {
        console.log(a)
      },
      value: 'SC',
    }}
    intl={intlMock}
  />
))

storiesOf('questionTypes/SC', module)
  .add('SC Answering Options', () => <SCAnswerOptionsWithState options={options} />)
  .add('SC Creation Options [NoTest]', () => <SCCreationOptionsWithState intl={intlMock} />)
  .add('SC Creation Option (correct)', () => <SCCreationOption correct name="That's true!" />)
  .add('SC Creation Option (incorrect)', () => (
    <SCCreationOption correct={false} name="So wrong!" />
  ))
  .add('SC Creation Placeholder', () => <SCCreationPlaceholder />)
  .add('SC Creation Preview', () => (
    <SCCreationPreview description="abcd" options={{ choices: options }} title="Hello question" />
  ))

storiesOf('questionTypes/FREE', module)
  .add('FREE Answering Options (unrestricted)', () => (
    <FREEAnswerOptions
      options={{ restrictions: { max: null, min: null, type: 'NONE' } }}
      onChange={f => f}
    />
  ))
  .add('FREE Answering Options (lower bound restriction)', () => (
    <FREEAnswerOptions
      options={{ restrictions: { max: null, min: 9, type: 'RANGE' } }}
      onChange={f => f}
    />
  ))
  .add('FREE Answering Options (upper bound restriction)', () => (
    <FREEAnswerOptions
      options={{ restrictions: { max: 87, min: null, type: 'RANGE' } }}
      onChange={f => f}
    />
  ))
  .add('FREE Answering Options (Number restriction)', () => (
    <FREEAnswerOptions
      options={{ restrictions: { max: 87, min: 900, type: 'RANGE' } }}
      onChange={(a) => {
        console.log(a)
      }}
      value={555}
    />
  ))
  .add('FREE Creation Options [NoTest]', () => <FREECreationOptionsWithState />)
  .add('FREE Creation Preview (unrestricted)', () => (
    <FREECreationPreview description="World!" title="Hello" />
  ))
  .add('FREE Creation Preview (Lower bound restriction)', () => (
    <FREECreationPreview
      description="World!"
      options={{ restrictions: { max: null, min: 90, type: 'RANGE' } }}
      title="Hello"
    />
  ))
  .add('FREE Creation Preview (Number-Range)', () => (
    <FREECreationPreview
      description="World!"
      options={{ restrictions: { max: 900, min: 90, type: 'RANGE' } }}
      title="Hello"
    />
  ))
