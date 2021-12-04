import React from 'react'
import { Container, Grid, List } from 'semantic-ui-react'
import Link from 'next/link'

import KlickerLogo from './KlickerLogo'

function Footer() {
  return (
    <footer className="text-white bg-[#375164] p-8">
      <Grid columns={2} stackable>
        <Grid.Row>
          <Grid.Column>
            <strong>
              <KlickerLogo width={150} />
            </strong>

            <p>
              Created by the{' '}
              <a href="https://www.bf.uzh.ch/de/studies/general/teaching-center.html">
                Teaching Center
              </a>{' '}
              at the Department of Banking and Finance, University of Zurich.
            </p>

            <p>
              Contact us via{' '}
              <a href="mailto:klicker.support@uzh.ch">klicker.support@uzh.ch</a>
            </p>

            <address>
              Teaching Center
              <br />
              Department of Banking and Finance
              <br />
              Plattenstrasse 14
              <br />
              8032 Zurich
            </address>
          </Grid.Column>
          <Grid.Column>
            <List>
              <List.Item className="text-white">
                <Link href="/tos">Terms of Service</Link>
              </List.Item>

              <List.Item>
                <Link href="/privacy">Privacy Policy</Link>
              </List.Item>
            </List>
          </Grid.Column>
        </Grid.Row>
      </Grid>
    </footer>
  )
}

export default Footer
