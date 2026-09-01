import builder from '../builder.js'
import { sharedElementProps, type IBaseElementProps } from './elementShared.js'

export interface IQrScanElement extends IBaseElementProps {}
export const QrScanElement = builder
  .objectRef<IQrScanElement>('QrScanElement')
  .implement({
    fields: (t) => ({
      ...sharedElementProps(t),
    }),
  })

export interface IQrScanPrintData {
  elementId: number
  name: string
  content: string
  code: string
  decoys: string[]
}
export const QrScanPrintData = builder
  .objectRef<IQrScanPrintData>('QrScanPrintData')
  .implement({
    fields: (t) => ({
      elementId: t.exposeInt('elementId'),
      name: t.exposeString('name'),
      content: t.exposeString('content'),
      code: t.exposeString('code'),
      decoys: t.exposeStringList('decoys'),
    }),
  })
