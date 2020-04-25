import React, { useState } from 'react'
import { Modal, Button, TextArea, Grid, Table, Tab, Form } from 'semantic-ui-react'

function Participants({
  participants,
  onChangeParticipants,
  onActivateNextStep,
  onActivatePreviousStep,
}): React.ReactElement {
  const [participantsRaw, setParticipantsRaw] = useState('')

  const onParseParticipants = () => {
    const cleanedParticipants = participantsRaw.replace(/.*(;).*/g, '\n').replace(/.*(,).*/g, '\n')
    const separatedParticipants = cleanedParticipants.split('\n')
    const filteredParticipants = separatedParticipants.filter((participant) => !!participant)
    console.log(filteredParticipants)
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
                    <Table.HeaderCell>Participants</Table.HeaderCell>
                  </Table.Row>
                </Table.Header>
                <Table.Body>
                  <Table.Row>
                    <Table.Cell>rolandschlaefli@gmail.com</Table.Cell>
                  </Table.Row>
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
