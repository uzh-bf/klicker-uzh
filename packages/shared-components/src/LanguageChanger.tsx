import { Select } from '@uzh-bf/design-system'

function LanguageChanger({
  value,
  onChange,
}: {
  value: string
  onChange: (locale: string) => void
}) {
  return (
    <Select
      value={value}
      items={[
        { value: 'de', label: 'DE', data: { cy: 'language-de' } },
        { value: 'en', label: 'EN', data: { cy: 'language-en' } },
      ]}
      onChange={onChange}
      className={{ trigger: 'h-8 w-max' }}
      data={{ cy: 'select-value-language-changer' }}
    />
  )
}

export default LanguageChanger
