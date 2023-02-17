import {
  faArrowLeftLong,
  faHouse,
  faPersonChalkboard,
} from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { useRouter } from 'next/router'
import { useState } from 'react'
import EmbeddingModal from '../../components/sessions/EmbeddingModal'
import MenuButton from './MenuButton'

interface MobileMenuBarProps {
  sessionId?: string
}

function MobileMenuBar({ sessionId }: MobileMenuBarProps) {
  const router = useRouter()
  const [embedModalOpen, setEmbedModalOpen] = useState<boolean>(false)

  return (
    <div className="fixed bottom-0 w-full h-12 bg-slate-800">
      <div className="flex flex-row justify-between h-full">
        <MenuButton
          icon={<FontAwesomeIcon icon={faArrowLeftLong} />}
          onClick={() => router.back()}
        >
          Zurück
        </MenuButton>
        <MenuButton
          icon={<FontAwesomeIcon icon={faHouse} />}
          onClick={() => router.push('/')}
        >
          Home
        </MenuButton>
        <MenuButton
          icon={<FontAwesomeIcon icon={faPersonChalkboard} />}
          onClick={() => setEmbedModalOpen(true)}
          disabled={!sessionId}
        >
          PPT
        </MenuButton>
      </div>

      {sessionId && (
        <EmbeddingModal
          open={embedModalOpen}
          setOpen={setEmbedModalOpen}
          sessionId={sessionId}
        />
      )}
    </div>
  )
}

export default MobileMenuBar
