import React from 'react'
import PropTypes from 'prop-types'

import { List, Popup } from 'semantic-ui-react'

const propTypes = {
  children: PropTypes.node.isRequired,
  items: PropTypes.arrayOf(PropTypes.string.isRequired),
  limit: PropTypes.number,
}

const defaultProps = {
  items: [],
  limit: undefined,
}

const mapItems = items => items.map(item => <List.Item>{item}</List.Item>)

const ListWithHeader = ({ children, items, limit }) => (
  <div className="listWithHeader">
    {children && <span className="listHeader">{children}</span>}

    {items.length > limit ? (
      <React.Fragment>
        <List>{mapItems(items.slice(0, limit))}</List>
        <Popup
          hideOnScroll
          on="click"
          position="bottom center"
          trigger={<div className="more">...</div>}
        >
          <div className="remainingPopup">
            <List>{mapItems(items.slice(limit))}</List>
          </div>
        </Popup>
      </React.Fragment>
    ) : (
      <List>{mapItems(items)}</List>
    )}

    <style jsx>{`
      @import 'src/theme';

      .listWithHeader {
        display: flex;
        flex-direction: column;

        .listHeader,
        .more {
          font-size: 1rem;

          padding: 0.2rem 0;
        }

        .listHeader {
          border-bottom: 1px solid $color-primary;
        }

        .more {
          border-top: 1px solid $color-primary;
          cursor: pointer;
        }

        :global(.list) {
          margin: 0;
          padding: 0.5rem 0;
        }
      }
    `}</style>
  </div>
)

ListWithHeader.propTypes = propTypes
ListWithHeader.defaultProps = defaultProps

export default ListWithHeader
