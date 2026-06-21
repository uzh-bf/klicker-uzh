import { routing } from '@klicker-uzh/i18n'
import { Modal, Select, Switch, UserNotification } from '@uzh-bf/design-system'
import { useTranslations } from 'next-intl'
import { useRouter } from 'next/router'
import { useState } from 'react'
import { trpc } from '../../lib/trpc'
import HMACLink from './HMACLink'

function EmbeddingModal({
  onClose,
  quizId,
  isGamificationEnabled,
}: {
  onClose: () => void
  quizId: string
  isGamificationEnabled: boolean
}) {
  const t = useTranslations()
  const [showSolution, setShowSolution] = useState(false)
  const [showExplanation, setShowExplanation] = useState(false)
  const router = useRouter()
  const { data, error, isLoading } = trpc.liveQuiz.embeddingInfo.useQuery({
    id: quizId,
  })
  const embeddingInfo = data?.embeddingInfo
  const initialLoading = isLoading && !embeddingInfo
  const embeddingUnavailable = Boolean((error || !isLoading) && !embeddingInfo)

  // language state for links
  type LocaleType = (typeof routing.locales)[number]
  const [language, setLanguage] = useState(
    router.locale &&
      (routing.locales as readonly string[]).includes(router.locale)
      ? (router.locale as LocaleType)
      : 'en'
  )

  return (
    <Modal
      open
      loading={initialLoading}
      title={t('manage.liveQuizzes.evaluationLinksEmbedding')}
      onClose={onClose}
      primaryLabel={t('shared.generic.close')}
      primaryButtonStyle="default"
      onPrimaryAction={onClose}
      dataPrimaryAction={{ cy: 'close-embedding-modal' }}
      className={{ content: 'max-h-[calc(100%-3rem)]', footer: 'justify-end' }}
    >
      {embeddingUnavailable ? (
        <UserNotification
          type="error"
          message={t('shared.generic.systemError')}
        />
      ) : null}

      {embeddingInfo ? (
        <>
          <div className="mb-4 rounded-md border p-2.5">
            <Switch
              size="sm"
              label={t('manage.evaluation.showSolution')}
              checked={showSolution}
              onCheckedChange={(val) => setShowSolution(val)}
              data={{ cy: 'embedding-show-solution-switch' }}
            />
            <div className="pl-13 mb-3 text-sm">
              {t('manage.evaluation.showSolutionInfo')}
            </div>
            <Switch
              size="sm"
              label={t('manage.evaluation.showExplanation')}
              checked={showExplanation}
              onCheckedChange={(val) => setShowExplanation(val)}
              data={{ cy: 'embedding-show-explanation-switch' }}
            />
            <div className="pl-13 mb-3 text-sm">
              {t('manage.evaluation.showExplanationInfo')}
            </div>
            <div className="pl-13">
              <div className="font-bold">{t('shared.generic.language')}</div>
              <Select
                value={language}
                onChange={(newValue) => setLanguage(newValue as LocaleType)}
                items={routing.locales.map((loc) => ({
                  label: t(`shared.generic.${loc}`),
                  value: loc,
                }))}
              />
            </div>
          </div>

          <div className="flex flex-col gap-4">
            <div>
              <div className="w-30 font-bold">
                {t('shared.generic.evaluation')}
              </div>
              <HMACLink
                quizId={quizId}
                hmac={embeddingInfo.hmac}
                params=""
                identifier="generic-evaluation"
                language={language}
              />
            </div>
            {embeddingInfo.instances?.map((instance, ix) => {
              return (
                <div key={instance.id}>
                  <div className="line-clamp-1 font-bold">
                    {ix + 1} {instance.name}
                  </div>
                  <HMACLink
                    quizId={quizId}
                    hmac={embeddingInfo.hmac}
                    params={`questionIx=${ix}&hideControls=true&showSolution=${showSolution}&showExplanation=${showExplanation}`}
                    identifier={`question-${ix}`}
                    language={language}
                  />
                </div>
              )
            })}
            {isGamificationEnabled && (
              <div>
                <div className="w-30 font-bold">
                  {t('shared.generic.leaderboard')}:
                </div>
                <HMACLink
                  quizId={quizId}
                  hmac={embeddingInfo.hmac}
                  params="leaderboard=true&hideControls=true"
                  identifier="leaderboard"
                  language={language}
                />
              </div>
            )}
          </div>
        </>
      ) : null}
    </Modal>
  )
}

export default EmbeddingModal
