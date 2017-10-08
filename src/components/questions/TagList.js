import React from 'react'
import PropTypes from 'prop-types'
import { graphql } from 'react-apollo'
import { List } from 'semantic-ui-react'
import { compose, withPropsOnChange, setPropTypes } from 'recompose'
import { TagListQuery } from '../../queries/queries'

const propTypes = {
  error: PropTypes.oneOfType([PropTypes.string, undefined]).isRequired,
  handleTagClick: PropTypes.func.isRequired,
  loading: PropTypes.bool.isRequired,
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

export const TagListPres = ({
  loading, error, tags, handleTagClick,
}) => {
  if (loading) {
    return <div>Loading</div>
  }

  if (error) {
    return <div>{error}</div>
  }

  return (
    <List selection size="large">
      {tags.map(({ isActive, id, name }) => (
        <List.Item key={id} className="listItem" onClick={() => handleTagClick(name)}>
          <List.Icon name={isActive ? 'folder' : 'folder outline'} />
          <List.Content>
            <span className={isActive ? 'active' : 'inactive'}>{name}</span>
          </List.Content>
        </List.Item>
      ))}

      <style jsx>
        {`
          .active {
            font-weight: bold;
          }
        `}
      </style>
    </List>
  )
}

TagListPres.propTypes = propTypes
TagListPres.defaultProps = defaultProps

export default compose(
  graphql(TagListQuery),
  withPropsOnChange(['data', 'activeTags'], ({ activeTags, data: { loading, error, tags } }) => ({
    error,
    loading,
    tags: tags && tags.map(tag => ({ ...tag, isActive: activeTags.includes(tag.name) })),
  })),
  setPropTypes({
    activeTags: PropTypes.arrayOf(PropTypes.string),
  }),
)(TagListPres)
