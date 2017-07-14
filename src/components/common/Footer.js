import React from 'react'
import { Grid } from 'semantic-ui-react'

export default () =>
  (<Grid.Row>
    <Grid.Column as="footer">Klicker 2017 - IBF</Grid.Column>

    <style jsx global>{`
      footer {
        border-top: 3px solid orange;
        padding: 1rem;
      }
    `}</style>
  </Grid.Row>)
