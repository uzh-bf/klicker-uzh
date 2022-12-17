import { useQuery } from '@apollo/client'
import {
  faCircleXmark,
  faRectangleList as faListRegular,
} from '@fortawesome/free-regular-svg-icons'
import {
  faRectangleList as faListSolid,
  faTag,
} from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { GetUserTagsDocument } from '@klicker-uzh/graphql/dist/ops'
import { Button, ThemeContext, UserNotification } from '@uzh-bf/design-system'
import React, { useContext } from 'react'
import { QUESTION_TYPES, TYPES_LABELS } from 'shared-components/src/constants'
import { twMerge } from 'tailwind-merge'

interface Props {
  activeTags: string[]
  activeType: string
  handleReset: () => void
  handleTagClick: (questionType: string, selected?: boolean) => void
}

// TODO: re-add archive toggle
function TagList({
  activeTags,
  activeType,
  handleTagClick,
  handleReset,
}: Props): React.ReactElement {
  const theme = useContext(ThemeContext)
  const {
    data: tagsData,
    loading: tagsLoading,
    error: tagsError,
  } = useQuery(GetUserTagsDocument)

  const tags = tagsData?.userTags?.map((tag) => tag.name)

  return (
    <div className="h-full pb-2">
      <div className="p-4 md:min-w-[17rem] border border-uzh-grey-60 border-solid md:max-h-full rounded-md h-max text-[0.9rem] overflow-y-auto">
        <Button
          className={{
            root: 'w-full text-base bg-white hover:bg-grey-40 !py-[0.2rem] mb-1.5 flex flex-row items-center justify-center',
          }}
          onClick={(): void => handleReset()}
        >
          <Button.Icon className={{ root: 'mr-1' }}>
            <FontAwesomeIcon icon={faCircleXmark} />
          </Button.Icon>
          <Button.Label>Filter zurücksetzen</Button.Label>
        </Button>

        {/* <Button
          className={twMerge(
            isArchiveActive && 'text-red-600',
            'w-full text-base bg-white hover:bg-grey-40 hover:text-red-600 !py-[0.2rem] mb-2 flex flex-row justify-center'
          )}
          onClick={(): void => handleToggleArchive(true)}
        >
          <Button.Icon>
            <FontAwesomeIcon icon={faBoxArchive} />
          </Button.Icon>
          <Button.Label>Archiv Anzeigen</Button.Label>
        </Button> */}

        <div>
          <div className="px-4 py-1 font-bold mb-1 border border-b border-x-0 border-solid border-t-0 border-gray-300 text-[1.05rem] text-neutral-500 mt-4">
            Fragetypen
          </div>
          <ul className="p-0 m-0 list-none">
            {Object.values(QUESTION_TYPES).map((type) => (
              <li
                key={type}
                className={twMerge(
                  'px-4 py-1 hover:cursor-pointer',
                  theme.primaryTextHover,
                  activeType === type && 'text-red-500'
                )}
                onClick={(): void => handleTagClick(type, true)}
              >
                <FontAwesomeIcon
                  icon={activeType === type ? faListSolid : faListRegular}
                  className="mr-2"
                />
                {TYPES_LABELS[type]}
              </li>
            ))}
          </ul>

          <div className="px-4 py-1 font-bold mb-1 border border-b border-x-0 border-solid border-t-0 border-gray-300 text-[1.05rem] text-neutral-500 mt-4">
            Tags
          </div>

          {((): React.ReactElement => {
            if (tagsLoading) {
              return <div>Loading...</div>
            }

            if (tagsError) {
              return (
                <UserNotification
                  notificationType="error"
                  message={tagsError.message}
                />
              )
            }

            if (tags?.length === 0) {
              return <div>Keine Tags verfügbar</div>
            }

            return (
              <ul className="p-0 m-0 list-none">
                {tags?.map(
                  (tag: string, index: number): React.ReactElement => (
                    <li
                      className={twMerge(
                        'px-4 py-1 hover:cursor-pointer',
                        theme.primaryTextHover,
                        activeTags.includes(tag) && 'text-red-500'
                      )}
                      key={index}
                      onClick={(): void => handleTagClick(tag)}
                    >
                      <FontAwesomeIcon icon={faTag} className="mr-2" />
                      {tag}
                    </li>
                  )
                )}
              </ul>
            )
          })()}
        </div>
      </div>
    </div>
  )
}

export default TagList
