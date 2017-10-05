import React from 'react'
import PropTypes from 'prop-types'

const propTypes = {
  children: PropTypes.children.isRequired,
  items: PropTypes.arrayOf(PropTypes.string.isRequired),
}

const defaultProps = {
  items: [],
}

const ListWithHeader = ({ children, items }) => (
  <div>
    <h3 className="listHeader">{children}</h3>
    <ul className="list">
      {items.map(item => (
        <li key={item} className="listItem">
          {item}
        </li>
      ))}
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
  </div>
)

ListWithHeader.propTypes = propTypes
ListWithHeader.defaultProps = defaultProps

export default ListWithHeader
