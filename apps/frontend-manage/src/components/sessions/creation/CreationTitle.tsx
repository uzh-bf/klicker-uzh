import { faX } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { Button, H2 } from '@uzh-bf/design-system'

interface CreationTitleProps {
  text: string
  editMode: boolean
  closeWizard: () => void
}

function CreationTitle({ text, editMode, closeWizard }: CreationTitleProps) {
  return (
    <div className="grid w-full grid-cols-3 mb-1 -mt-1">
      <div />
      <H2 className={{ root: 'w-full text-center' }}>
        {text} {editMode ? 'bearbeiten' : 'erstellen'}
      </H2>
      <Button
        className={{ root: 'ml-auto -mt-1 border-red-400' }}
        onClick={closeWizard}
      >
        <FontAwesomeIcon icon={faX} />
        <div>{editMode ? 'Editieren' : 'Erstellen'} abbrechen</div>
      </Button>
    </div>
  )
}

export default CreationTitle
