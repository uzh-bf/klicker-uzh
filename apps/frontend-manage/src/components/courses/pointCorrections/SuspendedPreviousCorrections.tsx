import { useSuspenseQuery } from '@apollo/client'
import { GetPreviousPointCorrectionsDocument } from '@klicker-uzh/graphql/dist/ops'
import dayjs from 'dayjs'
import { useTranslations } from 'next-intl'

function SuspendedPreviousCorrections({
  instanceScope,
  liveQuizId,
  instanceId,
}: {
  instanceScope: boolean
  liveQuizId: string
  instanceId: string
}) {
  const t = useTranslations()

  // fetch the previous corrections for the given live quiz / instance
  const { data } = useSuspenseQuery(GetPreviousPointCorrectionsDocument, {
    variables: {
      liveQuizId,
      instanceId: instanceId ? parseInt(instanceId, 10) : undefined,
    },
    fetchPolicy: 'network-only',
  })
  const corrections = data.previousPointCorrections ?? []

  if (corrections.length === 0) {
    return (
      <div className="text-sm text-gray-600">
        {instanceScope
          ? t('manage.pointCorrections.historyPlaceholderInstance')
          : t('manage.pointCorrections.historyPlaceholder')}
      </div>
    )
  }

  return (
    <ul className="flex flex-col gap-1 text-sm text-gray-700">
      {corrections.map((correction) => (
        <li key={correction.id} className="flex flex-col">
          <span className="font-medium">{correction.reason}</span>
          <span className="text-xs text-gray-500">
            {t('manage.pointCorrections.historyApplied', {
              appliedAt: dayjs(correction.createdAt).format(
                'DD.MM.YYYY, HH:mm'
              ),
              user:
                correction.correctedBy?.shortname ??
                t('shared.generic.deletedUser'),
            })}
          </span>
        </li>
      ))}
    </ul>
  )
}

export default SuspendedPreviousCorrections
