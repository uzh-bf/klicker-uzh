import React from 'react'
import clsx from 'clsx'
import { Button, Icon } from 'semantic-ui-react'

interface Props {
  children: React.ReactNode
  collapsed?: boolean
  handleCollapseToggle: any
}

const defaultProps = {
  collapsed: false,
}

function Collapser({ children, collapsed, handleCollapseToggle }: Props): React.ReactElement {
  return (
    <div className="collapser">
      <div className={clsx('content', { collapsed })}>{children}</div>
      <div className="collapse">
        <Button basic icon size="tiny" onClick={handleCollapseToggle}>
          <Icon name={collapsed ? 'angle double down' : 'angle double up'} />
        </Button>
      </div>

      <style jsx>
        {`
          .collapser {
            display: flex;
            flex-direction: column;
          }

          .content {
            flex: 0 0 auto;

            line-height: 1.2rem;
            margin: 0.5rem;
            margin-bottom: 0.3rem;
            min-height: 6rem;
            overflow: hidden;
            word-wrap: break-word;
          }

          .content.collapsed {
            flex: 1 0 6rem;
          }

          .content :global(p) {
            margin-top: 0;
            margin-bottom: 0.6rem;
          }

          .content :global(p:last-child) {
            margin-bottom: 0;
          }

          .collapse {
            margin: auto;
            margin-bottom: 0.3rem;
          }
        `}
      </style>
    </div>
  )
}

Collapser.defaultProps = defaultProps

export default Collapser
