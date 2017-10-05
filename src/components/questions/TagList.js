import React from 'react'
import PropTypes from 'prop-types'
import { graphql } from 'react-apollo'
import { List } from 'semantic-ui-react'

import { TagListQuery } from '../../queries/queries'

const propTypes = {
  activeTags: PropTypes.arrayOf(PropTypes.string),
  data: PropTypes.shape({
    error: PropTypes.string,
    loading: PropTypes.bool.isRequired,
    tags: PropTypes.arrayOf(
      PropTypes.shape({
        id: PropTypes.string.isRequired,
        name: PropTypes.string.isRequired,
      }),
    ),
  }).isRequired,
  handleTagClick: PropTypes.func.isRequired,
}

const defaultProps = {
  activeTags: [],
}

const TagList = ({ activeTags, data, handleTagClick }) => {
  if (data.loading) {
    return <div>Loading</div>
  }

  if (data.error) {
    return <div>{data.error}</div>
  }

  return (
    <List selection size="large">
      {data.tags.map(({ id, name }) => {
        const isActive = activeTags.length > 0 && activeTags.includes(name)

        return (
          <List.Item key={id} className="listItem" onClick={() => handleTagClick(name)}>
            <List.Icon name={isActive ? 'folder' : 'folder outline'} />
            <List.Content>
              <span className={isActive ? 'active' : 'inactive'}>{name}</span>
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

TagList.propTypes = propTypes
TagList.defaultProps = defaultProps

export default graphql(TagListQuery)(TagList)
