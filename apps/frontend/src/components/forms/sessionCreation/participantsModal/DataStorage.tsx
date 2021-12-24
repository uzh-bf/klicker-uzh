import React from 'react'
import clsx from 'clsx'
import { Modal, Segment, Grid, Divider, Header, Button } from 'semantic-ui-react'
import { FormattedMessage } from 'react-intl'
import { DataStorageMode } from './SessionParticipantsModal'

interface Props {
  dataStorageMode: DataStorageMode
  onChangeDataStorageMode: (storageMode: DataStorageMode) => void
  onActivatePreviousStep: () => void
  onSaveSettings: () => void
}
// currently not in use
function DataStorage({
  dataStorageMode,
  onChangeDataStorageMode,
  onActivatePreviousStep,
  onSaveSettings,
}: Props): React.ReactElement {
  return (
    <>
      <Modal.Content>
        <Segment>
          <Grid stackable columns={2} textAlign="center">
            <Divider vertical>
              <FormattedMessage defaultMessage="Or" id="common.string.or" />
            </Divider>

            <Grid.Row>
              <Grid.Column
                className={clsx('option', { active: dataStorageMode === 'COMPLETE' })}
                onClick={(): void => onChangeDataStorageMode('COMPLETE')}
              >
                <Header>
                  <FormattedMessage
                    defaultMessage="Complete Results"
                    id="form.createSession.participantAuth.completeResults.title"
                  />
                </Header>
                <p>
                  <FormattedMessage
                    defaultMessage="The results of a session will be stored in a way that makes accessible individual participant responses and the corresponding username."
                    id="form.createSession.participantAuth.completeResults.description"
                  />
                </p>
              </Grid.Column>

              <Grid.Column
                className={clsx('option', { active: dataStorageMode === 'SECRET' })}
                onClick={(): void => onChangeDataStorageMode('SECRET')}
              >
                <Header>
                  <FormattedMessage
                    defaultMessage="Aggregated Results"
                    id="form.createSession.participantAuth.aggregatedResults.title"
                  />
                </Header>
                <p>
                  <FormattedMessage
                    defaultMessage="The results of a session will only be stored in an aggregated format, making it impossible to derive the responses of individual participants."
                    id="form.createSession.participantAuth.aggregatedResults.description"
                  />
                </p>
              </Grid.Column>
            </Grid.Row>
          </Grid>
        </Segment>
      </Modal.Content>

      <Modal.Actions>
        <Button type="button" onClick={onActivatePreviousStep}>
          <FormattedMessage defaultMessage="Back" id="common.button.back" />
        </Button>
        <Button primary disabled={!dataStorageMode} type="button" onClick={onSaveSettings}>
          <FormattedMessage defaultMessage="Save" id="common.button.save" />
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

export default DataStorage
