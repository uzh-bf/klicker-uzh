// import dynamic from 'next/dynamic'
import React, { PropsWithChildren, Ref, useCallback, useMemo, useState } from 'react'
import { Form, Icon } from 'semantic-ui-react'
import { FormattedMessage } from 'react-intl'
import { Editor, Transforms, createEditor, Descendant, Element as SlateElement } from 'slate'
import { Editable, withReact, useSlate, Slate } from 'slate-react'
import { withHistory } from 'slate-history'
import isHotkey from 'is-hotkey'
import clsx from 'clsx'

import CustomTooltip from '../../common/CustomTooltip'

interface Props {
  disabled?: boolean
  error?: any
  onChange: any
  touched: any
  value: any
}

const defaultProps = {
  disabled: false,
}

const HOTKEYS = {
  'mod+b': 'bold',
  'mod+i': 'italic',
  'mod+u': 'underline',
  'mod+`': 'code',
}
const LIST_TYPES = ['numbered-list', 'bulleted-list']
type OrNull<T> = T | null

function ContentInput({ value, onChange, error, touched, disabled }: Props): React.ReactElement {
  const [valueNew, setValue] = useState<Descendant[]>(initialValue)
  const renderElement = useCallback((props) => <Element {...props} />, [])
  const renderLeaf = useCallback((props) => <Leaf {...props} />, [])
  const editor = useMemo(() => withHistory(withReact(createEditor())), [])

  return (
    <div className={clsx(disabled && 'pointer-events-none opacity-70')}>
      <Form.Field required error={touched && error}>
        <label htmlFor="content">
          <FormattedMessage defaultMessage="Question" id="createQuestion.contentInput.label" />

          <CustomTooltip
            content={
              <FormattedMessage
                defaultMessage="Enter the question you want to ask the audience."
                id="createQuestion.contentInput.tooltip"
              />
            }
            iconObject={
              <a data-tip>
                <Icon name="question circle" />
              </a>
            }
          />
        </label>

        <div className="mt-2 border border-solid rounded">
          <Slate editor={editor} value={valueNew} onChange={(newvalue) => setValue(newvalue)}>
            <div className="flex flex-row w-full h-10 p-2 mb-2 mr-10 bg-grey-20">
              {/* toolbar div */}
              <MarkButton format="bold" icon="bold" />
              <MarkButton format="italic" icon="italic" />
              <MarkButton format="underline" icon="underline" />
              <MarkButton format="code" icon="code" />
              <BlockButton format="block-quote" icon="quote right" />
              <BlockButton format="numbered-list" icon="list ol" />
              <BlockButton format="bulleted-list" icon="list ul" />
            </div>
            <div className="p-3">
              <Editable
                autoFocus
                spellCheck
                placeholder="Enter some rich text…"
                renderElement={renderElement}
                renderLeaf={renderLeaf}
                onKeyDown={(event) => {
                  // eslint-disable-next-line no-restricted-syntax
                  for (const hotkey in HOTKEYS) {
                    if (isHotkey(hotkey, event as any)) {
                      event.preventDefault()
                      const mark = HOTKEYS[hotkey]
                      toggleMark(editor, mark)
                    }
                  }
                }}
              />
            </div>
          </Slate>
        </div>
      </Form.Field>
    </div>
  )
}

const toggleBlock = (editor, format) => {
  const isActive = isBlockActive(editor, format)
  const isList = LIST_TYPES.includes(format)

  Transforms.unwrapNodes(editor, {
    match: (n) => !Editor.isEditor(n) && SlateElement.isElement(n) && LIST_TYPES.includes(n.type),
    split: true,
  })
  const newProperties: Partial<SlateElement> = {
    // eslint-disable-next-line no-nested-ternary
    type: isActive ? 'paragraph' : isList ? 'list-item' : format,
  }
  Transforms.setNodes<SlateElement>(editor, newProperties)

  if (!isActive && isList) {
    const block = { type: format, children: [] }
    Transforms.wrapNodes(editor, block)
  }
}

const toggleMark = (editor, format) => {
  const isActive = isMarkActive(editor, format)

  if (isActive) {
    Editor.removeMark(editor, format)
  } else {
    Editor.addMark(editor, format, true)
  }
}

const isBlockActive = (editor, format) => {
  const { selection } = editor
  if (!selection) return false

  const [match] = Array.from(
    Editor.nodes(editor, {
      at: Editor.unhangRange(editor, selection),
      match: (n) => !Editor.isEditor(n) && SlateElement.isElement(n) && n.type === format,
    })
  )

  return !!match
}

const isMarkActive = (editor, format) => {
  const marks = Editor.marks(editor)
  return marks ? marks[format] === true : false
}

const Element = ({ attributes, children, element }) => {
  switch (element.type) {
    case 'block-quote':
      return <blockquote {...attributes}>{children}</blockquote>
    case 'bulleted-list':
      return <ul {...attributes}>{children}</ul>
    case 'heading-one':
      return <h1 {...attributes}>{children}</h1>
    case 'heading-two':
      return <h2 {...attributes}>{children}</h2>
    case 'list-item':
      return <li {...attributes}>{children}</li>
    case 'numbered-list':
      return <ol {...attributes}>{children}</ol>
    default:
      return <p {...attributes}>{children}</p>
  }
}

const Leaf = ({ attributes, children, leaf }) => {
  let formattedChildren = children
  if (leaf.bold) {
    formattedChildren = <strong>{formattedChildren}</strong>
  }

  if (leaf.code) {
    formattedChildren = <code>{formattedChildren}</code>
  }

  if (leaf.italic) {
    formattedChildren = <em>{formattedChildren}</em>
  }

  if (leaf.underline) {
    formattedChildren = <u>{formattedChildren}</u>
  }

  return <span {...attributes}>{formattedChildren}</span>
}

const BlockButton = ({ format, icon }) => {
  const editor = useSlate()
  return (
    <Button
      active={isBlockActive(editor, format)}
      editor={editor}
      format={format}
      onMouseDown={(event) => {
        event.preventDefault()
        toggleBlock(editor, format)
      }}
    >
      <Icon name={icon} />
    </Button>
  )
}

const MarkButton = ({ format, icon }) => {
  const editor = useSlate()
  return (
    <Button
      active={isMarkActive(editor, format)}
      onMouseDown={(event) => {
        event.preventDefault()
        toggleMark(editor, format)
      }}
    >
      <Icon name={icon} />
    </Button>
  )
}

const initialValue: Descendant[] = [
  {
    type: 'paragraph',
    children: [
      { text: 'This is editable ' },
      { text: 'rich', bold: true },
      { text: ' text, ' },
      { text: 'much', italic: true },
      { text: ' better than a ' },
      { text: '<textarea>', code: true },
      { text: '!' },
    ],
  },
  {
    type: 'paragraph',
    children: [
      {
        text: "Since it's rich text, you can do things like turn a selection of text ",
      },
      { text: 'bold', bold: true },
      {
        text: ', or add a semantically rendered block quote in the middle of the page, like this:',
      },
    ],
  },
  {
    type: 'block-quote',
    children: [{ text: 'A wise quote.' }],
  },
  {
    type: 'paragraph',
    children: [{ text: 'Try it out for yourself!' }],
  },
]

export const Button = React.forwardRef(
  (
    {
      className,
      active,
      reversed,
      ...props
    }: PropsWithChildren<{
      active: boolean
      reversed: boolean
      className: string
      [key: string]: unknown
    }>,
    ref: Ref<OrNull<HTMLSpanElement>>
  ) => (
    <span
      {...props}
      className={clsx(
        className,
        'cursor-pointer',
        active && !reversed && 'bg-red-400',
        !active && reversed && 'bg-red-400'
      )}
      ref={ref}
    />
  )
)
Button.displayName = 'Button'

ContentInput.defaultProps = defaultProps

export default ContentInput
