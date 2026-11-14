import { faKey } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import {
  Button,
  Checkbox,
  FormikNumberField,
  FormikTextareaField,
  FormikTextField,
} from '@uzh-bf/design-system'
import { getIn, useFormikContext } from 'formik'
import { useTranslations } from 'next-intl'
import type { ReactNode } from 'react'
import { twMerge } from 'tailwind-merge'
import { getEscapeRoomPresetFormValues } from './escapeRoomValidation'

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
    </div>
  )
}

function RuleGroup({
  title,
  children,
}: {
  title?: string
  children: ReactNode
}) {
  return (
    <div className="flex flex-col gap-2 border-t border-solid border-gray-200 pt-2">
      {title && <div className="text-sm font-bold">{title}</div>}
      {children}
    </div>
  )
}

// Rules card shown next to the settings cards while the Escape Room toggle is on.
// With `blockPath` (e.g. `blocks.0`) the card edits the rule fields of that
// Live Quiz block only; the block's time limit, hint penalty and intro text
// stay with the block modal, and the preset is applied to that block.
export function EscapeRoomRulesCard({
  isEscapeRoom,
  blockPath,
}: {
  isEscapeRoom: boolean
  blockPath?: string
}) {
  const t = useTranslations()
  const { setValues, setFieldValue, values } =
    useFormikContext<Record<string, unknown>>()
  const fieldName = (field: string) =>
    blockPath ? `${blockPath}.${field}` : field

  if (!isEscapeRoom) return null

  const seconds = t('shared.generic.seconds')
  const fieldClassName = {
    root: 'w-full',
    field: 'w-full',
    tooltip: 'z-20',
  }

  return (
    <div
      className={twMerge(
        'border-border w-full rounded-md border border-solid p-2 shadow-md',
        !blockPath && 'md:w-72'
      )}
      data-cy="escape-room-rules-card"
    >
      <div className="flex flex-row items-center justify-center gap-2">
        <FontAwesomeIcon icon={faKey} />
        <div className="text-lg font-bold">
          {t('manage.activityWizard.escapeRoomRulesTitle')}
        </div>
      </div>
      <div className="flex flex-col gap-2">
        <Button
          className={{ root: 'justify-center px-2 py-1 text-xs' }}
          onClick={() => {
            if (!blockPath) {
              setValues((current) => ({
                ...current,
                ...getEscapeRoomPresetFormValues(),
              }))
              return
            }
            const { escapeRoomTimeLimit, escapeRoomHintPenalty, ...rules } =
              getEscapeRoomPresetFormValues()
            setFieldValue(blockPath, {
              ...(getIn(values, blockPath) as object),
              escapeRoomTimeLimit: Number(escapeRoomTimeLimit),
              escapeRoomHintPenalty: Number(escapeRoomHintPenalty),
              ...rules,
            })
          }}
          data={{ cy: 'escape-room-apply-preset' }}
        >
          <Button.Label>
            {t('manage.activityWizard.escapeRoomApplyPreset')}
          </Button.Label>
        </Button>
        {!blockPath && (
          <RuleGroup title={t('manage.activityWizard.escapeRoomGroupTime')}>
            <FormikNumberField
              name="escapeRoomTimeLimit"
              label={t('manage.activityWizard.escapeRoomTimeLimit')}
              tooltip={t('manage.activityWizard.escapeRoomTimeLimitTooltip')}
              unit={t('manage.activityWizard.escapeRoomUnitMinutes')}
              required
              className={fieldClassName}
              data={{ cy: 'escape-room-time-limit' }}
            />
          </RuleGroup>
        )}
        <RuleGroup title={t('manage.activityWizard.escapeRoomGroupHints')}>
          {!blockPath && (
            <FormikNumberField
              name="escapeRoomHintPenalty"
              label={t('manage.activityWizard.escapeRoomHintPenalty')}
              tooltip={t('manage.activityWizard.escapeRoomHintPenaltyTooltip')}
              unit={seconds}
              required
              className={fieldClassName}
              data={{ cy: 'escape-room-hint-penalty' }}
            />
          )}
          <FormikTextField
            name={fieldName('escapeRoomHintPenalties')}
            label={t('manage.activityWizard.escapeRoomHintPenalties')}
            tooltip={t('manage.activityWizard.escapeRoomHintPenaltiesTooltip')}
            placeholder={t(
              'manage.activityWizard.escapeRoomHintPenaltiesPlaceholder'
            )}
            className={fieldClassName}
            data={{ cy: 'escape-room-hint-penalties' }}
          />
        </RuleGroup>
        <RuleGroup
          title={t('manage.activityWizard.escapeRoomGroupWrongAnswers')}
        >
          <FormikNumberField
            name={fieldName('escapeRoomWrongAnswerPenalty')}
            label={t('manage.activityWizard.escapeRoomWrongAnswerPenalty')}
            tooltip={t(
              'manage.activityWizard.escapeRoomWrongAnswerPenaltyTooltip'
            )}
            unit={seconds}
            className={fieldClassName}
            data={{ cy: 'escape-room-wrong-answer-penalty' }}
          />
          <FormikNumberField
            name={fieldName('escapeRoomMaxWrongAttempts')}
            label={t('manage.activityWizard.escapeRoomMaxWrongAttempts')}
            tooltip={t(
              'manage.activityWizard.escapeRoomMaxWrongAttemptsTooltip'
            )}
            className={fieldClassName}
            data={{ cy: 'escape-room-max-wrong-attempts' }}
          />
          <FormikNumberField
            name={fieldName('escapeRoomRevealPenalty')}
            label={t('manage.activityWizard.escapeRoomRevealPenalty')}
            tooltip={t('manage.activityWizard.escapeRoomRevealPenaltyTooltip')}
            unit={seconds}
            className={fieldClassName}
            data={{ cy: 'escape-room-reveal-penalty' }}
          />
        </RuleGroup>
        <RuleGroup title={t('manage.activityWizard.escapeRoomGroupSkip')}>
          <FormikNumberField
            name={fieldName('escapeRoomSkipPenalty')}
            label={t('manage.activityWizard.escapeRoomSkipPenalty')}
            tooltip={t('manage.activityWizard.escapeRoomSkipPenaltyTooltip')}
            unit={seconds}
            className={fieldClassName}
            data={{ cy: 'escape-room-skip-penalty' }}
          />
        </RuleGroup>
        <RuleGroup title={t('manage.activityWizard.escapeRoomGroupBonus')}>
          <FormikNumberField
            name={fieldName('escapeRoomBonusSeconds')}
            label={t('manage.activityWizard.escapeRoomBonusSeconds')}
            tooltip={t('manage.activityWizard.escapeRoomBonusSecondsTooltip')}
            unit={seconds}
            className={fieldClassName}
            data={{ cy: 'escape-room-bonus-seconds' }}
          />
        </RuleGroup>
        {!blockPath && (
          <RuleGroup>
            <FormikTextareaField
              name="escapeRoomIntroText"
              label={t('manage.activityWizard.escapeRoomIntroText')}
              tooltip={t('manage.activityWizard.escapeRoomIntroTextTooltip')}
              placeholder={t(
                'manage.activityWizard.escapeRoomIntroTextPlaceholder'
              )}
              className={{
                root: 'w-full',
                input: 'h-20 w-full',
                tooltip: 'z-20',
              }}
              data={{ cy: 'escape-room-intro-text' }}
            />
          </RuleGroup>
        )}
      </div>
    </div>
  )
}

export default EscapeRoomSettingsFields
