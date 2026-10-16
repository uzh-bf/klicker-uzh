import { useQuery } from '@apollo/client'
import { faCheck, faCopy } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import {
  GetLiveQuizEmbeddingInfoDocument,
  GetSingleLiveQuizDocument,
} from '@klicker-uzh/graphql/dist/ops'
import Loader from '@klicker-uzh/shared-components/src/Loader'
import { Button, toast, UserNotification } from '@uzh-bf/design-system'
import { useTranslations } from 'next-intl'
import { useEffect, useMemo, useState } from 'react'
import ResponsiveSheet from '../common/ResponsiveSheet'
import {
  iconButtonClass,
  outlineButtonClass,
  sheetButtonClass,
} from '../common/styles'

function EmbedRow({
  label,
  quizId,
  hmac,
  params,
  identifier,
}: {
  label: string
  quizId: string
  hmac: string
  params: string
  identifier: string
}) {
  const t = useTranslations()
  const [copied, setCopied] = useState(false)
  const link = `${process.env.NEXT_PUBLIC_MANAGE_URL}/quizzes/${quizId}/evaluation?hmac=${hmac}&${params}`

  useEffect(() => {
    if (!copied) return
    const timeout = setTimeout(() => setCopied(false), 1600)
    return () => clearTimeout(timeout)
  }, [copied])

  return (
    <div className="flex flex-col gap-1.5">
      <div className="text-ctrl-ink truncate text-sm font-bold">{label}</div>
      <div className="border-ctrl-border bg-ctrl-bg flex items-center gap-2 rounded-md border py-1 pr-1 pl-2.5">
        <a
          href={link}
          target="_blank"
          rel="noopener noreferrer"
          data-cy={`open-embedding-link-${identifier}`}
          className="text-ctrl-ink-2 min-w-0 flex-1 truncate font-[ui-monospace,SFMono-Regular,Menlo,monospace] text-xs"
        >
          {link}
        </a>
        <Button
          onClick={async () => {
            try {
              // the clipboard API is missing in insecure contexts; only show
              // the check mark after an actual copy
              if (!navigator.clipboard) throw new Error('clipboard unavailable')
              await navigator.clipboard.writeText(link)
              setCopied(true)
            } catch {
              setCopied(false)
              toast({
                type: 'error',
                message: t('control.liveQuiz.actionFailed'),
                options: { duration: 5000 },
              })
            }
          }}
          className={{ root: iconButtonClass }}
          aria-label={
            copied
              ? t('control.course.linkCopied')
              : t('control.course.copyLink')
          }
          data={{ cy: `copy-embed-link-live-quiz-${quizId}` }}
        >
          <FontAwesomeIcon
            icon={copied ? faCheck : faCopy}
            className={copied ? 'text-ctrl-good h-3.5 w-3.5' : 'h-3.5 w-3.5'}
          />
        </Button>
      </div>
    </div>
  )
}

// PPT embedding: one copyable evaluation link per question plus the leaderboard
function EmbeddingModal({
  onClose,
  quizId,
}: {
  onClose: () => void
  quizId: string
}) {
  const t = useTranslations()
  const { data: dataLiveQuiz, loading: loadingQuiz } = useQuery(
    GetSingleLiveQuizDocument,
    {
      variables: { quizId },
      skip: !quizId,
    }
  )
  const { data, loading, error } = useQuery(GetLiveQuizEmbeddingInfoDocument, {
    variables: { id: quizId },
    skip: !quizId,
  })

  // questionIx is the global index across all blocks of the quiz
  const questions = useMemo(
    () =>
      dataLiveQuiz?.liveQuiz?.blocks?.flatMap((block) => block.elements) || [],
    [dataLiveQuiz?.liveQuiz?.blocks]
  )
  const hmac = data?.getLiveQuizEmbeddingInfo?.hmac

  return (
    <ResponsiveSheet
      open
      onClose={onClose}
      title={t('control.course.pptEmbedding')}
      dataCy="embedding-sheet"
      actions={
        <Button
          onClick={onClose}
          className={{ root: `${sheetButtonClass} ${outlineButtonClass}` }}
          data={{ cy: 'close-embedding-modal' }}
        >
          {t('shared.generic.close')}
        </Button>
      }
    >
      <p className="text-ctrl-muted mb-3.5 text-sm">
        {t('control.course.pptEmbeddingHint')}
      </p>
      {loading || loadingQuiz ? (
        <Loader />
      ) : error || !hmac ? (
        <UserNotification
          type="error"
          message={t('control.liveQuiz.actionFailed')}
        />
      ) : (
        <div className="flex flex-col gap-3.5">
          {questions.map((element, ix) =>
            element?.elementData ? (
              <EmbedRow
                key={element.id}
                label={`${ix + 1}. ${element.elementData.name}`}
                quizId={quizId}
                hmac={hmac}
                params={`questionIx=${ix}&hideControls=true`}
                identifier={`question-${ix}`}
              />
            ) : null
          )}
          <EmbedRow
            label={t('shared.generic.leaderboard')}
            quizId={quizId}
            hmac={hmac}
            params="leaderboard=true&hideControls=true"
            identifier="leaderboard"
          />
        </div>
      )}
    </ResponsiveSheet>
  )
}

export default EmbeddingModal
