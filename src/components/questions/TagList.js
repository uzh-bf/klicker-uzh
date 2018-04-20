import React from 'react'
import PropTypes from 'prop-types'
import { Button, Icon, List, Loader, Message } from 'semantic-ui-react'
import { FormattedMessage } from 'react-intl'
import { Query } from 'react-apollo'

import { QUESTION_TYPES } from '../../lib'
import { TagListQuery } from '../../graphql'

const propTypes = {
  activeTags: PropTypes.array.isRequired,
  activeType: PropTypes.string.isRequired,
  handleReset: PropTypes.func.isRequired,
  handleTagClick: PropTypes.func.isRequired,
  handleToggleArchive: PropTypes.func.isRequired,
  isArchiveActive: PropTypes.bool,
}

const defaultProps = {
  isArchiveActive: false,
}

export const TagListPres = ({
  activeTags,
  isArchiveActive,
  activeType,
  handleTagClick,
  handleReset,
  handleToggleArchive,
}) => (
  <div className="tagList">
    <Button basic fluid onClick={() => handleReset()}>
      <Icon name="remove circle" />
      <FormattedMessage defaultMessage="Reset filters" id="tagList.button.reset" />
    </Button>
    <List selection size="large">
      <List.Header className="listHeader archive">
        <FormattedMessage defaultMessage="Archive" id="tagList.header.archive" />
      </List.Header>
      <List.Item
        active={isArchiveActive}
        className="listItem archiveItem"
        onClick={() => handleToggleArchive()}
      >
        <List.Icon name="archive" />
        <List.Content>
          <FormattedMessage defaultMessage="Show archived" id="tagList.string.archive" />
        </List.Content>
      </List.Item>
      <List.Header className="listHeader types">
        <FormattedMessage defaultMessage="Types" id="tagList.header.types" />
      </List.Header>
      <List.Item
        active={activeType === QUESTION_TYPES.SC}
        className="listItem"
        key="SC"
        onClick={() => handleTagClick('SC', true)}
      >
        <List.Icon name={activeType === QUESTION_TYPES.SC ? 'folder' : 'folder outline'} />
        <List.Content>
          <FormattedMessage defaultMessage="SC" id="common.SC.label" />
        </List.Content>
      </List.Item>
      <List.Item
        active={activeType === QUESTION_TYPES.MC}
        className="listItem"
        key="MC"
        onClick={() => handleTagClick('MC', true)}
      >
        <List.Icon name={activeType === QUESTION_TYPES.MC ? 'folder' : 'folder outline'} />
        <List.Content>
          <FormattedMessage defaultMessage="MC" id="common.MC.label" />
        </List.Content>
      </List.Item>
      <List.Item
        active={activeType === QUESTION_TYPES.FREE}
        className="listItem"
        key="FREE"
        onClick={() => handleTagClick('FREE', true)}
      >
        <List.Icon name={activeType === QUESTION_TYPES.FREE ? 'folder' : 'folder outline'} />
        <List.Content>
          <FormattedMessage defaultMessage="FREE" id="common.FREE.label" />
        </List.Content>
      </List.Item>
      <List.Item
        active={activeType === QUESTION_TYPES.FREE_RANGE}
        className="listItem"
        key="FREE_RANGE"
        onClick={() => handleTagClick('FREE_RANGE', true)}
      >
        <List.Icon name={activeType === QUESTION_TYPES.FREE_RANGE ? 'folder' : 'folder outline'} />
        <List.Content>
          <FormattedMessage defaultMessage="FREE_RANGE" id="common.FREE_RANGE.label" />
        </List.Content>
      </List.Item>
      <List.Header className="listHeader tags">
        <FormattedMessage defaultMessage="Tags" id="tagList.header.tags" />
      </List.Header>

      <Query query={TagListQuery}>
        {({ data: { tags }, error, loading }) => {
          if (loading) {
            return <Loader active />
          }

          if (error) {
            return <Message error>{error.message}</Message>
          }

          if (tags.length === 0) {
            return (
              <FormattedMessage defaultMessage="No tags available." id="tagList.string.noTags" />
            )
          }

          return tags.map(({ id, name }) => (
            <List.Item
              active={activeTags.includes(name)}
              className="listItem"
              key={id}
              onClick={() => handleTagClick(name)}
            >
              <List.Icon name="tag" />
              <List.Content>{name}</List.Content>
            </List.Item>
          ))
        }}
      </Query>
    </List>

    <style jsx>{`
      @import 'src/theme';

      .tagList {
        font-size: 0.9rem;
        min-width: 12rem;

        :global(.listHeader) {
          color: grey;
          font-size: 1rem;
          font-weight: bold;
          padding: 0 1rem;
        }
        :global(.listHeader.tags),
        :global(.listHeader.types) {
          margin-top: 1rem;
        }
        :global(.listItem.item) {
          border-radius: 0;
          padding: 0.3rem 1rem;

          &:hover :global(.content),
          &:hover :global(i) {
            color: #2185d0;
          }
        }
      }
    `}</style>
  </div>
)

TagListPres.propTypes = propTypes
TagListPres.defaultProps = defaultProps

export default TagListPres
