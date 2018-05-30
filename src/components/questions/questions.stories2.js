/* eslint-disable import/no-extraneous-dependencies */

import React from 'react'
import { storiesOf } from '@storybook/react'

import ActionBar from './ActionBar'

storiesOf('questions', module)
  .add('ActionBar', () => <ActionBar />)
  .add('ActionBar (creationMode)', () => <ActionBar creationMode />)
  .add('ActionBar (creationMode, 10 items)', () => <ActionBar creationMode itemsChecked={10} />)
