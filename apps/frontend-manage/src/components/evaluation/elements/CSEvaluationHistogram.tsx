import {
  CaseStudyElementResultCaseInfo,
  CaseStudyElementResultItemInfo,
} from '@klicker-uzh/graphql/dist/ops'
import { ChartType } from '@klicker-uzh/shared-components/src/constants'
import { ActivityEvaluationType } from '../ActivityEvaluation'
import { TextSizeType } from '../textSizes'
import { CSResultsEvaluationObject } from './CSEvaluation'

interface CSEvaluationHistogramProps {
  results: CSResultsEvaluationObject
  cases: CaseStudyElementResultCaseInfo[]
  items: CaseStudyElementResultItemInfo[]
  textSize: TextSizeType
  chartType: ChartType
  showSolution: boolean
  type: ActivityEvaluationType
}

function CSEvaluationHistogram({
  results,
  cases,
  items,
  textSize,
  chartType,
  showSolution,
  type,
}: CSEvaluationHistogramProps) {
  return <div>CASE STUDY HISTOGRAM EVALUATION</div>
}

export default CSEvaluationHistogram
