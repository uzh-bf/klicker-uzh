// @flow
/* eslint-disable import/no-extraneous-dependencies, import/no-unresolved, import/extensions */
/* eslint-disable react/jsx-max-props-per-line, react/jsx-indent-props */
/* eslint-disable react/jsx-first-prop-new-line */

import React from 'react'
import { storiesOf } from '@storybook/react'
import { boolean, number } from '@storybook/addon-knobs'

import Question from '../src/components/questions/Question'
import Session from '../src/components/sessions/Session'
import QuestionBlock from '../src/components/questions/QuestionBlock'
import QuestionSingle from '../src/components/questions/QuestionSingle'
import SessionTimeline from '../src/components/sessions/SessionTimeline'

import '../node_modules/semantic-ui-css/semantic.min.css'
import './base.css'
import * as fixtures from './fixtures'

storiesOf('Question', module)
  .add('SC with a single version', () => <Question {...fixtures.question} />)
  .add('MC with multiple versions', () => <Question {...fixtures.question} type="MC" version={2} />)
  .add('MC without tags', () => <Question {...fixtures.question} tags={[]} type="MC" />)

storiesOf('Session', module).add('default', () => <Session {...fixtures.session} />)

storiesOf('QuestionBlock', module)
  .add('default', () =>
    (<QuestionBlock
      {...fixtures.questionBlock}
      showSolutions={boolean('showSolutions', false)}
      timeLimit={number('timeLimit', 60)}
    />),
  )
  .add('empty', () =>
    (<QuestionBlock
      {...fixtures.questionBlock}
      questions={[]}
      showSolutions={boolean('showSolutions', false)}
      timeLimit={number('timeLimit', 60)}
    />),
  )

storiesOf('QuestionSingle', module).add('default', () => <QuestionSingle {...fixtures.question} />)

storiesOf('SessionTimeline', module).add('default', () => <SessionTimeline blocks={[]} />)
