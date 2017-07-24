import React from 'react'
import { FormattedMessage } from 'react-intl'
import PropTypes from 'prop-types'
import { Button, Grid, Segment } from 'semantic-ui-react'
import QuestionInSession from './QuestionInSession'

import withCSS from '../../lib/withCSS'

const Session = ({ createdAt, head, id, name, questions }) => (
  <Grid padded stackable className="session">
    {head}
    <Grid.Row className="titleRow">
      <Grid.Column width="12"><strong>{id}</strong> | {name}</Grid.Column>
      <Grid.Column className="date" width="4">
        <FormattedMessage id="session.string.createdOn" defaultMessage="Created at" /> {createdAt}
      </Grid.Column>
    </Grid.Row>
    {/* TODO Possibility for more than two columns */}
    <Segment as={Grid.Row} className="questions">
      {
        questions.map(question => (
          /* TODO Possibility for more than two columns */
          <Grid.Column key={question.id} width="6">
            <QuestionInSession
              id={question.id}
              title={question.questionDefinition.title}
              type={question.questionDefinition.type}
            />
          </Grid.Column>
        ))
      }
      <Grid.Column className="buttonColumn">
        <Button content="Starten" icon="play" labelPosition="left" />
      </Grid.Column>
    </Segment>
    <style jsx global>{`
      .ui.grid.session > .row.questions {
        margin-top: 0;
      }
      .ui.grid.session > .row.titleRow > .column.date {
        text-align: right;
      }
    `}</style>
  </Grid>
)

Session.propTypes = {
  head: PropTypes.node.isRequired,
  id: PropTypes.string.isRequired,
  name: PropTypes.string.isRequired,
  /*
  status: PropTypes.string.isRequired, */
  questions: PropTypes.shape({
    id: PropTypes.string.isRequired,
    description: PropTypes.string.isRequired,
    questionDefinition: PropTypes.shape({
      title: PropTypes.string.isRequired,
      type: PropTypes.string.isRequired,
    }).isRequired,
  }).isRequired,
}

export default withCSS(Session, ['segment'])
