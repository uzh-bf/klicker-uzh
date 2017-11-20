import React from 'react'
import PropTypes from 'prop-types'
import { Icon, List } from 'semantic-ui-react'
import { FormattedMessage } from 'react-intl'

import { CHART_COLORS, QuestionTypes } from '../../constants'

const propTypes = {
  questionOptions: PropTypes.object.isRequired,
  questionType: PropTypes.string.isRequired,
}

const Choice = ({ choice, index }) => (
  <div className="choice">
    <div className="colorSquare">
      <Icon name="square icon" />
    </div>
    <div className="content">{choice.name}</div>
    <div className="char">{String.fromCharCode(65 + index)}</div>
    <style jsx>{`
      .choice {
        display: flex;
        flex-flow: row wrap;
        align-items: center;

        border-bottom: 1px solid lightgrey;

        padding: 0.1rem 0;

        &:first-child {
          border-top: 1px solid lightgrey;
        }

        .colorSquare :global(i) {
          flex: 0 0 auto;

          color: ${CHART_COLORS[index % 5]};
        }

        .char {
          flex: 0 0 auto;

          font-weight: bold;
        }

        .content {
          flex: 1;
        }
      }
    `}</style>
  </div>
)

const Possibilities = ({ questionOptions, questionType }) => (
  <div className="possibilities">
    <h2>
      {(() => {
        if ([QuestionTypes.SC, QuestionTypes.MC].includes(questionType)) {
          return (
            <FormattedMessage
              defaultMessage="Choices"
              id="teacher.evaluation.possibilities.choices"
            />
          )
        }

        if (questionType === QuestionTypes.FREE) {
          return (
            <FormattedMessage
              defaultMessage="Restrictions"
              id="teacher.evaluation.possibilities.restrictions"
            />
          )
        }

        return 'fail'
      })()}
    </h2>

    {(() => {
      if ([QuestionTypes.SC, QuestionTypes.MC].includes(questionType)) {
        return (
          <List celled className="choices">
            {questionOptions.choices.map((choice, index) => (
              <Choice choice={choice} index={index} />
            ))}
          </List>
        )
      }

      if (questionType === QuestionTypes.FREE) {
        const { restrictions } = questionOptions

        return (
          <List celled>
            {(() => {
              const comp = []
              if (restrictions.min) {
                comp.push(
                  <List.Item>
                    <List.Header>Minimum</List.Header>
                    {restrictions.min}
                  </List.Item>,
                )
              }

              if (restrictions.max) {
                comp.push(
                  <List.Item>
                    <List.Header>Maximum</List.Header>
                    {restrictions.max}
                  </List.Item>,
                )
              }

              if (comp.length > 0) {
                return comp
              }

              return <div>No restrictions.</div>
            })()}
          </List>
        )
      }

      return <div>Not yet implemented.</div>
    })()}

    <style jsx>{`
      .possibilities {
        h2 {
          font-size: 1.3rem;
          line-height: 1.3rem;
        }
      }
    `}</style>
  </div>
)

Possibilities.propTypes = propTypes

export default Possibilities
