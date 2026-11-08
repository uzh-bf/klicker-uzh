import {
  Button,
  Checkbox,
  FormikNumberField,
  FormikTextareaField,
  FormikTextField,
} from '@uzh-bf/design-system'
import { useFormikContext } from 'formik'
import { useTranslations } from 'next-intl'
import { getEscapeRoomPresetFormValues } from './escapeRoomValidation'

const RULE_FIELDS = [
  'escapeRoomWrongAnswerPenalty',
  'escapeRoomMaxWrongAttempts',
  'escapeRoomRevealPenalty',
  'escapeRoomSkipPenalty',
  'escapeRoomBonusSeconds',
] as const

const RULE_DATA_CY: Record<(typeof RULE_FIELDS)[number], string> = {
  escapeRoomWrongAnswerPenalty: 'escape-room-wrong-answer-penalty',
  escapeRoomMaxWrongAttempts: 'escape-room-max-wrong-attempts',
  escapeRoomRevealPenalty: 'escape-room-reveal-penalty',
  escapeRoomSkipPenalty: 'escape-room-skip-penalty',
  escapeRoomBonusSeconds: 'escape-room-bonus-seconds',
}

interface EscapeRoomSettingsFieldsProps {
  isEscapeRoom: boolean
  onToggle: (nextEnabled: boolean) => void
}

function EscapeRoomSettingsFields({
  isEscapeRoom,
  onToggle,
}: EscapeRoomSettingsFieldsProps) {
  const t = useTranslations()
  const { setValues } = useFormikContext<Record<string, unknown>>()
  const ruleLabels: Record<(typeof RULE_FIELDS)[number], string> = {
    escapeRoomWrongAnswerPenalty: t(
      'manage.activityWizard.escapeRoomWrongAnswerPenalty'
    ),
    escapeRoomMaxWrongAttempts: t(
      'manage.activityWizard.escapeRoomMaxWrongAttempts'
    ),
    escapeRoomRevealPenalty: t('manage.activityWizard.escapeRoomRevealPenalty'),
    escapeRoomSkipPenalty: t('manage.activityWizard.escapeRoomSkipPenalty'),
    escapeRoomBonusSeconds: t('manage.activityWizard.escapeRoomBonusSeconds'),
  }

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
          <div className="mt-1 flex flex-row items-center justify-between">
            <div className="font-bold">
              {t('manage.activityWizard.escapeRoomRulesTitle')}
            </div>
            <Button
              className={{ root: 'px-2 py-1 text-xs' }}
              onClick={() =>
                setValues((values) => ({
                  ...values,
                  ...getEscapeRoomPresetFormValues(),
                }))
              }
              data={{ cy: 'escape-room-apply-preset' }}
            >
              <Button.Label>
                {t('manage.activityWizard.escapeRoomApplyPreset')}
              </Button.Label>
            </Button>
          </div>
          <FormikTextField
            name="escapeRoomHintPenalties"
            label={t('manage.activityWizard.escapeRoomHintPenalties')}
            placeholder="120, 240"
            className={{ root: 'w-full', field: 'w-full' }}
            data={{ cy: 'escape-room-hint-penalties' }}
          />
          {RULE_FIELDS.map((name) => (
            <FormikNumberField
              key={name}
              name={name}
              label={ruleLabels[name]}
              className={{ root: 'w-full', field: 'w-full' }}
              data={{ cy: RULE_DATA_CY[name] }}
            />
          ))}
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
