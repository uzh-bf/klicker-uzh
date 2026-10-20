import { createElement } from 'react'

function optionLabel(label: string, description: string) {
  return createElement(
    'span',
    {
      className:
        'flex w-[calc(100vw-4rem)] max-w-[30rem] flex-col gap-0.5 whitespace-normal',
    },
    createElement('span', null, label),
    createElement('span', { className: 'text-xs text-slate-600' }, description)
  )
}

export default optionLabel
