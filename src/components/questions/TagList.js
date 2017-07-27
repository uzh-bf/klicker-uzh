import React from 'react'
import PropTypes from 'prop-types'
import { gql, graphql } from 'react-apollo'
import { List } from 'semantic-ui-react'

import withCSS from '../../lib/withCSS'

const TagList = ({ activeTags, data, head, handleTagClick }) => {
  if (data.loading) {
    return <div>Loading</div>
  }

  if (data.error) {
    return <div>{data.error}</div>
  }

  return (
    <List selection size="large">
      {head}

      {data.tags.map((tag) => {
        const isActive = activeTags.includes(tag.id)

        return (
          <List.Item key={tag.id} className="listItem" onClick={() => handleTagClick(tag.id)}>
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
    tags: PropTypes.arrayOf(
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
    tags: allTags(orderBy: name_ASC) {
      id
      name
    }
  }
`)(TagListWithCSS)
