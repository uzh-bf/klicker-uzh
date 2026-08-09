import { faLink } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { toast } from '@uzh-bf/design-system'

function getLTIAccessLink({
  t,
  name,
  href,
  label,
}: {
  t: any
  name: string
  href: string
  label?: string
}) {
  return {
    id: `copy-lti-link-${name}`,
    label: (
      <div className="text-primary-100 flex cursor-pointer flex-row items-center gap-1">
        <FontAwesomeIcon icon={faLink} size="sm" className="w-4" />
        <div>
          {t('manage.course.copyLTIAccessLink')}
          {typeof label === 'string' && ` (${label})`}
        </div>
      </div>
    ),
    onClick: async () => {
      try {
        const link = `${process.env.NEXT_PUBLIC_LTI_URL}?redirectTo=${href}`
        await navigator.clipboard.writeText(link)
        toast({
          type: 'success',
          message: t('manage.course.linkLTICopied'),
        })
      } catch (e) {
        console.error(e)
        toast({
          type: 'error',
          message: t('manage.course.linkLTIError'),
        })
      }
    },
    data: {
      cy: `copy-lti-link-${name}`,
    },
  }
}

export default getLTIAccessLink
