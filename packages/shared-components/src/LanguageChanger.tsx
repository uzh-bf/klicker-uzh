import { Select } from '@uzh-bf/design-system'
import React from 'react'

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
        { value: 'de', label: 'DE' },
        { value: 'en', label: 'EN' },
      ]}
      onChange={onChange}
      className={{
        root: className,
        trigger: 'border bg-slate-100 hover:shadow',
      }}
      basic
    />
  )
}

export default LanguageChanger
