import React from 'react'
import PropTypes from 'prop-types'

const ListWithHeader = ({ children, items }) =>
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
      .listHeader {
        font-size: 1rem;
        margin: 0;
      }
      .list {
        margin: 0;
        margin-top: 1rem;
        padding: 0;
      }
      .listItem {
        list-style: none;
      }
    `}</style>
  </div>)

ListWithHeader.propTypes = {
  children: PropTypes.node.isRequired,
  items: PropTypes.arrayOf(PropTypes.string).isRequired,
}

export default ListWithHeader
