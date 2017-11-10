import React from 'react'
import PropTypes from 'prop-types'
import { graphql } from 'react-apollo'
import { List } from 'semantic-ui-react'
import { compose, withProps, branch, renderComponent } from 'recompose'

import { LoadingDiv } from '../common'
import { TagListQuery } from '../../graphql/queries'

const propTypes = {
  handleTagClick: PropTypes.func.isRequired,
  tags: PropTypes.arrayOf(
    PropTypes.shape({
      id: PropTypes.string.isRequired,
      name: PropTypes.string.isRequired,
    }),
  ),
}

const defaultProps = {
  tags: [],
}

export const TagListPres = ({ tags, handleTagClick }) => (
  <div className="tagList">
    <List selection size="large">
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
      .tagList {
        :global(.listItem:hover .content),
        :global(.listItem:hover i) {
          color: #2185d0;
        }
      }
    `}</style>
  </div>
)

TagListPres.propTypes = propTypes
TagListPres.defaultProps = defaultProps

export default compose(
  graphql(TagListQuery),
  branch(props => props.data.loading, renderComponent(LoadingDiv)),
  branch(props => props.data.error, renderComponent(props => <div>{props.data.error}</div>)),
  withProps(({ activeTags, data: { loading, tags } }) => ({
    loading,
    tags: tags && tags.map(tag => ({ ...tag, isActive: activeTags.includes(tag.name) })),
  })),
)(TagListPres)
