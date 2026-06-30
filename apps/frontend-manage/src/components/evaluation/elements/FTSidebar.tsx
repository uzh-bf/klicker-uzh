import {
  FreeTextActivityEvaluationData,
  LocaleType,
} from '@lib/evaluationTypes'
import { useTranslations } from 'next-intl'
import { useRouter } from 'next/router'
import { twMerge } from 'tailwind-merge'
import { ActivityEvaluationType } from '../ActivityEvaluation'
import { TextSizeType } from '../textSizes'
import LiveQuizEvaluationQRCode from './LiveQuizEvaluationQRCode'

interface FTSidebarProps {
  instance: FreeTextActivityEvaluationData
  courseLanguage?: LocaleType | null
  isAssessmentEnabled: boolean
  pinCode?: string | null
  textSize: TextSizeType
  showSolution: boolean
  type: ActivityEvaluationType
}

function FTSidebar({
  instance,
  courseLanguage,
  isAssessmentEnabled,
  pinCode,
  textSize,
  showSolution,
  type,
}: FTSidebarProps) {
  const t = useTranslations()
  const router = useRouter()

  return (
    <div
      className={twMerge(
        'order-1 flex h-full w-full flex-col justify-between overflow-hidden pb-1 pt-2 md:order-2',
        textSize.text
      )}
    >
      <div className="flex h-max max-h-full flex-col gap-2 overflow-y-auto px-2">
        <div className="font-bold">
          {t('manage.evaluation.keywordsSolution')}:
        </div>
        <ul>
          {instance.results.solutions?.map((keyword) => (
            <li key={keyword}>{`- ${keyword}`}</li>
          ))}
        </ul>
      </div>
      {type === 'LiveQuiz' && !router.query.hmac && (
        <LiveQuizEvaluationQRCode
          language={courseLanguage}
          isAssessmentEnabled={isAssessmentEnabled}
          pinCode={pinCode}
        />
      )}
    </div>
  )
}

export default FTSidebar
