import React from 'react'
import { List, Popup } from 'semantic-ui-react'

interface Props {
  children: React.ReactNode
  items: string[]
  limit?: number
}

const defaultProps = {
  items: [],
  limit: undefined,
}

const mapItems = items => items.map(item => <List.Item>{item}</List.Item>)

function ListWithHeader({ children, items, limit }: Props): React.ReactElement {
  return (
    <div className="listWithHeader">
      {children && <span className="listHeader">{children}</span>}

      {items.length > limit ? (
        <>
          <List>{mapItems(items.slice(0, limit))}</List>
          <Popup hideOnScroll on="click" position="bottom center" trigger={<div className="more">...</div>}>
            <div className="remainingPopup">
              <List>{mapItems(items.slice(limit))}</List>
            </div>
          </Popup>
        </>
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
            line-height: 1rem;
          }

          .listHeader {
            border-bottom: 1px solid $color-primary;
            padding: 0.4rem 0;
          }

          .more {
            border-top: 1px solid $color-primary;
            cursor: pointer;
            padding: 0.2rem 0;
            vertical-align: middle;
          }

          :global(.list) {
            margin: 0;
            padding: 0.5rem 0;
          }
        }
      `}</style>
    </div>
  )
}

ListWithHeader.defaultProps = defaultProps

export default ListWithHeader
