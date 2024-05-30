import { Select } from '@uzh-bf/design-system'

function LanguageChanger({
  value,
  onChange,
  className,
}: {
  value: string
  onChange: (locale: string) => void
  className?: string
}) {
  return (
    <Select
      value={value}
      items={[
        { value: 'de', label: 'DE', data: { cy: 'language-de' } },
        { value: 'en', label: 'EN', data: { cy: 'language-en' } },
      ]}
      onChange={onChange}
      className={{
        root: className,
        trigger: 'border bg-slate-100 hover:shadow',
      }}
      data={{ cy: 'select-value-language-changer' }}
      basic
    />
  )
}

export default LanguageChanger
