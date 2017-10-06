/* eslint-disable import/no-extraneous-dependencies, react/no-multi-comp */

import React, { Component } from 'react'
import { storiesOf } from '@storybook/react'

import ConfusionBarometer from './ConfusionBarometer'
import ConfusionSection from './ConfusionSection'
import ConfusionSlider from './ConfusionSlider'
import { intlMock } from '../../../.storybook/utils'

// create a stateful wrapper for the component
class BarometerWrapper extends Component {
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

// create a stateful wrapper for the component
class SliderWrapper extends Component {
  state = {
    value: 10,
  }
  render() {
    return (
      <ConfusionSlider
        title={<h2>Speed</h2>}
        value={this.state.value}
        handleChange={value => this.setState({ value })}
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

storiesOf('ConfusionBarometer', module)
  .add('ConfusionBarometer', () => <BarometerWrapper />)
  .add('ConfusionSection', () => <ConfusionSection />)
  .add('ConfusionSlider', () => <SliderWrapper />)
// TODO: reenable if issue with refs is fixed
// https://github.com/recharts/recharts/issues/765
// .add('isActive', confusionBarometerMocked)
