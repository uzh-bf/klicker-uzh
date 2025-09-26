import { FormikSelectField } from '@uzh-bf/design-system'
import { useField } from 'formik'
import { useTranslations } from 'next-intl'
import { useEffect } from 'react'
import type {
  ParticipantScope,
  PointCorrectionsFormValues,
  PointCorrectionsParticipant,
} from './types'

interface PointCorrectionsAudienceStepProps {
  participants: PointCorrectionsParticipant[]
}

function PointCorrectionsAudienceStep({
  participants,
}: PointCorrectionsAudienceStepProps) {
  const t = useTranslations()
  const [participantScopeField] =
    useField<PointCorrectionsFormValues['participantScope']>('participantScope')
  const [participantField, _, participantHelpers] = useField('participantId')

  useEffect(() => {
    if (participantScopeField.value !== 'single' && participantField.value) {
      participantHelpers.setValue('')
    }
  }, [participantScopeField.value, participantField.value, participantHelpers])

  const participantOptions = participants.map((participant) => ({
    label: participant.name,
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
            label={t('manage.pointCorrections.audienceLabel')}
            placeholder={t('manage.pointCorrections.audiencePlaceholder')}
            items={[
              {
                value: 'single' as ParticipantScope,
                label: t('manage.pointCorrections.audienceOptionSingle'),
              },
              {
                value: 'participating' as ParticipantScope,
                label: t('manage.pointCorrections.audienceOptionParticipating'),
              },
              {
                value: 'course' as ParticipantScope,
                label: t('manage.pointCorrections.audienceOptionCourse'),
              },
            ]}
            className={{ select: { trigger: 'h-9 w-72' } }}
            data={{ cy: 'point-corrections-participant-scope-select' }}
          />
        </div>

        {participantScopeField.value === 'single' ? (
          <div className="flex-1">
            <FormikSelectField
              required
              name="participantId"
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
