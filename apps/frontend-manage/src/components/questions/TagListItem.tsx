import { faPencil, faTag, faTrash } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { Button, ThemeContext } from '@uzh-bf/design-system'
import { useContext, useState } from 'react'
import { twMerge } from 'tailwind-merge'
import TagEditForm from './TagEditForm'

interface TagListItemProps {
  tag: { name: string; id: string }
  handleTagClick: (tag: string) => void
  active: boolean
}

function TagListItem({ tag, handleTagClick, active }: TagListItemProps) {
  const theme = useContext(ThemeContext)
  const [editMode, setEditMode] = useState(false)

  return (
    <>
      <li
        className={twMerge(
          'px-4 py-1 hover:cursor-pointer flex flex-row justify-between group',
          active && theme.primaryText
        )}
      >
        {editMode ? (
          <TagEditForm tag={tag} onConfirm={() => setEditMode(false)} />
        ) : (
          <>
            <Button
              basic
              onClick={(): void => handleTagClick(tag.name)}
              className={{ root: twMerge(theme.primaryTextHover, 'flex-1') }}
            >
              <FontAwesomeIcon icon={faTag} />
              {tag.name}
            </Button>
            <div className="flex-row hidden text-black group-hover:flex">
              <Button
                basic
                onClick={() => setEditMode(true)}
                className={{ root: theme.primaryTextHover }}
              >
                <FontAwesomeIcon icon={faPencil} className="mr-2" />
              </Button>
              <Button
                basic
                // TODO
                onClick={() => null}
                className={{ root: 'hover:text-red-600' }}
              >
                <FontAwesomeIcon icon={faTrash} className="mr-2" />
              </Button>
            </div>
          </>
        )}
      </li>
    </>
  )
}

export default TagListItem
