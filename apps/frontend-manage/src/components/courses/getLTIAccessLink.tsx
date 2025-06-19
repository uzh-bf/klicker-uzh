import { faLink } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { useTranslations } from 'next-intl'

function getLTIAccessLink({
  t,
  name,
  href,
  onSuccess,
  label,
}: {
  t: ReturnType<typeof useTranslations>
  name: string
  href: string
  onSuccess: () => void
  label?: string
}) {
  return {
    label: (
      <div className="text-primary-100 flex cursor-pointer flex-row items-center gap-1">
        <FontAwesomeIcon icon={faLink} size="sm" className="w-4" />
        <div>
          {/* @ts-expect-error next-intl dictionary is not correctly typed */}
          {t('manage.course.copyLTIAccessLink')}
          {typeof label == 'string' && ` (${label})`}
        </div>
      </div>
    ),
    onClick: async () => {
      try {
        const link = `${process.env.NEXT_PUBLIC_LTI_URL}?redirectTo=${href}`
        await navigator.clipboard.writeText(link)
        onSuccess()
      } catch (e) {}
    },
    data: {
      cy: `copy-lti-link-${name}`,
    },
  }
}

export default getLTIAccessLink
