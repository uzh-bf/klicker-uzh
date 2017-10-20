import React from 'react'
import PropTypes from 'prop-types'
import { List } from 'semantic-ui-react'

import { QuestionTypes } from '../../constants'

const propTypes = {
  questionOptions: PropTypes.object.isRequired,
  questionType: PropTypes.string.isRequired,
}

const Possibilities = ({ questionOptions, questionType }) => {
  const getDisplay = () => {
    if ([QuestionTypes.SC, QuestionTypes.MC].includes(questionType)) {
      return (
        <List>
          {questionOptions.choices.map(choice => (
            <List.Item key={choice.id}>{choice.name}</List.Item>
          ))}
        </List>
      )
    }

    if (questionType === QuestionTypes.FREE) {
      const { restrictions } = questionOptions
      return (
        <div>
          {restrictions.min}-{restrictions.max}
        </div>
      )
    }

    return <div>Not yet implemented.</div>
  }

  return (
    <div className="possibilities">
      {getDisplay()}

      <style jsx>{`
        .possibilities {
        }

        .item {
          padding: 0.3rem 0;
        }
      `}</style>
    </div>
  )
}

Possibilities.propTypes = propTypes

export default Possibilities
