// @flow

/* eslint-disable import/no-extraneous-dependencies, import/no-unresolved, import/extensions */
/* eslint-disable react/jsx-max-props-per-line, react/jsx-indent-props */
/* eslint-disable react/jsx-first-prop-new-line */
/* eslint-disable react/prop-types */

import React, { Component } from 'react'
import { storiesOf } from '@storybook/react'

import FeedbackChannel from './FeedbackChannel'
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
        onActiveToggle={() => this.setState(prevState => ({ isActive: !prevState.isActive }))}
        onPublicToggle={() => this.setState(prevState => ({ isPublic: !prevState.isPublic }))}
      />
    )
  }
}

const data = [
  { content: 'hello alex!', id: 'abcd', votes: 100 },
{ content: 'bla bleh', id: 'defg', votes: 40 }
]

storiesOf('FeedbackChannel', module)
.add('default', () => <Wrapper data={data} />)
.add('isActive', () => <FeedbackChannel isActive data={data} intl={intlMock}/>)
.add('isPublic', () => <FeedbackChannel isActive isPublic data={data} intl={intlMock}/>)

