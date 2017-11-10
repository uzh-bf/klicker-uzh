import React from 'react'
import PropTypes from 'prop-types'
import classNames from 'classnames'
import _range from 'lodash/range'
import { compose, withStateHandlers } from 'recompose'

import { ActionMenu, Collapser } from '../../common'
import { SCAnswerOptions, FREEAnswerOptions } from '../../questionTypes'

const propTypes = {
  active: PropTypes.bool,
  activeQuestion: PropTypes.number,
  completedQuestions: PropTypes.array,
  handleActiveQuestionChange: PropTypes.func.isRequired,
  handleCompleteQuestion: PropTypes.func.isRequired,
  handleInputValueChange: PropTypes.func.isRequired,
  inputValue: PropTypes.oneOf([PropTypes.string, PropTypes.number, PropTypes.object]).isRequired,
  isCollapsed: PropTypes.bool.isRequired,
  questions: PropTypes.array,
  toggleIsCollapsed: PropTypes.func.isRequired,
}

const defaultProps = {
  active: false,
  activeQuestion: 0,
  completedQuestions: [],
  questions: [],
}

function QuestionArea({
  active,
  activeQuestion,
  completedQuestions,
  isCollapsed,
  inputValue,
  questions,
  toggleIsCollapsed,
  handleActiveQuestionChange,
  handleCompleteQuestion,
  handleInputValueChange,
}) {
  console.dir(questions)
  const currentQuestion = questions.length > 0 && questions[activeQuestion]
  const { description, options, type } = currentQuestion

  return (
    <div className={classNames('questionArea', { active })}>
      <div className="collapser">
        <Collapser collapsed={isCollapsed} handleCollapseToggle={toggleIsCollapsed}>
          {description}
        </Collapser>
      </div>

      <div className="options">
        {(() => {
          if (['SC', 'MC'].includes(type)) {
            return (
              <SCAnswerOptions
                disabled={completedQuestions.includes(activeQuestion)}
                value={inputValue}
                options={options.choices}
                onChange={handleInputValueChange}
              />
            )
          }

          if (type === 'FREE') {
            return (
              <FREEAnswerOptions
                disabled={completedQuestions.includes(activeQuestion)}
                onChange={inputValue}
                options={options}
                value={handleInputValueChange}
              />
            )
          }

          return null
        })()}
      </div>

      <ActionMenu
        activeIndex={activeQuestion}
        items={_range(questions.length).map(index => ({
          done: completedQuestions.includes(index),
        }))}
        setActiveIndex={handleActiveQuestionChange}
        onCompleteQuestion={handleCompleteQuestion}
      />

      <style jsx>{`
        @import 'src/theme';

        .questionArea {
          display: none;
          flex-direction: column;

          flex: 1;

          &.active {
            display: flex;
          }

          .collapser,
          .options {
            padding: 1rem;
          }

          .collapser {
            flex: 0 0 auto;
          }

          .options {
            flex: 1 1 50%;
          }

          .confusion {
            margin-bottom: 0.5rem;
            padding: 1rem;
          }

          @include desktop-tablet-only {
            display: flex;

            border: 1px solid $color-primary-10p;
          }
        }
      `}</style>
    </div>
  )
}

QuestionArea.propTypes = propTypes
QuestionArea.defaultProps = defaultProps

export default compose(
  withStateHandlers(
    {
      activeQuestion: 0,
      completedQuestions: [],
      inputValue: undefined,
      isCollapsed: true,
    },
    {
      handleActiveQuestionChange: () => ({ activeQuestion }) => ({
        activeQuestion,
        inputValue: undefined,
      }),
      handleCompleteQuestion: ({ completedQuestions }) => index => ({
        completedQuestions: [...completedQuestions, index],
      }),
      handleInputValueChange: () => inputValue => ({ inputValue }),
      toggleIsCollapsed: ({ isCollapsed }) => () => ({ isCollapsed: !isCollapsed }),
    },
  ),
)(QuestionArea)
