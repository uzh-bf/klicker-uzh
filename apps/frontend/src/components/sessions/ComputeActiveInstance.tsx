import React, { useState, useEffect } from 'react'
import _round from 'lodash/round'
import _get from 'lodash/get'
import { max, min, mean, median, quantileSeq, std } from 'mathjs'

import { toValueArray } from '../../lib/utils/math'
import { CHART_DEFAULTS, QUESTION_TYPES, SESSION_STATUS } from '../../constants'

function ComputeActiveInstance({ activeInstances, children, sessionStatus, sessionId }): React.ReactElement {
  const [activeInstanceIndex, setActiveInstanceIndex] = useState(0)

  useEffect((): void => {
    const firstActiveIndex = activeInstances.findIndex((instance): boolean => instance.blockStatus === 'ACTIVE')
    setActiveInstanceIndex(firstActiveIndex >= 0 ? firstActiveIndex : 0)
  }, [activeInstances])

  const [activeVisualizations, setActiveVisualizations] = useState(CHART_DEFAULTS)
  const [bins, setBins] = useState(null)
  const [showGraph, setShowGraph] = useState(null)

  const showSolutionDefault =
    JSON.parse(sessionStorage?.getItem(`showSolution${sessionId}`)) ||
    new Array(activeInstances.length).fill(sessionStatus !== SESSION_STATUS.RUNNING)

  sessionStorage?.setItem(`showSolution${sessionId}`, JSON.stringify(showSolutionDefault))
  const [showSolution, setShowSolution] = useState(sessionStatus === SESSION_STATUS.COMPLETED ? new Array(activeInstances.length).fill(true) : showSolutionDefault)

  if (!activeInstances || activeInstances.length === 0) {
    return children({
      activeInstances: [],
      activeInstance: {},
      activeInstanceIndex: 0,
      bins,
      setBins,
      showGraph,
      setShowGraph,
      showSolution,
      setShowSolution,
      activeVisualizations,
      setActiveVisualizations,
      setActiveInstanceIndex,
    })
  }

  const activeInstance = activeInstances[activeInstanceIndex]

  if (activeInstance.question.type === QUESTION_TYPES.FREE_RANGE) {
    // convert the result data into an array with primitive numbers
    const valueArray = toValueArray(activeInstance.results.data)
    const hasResults = valueArray.length > 0

    activeInstance.statistics = {
      bins,
      max: hasResults && max(valueArray),
      mean: hasResults && mean(valueArray),
      median: hasResults && median(valueArray),
      min: hasResults && min(valueArray),
      onChangeBins: (e): void => setBins(+e.target.value),
      q1: hasResults && quantileSeq(valueArray, 0.25),
      q3: hasResults && quantileSeq(valueArray, 0.75),
      sd: hasResults && std(valueArray),
    }
  } else {
    activeInstance.results = {
      ...activeInstance.results,
      data:
        _get(activeInstance, 'results.data') &&
        activeInstance.results.data.map(({ correct, count, value }): any => ({
          correct,
          count,
          percentage: _round(100 * (count / _get(activeInstance, 'results.totalResponses')), 1),
          value,
        })),
      totalResponses: _get(activeInstance, 'results.totalResponses'),
    }
  }

  return children({
    activeInstances,
    activeInstance,
    activeInstanceIndex,
    bins,
    setBins,
    showGraph,
    setShowGraph,
    showSolution,
    setShowSolution,
    activeVisualizations,
    setActiveVisualizations,
    setActiveInstanceIndex,
  })
}

export default ComputeActiveInstance
