// @flow

import * as React from 'react'
import { graphql } from 'react-apollo'
import { List } from 'semantic-ui-react'
import { Helmet } from 'react-helmet'

import { createLinks } from '../../lib'

import { TagListQuery } from '../../queries/queries'
import type { TagListType } from '../../queries/queries'

type Props = {
  activeTags: Array<string>,
  data: TagListType,
  handleTagClick: () => mixed,
}

const TagList = ({ activeTags, data, handleTagClick }: Props) => {
  if (data.loading) {
    return <div>Loading</div>
  }

  if (data.error) {
    return (
      <div>
        {data.error}
      </div>
    )
  }

  return (
    <List selection size="large">
      <Helmet>
        {createLinks(['list'])}
      </Helmet>

      {data.tags.map((tag) => {
        const isActive = activeTags.length > 0 && activeTags.includes(tag.id)

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

export default graphql(TagListQuery)(TagList)
