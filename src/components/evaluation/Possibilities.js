import React from 'react'
import PropTypes from 'prop-types'
import _isNumber from 'lodash/isNumber'
import { FormattedMessage } from 'react-intl'

import { CHART_COLORS, QUESTION_TYPES, QUESTION_GROUPS } from '../../constants'
import { indexToLetter } from '../../lib'
import { EvaluationListItem } from '.'

const propTypes = {
  data: PropTypes.array.isRequired,
  questionOptions: PropTypes.object.isRequired,
  questionType: PropTypes.string.isRequired,
  showGraph: PropTypes.bool,
  showSolution: PropTypes.bool,
}

const defaultProps = {
  showGraph: false,
  showSolution: false,
}

const Possibilities = ({
  data, questionOptions, questionType, showGraph, showSolution,
}) => (
  <div className="possibilities">
    <h2>
      {(() => {
        if (QUESTION_GROUPS.CHOICES.includes(questionType)) {
          return <FormattedMessage defaultMessage="Choices" id="evaluation.possibilities.choices" />
        }

        if (questionType === QUESTION_TYPES.FREE_RANGE) {
          return (
            <FormattedMessage
              defaultMessage="Restrictions"
              id="evaluation.possibilities.restrictions"
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
            {data.map(({ correct, percentage, value }, index) => (
              <EvaluationListItem
                color={CHART_COLORS[index % 12]}
                correct={showGraph && showSolution && correct}
                marker={indexToLetter(index)}
                percentage={showGraph && `${percentage}%`}
              >
                {value}
              </EvaluationListItem>
            ))}
          </div>
        )
      }

      if (questionType === QUESTION_TYPES.FREE_RANGE) {
        const {
          FREE_RANGE: { restrictions },
        } = questionOptions

        return (
          <div>
            {(() => {
              const comp = []
              if (restrictions && _isNumber(restrictions.min)) {
                comp.push(
                  <EvaluationListItem reverse marker="MIN">
                    {restrictions.min}
                  </EvaluationListItem>,
                )
              }

              if (restrictions && _isNumber(restrictions.max)) {
                comp.push(
                  <EvaluationListItem reverse marker="MAX">
                    {restrictions.max}
                  </EvaluationListItem>,
                )
              }

              if (comp.length > 0) {
                return comp
              }

              return (
                <div>
                  <FormattedMessage
                    defaultMessage="No restrictions."
                    id="evaluation.possibilities.noRestrictions"
                  />
                </div>
              )
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
Possibilities.defaultProps = defaultProps

export default Possibilities
