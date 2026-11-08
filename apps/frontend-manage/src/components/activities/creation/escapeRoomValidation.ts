import { ESCAPE_ROOM_CLASSROOM_PRESET } from '@klicker-uzh/types'
import { useTranslations } from 'next-intl'
import * as yup from 'yup'

const HINT_PENALTIES_PATTERN = /^\s*(\d+\s*(,\s*\d+\s*)*)?$/

export interface EscapeRoomRulesFormValues {
  escapeRoomHintPenalties: string
  escapeRoomWrongAnswerPenalty: string
  escapeRoomMaxWrongAttempts: string
  escapeRoomRevealPenalty: string
  escapeRoomSkipPenalty: string
  escapeRoomBonusSeconds: string
}

interface EscapeRoomRulesConfig {
  hintPenalties?: number[] | null
  wrongAnswerPenalty?: number | null
  maxWrongAttempts?: number | null
  revealPenalty?: number | null
  skipPenalty?: number | null
  bonusSeconds?: number | null
}

function optionalNumber(value: number | null | undefined) {
  return value == null ? '' : String(value)
}

function parseOptionalNumber(value: string | undefined) {
  return value == null || value.trim() === '' ? null : parseInt(value, 10)
}

// One hint per line; each hint costs its indexed hint penalty when revealed.
// Without loaded text (duplication and conversion skip the hint query) the
// list is omitted, so the server copies the source instance's hints.
export function getEscapeRoomHintsInput(text: string | null | undefined) {
  if (text == null) return undefined
  return text
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line !== '')
    .map((line) => ({ text: line, penalty: null }))
}

export function getEscapeRoomHintsFormValue(entry: {
  hint: string
  hints?: { text: string }[] | null
}) {
  return entry.hints?.length
    ? entry.hints.map((hint) => hint.text).join('\n')
    : entry.hint
}

// Form values for stored rules; without a config every rule is off.
export function getEscapeRoomRulesFormValues(
  config?: EscapeRoomRulesConfig | null
): EscapeRoomRulesFormValues {
  return {
    escapeRoomHintPenalties: (config?.hintPenalties ?? []).join(', '),
    escapeRoomWrongAnswerPenalty: String(config?.wrongAnswerPenalty ?? 0),
    escapeRoomMaxWrongAttempts: optionalNumber(config?.maxWrongAttempts),
    escapeRoomRevealPenalty: String(config?.revealPenalty ?? 0),
    escapeRoomSkipPenalty: optionalNumber(config?.skipPenalty),
    escapeRoomBonusSeconds: optionalNumber(config?.bonusSeconds),
  }
}

export function getEscapeRoomPresetFormValues() {
  return {
    escapeRoomTimeLimit: String(ESCAPE_ROOM_CLASSROOM_PRESET.timeLimitMinutes),
    escapeRoomHintPenalty: String(ESCAPE_ROOM_CLASSROOM_PRESET.hintPenalty),
    ...getEscapeRoomRulesFormValues({
      ...ESCAPE_ROOM_CLASSROOM_PRESET,
      hintPenalties: [...ESCAPE_ROOM_CLASSROOM_PRESET.hintPenalties],
    }),
  }
}

export function getEscapeRoomRulesInput(
  values: Partial<EscapeRoomRulesFormValues>
) {
  return {
    hintPenalties: (values.escapeRoomHintPenalties ?? '')
      .split(',')
      .map((entry) => entry.trim())
      .filter((entry) => entry !== '')
      .map((entry) => parseInt(entry, 10)),
    wrongAnswerPenalty: parseOptionalNumber(
      values.escapeRoomWrongAnswerPenalty
    ),
    maxWrongAttempts: parseOptionalNumber(values.escapeRoomMaxWrongAttempts),
    revealPenalty: parseOptionalNumber(values.escapeRoomRevealPenalty),
    skipPenalty: parseOptionalNumber(values.escapeRoomSkipPenalty),
    bonusSeconds: parseOptionalNumber(values.escapeRoomBonusSeconds),
  }
}

// note: named with a `use` prefix (and called as a hook) rather than taking
// `t` as a parameter, since typing the parameter explicitly as
// `ReturnType<typeof useTranslations>` blows up tsc with TS2590 ("union type
// too complex") given how large this repo's generated Messages type already is
export function useEscapeRoomYupFields() {
  const t = useTranslations()
  const escapeRoomRulesYupFields = useEscapeRoomRulesYupFields()

  return {
    isEscapeRoom: yup.boolean(),
    escapeRoomTimeLimit: yup.number().when('isEscapeRoom', {
      is: true,
      then: (schema) =>
        schema
          .required(t('manage.activityWizard.escapeRoomTimeLimitRequired'))
          .integer(t('manage.activityWizard.escapeRoomInteger'))
          .positive(t('manage.activityWizard.escapeRoomTimeLimitPositive'))
          .max(1440, t('manage.activityWizard.escapeRoomTimeLimitMax')),
      otherwise: (schema) => schema.notRequired(),
    }),
    escapeRoomHintPenalty: yup.number().when('isEscapeRoom', {
      is: true,
      then: (schema) =>
        schema
          .required(t('manage.activityWizard.escapeRoomHintPenaltyRequired'))
          .integer(t('manage.activityWizard.escapeRoomInteger'))
          .min(0, t('manage.activityWizard.escapeRoomHintPenaltyMin'))
          .max(3600, t('manage.activityWizard.escapeRoomHintPenaltyMax')),
      otherwise: (schema) => schema.notRequired(),
    }),
    escapeRoomIntroText: yup
      .string()
      .max(5000, t('manage.activityWizard.escapeRoomIntroTextMax')),
    ...escapeRoomRulesYupFields,
  }
}

// Scoring rules exist for Practice Quiz, Microlearning and Group Activity
// escape rooms; Live Quiz blocks keep their own settings.
function useEscapeRoomRulesYupFields() {
  const t = useTranslations()
  const ruleSeconds = () =>
    yup
      .number()
      .transform((value, original) =>
        original === '' || original == null ? undefined : value
      )
      .typeError(t('manage.activityWizard.escapeRoomRuleSecondsRange'))
      .integer(t('manage.activityWizard.escapeRoomRuleSecondsRange'))
      .min(0, t('manage.activityWizard.escapeRoomRuleSecondsRange'))
      .max(3600, t('manage.activityWizard.escapeRoomRuleSecondsRange'))

  return {
    escapeRoomHintPenalties: yup
      .string()
      .test(
        'hint-penalties',
        t('manage.activityWizard.escapeRoomHintPenaltiesInvalid'),
        (value) => {
          if (!value || value.trim() === '') return true
          if (!HINT_PENALTIES_PATTERN.test(value)) return false
          const entries = value.split(',').map((entry) => parseInt(entry, 10))
          return (
            entries.length <= 10 &&
            entries.every((entry) => entry >= 0 && entry <= 3600)
          )
        }
      ),
    escapeRoomWrongAnswerPenalty: ruleSeconds(),
    escapeRoomMaxWrongAttempts: yup
      .number()
      .transform((value, original) =>
        original === '' || original == null ? undefined : value
      )
      .typeError(t('manage.activityWizard.escapeRoomMaxWrongAttemptsRange'))
      .integer(t('manage.activityWizard.escapeRoomMaxWrongAttemptsRange'))
      .min(1, t('manage.activityWizard.escapeRoomMaxWrongAttemptsRange'))
      .max(50, t('manage.activityWizard.escapeRoomMaxWrongAttemptsRange')),
    escapeRoomRevealPenalty: ruleSeconds(),
    escapeRoomSkipPenalty: ruleSeconds(),
    escapeRoomBonusSeconds: ruleSeconds(),
  }
}
