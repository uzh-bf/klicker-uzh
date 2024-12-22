import { FreeElementInstanceEvaluation } from '@klicker-uzh/graphql/dist/ops'
import { useLocalStorage } from '@uidotdev/usehooks'
import { useTranslations } from 'next-intl'
import { twMerge } from 'tailwind-merge'
import { ActivityEvaluationType } from '../ActivityEvaluation'
import { TextSizeType } from '../textSizes'
import LiveQuizEvaluationQRCode from './LiveQuizEvaluationQRCode'

interface FTSidebarProps {
  instance: FreeElementInstanceEvaluation
  textSize: TextSizeType
  showSolution: boolean
  type: ActivityEvaluationType
}

function FTSidebar({ instance, textSize, showSolution, type }: FTSidebarProps) {
  const t = useTranslations()
  const [hideQR, setHideQR] = useLocalStorage<boolean>(
    `hide-qr-evaluation`,
    false
  )

  return (
    <div
      className={twMerge(
        'order-1 flex w-full flex-none flex-col justify-between overflow-hidden px-3 py-2 md:order-2',
        textSize.text
      )}
    >
      <div className="flex h-max max-h-full flex-col gap-2 overflow-y-auto">
        <div className="font-bold">
          {t('manage.evaluation.keywordsSolution')}:
        </div>
        <ul>
          {instance.results.solutions?.map((keyword) => (
            <li key={keyword}>{`- ${keyword}`}</li>
          ))}
        </ul>
      </div>
      {type === 'LiveQuiz' && !hideQR && (
        <LiveQuizEvaluationQRCode setHideQR={setHideQR} />
      )}
    </div>
  )
}

export default FTSidebar
