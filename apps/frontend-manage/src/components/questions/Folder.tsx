import { faFolder } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { Button } from '@uzh-bf/design-system'

interface FolderProps {
  name: string
}

function Folder({ name }: FolderProps): React.ReactElement {
  return (
    <Button
      className={{
        root: 'w-full flex flex-col items-center group',
      }}
      basic
    >
      <Button.Icon className={{ root: 'w-32 -mb-2' }}>
        <FontAwesomeIcon
          icon={faFolder}
          className="w-full h-full text-gray-400 group-hover:text-gray-600"
        />
      </Button.Icon>
      <Button.Label>{name}</Button.Label>
    </Button>
  )
}

export default Folder
