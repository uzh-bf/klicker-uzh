import React from 'react'
import PropTypes from 'prop-types'
import { FormattedMessage } from 'react-intl'

import { CHART_COLORS, QUESTION_TYPES, QUESTION_GROUPS } from '../../constants'
import { EvaluationListItem } from '.'

const propTypes = {
  questionOptions: PropTypes.object.isRequired,
  questionType: PropTypes.string.isRequired,
}

const Possibilities = ({ questionOptions, questionType }) => (
  <div className="possibilities">
    <h2>
      {(() => {
        if (QUESTION_GROUPS.CHOICES.includes(questionType)) {
          return (
            <FormattedMessage
              defaultMessage="Choices"
              id="teacher.evaluation.possibilities.choices"
            />
          )
        }

        if (questionType === QUESTION_TYPES.FREE_RANGE) {
          return (
            <FormattedMessage
              defaultMessage="Restrictions"
              id="teacher.evaluation.possibilities.restrictions"
            />
          )
        }

        return null
      })()}
    </h2>

    {(() => {
      if (QUESTION_GROUPS.CHOICES.includes(questionType)) {
        return (
          <div>
            {questionOptions[questionType].choices.map((choice, index) => (
              <EvaluationListItem
                color={CHART_COLORS[index % 12]}
                marker={String.fromCharCode(65 + index)}
              >
                {choice.name}
              </EvaluationListItem>
            ))}
          </div>
        )
      }

      if (questionType === QUESTION_TYPES.FREE_RANGE) {
        const { FREE_RANGE: { restrictions } } = questionOptions

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

      return null
    })()}

    <style jsx>{`
      .possibilities {
        h2 {
          font-size: 1.2rem;
          line-height: 1.2rem;
          margin-bottom: 0.5rem;
        }
      }
    `}</style>
  </div>
)

Possibilities.propTypes = propTypes

export default Possibilities
