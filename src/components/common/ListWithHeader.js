// @flow

import React from 'react'

type Props = {
  children: any,
  items: Array<string>,
}

const ListWithHeader = ({ children, items }: Props) =>
  (<div>
    <h3 className="listHeader">
      {children}
    </h3>
    <ul className="list">
      {items.map(item =>
        (<li key={item} className="listItem">
          {item}
        </li>),
      )}
    </ul>

    <style jsx>{`
      .list {
        margin: 0;
        margin-top: 1rem;
        padding: 0;
      }
      .listHeader {
        font-size: 1rem;
        margin: 0;
      }
      .listItem {
        list-style: none;
      }
    `}</style>
  </div>)

export default ListWithHeader
