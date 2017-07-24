import React from 'react'
import PropTypes from 'prop-types'
import { Grid, Segment } from 'semantic-ui-react'
import QuestionInSession from './QuestionInSession'

import withCSS from '../../lib/withCSS'

const Session = ({ head, id, name, questions }) => (
  <Grid padded stackable className="session">
    {head}
    <Grid.Row className="titleRow">
      <Grid.Column width="12"><strong>{id}</strong> | {name}</Grid.Column>
      <Grid.Column className="date" width="4">Erstellt am 60.80.1000</Grid.Column>
    </Grid.Row>
    <Segment as={Grid.Row} className="questions">
      <Grid.Column>
        {console.dir(questions)}
        {questions.map(question =>
          /* TODO get all values */
          <QuestionInSession id={question.id} title={question.questionDefinition.title} type={question.questionDefinition.type} />,
        )}
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
