import { Select } from '@uzh-bf/design-system'
import React from 'react'

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
      className={{
        trigger: 'w-max',
      }}
      data={{ cy: 'select-value-language-changer' }}
    />
  )
}

export default LanguageChanger
