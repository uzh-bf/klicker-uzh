import { PointCorrectionType } from '@klicker-uzh/graphql/dist/ops'
import { FormikSelectField } from '@uzh-bf/design-system'
import { useField } from 'formik'
import { useTranslations } from 'next-intl'
import { useEffect } from 'react'
import type { PointCorrectionsFormValues } from './types'

function PointCorrectionsAudienceStep({
  participants,
  fixedParticipant = false,
}: {
  participants: { id: string; email: string }[]
  fixedParticipant?: boolean
}) {
  const t = useTranslations()
  const [participantScopeField] =
    useField<PointCorrectionsFormValues['participantScope']>('participantScope')
  const [participantField, _, participantHelpers] = useField('participantId')

  useEffect(() => {
    if (
      participantScopeField.value !== PointCorrectionType.Single &&
      participantField.value
    ) {
      participantHelpers.setValue('')
    }
  }, [participantScopeField.value, participantField.value, participantHelpers])

  const participantOptions = participants.map((participant) => ({
    label: participant.email,
    value: participant.id,
  }))

  return (
    <div className="flex flex-col gap-2">
      <div className="text-sm text-gray-700">
        {t('manage.pointCorrections.audienceDescription')}
      </div>

      <div className="flex flex-col gap-4 md:flex-row">
        <div className="flex-1">
          <FormikSelectField
            required
            name="participantScope"
            disabled={fixedParticipant}
            label={t('manage.pointCorrections.audienceLabel')}
            placeholder={t('manage.pointCorrections.audiencePlaceholder')}
            items={[
              {
                value: PointCorrectionType.Single,
                label: t('manage.pointCorrections.audienceOptionSingle'),
              },
              {
                value: PointCorrectionType.Participating,
                label: t('manage.pointCorrections.audienceOptionParticipating'),
              },
              {
                value: PointCorrectionType.AllCourse,
                label: t('manage.pointCorrections.audienceOptionCourse'),
              },
            ]}
            className={{ select: { trigger: 'h-9 w-72' } }}
            data={{ cy: 'point-corrections-participant-scope-select' }}
          />
        </div>

        {participantScopeField.value === PointCorrectionType.Single ? (
          <div className="flex-1">
            <FormikSelectField
              required
              name="participantId"
              disabled={fixedParticipant}
              label={t('manage.pointCorrections.participantLabel')}
              placeholder={t('manage.pointCorrections.participantPlaceholder')}
              items={participantOptions}
              className={{ select: { trigger: 'h-9 w-72' } }}
            />
          </div>
        ) : null}
      </div>
    </div>
  )
}

export default PointCorrectionsAudienceStep
