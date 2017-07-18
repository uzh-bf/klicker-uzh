import React from 'react'
import PropTypes from 'prop-types'
import _sortBy from 'lodash/sortBy'
import { gql, graphql } from 'react-apollo'
import { List } from 'semantic-ui-react'

import withCSS from '../../lib/withCSS'

const TagList = ({ activeTags, data, head, handleTagClick }) => {
  if (data.loading) {
    return <div>Loading</div>
  }

  // sort the tags by name
  const sortedByName = _sortBy(data.allTags, ['name'])

  return (
    <List selection size="large">
      {head}

      {sortedByName.map((tag) => {
        const isActive = activeTags.includes(tag.id)

        return (
          <List.Item className="listItem" key={tag.id} onClick={() => handleTagClick(tag.id)}>
            <List.Icon name={isActive ? 'folder' : 'folder outline'} />
            <List.Content>
              <span className={isActive ? 'active' : 'inactive'}>
                {tag.name}
              </span>
            </List.Content>
          </List.Item>
        )
      })}
      <style jsx>{`
        .active {
          font-weight: bold;
        }
      `}</style>
    </List>
  )
}

TagList.propTypes = {
  activeTags: PropTypes.arrayOf(PropTypes.string),
  data: PropTypes.shape({
    loading: PropTypes.bool.isRequired,
    allTags: PropTypes.arrayOf(
      PropTypes.shape({
        id: PropTypes.string.isRequired,
        name: PropTypes.string.isRequired,
      }),
    ),
  }).isRequired,
  handleTagClick: PropTypes.func.isRequired,
  head: PropTypes.node.isRequired,
}

TagList.defaultProps = {
  activeTags: [],
}

const TagListWithCSS = withCSS(TagList, ['list'])

export default graphql(gql`
  {
    allTags {
      id
      name
    }
  }
`)(TagListWithCSS)
