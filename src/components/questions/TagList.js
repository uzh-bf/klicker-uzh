// @flow

import React from 'react'
import { graphql } from 'react-apollo'
import { List } from 'semantic-ui-react'

import withCSS from '../../lib/withCSS'
import { TagListQuery } from '../../queries/queries'

type Props = {
  activeTags?: Array<string>,
  data: {
    loading: boolean,
    error: string,
    tags: Array<{
      id: string,
      name: string,
    }>
  },
  head: 'next/head',
  handleTagClick: () => mixed,
}

const TagList = ({ activeTags = [], data, head, handleTagClick }: Props) => {
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

export default graphql(TagListQuery)(withCSS(TagList, ['list']))
