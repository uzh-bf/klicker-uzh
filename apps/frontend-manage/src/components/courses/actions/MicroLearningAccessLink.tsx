import { faLink } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { MicroLearning } from '@klicker-uzh/graphql/dist/ops'
import { Button, Toast } from '@uzh-bf/design-system'
import { useTranslations } from 'next-intl'
import { useState } from 'react'
import { twMerge } from 'tailwind-merge'

interface MicroLearningAccessLinkProps {
  microLearning: Partial<MicroLearning> & Pick<MicroLearning, 'name'>
  href: string
}

function MicroLearningAccessLink({
  microLearning,
  href,
}: MicroLearningAccessLinkProps) {
  const t = useTranslations()
  const [copyToast, setCopyToast] = useState(false)

  return (
    <>
      <Button
        basic
        onClick={() => {
          try {
            navigator.clipboard.writeText(href)
            setCopyToast(true)
          } catch (e) {}
        }}
        className={{
          root: twMerge('flex flex-row items-center gap-1 text-primary-100'),
        }}
        data={{ cy: `copy-microlearning-link-${microLearning.name}` }}
      >
        <FontAwesomeIcon icon={faLink} size="sm" className="w-4" />
        <div>{t('manage.course.copyAccessLink')}</div>
      </Button>
      <Toast
        openExternal={copyToast}
        setOpenExternal={setCopyToast}
        type="success"
        className={{ root: 'w-[24rem]' }}
      >
        {t('manage.course.linkMicrolearningCopied')}
      </Toast>
    </>
  )
}

export default MicroLearningAccessLink
