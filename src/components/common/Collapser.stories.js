// @flow

/* eslint-disable import/no-extraneous-dependencies, import/no-unresolved, import/extensions */
/* eslint-disable react/jsx-max-props-per-line, react/jsx-indent-props */
/* eslint-disable react/jsx-first-prop-new-line */
/* eslint-disable react/prop-types */

import * as React from 'react'
import { storiesOf } from '@storybook/react'
import { action } from '@storybook/addon-actions'

import Collapser from './Collapser'

// create a stateful wrapper for the component
class Wrapper extends React.Component<*, *> {
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

storiesOf('Collapser', module)
  .add('default', () =>
    (<Wrapper>
      {content}
    </Wrapper>),
  )
  .add('collapsed', () =>
    (<Collapser collapsed handleCollapseToggle={() => action('collapser-clicked')}>
      {content}
    </Collapser>),
  )
  .add('extended', () =>
    (<Collapser handleCollapseToggle={() => action('collapser-clicked')}>
      {content}
    </Collapser>),
  )
