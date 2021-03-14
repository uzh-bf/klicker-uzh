import React, { useState } from 'react'
import { defineMessages, FormattedMessage, useIntl } from 'react-intl'
import { Button, Form, Grid, Modal, Table, TextArea } from 'semantic-ui-react'

const messages = defineMessages({
  participantsPlaceholder: {
    defaultMessage: 'Input your participants (each on a new line)',
    id: 'form.createSession.participantAuth.string.participantsPlaceholder',
  },
})

interface Props {
  participants: string[]
  onChangeParticipants: (participants: string[]) => void
  onActivatePreviousStep: () => void
  onSaveSettings: () => void
}

function Participants({
  participants,
  onChangeParticipants,
  onActivatePreviousStep,
  onSaveSettings,
}: Props): React.ReactElement {
  const intl = useIntl()

  const [participantsRaw, setParticipantsRaw] = useState('')

  const onParseParticipants = (): void => {
    try {
      const cleanedParticipants = participantsRaw.replace(/;|,/g, '\n')
      const separatedParticipants = cleanedParticipants.split('\n').map((participant) => participant.replace(/ /g, ''))
      const filteredParticipants = separatedParticipants.filter((participant) => !!participant)
      onChangeParticipants(filteredParticipants)
    } catch (e) {
      console.error(e)
    }
  }

  return (
    <>
      <Modal.Content>
        <Grid columns="2">
          <Grid.Row>
            <Grid.Column>
              <Form>
                <TextArea
                  placeholder={intl.formatMessage(messages.participantsPlaceholder)}
                  rows={10}
                  value={participantsRaw}
                  onChange={(e, { value }): void => setParticipantsRaw(value as string)}
                />
                <Button
                  className="participantsUpdateButton"
                  color={participants.length === 0 ? 'red' : undefined}
                  floated="right"
                  type="button"
                  onClick={onParseParticipants}
                >
                  <FormattedMessage
                    defaultMessage="Update Participants"
                    id="form.createSession.participantAuth.button.updateParticipants"
                  />
                </Button>
              </Form>
            </Grid.Column>
            <Grid.Column>
              <Table celled>
                <Table.Header>
                  <Table.Row>
                    <Table.HeaderCell>
                      <FormattedMessage
                        defaultMessage="Participants"
                        id="form.createSession.participantAuth.string.participants"
                      />
                      : {participants.length}
                    </Table.HeaderCell>
                  </Table.Row>
                </Table.Header>

                <Table.Body>
                  {participants.map((participant) => (
                    <Table.Row>
                      <Table.Cell>{participant}</Table.Cell>
                    </Table.Row>
                  ))}
                </Table.Body>
              </Table>
            </Grid.Column>
          </Grid.Row>
        </Grid>
      </Modal.Content>

      <Modal.Actions>
        <Button type="button" onClick={onActivatePreviousStep}>
          <FormattedMessage defaultMessage="Back" id="common.button.back" />
        </Button>
        <Button primary disabled={!participants || participants.length === 0} type="button" onClick={onSaveSettings}>
          <FormattedMessage defaultMessage="Save" id="common.button.save" />
        </Button>
      </Modal.Actions>

      <style jsx>{`
        @import 'src/theme';

        p {
          padding: 0 1rem;
        }

        :global(textarea) {
          margin-bottom: 1rem !important;
          width: 100%;
        }
      `}</style>
    </>
  )
}

export default Participants
