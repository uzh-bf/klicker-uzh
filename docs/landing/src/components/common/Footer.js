import React from 'react'
import { Container, Grid, List } from 'semantic-ui-react'
import { Element } from 'react-scroll'
import { Link } from 'gatsby'

import KlickerUZH from './KlickerUZH'

function Footer() {
  return (
    <footer>
      <Container>
        <Grid columns={2}>
          <Grid.Row>
            <Grid.Column>
              <strong>
                <KlickerUZH color="white" fontSize={1.2} />
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
                <a href="mailto:klicker.support@uzh.ch">
                  klicker.support@uzh.ch
                </a>
              </p>

              <address>
                Teaching Center
                <br />
                Department of Banking and Finance
                <br />
                Plattenstrasse 32
                <br />
                8032 Zurich
              </address>

              <Element name="footer" />
            </Grid.Column>
            <Grid.Column>
              <List>
                <List.Item>
                  <Link to="/tos">Terms of Service</Link>
                </List.Item>

                <List.Item>
                  <Link to="/privacy">Privacy Policy</Link>
                </List.Item>
              </List>
            </Grid.Column>
          </Grid.Row>
        </Grid>
      </Container>

      <style jsx>{`
        footer {
          background-color: #375164;
          color: white;
          height: 15rem;
          padding: 1rem;
        }

        footer a,
        footer a.item {
          color: white !important;
        }
      `}</style>
    </footer>
  )
}

export default Footer
