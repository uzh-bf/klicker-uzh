import { faEllipsisVertical } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { LocaleType } from '@klicker-uzh/graphql/dist/ops'
import { Dropdown } from '@uzh-bf/design-system'
import { useTranslations } from 'next-intl'
import { useRouter } from 'next/router'
import { Dispatch } from 'react'
import { TextSizeType } from './textSizes'

const FONT_SIZES = [
  { value: 'sm', label: 'manage.evaluation.fontSizeSm' },
  { value: 'md', label: 'manage.evaluation.fontSizeMd' },
  { value: 'lg', label: 'manage.evaluation.fontSizeLg' },
  { value: 'xl', label: 'manage.evaluation.fontSizeXl' },
] as const

interface EvaluationFooterMenuProps {
  textSize: TextSizeType
  setTextSize: Dispatch<{ type: string }>
  onDownloadCorrelatedResponses?: () => void
  correlatedExportLoading?: boolean
}

// presentation settings that are not tied to the currently shown question live
// in one overflow, so the footer itself only carries contextual controls. the
// dropdown flips above the trigger on its own when the viewport requires it.
function EvaluationFooterMenu({
  textSize,
  setTextSize,
  onDownloadCorrelatedResponses,
  correlatedExportLoading = false,
}: EvaluationFooterMenuProps) {
  const t = useTranslations()
  const router = useRouter()

  // the dropdown accepts either plain items or radio groups, never both, so the
  // download action is modelled as a single-item group next to the real
  // one-of-N choices
  const radioGroups = [
    ...(onDownloadCorrelatedResponses
      ? [
          {
            items: [
              {
                id: 'download-correlated-responses',
                type: 'standard' as const,
                label: t('manage.evaluation.downloadCorrelatedResponses'),
                tooltip: t('manage.evaluation.responseExportPrivacyWarning'),
                disabled: correlatedExportLoading,
                onClick: () => onDownloadCorrelatedResponses(),
                data: { cy: 'download-correlated-live-quiz-responses' },
              },
            ],
          },
        ]
      : []),
    ...(!router.query.hmac
      ? [
          {
            value: router.locale,
            items: [
              {
                id: 'language-label',
                type: 'label' as const,
                label: t('shared.generic.language'),
              },
              ...Object.values(LocaleType).map((language) => ({
                id: `language-${language}`,
                type: 'radio' as const,
                value: language,
                label: t(`shared.generic.${language}`),
                onClick: () => {
                  router.push(
                    { pathname: router.pathname, query: router.query },
                    undefined,
                    { locale: language }
                  )
                },
                data: { cy: `evaluation-language-${language}` },
              })),
            ],
          },
        ]
      : []),
    {
      value: textSize.size,
      items: [
        {
          id: 'font-size-label',
          type: 'label' as const,
          label: t('manage.evaluation.fontSize'),
        },
        ...FONT_SIZES.map((size) => ({
          id: `font-size-${size.value}`,
          type: 'radio' as const,
          value: size.value,
          label: t(size.label),
          onClick: () => setTextSize({ type: size.value }),
          data: { cy: `set-font-size-${size.value}` },
        })),
      ],
    },
  ]

  return (
    <Dropdown
      radioGroups={radioGroups}
      align="end"
      trigger={
        // the trigger carries no text, so the icon supplies the accessible name
        <FontAwesomeIcon
          icon={faEllipsisVertical}
          title={t('manage.evaluation.moreOptions')}
        />
      }
      data={{ cy: 'evaluation-footer-menu' }}
      className={{
        viewport: 'z-20',
        item: 'py-0.5 text-sm',
        trigger: 'h-8 w-8 border-slate-400 bg-transparent text-sm',
      }}
    />
  )
}

export default EvaluationFooterMenu
