import React from 'react'
import PropTypes from 'prop-types'

const propTypes = {
  children: PropTypes.node.isRequired,
  items: PropTypes.arrayOf(PropTypes.string.isRequired),
}

const defaultProps = {
  items: [],
}

const ListWithHeader = ({ children, items }) => (
  <div className="listWithHeader">
    {children && <span className="listHeader">{children}</span>}
    <ul className="list">{items.map(item => <li className="listItem">{item}</li>)}</ul>

    <style jsx>{`
      @import 'src/theme';

      .listWithHeader {
        display: flex;
        flex-direction: column;

        padding: 0.7rem;

        .list {
          margin: 0;
          padding: 0;
        }
        .listHeader {
          font-size: 1rem;
          margin-bottom: 0.5rem;
        }
        .listItem {
          list-style: none;
        }
      }
    `}</style>
  </div>
)

ListWithHeader.propTypes = propTypes
ListWithHeader.defaultProps = defaultProps

export default ListWithHeader
