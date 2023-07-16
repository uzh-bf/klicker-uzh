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
    <div className="flex flex-row justify-between items-center mb-1">
      <div />
      <H2 className={{ root: 'flex-1' }}>
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
