import {
  Checkbox,
  Modal,
  NumberField,
  TextareaField,
} from '@uzh-bf/design-system'
import { useTranslations } from 'next-intl'
import { ElementBlockFormValues } from '../WizardLayout'

function LiveQuizCountdownModal({
  onClose,
  block,
  index,
  replace,
}: {
  onClose: () => void
  block: ElementBlockFormValues
  index: number
  replace: (index: number, block: ElementBlockFormValues) => void
}) {
  const t = useTranslations()

  return (
    <Modal
      open
      onClose={onClose}
      title={t('manage.activityWizard.blockCountdownTitle', {
        blockIx: index + 1,
      })}
      primaryLabel={t('shared.generic.ok')}
      onPrimaryAction={onClose}
      dataPrimaryAction={{ cy: 'close-block-countdown' }}
      className={{ content: 'max-w-xl', footer: 'justify-end' }}
    >
      <NumberField
        label={t('manage.activityWizard.timeLimit')}
        tooltip={t('manage.activityWizard.timeLimitTooltip', {
          blockIx: index + 1,
        })}
        id={`timeLimits.${index}`}
        value={block.timeLimit || ''}
        unit={t('shared.generic.seconds')}
        onChange={(newValue: string) => {
          replace(index, {
            ...block,
            timeLimit: newValue === '' ? undefined : parseInt(newValue),
          })
        }}
        placeholder={t('manage.activityWizard.optionalTimeLimit')}
        data={{ cy: 'block-time-limit' }}
      />
      <div className="mt-4 border-t border-solid border-gray-200 pt-3">
        <Checkbox
          label={t('manage.activityWizard.escapeRoomMode')}
          checked={!!block.isEscapeRoom}
          onCheck={() =>
            replace(index, {
              ...block,
              isEscapeRoom: !block.isEscapeRoom,
              escapeRoomTimeLimit: block.escapeRoomTimeLimit ?? 5,
              escapeRoomHintPenalty: block.escapeRoomHintPenalty ?? 0,
            })
          }
          data={{ cy: 'toggle-escape-room' }}
        />
        {block.isEscapeRoom && (
          <div className="mt-3 flex flex-col gap-3">
            <NumberField
              label={t('manage.activityWizard.escapeRoomTimeLimit')}
              value={block.escapeRoomTimeLimit ?? 5}
              onChange={(value) =>
                replace(index, {
                  ...block,
                  escapeRoomTimeLimit: Math.max(parseInt(value || '1'), 1),
                })
              }
              data={{ cy: 'escape-room-time-limit' }}
            />
            <NumberField
              label={t('manage.activityWizard.escapeRoomHintPenalty')}
              value={block.escapeRoomHintPenalty ?? 0}
              onChange={(value) =>
                replace(index, {
                  ...block,
                  escapeRoomHintPenalty: Math.max(parseInt(value || '0'), 0),
                })
              }
              data={{ cy: 'escape-room-hint-penalty' }}
            />
            <TextareaField
              label={t('manage.activityWizard.escapeRoomIntroText')}
              value={block.escapeRoomIntroText ?? ''}
              onChange={(value) =>
                replace(index, { ...block, escapeRoomIntroText: value })
              }
              data={{ cy: 'escape-room-intro-text' }}
            />
          </div>
        )}
      </div>
    </Modal>
  )
}

export default LiveQuizCountdownModal
