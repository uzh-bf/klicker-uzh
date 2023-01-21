import { useMutation } from '@apollo/client'
import { faPencil, faTag, faTrash } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import {
  DeleteTagDocument,
  GetUserQuestionsDocument,
  GetUserTagsDocument,
  Tag,
} from '@klicker-uzh/graphql/dist/ops'
import { Button, H2, H3, Modal, ThemeContext } from '@uzh-bf/design-system'
import { useContext, useState } from 'react'
import { twMerge } from 'tailwind-merge'
import TagEditForm from './TagEditForm'

interface TagListItemProps {
  tag: Tag
  handleTagClick: (tag: string) => void
  active: boolean
}

function TagListItem({ tag, handleTagClick, active }: TagListItemProps) {
  const theme = useContext(ThemeContext)
  const [editMode, setEditMode] = useState(false)
  const [isDeletionModalOpen, setIsDeletionModalOpen] = useState(false)

  const [deleteTag] = useMutation(DeleteTagDocument)

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
                disabled={active}
                onClick={() => setEditMode(true)}
                className={{
                  root: twMerge(
                    theme.primaryTextHover,
                    'disabled:text-uzh-grey-60'
                  ),
                }}
              >
                <FontAwesomeIcon icon={faPencil} className="mr-2" />
              </Button>
              <Button
                basic
                disabled={active}
                onClick={() => setIsDeletionModalOpen(true)}
                className={{
                  root: 'hover:text-red-600 disabled:text-uzh-grey-60 disabled:hover:text-none',
                }}
              >
                <FontAwesomeIcon icon={faTrash} className="mr-2" />
              </Button>
            </div>

            <Modal
              onPrimaryAction={
                <Button
                  onClick={async () => {
                    await deleteTag({
                      variables: {
                        id: tag.id,
                      },
                      refetchQueries: [
                        {
                          query: GetUserTagsDocument,
                        },
                        {
                          query: GetUserQuestionsDocument,
                        },
                      ],
                    })
                    setIsDeletionModalOpen(false)
                  }}
                  className={{ root: 'bg-red-600 font-bold text-white' }}
                >
                  Löschen
                </Button>
              }
              onSecondaryAction={
                <Button onClick={(): void => setIsDeletionModalOpen(false)}>
                  Abbrechen
                </Button>
              }
              onClose={(): void => setIsDeletionModalOpen(false)}
              open={isDeletionModalOpen}
              hideCloseButton={true}
              className={{ content: 'w-[40rem] h-max self-center pt-0' }}
            >
              <div>
                <H2>Tag löschen</H2>
                <div>
                  Sind Sie sich sicher, dass Sie den folgenden Tag löschen
                  möchten?
                </div>
                <div className="p-2 mt-1 border border-solid rounded border-uzh-grey-40">
                  <H3>{tag.name}</H3>
                </div>
                <div className="mt-6 mb-2 text-sm italic">
                  Gelöschte Tags können nicht wieder hergestellt werden. Alle
                  Fragen mit diesem Tag bleiben bestehen, der Tag wird jedoch
                  entfernt.
                </div>
              </div>
            </Modal>
          </>
        )}
      </li>
    </>
  )
}

export default TagListItem
