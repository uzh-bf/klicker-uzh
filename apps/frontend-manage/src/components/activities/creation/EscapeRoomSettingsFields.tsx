import {
  Checkbox,
  FormikNumberField,
  FormikTextareaField,
} from '@uzh-bf/design-system'
import { useTranslations } from 'next-intl'

interface EscapeRoomSettingsFieldsProps {
  isEscapeRoom: boolean
  onToggle: (nextEnabled: boolean) => void
}

function EscapeRoomSettingsFields({
  isEscapeRoom,
  onToggle,
}: EscapeRoomSettingsFieldsProps) {
  const t = useTranslations()

  return (
    <div className="mt-2 flex flex-col gap-2 border-t border-solid border-gray-200 pt-2">
      <Checkbox
        label={t('manage.activityWizard.escapeRoomMode')}
        checked={isEscapeRoom}
        onCheck={() => onToggle(!isEscapeRoom)}
        className={{
          indicator: 'text-xs',
          root: 'w-4.5 h-4.5',
        }}
        data={{ cy: 'toggle-escape-room' }}
      />
      {isEscapeRoom && (
        <>
          <FormikNumberField
            name="escapeRoomTimeLimit"
            label={t('manage.activityWizard.escapeRoomTimeLimit')}
            required
            className={{ root: 'w-full', field: 'w-full' }}
            data={{ cy: 'escape-room-time-limit' }}
          />
          <FormikNumberField
            name="escapeRoomHintPenalty"
            label={t('manage.activityWizard.escapeRoomHintPenalty')}
            required
            className={{ root: 'w-full', field: 'w-full' }}
            data={{ cy: 'escape-room-hint-penalty' }}
          />
          <FormikTextareaField
            name="escapeRoomIntroText"
            label={t('manage.activityWizard.escapeRoomIntroText')}
            placeholder={t(
              'manage.activityWizard.escapeRoomIntroTextPlaceholder'
            )}
            className={{ root: 'w-full', input: 'h-20 w-full' }}
            data={{ cy: 'escape-room-intro-text' }}
          />
        </>
      )}
    </div>
  )
}

export default EscapeRoomSettingsFields
