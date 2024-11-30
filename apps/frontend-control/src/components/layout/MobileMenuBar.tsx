import {
  faArrowLeftLong,
  faHouse,
  faPersonChalkboard,
} from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { useTranslations } from 'next-intl'
import { useRouter } from 'next/router'
import { useState } from 'react'
import EmbeddingModal from '../liveQuizzes/EmbeddingModal'
import MenuButton from './MenuButton'

interface MobileMenuBarProps {
  quizId?: string
}

function MobileMenuBar({ quizId }: MobileMenuBarProps) {
  const t = useTranslations()
  const router = useRouter()
  const [embedModalOpen, setEmbedModalOpen] = useState<boolean>(false)

  return (
    <div className="fixed bottom-0 h-12 w-full bg-slate-800">
      <div className="flex h-full flex-row justify-between">
        <MenuButton
          icon={<FontAwesomeIcon icon={faArrowLeftLong} />}
          onClick={() => router.back()}
          data={{ cy: 'back-button' }}
        >
          {t('shared.generic.back')}
        </MenuButton>
        <MenuButton
          icon={<FontAwesomeIcon icon={faHouse} />}
          onClick={() => router.push('/')}
          data={{ cy: 'home-button' }}
        >
          {t('shared.generic.home')}
        </MenuButton>
        <MenuButton
          icon={<FontAwesomeIcon icon={faPersonChalkboard} />}
          onClick={() => setEmbedModalOpen(true)}
          disabled={!quizId}
          data={{ cy: 'ppt-button' }}
        >
          PPT
        </MenuButton>
      </div>

      {quizId && (
        <EmbeddingModal
          open={embedModalOpen}
          setOpen={setEmbedModalOpen}
          quizId={quizId}
        />
      )}
    </div>
  )
}

export default MobileMenuBar
