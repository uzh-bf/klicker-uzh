/* eslint-disable import/no-extraneous-dependencies, react/no-multi-comp */

import React from 'react'
import { storiesOf } from '@storybook/react'
import { compose, withState, withHandlers } from 'recompose'

import ConfusionBarometer from './ConfusionBarometer'
import ConfusionSection from './ConfusionSection'
import ConfusionSlider from './ConfusionSlider'
import { intlMock } from '../../../.storybook/utils'

// create a stateful wrapper for the component
const BarometerWithState = compose(
  withState('isActive', 'setIsActive', false),
  withHandlers({
    handleActiveToggle: ({ setIsActive }) => () => setIsActive(isActive => !isActive),
  }),
)(ConfusionBarometer)

const SliderWithState = compose(
  withState('value', 'setValue', 10),
  withHandlers({
    handleChange: ({ setValue }) => newValue => setValue(() => newValue),
  }),
)(ConfusionSlider)

storiesOf('confusion', module)
  .add('ConfusionSlider', () => <SliderWithState title={<h2>Speed</h2>} />)
  .add('ConfusionBarometer', () => <BarometerWithState intl={intlMock} />)
  // HACK: disable test as recharts breaks => https://github.com/recharts/recharts/issues/765
  .add('ConfusionBarometer (isActive) [NoTest]', () => (
    <ConfusionBarometer isActive intl={intlMock} handleActiveToggle={() => null} />
  ))
  .add('ConfusionSection [NoTest]', () => <ConfusionSection />)

/* const createNodeMock = () => {
  const doc = document.implementation.createHTMLDocument()
  return { parentElement: doc.body }
}
const confusionBarometerMocked = () => (
  <ConfusionBarometer isActive intl={intlMock} handleActiveToggle={() => null} />
)
confusionBarometerMocked.options = { createNodeMock }

const confusionSectionMocked = () => <ConfusionSection />
confusionSectionMocked.options = { createNodeMock } */
