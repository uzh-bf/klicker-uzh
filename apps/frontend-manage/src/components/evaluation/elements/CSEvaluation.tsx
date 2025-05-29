import {
  CaseStudyActivityEvaluationData,
  CaseStudyElementResults,
} from '@klicker-uzh/graphql/dist/ops'
import { ChartType } from '@klicker-uzh/shared-components/src/constants'
import { TabsLegacy } from '@uzh-bf/design-system'
import { useTranslations } from 'next-intl'
import { useMemo } from 'react'
import { ActivityEvaluationType } from '../ActivityEvaluation'
import { TextSizeType } from '../textSizes'
import CSEvaluationHistogram from './CSEvaluationHistogram'
import CSEvaluationScatter from './CSEvaluationScatter'
import QuestionCollapsible from './QuestionCollapsible'

export type CSResultsEvaluationObject = {
  [caseId: string]: {
    [itemId: string]: {
      [
        criterionId: string
      ]: CaseStudyElementResults['caseResults'][0]['items'][0]['criteria'][0]
    }
  }
}

interface CSEvaluationProps {
  instanceEvaluation: CaseStudyActivityEvaluationData
  activeInstance: number
  textSize: TextSizeType
  chartType: ChartType
  showSolution: boolean
  showExplanation: boolean
  hasSolution: boolean
  hasExplanation: boolean
  type: ActivityEvaluationType
}

function CSEvaluation({
  instanceEvaluation,
  activeInstance,
  textSize,
  chartType,
  showSolution,
  showExplanation,
  hasSolution,
  hasExplanation,
  type,
}: CSEvaluationProps) {
  const t = useTranslations()

  // convert nested array results into proper object for efficient access
  const resultsObject = useMemo(
    () =>
      instanceEvaluation.results.caseResults.reduce<CSResultsEvaluationObject>(
        (caseAcc, caseResult) => {
          caseAcc[caseResult.caseId] = caseResult.items.reduce<
            CSResultsEvaluationObject[string]
          >((itemAcc, itemResult) => {
            itemAcc[String(itemResult.itemId)] = itemResult.criteria.reduce<
              CSResultsEvaluationObject[string][string]
            >((critAcc, critResult) => {
              critAcc[critResult.criterionId] = critResult
              return critAcc
            }, {})
            return itemAcc
          }, {})
          return caseAcc
        },
        {}
      ),
    [instanceEvaluation.results.caseResults]
  )

  return (
    <div
      className="flex min-h-0 w-full flex-1 flex-col"
      key={instanceEvaluation.id}
    >
      <TabsLegacy defaultValue="instructions">
        <TabsLegacy.TabList
          className={{
            root: 'h-8 px-0 py-0',
          }}
        >
          <TabsLegacy.Tab
            value="instructions"
            className={{
              label: textSize.text,
              root: 'px-0 py-0',
            }}
          >
            {t('shared.generic.instructions')}
          </TabsLegacy.Tab>
          {instanceEvaluation.cases.map((caseItem, caseIx) => (
            <TabsLegacy.Tab
              key={`case-description-${caseItem.id}`}
              value={caseItem.id}
              className={{ label: textSize.text, root: 'px-0 py-0' }}
            >
              {`${caseIx + 1}. ${caseItem.name}`}
            </TabsLegacy.Tab>
          ))}
        </TabsLegacy.TabList>
        <TabsLegacy.TabContent
          value="instructions"
          className={{ root: 'px-0 py-0' }}
        >
          <QuestionCollapsible
            content={instanceEvaluation.content}
            proseSize={textSize.prose}
            maxExpandedHeight={
              hasSolution && hasExplanation
                ? 'max-h-[calc(100vh-10.35rem)]'
                : 'max-h-[calc(100vh-10rem)]'
            }
          />
        </TabsLegacy.TabContent>
        {instanceEvaluation.cases.map((caseItem) => (
          <TabsLegacy.TabContent
            key={`case-content-${caseItem.id}`}
            value={caseItem.id}
            className={{ root: 'px-0 py-0' }}
          >
            <QuestionCollapsible
              content={caseItem.description}
              proseSize={textSize.prose}
              maxExpandedHeight={
                hasSolution && hasExplanation
                  ? 'max-h-[calc(100vh-10.35rem)]'
                  : 'max-h-[calc(100vh-10rem)]'
              }
            />
          </TabsLegacy.TabContent>
        ))}
      </TabsLegacy>
      {chartType === ChartType.HISTOGRAM && (
        <CSEvaluationHistogram
          evaluationId={instanceEvaluation.id}
          explanation={instanceEvaluation.explanation}
          results={resultsObject}
          cases={instanceEvaluation.cases}
          items={instanceEvaluation.items}
          criteria={instanceEvaluation.criteria}
          textSize={textSize}
          showSolution={showSolution}
          showExplanation={showExplanation}
          type={type}
        />
      )}
      {chartType === ChartType.SCATTER && (
        <CSEvaluationScatter
          evaluationId={instanceEvaluation.id}
          explanation={instanceEvaluation.explanation}
          results={resultsObject}
          cases={instanceEvaluation.cases}
          items={instanceEvaluation.items}
          criteria={instanceEvaluation.criteria}
          textSize={textSize}
          showSolution={showSolution}
          showExplanation={showExplanation}
          type={type}
        />
      )}
    </div>
  )
}

export default CSEvaluation
