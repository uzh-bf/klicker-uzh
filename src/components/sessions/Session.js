import React from 'react'
import { FormattedMessage } from 'react-intl'
import PropTypes from 'prop-types'
import { Button, Grid, Segment } from 'semantic-ui-react'
import moment from 'moment'
import QuestionInSession from './QuestionInSession'

import withCSS from '../../lib/withCSS'

const Session = ({ createdAt, head, intl, name, blocks, sessionId, status }) => {
  let buttonContent = ''
  let buttonIcon = ''
  switch (status) {
    case 'CREATED': {
      buttonContent = intl.formatMessage({
        id: 'session.button.created.content',
        defaultMessage: 'Start',
      })
      buttonIcon = 'play'
      break
    }
    case 'RUNNING': {
      buttonContent = intl.formatMessage({
        id: 'session.button.running.content',
        defaultMessage: 'Was hier?',
      })
      buttonIcon = 'play' // TODO which icon here?
      break
    }
    case 'COMPLETED': {
      buttonContent = intl.formatMessage({
        id: 'session.button.completed.content',
        defaultMessage: 'Copy',
      })
      buttonIcon = 'copy'
      break
    }
    default: {
      buttonContent = intl.formatMessage({
        id: 'session.button.created.content',
        defaultMessage: 'Start',
      })
      buttonIcon = 'play'
      break
    }
  }

  return (
    <Grid padded stackable className="session">
      {head}
      <Grid.Row className="titleRow">
        {/* HACK delete slice and get correct user ID */}
        <Grid.Column width="10"><strong>{sessionId}</strong> {name}</Grid.Column>
        <Grid.Column className="date" textAlign="right" width="6">
          <FormattedMessage
            id="session.string.createdOn"
            defaultMessage="Created at"
          /> {moment(createdAt).format('DD.MM.YYYY hh:mm:ss')}
        </Grid.Column>
      </Grid.Row>
      {/* TODO Possibility for more than two columns */}
      <Segment as={Grid.Row} className="questionsRow">
        {
          /* TODO desturcture questions array and pass title and type */
          blocks.map(({ id: questionId }) => (
            /* TODO Possibility for more than two columns, depends on long id */
            <Grid.Column key={questionId} width="3">
              <QuestionInSession
                id={questionId.slice(0, -15)} // HACK Correct short ID
                /* TODO pass type and id as props */
              />
            </Grid.Column>
          ))
        }
        <Grid.Column className="buttonColumn" floated="right" textAlign="right" verticalAlign="bottom" width="3">
          <Button content={buttonContent} icon={buttonIcon} labelPosition="left" />
        </Grid.Column>
      </Segment>
      <style jsx global>{`
      .ui.grid.session > .row.questionsRow {
        margin-top: 0;
      }
    `}</style>
    </Grid>
  )
}

Session.propTypes = {
  createdAt: PropTypes.string.isRequired,
  head: PropTypes.node.isRequired,
  id: PropTypes.string.isRequired,
  intl: PropTypes.shape({
    formatMessage: PropTypes.func.isRequired,
  }).isRequired,
  name: PropTypes.string.isRequired,
  status: PropTypes.string.isRequired,
  questions: PropTypes.shape({
    questionDefinition: PropTypes.shape({
      createdAt: PropTypes.string.isRequired,
      title: PropTypes.string.isRequired,
      type: PropTypes.string.isRequired,
    }).isRequired,
  }).isRequired,

}

export default withCSS(Session, ['segment'])
