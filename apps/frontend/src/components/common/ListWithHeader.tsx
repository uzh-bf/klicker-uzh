import React from 'react'
import { List, Popup } from 'semantic-ui-react'

interface Props {
  children: React.ReactNode
  items?: string[]
  limit?: number
}

const defaultProps = {
  items: [],
  limit: undefined,
}

const mapItems = (items): React.ReactElement[] =>
  items.map((item: any): React.ReactElement => <List.Item key={item}>{item}</List.Item>)

function ListWithHeader({ children, items, limit }: Props): React.ReactElement {
  return (
    <div className="flex flex-col listWithHeader">
      {children && (
        <span className="border-b fontSize-[2rem] lineHeight-[2rem] py-[0.4rem] px-0 text-base leading-4 border-primary">
          {children}
        </span>
      )}

      {items.length > limit ? (
        <>
          <List className="!px-0 !py-2 !m-0">{mapItems(items.slice(0, limit))}</List>
          <Popup
            hideOnScroll
            on="click"
            position="bottom center"
            trigger={
              <div className="border-t fontSize-[2rem] lineHeight-[2rem] cursor-pointer text-base leading-4 py-[0.2rem] px-0 align-middle border-primary">
                ...
              </div>
            }
          >
            <List className="!px-0 !py-2 !m-0">{mapItems(items.slice(limit))}</List>
          </Popup>
        </>
      ) : (
        <List className="!px-0 !py-2 !m-0">{mapItems(items)}</List>
      )}
    </div>
  )
}

ListWithHeader.defaultProps = defaultProps

export default ListWithHeader
