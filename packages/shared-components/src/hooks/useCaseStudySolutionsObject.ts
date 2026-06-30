import type { CaseStudySolutionsObject } from '@klicker-uzh/types'
import type { CaseStudyInstanceEvaluation } from '../elementTypes'

function useCaseStudySolutionsObject({
  evaluation,
}: {
  evaluation?: CaseStudyInstanceEvaluation
}) {
  return evaluation?.studySolutions?.reduce<CaseStudySolutionsObject>(
    (caseAcc, caseItem) => {
      caseAcc[caseItem.caseId] = caseItem.solutions!.reduce<
        CaseStudySolutionsObject['']
      >((itemAcc, item) => {
        itemAcc[String(item.itemId)] = item.criteriaSolutions.reduce<
          CaseStudySolutionsObject['']['']
        >((criterionAcc, criterion) => {
          criterionAcc[criterion.criterionId] = {
            min: criterion.min,
            max: criterion.max,
          }
          return criterionAcc
        }, {})

        return itemAcc
      }, {})

      return caseAcc
    },
    {}
  )
}

export default useCaseStudySolutionsObject
