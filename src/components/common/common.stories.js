/* eslint-disable import/no-extraneous-dependencies, react/prop-types */

import React from 'react'
import { storiesOf } from '@storybook/react'
import { action } from '@storybook/addon-actions'

import ActionButton from './ActionButton'
import ListWithHeader from './ListWithHeader'

import Collapser from './Collapser'

// create a stateful wrapper for the component
class CollapserWrapper extends React.Component {
  state = {
    collapsed: true,
  }
  render() {
    return (
      <Collapser
        collapsed={this.state.collapsed}
        handleCollapseToggle={() =>
          this.setState(prevState => ({ collapsed: !prevState.collapsed }))}
      >
        {this.props.children}
      </Collapser>
    )
  }
}

// specify some example content
const content = (
  <div>
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
  </div>
)

storiesOf('common', module)
  .add('ActionButton', () => (
    <ActionButton
      items={[
        { handleClick: () => action('click abcd'), label: 'abcd' },
        { handleClick: () => action('click cdef'), label: 'cdef' },
      ]}
    />
  ))
  .add('ListWithHeader', () => (
    <ListWithHeader items={['abcd', 'cdef']}>hello world</ListWithHeader>
  ))
  .add('Collapser', () => <CollapserWrapper>{content}</CollapserWrapper>)
  .add('Collapser (extended)', () => (
    <Collapser handleCollapseToggle={() => action('collapser-clicked')}>{content}</Collapser>
  ))
