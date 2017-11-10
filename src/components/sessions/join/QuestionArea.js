import React from 'react'
import PropTypes from 'prop-types'
import classNames from 'classnames'
import _range from 'lodash/range'
import { compose, withStateHandlers, withHandlers } from 'recompose'

import { ActionMenu, Collapser } from '../../common'
import { SCAnswerOptions, FREEAnswerOptions } from '../../questionTypes'

const propTypes = {
  active: PropTypes.bool,
  activeQuestion: PropTypes.number,
  completedQuestions: PropTypes.array,
  handleActiveChoicesChange: PropTypes.func.isRequired,
  handleActiveQuestionChange: PropTypes.func.isRequired,
  handleCompleteQuestion: PropTypes.func.isRequired,
  handleFreeValueChange: PropTypes.func.isRequired,
  handleSubmit: PropTypes.func.isRequired,
  inputValue: PropTypes.oneOfType([PropTypes.string, PropTypes.number, PropTypes.object])
    .isRequired,
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
  handleActiveChoicesChange,
  handleFreeValueChange,
  handleSubmit,
}) {
  if (activeQuestion === questions.length) {
    return <div>You finished all active questions.</div>
  }

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
                onChange={handleActiveChoicesChange}
                options={options.choices}
                value={inputValue}
              />
            )
          }

          if (type === 'FREE') {
            return (
              <FREEAnswerOptions
                disabled={completedQuestions.includes(activeQuestion)}
                onChange={handleFreeValueChange}
                options={options}
                value={inputValue}
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
        onSubmit={handleSubmit}
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
      handleActiveChoicesChange: ({ inputValue }) => choice => ({
        inputValue: inputValue ? [...inputValue, choice] : [choice],
      }),
      handleActiveQuestionChange: () => activeQuestion => ({
        activeQuestion,
        inputValue: undefined,
      }),
      handleCompleteQuestion: ({ completedQuestions }) => completedIndex => ({
        completedQuestions: [...completedQuestions, completedIndex],
      }),
      handleFreeValueChange: () => inputValue => ({ inputValue }),
      handleSubmit: ({ activeQuestion, completedQuestions }) => () => ({
        activeQuestion: activeQuestion + 1,
        completedQuestions: [...completedQuestions, activeQuestion],
      }),
      toggleIsCollapsed: ({ isCollapsed }) => () => ({ isCollapsed: !isCollapsed }),
    },
  ),
  withHandlers({
    handleActiveChoicesChange: ({ handleActiveChoicesChange }) => choice => () =>
      handleActiveChoicesChange(choice),
    handleActiveQuestionChange: ({ handleActiveQuestionChange }) => index => () =>
      handleActiveQuestionChange(index),
    handleCompleteQuestion: ({ handleCompleteQuestion }) => index => () =>
      handleCompleteQuestion(index),
    handleSubmit: ({ handleSubmit, inputValue }) => () => {
      console.dir(inputValue)
      handleSubmit()
    },
  }),
)(QuestionArea)
