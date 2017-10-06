/* eslint-disable import/no-extraneous-dependencies */

import React from 'react'
import { storiesOf } from '@storybook/react'
import { DragDropContextProvider } from 'react-dnd'
import HTML5Backend from 'react-dnd-html5-backend'

import fixtures from '../../../.storybook/fixtures'
import Question from './Question'
import QuestionBlock from './QuestionBlock'
import QuestionDetails from './QuestionDetails'
import QuestionSingle from './QuestionSingle'
import QuestionTags from './QuestionTags'

import TagInput from './creation/TagInput'
import TitleInput from './creation/TitleInput'

storiesOf('questions', module)
  .addDecorator(getStory => (
    <DragDropContextProvider backend={HTML5Backend}>{getStory()}</DragDropContextProvider>
  ))
  .add('Question (SC, 1 version)', () => <Question {...fixtures.question} />)
  .add('Question (MC, >1 versions)', () => (
    <Question {...fixtures.question} type="MC" version={2} />
  ))
  .add('Question (MC, no tags)', () => <Question {...fixtures.question} tags={[]} type="MC" />)
  .add('QuestionDetails', () => (
    <QuestionDetails lastUsed={['20.12.2017', '19.12.2017', '10.10.2017']} />
  ))
  .add('QuestionBlock', () => (
    <QuestionBlock {...fixtures.questionBlock} showSolutions={false} timeLimit={60} />
  ))
  .add('QuestionBlock (empty)', () => (
    <QuestionBlock
      {...fixtures.questionBlock}
      questions={[]}
      showSolutions={false}
      timeLimit={60}
    />
  ))
  .add('QuestionSingle', () => <QuestionSingle {...fixtures.question} />)
  .add('QuestionTags', () => <QuestionTags tags={['tag1', 'tag2']} type="SC" />)
  // HACK: disable test for TagInput as autosuggest breaks...
  .add('TagInput [NoTest]', () => <TagInput input={{ value: ['tag1', 'tag2'] }} />)
  .add('TitleInput', () => <TitleInput input={{ value: 'my title' }} />)
