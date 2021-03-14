import { useQuery } from '@apollo/client'
import React from 'react'
import { FormattedMessage } from 'react-intl'
import { Button, Icon, List, Loader, Message } from 'semantic-ui-react'
import { QUESTION_TYPES } from '../../constants'
import TagListQuery from '../../graphql/queries/TagListQuery.graphql'

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
    <div className="tagList">
      <Button basic fluid className="resetFilters" onClick={(): void => handleReset()}>
        <Icon name="remove circle" />
        <FormattedMessage defaultMessage="Reset filters" id="tagList.button.reset" />
      </Button>

      <List selection>
        <List.Item
          active={isArchiveActive}
          className="listItem archiveItem"
          onClick={(): void => handleToggleArchive(true)}
        >
          <List.Icon name="archive" />
          <List.Content>
            <FormattedMessage defaultMessage="Show Archive" id="tagList.string.showArchive" />
          </List.Content>
        </List.Item>
        <List.Item
          active={!isArchiveActive}
          className="listItem archiveItem"
          onClick={(): void => handleToggleArchive(false)}
        >
          <List.Icon name="list" />
          <List.Content>
            <FormattedMessage defaultMessage="Show Pool" id="tagList.string.showPool" />
          </List.Content>
        </List.Item>

        <List.Header className="listHeader types">
          <FormattedMessage defaultMessage="Types" id="tagList.header.types" />
        </List.Header>
        <List.Item
          active={activeType === QUESTION_TYPES.SC}
          className="listItem"
          key="SC"
          onClick={(): void => handleTagClick('SC', true)}
        >
          <List.Icon name={activeType === QUESTION_TYPES.SC ? 'folder' : 'folder outline'} />
          <List.Content>
            <FormattedMessage defaultMessage="Single Choice (SC)" id="common.SC.label" />
          </List.Content>
        </List.Item>
        <List.Item
          active={activeType === QUESTION_TYPES.MC}
          className="listItem"
          key="MC"
          onClick={(): void => handleTagClick('MC', true)}
        >
          <List.Icon name={activeType === QUESTION_TYPES.MC ? 'folder' : 'folder outline'} />
          <List.Content>
            <FormattedMessage defaultMessage="Multiple Choice (MC)" id="common.MC.label" />
          </List.Content>
        </List.Item>
        <List.Item
          active={activeType === QUESTION_TYPES.FREE}
          className="listItem"
          key="FREE"
          onClick={(): void => handleTagClick('FREE', true)}
        >
          <List.Icon name={activeType === QUESTION_TYPES.FREE ? 'folder' : 'folder outline'} />
          <List.Content>
            <FormattedMessage defaultMessage="Free Text (FT)" id="common.FREE.label" />
          </List.Content>
        </List.Item>
        <List.Item
          active={activeType === QUESTION_TYPES.FREE_RANGE}
          className="listItem"
          key="FREE_RANGE"
          onClick={(): void => handleTagClick('FREE_RANGE', true)}
        >
          <List.Icon name={activeType === QUESTION_TYPES.FREE_RANGE ? 'folder' : 'folder outline'} />
          <List.Content>
            <FormattedMessage defaultMessage="Numerical (NR)" id="common.FREE_RANGE.label" />
          </List.Content>
        </List.Item>

        <List.Header className="listHeader tags">
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
                className="listItem"
                key={id}
                onClick={(): void => handleTagClick(name)}
              >
                <List.Icon name="tag" />
                <List.Content>{name}</List.Content>
              </List.Item>
            )
          )
        })()}
      </List>

      <style jsx>{`
        @import 'src/theme';

        .tagList {
          font-size: 0.9rem;

          :global(.resetFilters) {
            padding: 0.5rem;
          }

          :global(.listHeader) {
            color: grey;
            font-weight: bold;
            padding: 0.3rem 1rem;
            font-size: 1.05rem;
            border-bottom: 1px solid lightgrey;
            margin-bottom: 0.3rem;
          }
          :global(.listHeader.tags),
          :global(.listHeader.types) {
            margin-top: 1rem;
          }
          :global(.listItem.item) {
            border-radius: 0;
            padding: 0.3rem 1rem;

            :global(i) {
              padding: 0;
            }

            &:hover :global(.content),
            &:hover :global(i) {
              color: #2185d0;
            }
          }
        }
      `}</style>
    </div>
  )
}

TagList.defaultProps = defaultProps

export default TagList
