import React from 'react'
import classNames from 'classnames'
import { Modal, Segment, Grid, Divider, Header, Button } from 'semantic-ui-react'
import { AuthenticationMode } from './SessionParticipantsModal'

interface Props {
  sessionAuthenticationMode: AuthenticationMode
  onChangeSessionAuthenticationMode: (authenticationMode: AuthenticationMode) => void
  onActivateNextStep: () => void
}

function Authentication({
  sessionAuthenticationMode,
  onChangeSessionAuthenticationMode,
  onActivateNextStep,
}: Props): React.ReactElement {
  return (
    <>
      <Modal.Content>
        <Segment>
          <Grid stackable columns={2} textAlign="center">
            <Divider vertical>Or</Divider>

            <Grid.Row>
              <Grid.Column
                className={classNames('option', { active: sessionAuthenticationMode === 'password' })}
                onClick={(): void => onChangeSessionAuthenticationMode('password')}
              >
                <Header>Password Distribution (Beta)</Header>
                <p>
                  After your upload of a list of arbitrary usernames/pseudonyms, we generate a list of username-password
                  combinations that you can distribute to your participants.
                </p>
              </Grid.Column>

              <Grid.Column
                className={classNames('disabled option', { active: sessionAuthenticationMode === 'aai' })}
                // onClick={(): void => onChangeSessionAuthenticationMode('aai')}
              >
                <Header>SwitchAAI (Coming Soon)</Header>
                <p>
                  After your upload of a list of SwitchAAI accounts (exact matches by email), participants will get
                  access to your KlickerUZH session using their personal SwitchAAI login. Therefore, you will not be
                  able to emulate any of your participants.
                </p>
              </Grid.Column>
            </Grid.Row>
          </Grid>
        </Segment>
      </Modal.Content>
      <Modal.Actions>
        <Button primary disabled={!sessionAuthenticationMode} type="button" onClick={onActivateNextStep}>
          Continue
        </Button>
      </Modal.Actions>
      <style jsx>{`
        @import 'src/theme';

        p {
          padding: 0 1rem;
        }

        :global(.row) {
          padding: 0 !important;
        }

        :global(.option) {
          cursor: pointer;
          padding: 1rem;

          &:hover {
            background-color: $color-primary-20p;
          }
        }

        :global(.option.active) {
          background-color: $color-primary-20p;
        }

        :global(.option.disabled) {
          background-color: initial;
          cursor: initial;

          &:hover {
            background-color: initial;
          }
        }
      `}</style>
    </>
  )
}

export default Authentication
