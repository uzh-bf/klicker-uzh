import { FreeElementInstanceEvaluation } from '@klicker-uzh/graphql/dist/ops'
import { useTranslations } from 'next-intl'
import { TextSizeType } from '../textSizes'

interface FTSidebarProps {
  instance: FreeElementInstanceEvaluation
  textSize: TextSizeType
  showSolution: boolean
}

function FTSidebar({ instance, textSize, showSolution }: FTSidebarProps) {
  const t = useTranslations()

  return (
    <div>
      <div className="font-bold">
        {t('manage.evaluation.keywordsSolution')}:
      </div>
      <ul>
        {instance.results.solutions?.map((keyword, innerIndex) => (
          <li key={innerIndex}>{`- ${keyword}`}</li>
        ))}
      </ul>
    </div>
  )
}

export default FTSidebar
