/* eslint-disable import/no-extraneous-dependencies, import/no-unresolved, import/extensions */

import React from 'react'
import { storiesOf } from '@storybook/react'
import QuestionSingle from '../src/components/sessions/session/QuestionSingle'
import QuestionBlock from '../src/components/sessions/session/QuestionBlock'

import '../node_modules/semantic-ui-css/components/reset.css'
import './base.css'

// storiesOf('Question', module).add('basic', () => <Question id="abcd" title="Hello world" />)

// storiesOf('Session', module).add('basic', () => <Session id="abcd" title="Hello world" />)

storiesOf('QuestionSingle', module).add('basic', () =>
  <QuestionSingle id="abc" title="hello world this is a long long question" type="SC" />,
)

// storiesOf('QuestionBlock', module).add('basic', () => <QuestionBlock />)
