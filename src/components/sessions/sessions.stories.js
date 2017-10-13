/* eslint-disable import/no-extraneous-dependencies */

import React from 'react'
import { storiesOf } from '@storybook/react'
import { DragDropContextProvider } from 'react-dnd'
import HTML5Backend from 'react-dnd-html5-backend'

import { intlMock } from '../../../.storybook/utils'

import Session from './Session'
import SessionTimeline from './SessionTimeline'
import { SessionListPres } from './SessionList'
import fixtures from '../../../.storybook/fixtures'
import SessionTimelineInput from './creation/SessionTimelineInput'
import QuestionDropzone from './creation/QuestionDropzone'

storiesOf('sessions', module)
  .addDecorator(getStory => (
    <DragDropContextProvider backend={HTML5Backend}>{getStory()}</DragDropContextProvider>
  ))
  .add('Session', () => <Session {...fixtures.session} />)
  .add('SessionTimeline', () => (
    <SessionTimeline blocks={[fixtures.questionBlock2]} intl={intlMock} />
  ))
  .add('SessionList', () => <SessionListPres sessions={[fixtures.session, fixtures.session]} />)
  .add('QuestionDropzone', () => (
    <div style={{ height: 100, width: 100 }}>
      <QuestionDropzone />
    </div>
  ))
  .add('SessionTimelineInput', () => (
    <SessionTimelineInput
      input={{
        value: [
          { id: 'id1', title: 'question1', type: 'SC' },
          { id: 'id2', title: 'question2', type: 'FREE' },
        ],
      }}
    />
  ))
