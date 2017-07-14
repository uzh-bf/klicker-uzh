import React from 'react'
import { Grid } from 'semantic-ui-react'

export default () =>
  (<Grid.Row>
    <Grid.Column as="footer">Klicker 2017 - IBF</Grid.Column>

    <style global jsx>{`
      footer {
        background-color: lightgrey;
        border-top: 1px solid darkgrey;
        height: 3rem;
      }
    `}</style>
  </Grid.Row>)
