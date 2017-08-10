/* eslint-disable import/no-extraneous-dependencies, import/no-unresolved, import/extensions */
/* eslint-disable react/jsx-max-props-per-line, react/jsx-indent-props */
/* eslint-disable react/jsx-first-prop-new-line */

import React from 'react'
import { storiesOf } from '@storybook/react'
import { boolean, number } from '@storybook/addon-knobs'

import ActionButton from '../src/components/common/ActionButton'
import Collapser from '../src/components/common/Collapser'
import SingleChoiceOptions from '../src/components/questionTypes/options/SingleChoiceOptions'
import Question from '../src/components/questions/Question'
import Session from '../src/components/sessions/Session'
import QuestionBlock from '../src/components/questions/QuestionBlock'
import QuestionSingle from '../src/components/questions/QuestionSingle'
import SessionTimeline from '../src/components/sessions/SessionTimeline'

import '../node_modules/semantic-ui-css/components/reset.min.css'
import '../node_modules/semantic-ui-css/semantic.min.css'
import './base.css'
import * as fixtures from './fixtures'

// mock the intl function
const intl = {
  formatMessage: ({ defaultMessage }) => defaultMessage,
}

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

storiesOf('SessionTimeline', module).add('default', () =>
  <SessionTimeline blocks={[]} intl={intl} />,
)

storiesOf('ActionButton', module).add('default', () =>
  <ActionButton items={[{ label: 'abcd' }, { label: 'cdef' }]} />,
)

storiesOf('Collapser', module).add('default', () =>
  (<Collapser>
    <p>
      hello this is a very short question that is getting longer and longer as we speak. it is in
      fact very very long. the end is even hidden at the beginning.
    </p>
    <p>wow, is this a long question. i could never have imagined seeing such a question.</p>
    <p>
      hello this is a very short question that is getting longer and longer as we speak. it is in
      fact very very long. the end is even hidden at the beginning.
    </p>
    <p>wow, is this a long question. i could never have imagined seeing such a question.</p>
  </Collapser>),
)

storiesOf('SingleChoiceOptions', module).add('default', () =>
  (<SingleChoiceOptions
    options={[
      { label: 'answer1' },
      { label: 'antwort 2' },
      { label: 'option 3' },
      { label: 'tschege' },
    ]}
  />),
)
