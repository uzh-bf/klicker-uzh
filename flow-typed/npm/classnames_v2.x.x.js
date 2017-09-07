// flow-typed signature: 540091e58fbe3b47cf158d0953a84cb0
// flow-typed version: 7a7121569e/classnames_v2.x.x/flow_>=v0.25.x

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

declare module 'classnames/dedupe' {
  declare module.exports: $Exports<'classnames'>;
}
