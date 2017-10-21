import React from 'react'
import PropTypes from 'prop-types'
import { List } from 'semantic-ui-react'
import { FormattedMessage } from 'react-intl'

import { QuestionTypes } from '../../constants'

const propTypes = {
  questionOptions: PropTypes.object.isRequired,
  questionType: PropTypes.string.isRequired,
}

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
          <List celled ordered>
            {questionOptions.choices.map(choice => (
              <List.Item key={choice.id}>{choice.name}</List.Item>
            ))}
          </List>
        )
      }

      if (questionType === QuestionTypes.FREE) {
        const { restrictions } = questionOptions

        return (
          <List celled>
            {restrictions.min && (
              <List.Item>
                <List.Header>Minimum</List.Header>
                {restrictions.min}
              </List.Item>
            )}
            {restrictions.max && (
              <List.Item>
                <List.Header>Maximum</List.Header>
                {restrictions.max}
              </List.Item>
            )}
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
