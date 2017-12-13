import React from 'react'
import PropTypes from 'prop-types'
import classNames from 'classnames'
import { Icon } from 'semantic-ui-react'

const propTypes = {
  children: PropTypes.node.isRequired,
  collapsed: PropTypes.bool,
  handleCollapseToggle: PropTypes.func.isRequired,
}

const defaultProps = {
  collapsed: false,
}

const Collapser = ({ children, collapsed, handleCollapseToggle }) => (
  <div className="collapser">
    <div className={classNames('content', { collapsed })}>{children}</div>
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
        margin: 0.5rem;
        margin-bottom: 0.3rem;
        min-height: 3rem;
        overflow: hidden;
        word-wrap: break-word;
      }

      .content.collapsed {
        flex: 1 0 3rem;
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
    `}</style>
  </div>
)

Collapser.propTypes = propTypes
Collapser.defaultProps = defaultProps

export default Collapser
