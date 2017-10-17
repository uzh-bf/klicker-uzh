import React from 'react'
import PropTypes from 'prop-types'
import { graphql } from 'react-apollo'
import { List } from 'semantic-ui-react'
import { compose, withProps, branch, renderComponent } from 'recompose'

import { LoadingDiv } from '../common'
import { TagListQuery } from '../../graphql/queries'

const propTypes = {
  error: PropTypes.string,
  handleTagClick: PropTypes.func.isRequired,
  tags: PropTypes.arrayOf(
    PropTypes.shape({
      id: PropTypes.string.isRequired,
      name: PropTypes.string.isRequired,
    }),
  ),
}

const defaultProps = {
  error: undefined,
  tags: [],
}

export const TagListPres = ({ error, tags, handleTagClick }) => {
  if (error) {
    return <div>{error}</div>
  }

  return (
    <div className="tagList">
      <List selection size="large" className="list">
        {tags.map(({ isActive, id, name }) => (
          <List.Item
            key={id}
            active={isActive}
            className="listItem"
            onClick={() => handleTagClick(name)}
          >
            <List.Icon name={isActive ? 'folder' : 'folder outline'} />
            <List.Content>{name}</List.Content>
          </List.Item>
        ))}
      </List>

      <style jsx>{`
        .tagList :global(.listItem:hover .content, .listItem:hover i) {
          color: #2185d0;
        }
      `}</style>
    </div>
  )
}

TagListPres.propTypes = propTypes
TagListPres.defaultProps = defaultProps

export default compose(
  graphql(TagListQuery),
  branch(props => props.data.loading, renderComponent(LoadingDiv)),
  withProps(({ activeTags, data: { loading, error, tags } }) => ({
    error,
    loading,
    tags: tags && tags.map(tag => ({ ...tag, isActive: activeTags.includes(tag.name) })),
  })),
)(TagListPres)
