/* eslint-disable import/no-extraneous-dependencies, import/no-unresolved, import/extensions */
/* eslint-disable react/jsx-max-props-per-line, react/jsx-indent-props */
/* eslint-disable react/jsx-first-prop-new-line */

import React from 'react'
import { storiesOf } from '@storybook/react'
import { text, boolean, number } from '@storybook/addon-knobs'

import Question from '../src/components/questions/question/Question'

import Session from '../src/components/sessions/session/Session'
import QuestionBlock from '../src/components/sessions/session/QuestionBlock'
import QuestionSingle from '../src/components/sessions/session/QuestionSingle'

import '../node_modules/semantic-ui-css/semantic.min.css'
import './base.css'

storiesOf('Question', module)
  .add('SC with a single version', () =>
    (<Question
      id="1"
      lastUsed={['2015-02-08 14:32:11', '2016-09-09 15:22:09']}
      tags={['CAPM', 'Risk']}
      title={text('title', 'Hello World')}
      type="SC"
    />),
  )
  .add('MC with multiple versions', () =>
    (<Question
      id="1"
      lastUsed={['2017-08-08 14:30:22', '2016-09-09 15:22:09']}
      tags={['Beta']}
      title={text('title', 'Hello World')}
      type="MC"
      version="2"
    />),
  )
  .add('MC without tags', () =>
    (<Question
      id="1"
      lastUsed={['2017-08-08 14:30:22', '2016-09-09 15:22:09', '2015-10-09 15:22:09']}
      tags={[]}
      title={text('title', 'Hello World')}
      type="MC"
      version="1"
    />),
  )

storiesOf('Session', module).add('default', () =>
  <Session createdAt="2017-08-08 14:30:22" name="Hello World" status="PLANNED" />,
)

storiesOf('QuestionBlock', module)
  .add('default', () =>
    (<QuestionBlock
      questions={[
        {
          id: 'abcd',
          title: 'haha',
          type: 'SC',
        },
        {
          id: 'dhds',
          title: 'haha 2 asasd',
          type: 'FREE',
        },
        {
          id: 'dkdj',
          title: 'lorem ipsum haha',
          type: 'MC',
        },
      ]}
      showSolutions={boolean('showSolutions', false)}
      timeLimit={number('timeLimit', 60)}
    />),
  )
  .add('empty', () =>
    (<QuestionBlock
      questions={[]}
      showSolutions={boolean('showSolutions', false)}
      timeLimit={number('timeLimit', 60)}
    />),
  )

storiesOf('QuestionSingle', module).add('default', () =>
  <QuestionSingle id="abc" title="hello world this is a long long question" type="SC" />,
)
