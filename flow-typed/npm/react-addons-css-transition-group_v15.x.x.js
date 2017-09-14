// flow-typed signature: e64b934137dc4ec4a5efd9f02b4b817a
// flow-typed version: 19506e57e6/react-addons-css-transition-group_v15.x.x/flow_>=v0.26.x <=v0.52.x

declare module 'react-addons-css-transition-group' {
  declare type ReactCSSTransitionGroupNames = {
    enter: string,
    enterActive?: string,
    leave: string,
    leaveActive?: string,
    appear: string,
    appearActive?: string
  };
  declare type Props = {
    transitionName: string | ReactCSSTransitionGroupNames,
    transitionAppear?: boolean,
    transitionEnter?: boolean,
    transitionLeave?: boolean,
    transitionAppearTimeout?: number,
    transitionEnterTimeout?: number,
    transitionLeaveTimeout?: number,
  };
  declare type DefaultProps = {
    transitionAppear: boolean,
    transitionEnter: boolean,
    transitionLeave: boolean,
  }
  declare class ReactCSSTransitionGroup extends React$Component<DefaultProps, Props, any> {
    props: Props;
    static defaultProps: DefaultProps;
  }
  declare module.exports: Class<ReactCSSTransitionGroup>;
}
