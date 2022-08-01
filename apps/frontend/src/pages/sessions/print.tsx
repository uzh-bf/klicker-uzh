/* eslint-disable */
import React, { useState } from 'react'
import _round from 'lodash/round'
import _get from 'lodash/get'
import { FormattedMessage } from 'react-intl'
import { useRouter } from 'next/router'
import { max, min, mean, median, quantileSeq, std } from 'mathjs'
import { Button } from '@uzh-bf/design-system'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faPrint } from '@fortawesome/free-solid-svg-icons'

import { CHART_DEFAULTS, QUESTION_TYPES } from '../../constants'
import { toValueArray } from '../../lib/utils/math'
import Chart from '../../components/evaluation/Chart'
import Possibilities from '../../components/evaluation/Possibilities'
import VisualizationType from '../../components/evaluation/VisualizationType'
import CommonLayout from '../../components/layouts/CommonLayout'
import { extractInstancesFromSession } from './evaluation'
import LoadSessionData from '../../components/sessions/LoadSessionData'
import Markdown from '../../components/common/Markdown'

function Print(): React.ReactElement<any> {
  const router = useRouter()

  const isPublic = !!router.query.public
  const sessionId: string = router.query.sessionId.toString()

  const [activeVisualizations, setActiveVisualizations] = useState(CHART_DEFAULTS)

  return (
    <LoadSessionData sessionId={sessionId} isPublic={isPublic}>
      {({ session, loading, error }) => {
        if (loading || error || !_get(session, 'blocks')) {
          return null
        }

        const { activeInstances, sessionStatus } = extractInstancesFromSession(session)

        return (
          <CommonLayout baseFontSize="16">
            <div className="p-2 print:hidden">
              <Button
                className="justify-center font-bold text-white h-11 bg-uzh-blue-80"
                onClick={() => window.print()}
              >
                <FontAwesomeIcon icon={faPrint} className="mr-1" />
                Print / PDF Download
              </Button>
            </div>

            {activeInstances.map((activeInstance) => {
              if (activeInstance.question.type === QUESTION_TYPES.FREE_RANGE) {
                // convert the result data into an array with primitive numbers
                const valueArray = toValueArray(activeInstance.results.data)
                const hasResults = valueArray.length > 0

                activeInstance.statistics = {
                  bins: null,
                  max: hasResults && max(valueArray),
                  mean: hasResults && mean(valueArray),
                  median: hasResults && median(valueArray),
                  min: hasResults && min(valueArray),
                  onChangeBins: () => null,
                  q1: hasResults && quantileSeq(valueArray, 0.25),
                  q3: hasResults && quantileSeq(valueArray, 0.75),
                  sd: hasResults && std(valueArray),
                }
              } else {
                activeInstance.results = {
                  ...activeInstance.results,
                  data:
                    _get(activeInstance, 'results.data') &&
                    activeInstance.results.data.map(({ correct, count, value }) => ({
                      correct,
                      count,
                      percentage: _round(100 * (count / _get(activeInstance, 'results.totalResponses')), 1),
                      value,
                    })),
                  totalResponses: _get(activeInstance, 'results.totalResponses'),
                }
              }

              const { results, question, version, statistics } = activeInstance
              const { content, options } = question.versions[version]
              const activeVisualization = activeVisualizations[question.type]

              return (
                <div className="relative h-[1190px] w-[1740px] p-[25px] break-after-page">
                  <div className="h-max-content max-h-[40%] bg-primary-bg border-0 border-y-2 border-solid border-primary text-md p-[0.7em] text-left">
                    <Markdown>{content}</Markdown>
                  </div>

                  <div className="flex flex-row h-full">
                    <div className="h-[60%] w-[1100px]">
                      <Chart
                        activeVisualization={activeVisualization}
                        data={results.data}
                        instanceId={activeInstance.id}
                        isPublic={false}
                        numBins={null}
                        handleShowGraph={null}
                        questionType={question.type}
                        restrictions={options.FREE_RANGE && options.FREE_RANGE.restrictions}
                        sessionId={sessionId}
                        sessionStatus={sessionStatus}
                        showGraph={true}
                        showSolution={false}
                        statistics={statistics}
                        totalResponses={results.totalResponses}
                      />
                    </div>
                    <div className="p-[1em]">
                      <div className="mb-[0.7em]">
                        <Possibilities
                          data={results.data}
                          questionOptions={options}
                          questionType={question.type}
                          showGraph={true}
                          showSolution={false}
                        />
                      </div>
                      <div className="mb-[0.7em]">
                        <FormattedMessage
                          id="evaluation.totalParticipants.label"
                          defaultMessage="Total participants:"
                        />{' '}
                        {results.totalResponses}
                      </div>
                      <div className="print:hidden">
                        <VisualizationType
                          activeVisualization={activeVisualization}
                          questionType={question.type}
                          onChangeType={(type, newVisualization) =>
                            setActiveVisualizations((currentState) => ({ ...currentState, [type]: newVisualization }))
                          }
                        />
                      </div>
                    </div>
                  </div>
                </div>
              )
            })}
            <style jsx global>{`
              html {
                font-size: 1.5em;
              }
            `}</style>

            <style jsx>{`
              @import 'src/theme';

              @page {
                size: landscape;
                margin: 0;
              }
            `}</style>
          </CommonLayout>
        )
      }}
    </LoadSessionData>
  )
}

export default Print
