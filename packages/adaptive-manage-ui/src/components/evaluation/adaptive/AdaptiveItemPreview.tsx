import { faMagnifyingGlass } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { useQuery } from '@apollo/client'
import {
  ElementType,
  QAdaptivePracticeQuizItemPreviewDocument,
} from '@klicker-uzh/graphql/dist/ops'
import Loader from '@klicker-uzh/shared-components/src/Loader'
import QuestionContent from '@klicker-uzh/shared-components/src/QuestionContent'
import { SCAnswerOptions } from '@klicker-uzh/shared-components/src/questions/SCAnswerOptions'
import { MCAnswerOptions } from '@klicker-uzh/shared-components/src/questions/MCAnswerOptions'
import { KPAnswerOptions } from '@klicker-uzh/shared-components/src/questions/KPAnswerOptions'
import {
  Button,
  Modal,
  TextField,
  UserNotification,
} from '@uzh-bf/design-system'
import { useTranslations } from 'next-intl'
import { useState } from 'react'

function PreviewContent({
  practiceQuizId,
  poolItemId,
}: {
  practiceQuizId: string
  poolItemId: number
}) {
  const t = useTranslations()
  const { data, loading, error, refetch } = useQuery(
    QAdaptivePracticeQuizItemPreviewDocument,
    {
      variables: { practiceQuizId, poolItemId },
      fetchPolicy: 'no-cache',
    }
  )
  const [choices, setChoices] = useState<Record<number, boolean | undefined>>(
    {}
  )
  const [text, setText] = useState('')
  const item = data?.adaptivePracticeQuizItemPreview
  if (loading) return <Loader />
  if (error || !item)
    return (
      <UserNotification type="error">
        {t('manage.competenceTree.previewError')}
        <Button
          onClick={() => void refetch()}
          data={{ cy: 'adaptive-item-preview-retry' }}
        >
          <Button.Label>{t('manage.competenceTree.retryPreview')}</Button.Label>
        </Button>
      </UserNotification>
    )
  const options = item.options
  const choiceProps =
    options.__typename === 'AdaptivePracticeQuizChoicesOptions'
      ? {
          choices: options.choices.map(({ ix, value }) => ({ ix, value })),
          displayMode: options.displayMode,
          value: choices,
          onChange: setChoices,
          elementIx: 0,
          hideFeedbacks: true,
          disabled: false,
        }
      : null
  return (
    <div className="space-y-4">
      <QuestionContent content={item.content} noPoints={false} />
      {choiceProps && item.type === ElementType.Sc && (
        <SCAnswerOptions {...choiceProps} />
      )}
      {choiceProps && item.type === ElementType.Mc && (
        <MCAnswerOptions {...choiceProps} />
      )}
      {choiceProps && item.type === ElementType.Kprim && (
        <KPAnswerOptions {...choiceProps} type={ElementType.Kprim} />
      )}
      {options.__typename === 'AdaptivePracticeQuizNumericalOptions' && (
        <>
          <div className="flex gap-4 text-sm">
            {options.restrictions?.min != null && (
              <span>
                {t('shared.generic.min')}: {options.restrictions.min}
              </span>
            )}
            {options.restrictions?.max != null && (
              <span>
                {t('shared.generic.max')}: {options.restrictions.max}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <TextField
              value={text}
              onChange={setText}
              inputMode="decimal"
              aria-label={t('shared.NUMERICAL.text')}
              placeholder={options.placeholder ?? undefined}
            />
            {options.unit && <span>{options.unit}</span>}
          </div>
        </>
      )}
      {options.__typename === 'AdaptivePracticeQuizFreeTextOptions' && (
        <TextField
          value={text}
          onChange={setText}
          aria-label={t('shared.FREE_TEXT.text')}
          maxLength={options.restrictions?.maxLength ?? undefined}
        />
      )}
    </div>
  )
}

function AdaptiveItemPreview({
  practiceQuizId,
  poolItemId,
  name,
}: {
  practiceQuizId: string
  poolItemId: number
  name: string
}) {
  const t = useTranslations()
  const [open, setOpen] = useState(false)
  return (
    <>
      <Button
        basic
        size="icon"
        className={{ root: 'h-8 w-8 shrink-0' }}
        onClick={() => setOpen(true)}
        title={t('manage.activities.previewElement')}
        aria-label={t('manage.competenceTree.previewElement', { name })}
        data={{ cy: `adaptive-item-preview-${poolItemId}` }}
      >
        <FontAwesomeIcon icon={faMagnifyingGlass} size="sm" />
      </Button>
      {open && (
        <Modal
          open
          title={name}
          onClose={() => setOpen(false)}
          className={{
            content: 'max-w-3xl',
            title: 'whitespace-normal break-words pr-6',
          }}
          dataContent={{ cy: 'adaptive-item-preview-modal' }}
        >
          <PreviewContent
            practiceQuizId={practiceQuizId}
            poolItemId={poolItemId}
          />
        </Modal>
      )}
    </>
  )
}
export default AdaptiveItemPreview
