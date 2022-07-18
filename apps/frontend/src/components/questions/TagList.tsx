import React from 'react'
import { List, Loader, Message } from 'semantic-ui-react'
import { FormattedMessage } from 'react-intl'
import { useQuery } from '@apollo/client'
import clsx from 'clsx'
import { XCircleIcon, ArchiveIcon } from '@heroicons/react/outline'

import { QUESTION_TYPES } from '../../constants'
import TagListQuery from '../../graphql/queries/TagListQuery.graphql'
import CustomButton from '../common/CustomButton'

interface Props {
  activeTags: any[]
  activeType: string
  handleReset: any
  handleTagClick: any
  handleToggleArchive: any
  isArchiveActive?: boolean
}

const defaultProps = {
  isArchiveActive: false,
}

function TagList({
  activeTags,
  isArchiveActive,
  activeType,
  handleTagClick,
  handleReset,
  handleToggleArchive,
}: Props): React.ReactElement {
  const { data, loading, error } = useQuery(TagListQuery)

  return (
    <div className="h-full pb-2">
      <div className="p-4 md:min-w-[17rem] border border-black border-solid md:max-h-full rounded-md h-max text-[0.9rem] overflow-y-scroll">
        <CustomButton
          className="w-full text-base bg-white hover:bg-grey-40 !py-[0.2rem] mb-1.5 flex flex-row justify-center"
          onClick={(): void => handleReset()}
        >
          <XCircleIcon className="h-5 mr-2" />
          <FormattedMessage defaultMessage="Reset filters" id="tagList.button.reset" />
        </CustomButton>

        <CustomButton
          className={clsx(
            isArchiveActive && 'text-red-600',
            'w-full text-base bg-white hover:bg-grey-40 hover:text-red-600 !py-[0.2rem] mb-2 flex flex-row justify-center'
          )}
          onClick={(): void => handleToggleArchive(true)}
        >
          <ArchiveIcon className="h-5 mr-2" />
          <FormattedMessage defaultMessage="Show Archive" id="tagList.string.showArchive" />
        </CustomButton>

        <List selection>
          <List.Header className="px-4 py-1 font-bold mb-1 border border-b border-x-0 border-solid border-t-0 border-gray-300 text-[1.05rem] text-neutral-500 mt-4">
            <FormattedMessage defaultMessage="Types" id="tagList.header.types" />
          </List.Header>
          <List.Item
            active={activeType === QUESTION_TYPES.SC}
            className="!px-4 !py-1"
            key="SC"
            onClick={(): void => handleTagClick('SC', true)}
          >
            <List.Content className="hover:!text-blue-500">
              <List.Icon
                className="!mr-3"
                color="grey"
                name={activeType === QUESTION_TYPES.SC ? 'folder' : 'folder outline'}
              />
              <FormattedMessage defaultMessage="Single Choice (SC)" id="common.SC.label" />
            </List.Content>
          </List.Item>
          <List.Item
            active={activeType === QUESTION_TYPES.MC}
            className="!px-4 !py-1"
            key="MC"
            onClick={(): void => handleTagClick('MC', true)}
          >
            <List.Content className="hover:!text-blue-500">
              <List.Icon
                className="!mr-3"
                color="grey"
                name={activeType === QUESTION_TYPES.MC ? 'folder' : 'folder outline'}
              />
              <FormattedMessage defaultMessage="Multiple Choice (MC)" id="common.MC.label" />
            </List.Content>
          </List.Item>
          <List.Item
            active={activeType === QUESTION_TYPES.FREE}
            className="!px-4 !py-1"
            key="FREE"
            onClick={(): void => handleTagClick('FREE', true)}
          >
            <List.Content className="hover:!text-blue-500">
              <List.Icon
                className="!mr-3"
                color="grey"
                name={activeType === QUESTION_TYPES.FREE ? 'folder' : 'folder outline'}
              />
              <FormattedMessage defaultMessage="Free Text (FT)" id="common.FREE.label" />
            </List.Content>
          </List.Item>
          <List.Item
            active={activeType === QUESTION_TYPES.FREE_RANGE}
            className="!px-4 !py-1"
            key="FREE_RANGE"
            onClick={(): void => handleTagClick('FREE_RANGE', true)}
          >
            <List.Content className="hover:!text-blue-500">
              <List.Icon
                className="!mr-3"
                color="grey"
                name={activeType === QUESTION_TYPES.FREE_RANGE ? 'folder' : 'folder outline'}
              />
              <FormattedMessage defaultMessage="Numerical (NR)" id="common.FREE_RANGE.label" />
            </List.Content>
          </List.Item>

          <List.Header className="px-4 py-1 font-bold mb-1 border border-b border-x-0 border-solid border-t-0 border-gray-300 text-[1.05rem] text-neutral-500 mt-4">
            <FormattedMessage defaultMessage="Tags" id="tagList.header.tags" />
          </List.Header>

          {((): React.ReactElement => {
            if (loading) {
              return <Loader active />
            }

            if (error) {
              return <Message error>{error.message}</Message>
            }

            const { tags } = data

            if (tags.length === 0) {
              return <FormattedMessage defaultMessage="No tags available." id="tagList.string.noTags" />
            }

            return tags.map(
              ({ id, name }): React.ReactElement => (
                <List.Item
                  active={activeTags.includes(name)}
                  className="!px-4 !py-1"
                  key={id}
                  onClick={(): void => handleTagClick(name)}
                >
                  <List.Content className="hover:!text-blue-500">
                    <List.Icon className="!mr-3" color="grey" name="tag" /> {name}
                  </List.Content>
                </List.Item>
              )
            )
          })()}
        </List>
      </div>
    </div>
  )
}

TagList.defaultProps = defaultProps

export default TagList
