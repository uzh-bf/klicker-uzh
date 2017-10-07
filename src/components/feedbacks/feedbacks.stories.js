/* eslint-disable import/no-extraneous-dependencies, react/prop-types */

import React, { Component } from 'react'
import { storiesOf } from '@storybook/react'
import { action } from '@storybook/addon-actions'

import FeedbackChannel from './FeedbackChannel'
import Feedback from './Feedback'
import { intlMock } from '../../../.storybook/utils'

// create a stateful wrapper for the component
class Wrapper extends Component {
  state = {
    isActive: false,
    isPublic: false,
  }
  render() {
    return (
      <FeedbackChannel
        data={this.props.data}
        intl={intlMock}
        isActive={this.state.isActive}
        isPublic={this.state.isPublic}
        handleActiveToggle={() => this.setState(prevState => ({ isActive: !prevState.isActive }))}
        handlePublicToggle={() => this.setState(prevState => ({ isPublic: !prevState.isPublic }))}
      />
    )
  }
}

const data = [
  { content: 'hello alex!', key: 0, votes: 100 },
  { content: 'bla bleh', key: 1, votes: 40 },
]

storiesOf('feedbacks', module)
  .add('FeedbackChannel', () => <Wrapper data={data} />)
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
