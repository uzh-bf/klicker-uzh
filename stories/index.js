/* eslint-disable import/no-extraneous-dependencies, import/no-unresolved, import/extensions */

import React from 'react'
import { storiesOf } from '@storybook/react'
import { Grid } from 'semantic-ui-react'

import Question from '../src/components/questions/Question'
import '../node_modules/semantic-ui-css/semantic.min.css'

storiesOf('Question', module).add('basic', () =>
  (<Grid padded stackable>
    <Grid.Row>
      <Grid.Column>
        <Question id="abcd" title="Hello world" />
      </Grid.Column>
    </Grid.Row>
  </Grid>),
)
