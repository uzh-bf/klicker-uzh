import React from 'react'
import PropTypes from 'prop-types'
import moment from 'moment'
import { FormattedMessage } from 'react-intl'
import { Button, Grid, Icon, Segment } from 'semantic-ui-react'

import QuestionBlock from './QuestionBlock'
import withCSS from '../../../lib/withCSS'

const Session = ({ createdAt, head, name, blocks, id, status }) => {
  let buttonContent = ''
  let buttonIcon = ''
  switch (status) {
    case 'RUNNING': {
      buttonContent = (
        <FormattedMessage id="session.button.running.content" defaultMessage="Running" />
      )
      buttonIcon = 'play' // TODO which icon here?
      break
    }
    case 'COMPLETED': {
      buttonContent = (
        <FormattedMessage id="session.button.completed.content" defaultMessage="Copy" />
      )
      buttonIcon = 'copy'
      break
    }
    default: {
      buttonContent = (
        <FormattedMessage id="session.button.created.content" defaultMessage="Start" />
      )
      buttonIcon = 'play'
      break
    }
  }

  return (
    <div className="container">
      <h2 className="title">
        {id.slice(0, 7)} - {name}
      </h2>
      <div className="date">
        <FormattedMessage id="sessionHistory.string.createdOn" defaultMessage="Created on" />{' '}
        {moment(createdAt).format('DD.MM.YYYY HH:MM:SS')}
      </div>
      <div className="details">
        <div className="blocks">
          {blocks.map(block =>
            (<div className="block">
              <QuestionBlock
                questions={block.questions.map(question => ({
                  id: question.id,
                  title: question.questionDefinition.title,
                  type: question.questionDefinition.type,
                }))}
                showSolutions={block.showSolutions}
                timeLimit={block.timeLimit}
              />
            </div>),
          )}
        </div>
      </div>

      <style jsx>{`
        .container {
          display: flex;
          flex-flow: row wrap;
        }
        .title {
          margin: 0;
          margin-bottom: 0.5rem;
          font-size: 1.2rem;
          text-align: center;
          width: 100%;
        }
        .date {
          text-align: center;
          width: 100%;
        }
        .details {
          background-color: lightgrey;
          width: 100%;
        }
        .blocks {
          display: flex;
          margin: 0.5rem;
        }
        .block {
          flex-grow: 1;
          flex-shrink: 1;
        }

        @media all and (min-width: 768px) {
          .title {
            text-align: left;
            width: 70%;
          }
          .date {
            text-align: right;
            width: 30%;
          }
        }
      `}</style>
    </div>
  )

  return (
    <Grid padded stackable className="session">
      {head}

      {/* TODO Possibility for more than two columns */}
      <Segment as={Grid.Row} className="questionsRow">
        {/* TODO desturcture questions array and pass title and type */
        blocks.map(({ id: questionId, title, type }) =>
          /* TODO Possibility for more than two columns, depends on long id */
          (<Grid.Column key={questionId} width="3">
            <QuestionInSession
              id={id} // HACK Correct short ID
              title={title}
              type={type}
              /* TODO pass type and id as props */
            />
          </Grid.Column>),
        )}
        <Grid.Column
          className="buttonColumn"
          floated="right"
          textAlign="right"
          verticalAlign="bottom"
          width="3"
        >
          <Button icon labelPosition="left">
            <Icon name={buttonIcon} />
            {buttonContent}
          </Button>
        </Grid.Column>
      </Segment>

      <style jsx>{`
        .container {
        }
      `}</style>
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
