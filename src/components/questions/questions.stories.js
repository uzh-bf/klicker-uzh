/* eslint-disable import/no-extraneous-dependencies */

import React from 'react'
import { storiesOf } from '@storybook/react'
import { DragDropContextProvider } from 'react-dnd'
import HTML5Backend from 'react-dnd-html5-backend'

import fixtures from '../../../.storybook/fixtures'
import {
  Question,
  QuestionBlock,
  QuestionDetails,
  QuestionSingle,
  QuestionTags,
  TagInput,
  TitleInput,
  ContentInput,
} from '.'
import { TagListPres } from './TagList'
import { QuestionListPres } from './QuestionList'

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
    <QuestionDetails
      description="hello world blabla"
      lastUsed={['20.12.2017', '19.12.2017', '10.10.2017']}
    />
  ))
  .add('QuestionList', () => (
    <QuestionListPres questions={fixtures.questions} onQuestionDropped={() => null} />
  ))
  .add('QuestionList (creation mode)', () => (
    <QuestionListPres creationMode questions={fixtures.questions} onQuestionDropped={() => null} />
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
  .add('QuestionTags', () => <QuestionTags tags={fixtures.question.tags} type="SC" />)
  .add('TagList', () => (
    <TagListPres
      handleTagClick={() => null}
      tags={[{ id: '1', isActive: false, name: 'CAPM' }, { id: '2', isActive: true, name: 'CF' }]}
    />
  ))
  // HACK: disable test for TagInput as autosuggest breaks...
  .add('TagInput [NoTest]', () => (
    <form className="ui form">
      <TagInput input={{ onChange: () => null, value: ['tag1', 'tag2'] }} />
    </form>
  ))
  .add('TitleInput [NoTest]', () => (
    <form className="ui form">
      <TitleInput input={{ onChange: () => null, value: 'my title' }} />
    </form>
  ))
  .add('ContentInput [NoTest]', () => (
    <form className="ui form">
      <ContentInput input={{ onChange: () => null, value: 'hello world' }} />
    </form>
  ))
