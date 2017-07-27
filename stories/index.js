/* eslint-disable import/no-extraneous-dependencies, import/no-unresolved, import/extensions */
/* eslint-disable react/jsx-max-props-per-line, react/jsx-indent-props */
/* eslint-disable react/jsx-first-prop-new-line */

import React from 'react'
import { storiesOf } from '@storybook/react'

import Question from '../src/components/questions/question/Question'
import QuestionSingle from '../src/components/sessions/session/QuestionSingle'
import QuestionBlock from '../src/components/sessions/session/QuestionBlock'
import '../node_modules/semantic-ui-css/semantic.min.css'
import './base.css'

storiesOf('Question', module)
  .add('SC with a single version', () =>
    (<Question id="1"
               lastUsed={['2015-02-08 14:32:11', '2016-09-09 15:22:09']}
               tagList={['CAPM', 'Risk']}
               title="Hello world" type="SC"
    />))
  .add('MC with multiple versions', () =>
    (<Question id="1" lastUsed={['2017-08-08 14:30:22', '2016-09-09 15:22:09']} tagList={['Beta']} title="Good question"
               type="MC" version="2"
    />),
  )

storiesOf('QuestionSingle', module).add('default', () =>
  <QuestionSingle id="abc" title="hello world this is a long long question" type="SC" />,
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
      showSolutions={false}
      timeLimit={60}
    />),
  )
  .add('empty', () => <QuestionBlock questions={[]} showSolutions={false} timeLimit={60} />)
