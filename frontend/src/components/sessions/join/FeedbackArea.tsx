import React, { useState, useEffect } from 'react'
import clsx from 'clsx'
import dayjs from 'dayjs'
import { FormattedMessage } from 'react-intl'
import { Form, Button, TextArea } from 'semantic-ui-react'

import ConfusionSlider from '../../interaction/confusion/ConfusionSlider'
import PublicFeedback from './PublicFeedback'

interface Props {
  active: boolean
  isConfusionBarometerActive: boolean
  isFeedbackChannelActive: boolean
  feedbacks?: any[]
  handleNewConfusionTS: any
  handleNewFeedback: any
  shortname: string
  sessionId: string
}

const defaultProps = {
  feedbacks: [],
  isConfusionBarometerActive: false,
  isFeedbackChannelActive: false,
}

function FeedbackArea({
  active,
  isConfusionBarometerActive,
  isFeedbackChannelActive,
  feedbacks,
  handleNewConfusionTS,
  handleNewFeedback,
  shortname,
  sessionId,
}: Props): React.ReactElement {
  // const [confusionDifficulty, setConfusionDifficulty] = useState()
  // const [confusionSpeed, setConfusionSpeed] = useState()
  const [feedbackInputValue, setFeedbackInputValue] = useState('')

  // useEffect((): void => {
  //   try {
  //     if (window.sessionStorage) {
  //       const confusion = JSON.parse(sessionStorage.getItem(`${shortname}-${sessionId}-confusion`))
  //       setConfusionDifficulty(confusion.confusionDifficulty)
  //       setConfusionSpeed(confusion.confusionSpeed)
  //     }
  //   } catch (e) {
  //     console.error(e)
  //   }
  // }, [])

  // const onNewConfusionTS = (): void => {
  //   // send the new confusion entry to the server
  //   handleNewConfusionTS({
  //     difficulty: confusionDifficulty,
  //     speed: confusionSpeed,
  //   })

  //   // update the confusion cookie
  //   try {
  //     if (window.sessionStorage) {
  //       sessionStorage.setItem(
  //         `${shortname}-${sessionId}-confusion`,
  //         JSON.stringify({
  //           difficulty: confusionDifficulty,
  //           speed: confusionSpeed,
  //           timestamp: dayjs().unix(),
  //         })
  //       )
  //     }
  //   } catch (e) {
  //     console.error(e)
  //   }
  // }

  const onNewFeedback = (): void => {
    setFeedbackInputValue('')
    handleNewFeedback({ content: feedbackInputValue })
  }

  return (
    <div
      className={clsx(
        'bg-white p-2 md:p-4 flex-col md:border-primary md:border-solid md:border',
        active ? 'flex flex-1' : 'hidden'
      )}
    >
      <h1 className="hidden md:block header">Feedback-Channel</h1>

      {isFeedbackChannelActive && (
        <div>
          <Form>
            <Form.Field className="!mb-2">
              <TextArea
                className="h-24"
                name="feedbackInput"
                placeholder="Post a question or feedback..."
                rows={4}
                value={feedbackInputValue}
                onChange={(e): void => setFeedbackInputValue(e.target.value)}
              />
            </Form.Field>

            <Button primary disabled={!feedbackInputValue} type="submit" onClick={onNewFeedback}>
              <FormattedMessage defaultMessage="Submit" id="common.button.submit" />
            </Button>
          </Form>
        </div>
      )}

      <div className="flex flex-col justify-between h-full mt-4">
        {isFeedbackChannelActive && feedbacks && feedbacks.length > 0 && (
          <div>
            <div>
              {feedbacks.map(
                ({ id, content, votes, responses, createdAt, pinned }): React.ReactElement => (
                  <div className="mt-2 first:mt-0" key={id}>
                    <PublicFeedback
                      content={content}
                      createdAt={createdAt}
                      pinned={pinned}
                      responses={responses}
                      votes={votes}
                    />
                  </div>
                )
              )}
            </div>
          </div>
        )}
      </div>

      {/* {isConfusionBarometerActive && (
        <div className="confusion">
          <ConfusionSlider
            handleChange={(newValue): void => setConfusionSpeed(newValue)}
            handleChangeComplete={onNewConfusionTS}
            labels={{ max: 'fast', mid: 'optimal', min: 'slow' }}
            max={5}
            min={-5}
            title={
              <h2 className="sectionTitle">
                <FormattedMessage defaultMessage="Speed" id="common.string.speed" />
              </h2>
            }
            value={confusionSpeed}
          />

          <ConfusionSlider
            handleChange={(newValue): void => setConfusionDifficulty(newValue)}
            handleChangeComplete={onNewConfusionTS}
            labels={{ max: 'hard', mid: 'optimal', min: 'easy' }}
            max={5}
            min={-5}
            title={
              <h2 className="sectionTitle">
                <FormattedMessage defaultMessage="Difficulty" id="common.string.difficulty" />
              </h2>
            }
            value={confusionDifficulty}
          />
        </div>
      )} */}
    </div>
  )
}

FeedbackArea.defaultProps = defaultProps

export default FeedbackArea
