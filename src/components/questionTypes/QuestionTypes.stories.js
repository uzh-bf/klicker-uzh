/* eslint-disable import/no-extraneous-dependencies, react/no-multi-comp */

import React from 'react'
import { storiesOf } from '@storybook/react'
import { compose, mapProps, withHandlers, withState } from 'recompose'

import { intlMock } from '../../../.storybook/utils'

import TypeChooser from './TypeChooser'
import {
  SCAnswerOptions,
  SCCreationContent,
  SCCreationOption,
  SCCreationOptions,
  SCCreationPlaceholder,
  SCCreationPreview,
} from './SC'

const options = [
  { correct: false, name: 'answer 1' },
  { correct: true, name: 'antwort 2' },
  { correct: false, name: 'option 3' },
]

const SCAnswerOptionsWithState = compose(
  withState('activeOption', 'setActiveOption', 1),
  withHandlers({
    onOptionClick: ({ setActiveOption }) => index => () => setActiveOption(index),
  }),
)(SCAnswerOptions)

const SCCreationOptionsWithState = compose(
  withState('options', 'setOptions', options),
  withHandlers({
    onChange: ({ setOptions }) => newOptions => setOptions(newOptions),
  }),
  mapProps(({ onChange, options: value }) => ({ input: { onChange, value } })),
)(SCCreationOptions)

storiesOf('questionTypes/components', module).add('TypeChooser', () => (
  <TypeChooser
    input={{
      onChange: (a) => {
        console.log(a)
      },
      value: 'SC',
    }}
    intl={intlMock}
    types={[
      { name: 'Single Choice', value: 'SC' },
      { name: 'Multiple Choice', value: 'MC' },
      { name: 'Free-Form', value: 'FREE' },
    ]}
  />
))

storiesOf('questionTypes/SC', module)
  .add('SC Answering Options', () => <SCAnswerOptionsWithState options={options} />)
  .add('SC Creation Content', () => <SCCreationContent input={{ value: 'hello world' }} />)
  .add('SC Creation Options [NoTest]', () => <SCCreationOptionsWithState intl={intlMock} />)
  .add('SC Creation Option (correct)', () => <SCCreationOption correct name="That's true!" />)
  .add('SC Creation Option (incorrect)', () => (
    <SCCreationOption correct={false} name="So wrong!" />
  ))
  .add('SC Creation Placeholder', () => <SCCreationPlaceholder />)
  .add('SC Creation Preview', () => (
    <SCCreationPreview title="Hello question" description="abcd" options={[]} />
  ))
