// @flow

import React from 'react'
import classNames from 'classnames'
import { Icon } from 'semantic-ui-react'

type Props = {
  children: any,
  collapsed: boolean,
  handleCollapseToggle: () => mixed,
}

const defaultProps = {
  collapsed: false,
}

const Collapser = ({ children, collapsed, handleCollapseToggle }: Props) =>
  (<div className="collapser">
    <div className={classNames('content', { collapsed })}>
      {children}
    </div>
    <div className="collapse">
      <Icon
        name={collapsed ? 'angle double down' : 'angle double up'}
        onClick={handleCollapseToggle}
      />
    </div>

    <style jsx>{`
      .collapser {
        display: flex;
        flex-direction: column;
      }

      .content {
        flex: 0 0 auto;

        line-height: 1.2rem;
        margin: .5rem;
        margin-bottom: .3rem;
        overflow: hidden;
      }

      .content.collapsed {
        flex: 1 0 4.2rem;
      }

      .content :global(p) {
        margin-top: 0;
        margin-bottom: .6rem;
      }

      .content :global(p:last-child) {
        margin-bottom: 0;
      }

      .collapse {
        margin: auto;
        margin-bottom: .3rem;
      }
    `}</style>
  </div>)

Collapser.defaultProps = defaultProps

export default Collapser
