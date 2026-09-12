import { faMinus, faPlus } from '@fortawesome/free-solid-svg-icons'
import { Button } from '@uzh-bf/design-system'
import { useTranslations } from 'next-intl'

interface FontSizeButtonsProps {
  textSize: number
  minTextSize: number
  maxTextSize: number
  setTextSize: (size: number) => void
  labelPrefix?: string
  labelSuffix?: string
}

function FontSizeButtons({
  textSize,
  minTextSize,
  maxTextSize,
  setTextSize,
  labelPrefix = '',
  labelSuffix = '',
}: FontSizeButtonsProps) {
  const t = useTranslations()

  return (
    <div className="w-30 flex flex-col gap-1">
      <div className="flex-1 text-sm font-bold">
        {labelPrefix} {t('manage.evaluation.fontSize')} {labelSuffix}
      </div>
      <div className="flex flex-1 flex-row justify-between text-sm font-bold">
        <Button
          onClick={() => setTextSize(Math.max(textSize - 2, minTextSize))}
          disabled={textSize <= minTextSize}
          className={{
            root: 'h-9 w-9',
          }}
          data={{ cy: 'decrease-font-size-max-word-cloud' }}
        >
          <Button.Icon withoutLabel icon={faMinus} />
        </Button>
        <div className="flex-1 self-center text-center">{textSize} px</div>
        <Button
          onClick={() => setTextSize(Math.min(textSize + 2, maxTextSize))}
          disabled={textSize >= maxTextSize}
          className={{
            root: 'h-9 w-9',
          }}
          data={{ cy: 'increase-font-size-max-word-cloud' }}
        >
          <Button.Icon withoutLabel icon={faPlus} />
        </Button>
      </div>
    </div>
  )
}

export default FontSizeButtons
