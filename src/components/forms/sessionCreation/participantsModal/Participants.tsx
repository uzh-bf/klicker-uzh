import React, { useState } from 'react'
import { Modal, Button, TextArea, Grid, Table, Form } from 'semantic-ui-react'

interface Props {
  participants: string[]
  onChangeParticipants: (participants: string[]) => void
  onActivateNextStep: () => void
  onActivatePreviousStep: () => void
}

function Participants({
  participants,
  onChangeParticipants,
  onActivateNextStep,
  onActivatePreviousStep,
}: Props): React.ReactElement {
  const [participantsRaw, setParticipantsRaw] = useState('')

  const onParseParticipants = (): void => {
    try {
      const cleanedParticipants = participantsRaw.replace(/;|,/g, '\n')
      const separatedParticipants = cleanedParticipants.split('\n').map((participant) => participant.replace(' ', ''))
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
                  placeholder="Input your participants..."
                  rows={10}
                  value={participantsRaw}
                  onChange={(e, { value }): void => setParticipantsRaw(value as string)}
                />
                <Button type="button" onClick={onParseParticipants}>
                  Update Participants
                </Button>
              </Form>
            </Grid.Column>
            <Grid.Column>
              <Table celled>
                <Table.Header>
                  <Table.Row>
                    <Table.HeaderCell>Participants: {participants.length}</Table.HeaderCell>
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
          Back
        </Button>
        <Button
          primary
          disabled={!participants || participants.length === 0}
          type="button"
          onClick={onActivateNextStep}
        >
          Continue
        </Button>
      </Modal.Actions>
      <style jsx>{`
        @import 'src/theme';

        p {
          padding: 0 1rem;
        }

        :global(textarea) {
          width: 100%;
        }
      `}</style>
    </>
  )
}

export default Participants
