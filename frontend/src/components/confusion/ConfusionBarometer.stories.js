// @flow

/* eslint-disable import/no-extraneous-dependencies, import/no-unresolved, import/extensions */
/* eslint-disable react/jsx-max-props-per-line, react/jsx-indent-props */
/* eslint-disable react/jsx-first-prop-new-line */
/* eslint-disable react/prop-types */

import React, { Component } from 'react'
import { storiesOf } from '@storybook/react'

import ConfusionBarometer from './ConfusionBarometer'
import { intlMock } from '../../../.storybook/utils'

// create a stateful wrapper for the component
class Wrapper extends Component {
  state = {
    isActive: false,
  }
  render() {
    return (
      <ConfusionBarometer
        intl={intlMock}
        isActive={this.state.isActive}
        handleActiveToggle={() => this.setState(prevState => ({ isActive: !prevState.isActive }))}
      />
    )
  }
}

/*
const createNodeMock = () => {
  const doc = document.implementation.createHTMLDocument();
  return { parentElement: doc.body };
}
const confusionBarometerMocked = () => <ConfusionBarometer isActive intl={intlMock} />
confusionBarometerMocked.options = { createNodeMock }
*/

storiesOf('ConfusionBarometer', module).add('default', () => <Wrapper />)
// TODO: reenable if issue with refs is fixed
// https://github.com/recharts/recharts/issues/765
// .add('isActive', confusionBarometerMocked)
