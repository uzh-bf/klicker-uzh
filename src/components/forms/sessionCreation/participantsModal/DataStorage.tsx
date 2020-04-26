import React from 'react'
import classNames from 'classnames'
import { Modal, Segment, Grid, Divider, Header, Button } from 'semantic-ui-react'
import { DataStorageMode } from './SessionParticipantsModal'

interface Props {
  dataStorageMode: DataStorageMode
  onChangeDataStorageMode: (storageMode: DataStorageMode) => void
  onActivatePreviousStep: () => void
  onSaveSettings: () => void
}

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
            <Divider vertical>Or</Divider>

            <Grid.Row>
              <Grid.Column
                className={classNames('option', { active: dataStorageMode === 'complete' })}
                onClick={(): void => onChangeDataStorageMode('complete')}
              >
                <Header>Complete Results</Header>
                <p>
                  The results of a session will be stored in a way that makes accessible individual participant
                  responses and the corresponding username.
                </p>
              </Grid.Column>

              <Grid.Column
                className={classNames('option', { active: dataStorageMode === 'secret' })}
                onClick={(): void => onChangeDataStorageMode('secret')}
              >
                <Header>Aggregated Results</Header>
                <p>
                  The results of a session will only be stored in an aggregated format, making it impossible to derive
                  the responses of individual participants.
                </p>
              </Grid.Column>
            </Grid.Row>
          </Grid>
        </Segment>
      </Modal.Content>
      <Modal.Actions>
        <Button type="button" onClick={onActivatePreviousStep}>
          Back
        </Button>
        <Button primary disabled={!dataStorageMode} type="button" onClick={onSaveSettings}>
          Save
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
      `}</style>
    </>
  )
}

export default DataStorage
