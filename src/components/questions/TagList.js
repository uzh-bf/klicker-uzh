import React from 'react'
import PropTypes from 'prop-types'
import { List } from 'semantic-ui-react'
import { compose, withProps, branch, renderComponent } from 'recompose'
import { FormattedMessage } from 'react-intl'

import { LoadingDiv } from '../common'

const propTypes = {
  handleTagClick: PropTypes.func.isRequired,
  tags: PropTypes.arrayOf(
    PropTypes.shape({
      id: PropTypes.string.isRequired,
      name: PropTypes.string.isRequired,
    }),
  ),
  types: PropTypes.arrayOf(
    PropTypes.shape({
      id: PropTypes.string.isRequired,
      name: PropTypes.string.isRequired,
    }),
  ),
}

const defaultProps = {
  tags: [],
  types: [],
}

export const TagListPres = ({ tags, types, handleTagClick }) => (
  <div className="tagList">
    {tags.length === 0 ? (
      <FormattedMessage defaultMessage="No tags available." id="tagList.string.noTags" />
    ) : (
      []
    )}
    <List selection size="large">
      <List.Header className="listHeader types">
        <FormattedMessage defaultMessage="Types" id="tagList.header.types" />
      </List.Header>
      {types.map(({ isActive, name }) => (
        <List.Item
          active={isActive}
          className="listItem"
          key={name}
          onClick={() => handleTagClick(name, true)}
        >
          <List.Icon name={isActive ? 'folder' : 'folder outline'} />
          <List.Content>
            <FormattedMessage defaultMessage="type" id={`common.${name}.label`} />
          </List.Content>
        </List.Item>
      ))}
      <List.Header className="listHeader tags">
        <FormattedMessage defaultMessage="Tags" id="tagList.header.tags" />
      </List.Header>
      {tags.map(({ isActive, id, name }) => (
        <List.Item
          active={isActive}
          className="listItem"
          key={id}
          onClick={() => handleTagClick(name)}
        >
          <List.Icon name="tag" />
          <List.Content>{name}</List.Content>
        </List.Item>
      ))}
    </List>

    <style jsx>{`
      .tagList {
        font-size: 0.9rem;
        min-width: 10rem;

        :global(.listHeader) {
          color: grey;
          font-size: 1rem;
          font-weight: bold;
          padding: 0 1rem;
        }
        :global(.listHeader.tags) {
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

export default compose(
  branch(({ data }) => data.loading, renderComponent(LoadingDiv)),
  branch(({ data }) => data.error, renderComponent(({ data }) => <div>{data.error}</div>)),
  withProps(({ activeTags, activeType, data: { loading, tags } }) => ({
    loading,
    tags: tags && tags.map(tag => ({ ...tag, isActive: activeTags.includes(tag.name) })),
    types: ['SC', 'MC', 'FREE', 'FREE_RANGE'].map(type => ({
      isActive: type === activeType,
      name: type,
    })),
  })),
)(TagListPres)
