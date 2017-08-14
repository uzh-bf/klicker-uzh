// flow-typed signature: 550f02e64923bd09478f80e998e9eb60
// flow-typed version: 7fd0a6404e/classnames_v2.x.x/flow_>=v0.25.x

type $npm$classnames$Classes =
  | string
  | { [className: string]: * }
  | Array<string>
  | false
  | void
  | null;

declare module 'classnames' {
  declare function exports(...classes: Array<$npm$classnames$Classes>): string;
}

declare module 'classnames/bind' {
  declare module.exports: $Exports<'classnames'>;
}
