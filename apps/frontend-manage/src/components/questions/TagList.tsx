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
import { Button, UserNotification } from '@uzh-bf/design-system'
import React from 'react'
import { QUESTION_TYPES } from 'shared-components/src/constants'
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
            <li
              className={twMerge(
                '!px-4 !py-1 hover:text-uzh-blue-100 hover:cursor-pointer',
                activeType === QUESTION_TYPES.SC && 'text-red-500'
              )}
              key="SC"
              onClick={(): void => handleTagClick(QUESTION_TYPES.SC, true)}
            >
              <FontAwesomeIcon
                icon={
                  activeType === QUESTION_TYPES.SC ? faListSolid : faListRegular
                }
                className="mr-2"
              />
              Single Choice (SC)
            </li>
            <li
              className={twMerge(
                '!px-4 !py-1 hover:text-uzh-blue-100 hover:cursor-pointer',
                activeType === QUESTION_TYPES.MC && 'text-red-500'
              )}
              key="MC"
              onClick={(): void => handleTagClick(QUESTION_TYPES.MC, true)}
            >
              <FontAwesomeIcon
                icon={
                  activeType === QUESTION_TYPES.MC ? faListSolid : faListRegular
                }
                className="mr-2"
              />
              Multiple Choice (MC)
            </li>
            <li
              className={twMerge(
                '!px-4 !py-1 hover:text-uzh-blue-100 hover:cursor-pointer',
                activeType === QUESTION_TYPES.FREE_TEXT && 'text-red-500'
              )}
              key="FREE_TEXT"
              onClick={(): void =>
                handleTagClick(QUESTION_TYPES.FREE_TEXT, true)
              }
            >
              <FontAwesomeIcon
                icon={
                  activeType === QUESTION_TYPES.FREE_TEXT
                    ? faListSolid
                    : faListRegular
                }
                className="mr-2"
              />
              Free Text (FT)
            </li>
            <li
              className={twMerge(
                '!px-4 !py-1 hover:text-uzh-blue-100 hover:cursor-pointer',
                activeType === QUESTION_TYPES.NUMERICAL && 'text-red-500'
              )}
              key="NUMERICAL"
              onClick={(): void =>
                handleTagClick(QUESTION_TYPES.NUMERICAL, true)
              }
            >
              <FontAwesomeIcon
                icon={
                  activeType === QUESTION_TYPES.NUMERICAL
                    ? faListSolid
                    : faListRegular
                }
                className="mr-2"
              />
              Numerical (NR)
            </li>
            <li
              className={twMerge(
                '!px-4 !py-1 hover:text-uzh-blue-100 hover:cursor-pointer',
                activeType === QUESTION_TYPES.KPRIM && 'text-red-500'
              )}
              key="NUMERICAL"
              onClick={(): void => handleTagClick(QUESTION_TYPES.KPRIM, true)}
            >
              <FontAwesomeIcon
                icon={
                  activeType === QUESTION_TYPES.KPRIM
                    ? faListSolid
                    : faListRegular
                }
                className="mr-2"
              />
              KPRIM (KP)
            </li>
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
                        '!px-4 !py-1 hover:text-uzh-blue-100 hover:cursor-pointer',
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
