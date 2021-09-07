import React from 'react'
import Head from 'next/head'
import { Button } from 'semantic-ui-react'

import { createLinks } from '../../../lib/utils/css'

interface Props {
  handleChange: any
  labels?: any
  title: React.ReactNode
  value?: number
}

const defaultProps = {
  labels: undefined,
  title: undefined,
  value: undefined,
}

function ConfusionDialog({ title, value, handleChange, labels }: Props): React.ReactElement {
  return (
    <div className="confusionSlider mb-10">
      <Head>{createLinks(['https://unpkg.com/react-rangeslider/umd/rangeslider.min.css'])}</Head>
      {title && <div className="text-base m-0 mb-2">{title}</div>}

      <div>
        <Button
          onClick={(): void => {
            handleChange(-1)
          }}
          color={value == -1 ? 'blue' : null}
        >
          {labels.min}
        </Button>
        <Button
          onClick={(): void => {
            handleChange(0)
          }}
          color={value == 0 ? 'blue' : null}
        >
          {labels.mid}
        </Button>
        <Button
          onClick={(): void => {
            handleChange(1)
          }}
          color={value == 1 ? 'blue' : null}
        >
          {labels.max}
        </Button>
      </div>

      <style jsx>{`
        @import 'src/theme';

        .confusionSlider {
          .title > :global(*):first-child {
            font-size: 1rem !important;
            margin: 0;
          }

          :global(.rangeslider__fill) {
            background-color: $color-primary;
          }

          :global(.rangeslider__handle) {
            padding: 1rem;

            &:after {
              display: none;
            }

            &:focus {
              outline: none;
            }
          }

          :global(.rangeslider__handle-label) {
            position: absolute;
            top: 50%;
            left: 50%;
            transform: translate3d(-50%, -50%, 0);
          }
        }
      `}</style>
    </div>
  )
}

ConfusionDialog.defaultProps = defaultProps

export default ConfusionDialog
