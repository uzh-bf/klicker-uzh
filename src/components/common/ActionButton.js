// @flow

import * as React from 'react';
import { Button } from 'semantic-ui-react'

type Props = {
  items: Array<{
    label: string,
    handleClick: () => mixed,
  }>,
}

const ActionButton = ({ items }: Props) =>
  (<div className="actionButtonWrapper">
    <div className="actionButton">
      <Button circular primary icon="plus" size="large" />
    </div>
    <div className="ui vertical text menu buttonMenu">
      {items.map(item =>
        (<button className="item" onClick={item.handleClick}>
          {item.label}
        </button>),
      )}
    </div>

    <style jsx>{`
      .actionButtonWrapper {
        display: flex;
        flex-direction: column;

        max-width: 7rem;
      }

      .buttonMenu {
        flex: 1;
        order: 0;
      }

      .buttonMenu .item {
        opacity: 0;
        transform: scale(0) translateX(10rem);
        transition: transform .3s ease-in-out, opacity .3s ease-in;
      }

      .actionButton {
        flex: 0 0 auto;
        align-self: flex-end;
        order: 1;

        transition: transform .5s ease-in-out;
      }

      .actionButton:hover + .buttonMenu .item {
        opacity: 1;
        transform: scale(1) translateX(0);
      }

      .actionButton:hover {
        transform: rotate(45deg);
      }

      .actionButton :global(button) {
        margin-right: 0;
      }
    `}</style>
  </div>)

export default ActionButton
