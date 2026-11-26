import { faChevronLeft } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { Button } from '@uzh-bf/design-system'
import { useRouter } from 'next/router'
import { useTranslations } from 'next-intl'
import { eyebrowClass, iconButtonClass } from '../common/styles'
import PageContainer from './PageContainer'

interface AppBarProps {
  title: string
  eyebrow?: React.ReactNode
  backHref: string
  actions?: React.ReactNode
}

function AppBar({ title, eyebrow, backHref, actions }: AppBarProps) {
  const t = useTranslations()
  const router = useRouter()

  return (
    <div className="border-ctrl-hair bg-ctrl-bg sticky top-0 z-20 border-b pt-[env(safe-area-inset-top)]">
      <PageContainer className="flex items-center gap-3 py-2.5">
        <Button
          onClick={() => router.push(backHref)}
          className={{ root: iconButtonClass }}
          aria-label={t('shared.generic.back')}
          data={{ cy: 'app-bar-back' }}
        >
          <FontAwesomeIcon icon={faChevronLeft} className="h-4 w-4" />
        </Button>
        <div className="min-w-0 flex-1">
          {eyebrow && <div className={eyebrowClass}>{eyebrow}</div>}
          <h1 className="text-ctrl-ink truncate text-xl font-bold">{title}</h1>
        </div>
        {actions}
      </PageContainer>
    </div>
  )
}

export default AppBar
