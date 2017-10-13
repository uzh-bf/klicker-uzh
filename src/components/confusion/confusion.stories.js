/* eslint-disable import/no-extraneous-dependencies, react/no-multi-comp */

import React from 'react'
import { storiesOf } from '@storybook/react'
import { compose, withHandlers, withState } from 'recompose'

import { ConfusionBarometer, ConfusionSection, ConfusionSlider } from '.'
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

const data = [
  { createdAt: '11:10', difficulty: 10, speed: 0 },
  { createdAt: '11:11', difficulty: 20, speed: 10 },
  { createdAt: '11:12', difficulty: 40, speed: 30 },
  { createdAt: '11:13', difficulty: 30, speed: 40 },
  { createdAt: '11:14', difficulty: 0, speed: 10 },
  { createdAt: '11:15', difficulty: -20, speed: 20 },
]

storiesOf('confusion', module)
  .add('ConfusionSlider', () => <SliderWithState title={<h2>Speed</h2>} />)
  .add('ConfusionBarometer', () => <BarometerWithState confusionTS={data} intl={intlMock} />)
  // HACK: disable test as recharts breaks => https://github.com/recharts/recharts/issues/765
  .add('ConfusionBarometer (isActive) [NoTest]', () => (
    <ConfusionBarometer
      isActive
      confusionTS={data}
      intl={intlMock}
      handleActiveToggle={() => null}
    />
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
