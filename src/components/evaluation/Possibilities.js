import React from 'react'
import PropTypes from 'prop-types'
import { FormattedMessage } from 'react-intl'

import { CHART_COLORS, QuestionTypes } from '../../constants'
import { EvaluationListItem } from '.'

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
          <div>
            {questionOptions.choices.map((choice, index) => (
              <EvaluationListItem
                color={CHART_COLORS[index % 5]}
                marker={String.fromCharCode(65 + index)}
              >
                {choice.name}
              </EvaluationListItem>
            ))}
          </div>
        )
      }

      if (questionType === QuestionTypes.FREE) {
        const { restrictions } = questionOptions

        return (
          <div>
            {(() => {
              const comp = []
              if (restrictions.min) {
                comp.push(<EvaluationListItem marker="MIN">{restrictions.min}</EvaluationListItem>)
              }

              if (restrictions.max) {
                comp.push(<EvaluationListItem marker="MAX">{restrictions.max}</EvaluationListItem>)
              }

              if (comp.length > 0) {
                return comp
              }

              return <div>No restrictions.</div>
            })()}
          </div>
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
