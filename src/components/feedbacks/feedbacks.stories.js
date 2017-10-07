/* eslint-disable import/no-extraneous-dependencies, react/prop-types */

import React from 'react'
import { storiesOf } from '@storybook/react'
import { action } from '@storybook/addon-actions'
import { compose, withState, withHandlers } from 'recompose'
import FeedbackChannel from './FeedbackChannel'
import Feedback from './Feedback'
import { intlMock } from '../../../.storybook/utils'

// create a stateful wrapper for the component
const FeedbackChannelWithState = compose(
  withState('isActive', 'setIsActive', false),
  withState('isPublic', 'setIsPublic', false),
  withHandlers({
    handleActiveToggle: ({ setIsActive }) => () => setIsActive(isActive => !isActive),
    handlePublicToggle: ({ setIsPublic }) => () => setIsPublic(isPublic => !isPublic),
  }),
)(FeedbackChannel)

const data = [
  { content: 'hello alex!', key: 0, votes: 100 },
  { content: 'bla bleh', key: 1, votes: 40 },
]

storiesOf('feedbacks', module)
  .add('FeedbackChannel', () => <FeedbackChannelWithState data={data} intl={intlMock} />)
  .add('FeedbackChannel (isActive)', () => (
    <FeedbackChannel
      isActive
      data={data}
      intl={intlMock}
      handleActiveToggle={() => action('active-toggle')}
      handlePublicToggle={() => action('public-toggle')}
    />
  ))
  .add('FeedbackChannel (isPublic)', () => (
    <FeedbackChannel
      isActive
      isPublic
      data={data}
      intl={intlMock}
      handleActiveToggle={() => action('active-toggle')}
      handlePublicToggle={() => action('public-toggle')}
    />
  ))
  .add('Feedback', () => <Feedback content="hello world" votes={100} />)
