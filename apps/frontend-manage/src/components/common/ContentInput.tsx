import { faImage } from '@fortawesome/free-regular-svg-icons'
import {
  faBold,
  faCode,
  faItalic,
  faListOl,
  faListUl,
  faQuoteRight,
  faRotateLeft,
  faRotateRight,
  faSuperscript,
  faTable,
  faTerminal,
} from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { Extension } from '@tiptap/core'
import CodeBlockLowlight from '@tiptap/extension-code-block-lowlight'
import Image from '@tiptap/extension-image'
import Placeholder from '@tiptap/extension-placeholder'
import { TableKit } from '@tiptap/extension-table'
import { Markdown } from '@tiptap/markdown'
import { Plugin } from '@tiptap/pm/state'
import { EditorContent, useEditor } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import { Tooltip } from '@uzh-bf/design-system'
import { common, createLowlight } from 'lowlight'
import { useTranslations } from 'next-intl'
import React, { PropsWithChildren, useEffect, useState } from 'react'
import { twMerge } from 'tailwind-merge'
import MediaLibrary from './MediaLibrary'

const lowlight = createLowlight(common)

const normalizeMarkdown = (str: string) =>
  str.replace(/\r\n/g, '\n').replace(/\n+$/, '')

const normalizeLegacyEmptyContent = (content?: string) => {
  const currentContent = content ?? ''
  return /^\s*(<br\s*\/?>\s*)+$/i.test(currentContent) ? '' : currentContent
}

const normalizePastedTableSpans = (html: string) => {
  if (!/(?:rowspan|colspan)\s*=/i.test(html)) {
    return html
  }

  const document = new DOMParser().parseFromString(html, 'text/html')
  let changed = false

  document.querySelectorAll('table').forEach((table) => {
    const sections = [
      table.tHead,
      ...Array.from(table.tBodies),
      table.tFoot,
    ].filter((section): section is HTMLTableSectionElement => section !== null)
    const hasMergedCells = sections.some((section) => {
      const rows = Array.from(section.rows)

      return rows.some((row, rowIndex) =>
        Array.from(row.cells).some(
          (cell) =>
            cell.colSpan > 1 ||
            cell.rowSpan === 0 ||
            Math.min(cell.rowSpan, rows.length - rowIndex) > 1
        )
      )
    })

    if (!hasMergedCells) {
      return
    }

    changed = true
    const normalizedSections = sections.map((section) => {
      const rows = Array.from(section.rows)
      const grid: Array<Array<HTMLTableCellElement | undefined>> = rows.map(
        () => []
      )
      const fallbackTags = rows.map((row) =>
        Array.from(row.cells).every((cell) => cell.tagName === 'TH')
          ? 'th'
          : 'td'
      )

      rows.forEach((row, rowIndex) => {
        let columnIndex = 0

        Array.from(row.cells).forEach((cell) => {
          const columnSpan = cell.colSpan
          const rowSpan =
            cell.rowSpan === 0
              ? rows.length - rowIndex
              : Math.min(cell.rowSpan, rows.length - rowIndex)

          while (
            Array.from(
              { length: columnSpan },
              (_, offset) => grid[rowIndex][columnIndex + offset]
            ).some(Boolean)
          ) {
            columnIndex += 1
          }

          cell.removeAttribute('colspan')
          cell.removeAttribute('rowspan')

          for (
            let targetRow = rowIndex;
            targetRow < rowIndex + rowSpan;
            targetRow += 1
          ) {
            for (
              let targetColumn = columnIndex;
              targetColumn < columnIndex + columnSpan;
              targetColumn += 1
            ) {
              grid[targetRow][targetColumn] =
                targetRow === rowIndex && targetColumn === columnIndex
                  ? cell
                  : (document.createElement(
                      cell.tagName.toLowerCase()
                    ) as HTMLTableCellElement)
            }
          }

          columnIndex += columnSpan
        })
      })

      return { fallbackTags, grid, rows }
    })

    const columnCount = Math.max(
      ...normalizedSections.flatMap(({ grid }) => grid.map((row) => row.length))
    )
    normalizedSections.forEach(({ fallbackTags, grid, rows }) => {
      rows.forEach((row, rowIndex) => {
        const cells = Array.from({ length: columnCount }, (_, columnIndex) => {
          return (
            grid[rowIndex][columnIndex] ??
            (document.createElement(
              fallbackTags[rowIndex]
            ) as HTMLTableCellElement)
          )
        })

        row.replaceChildren(...cells)
      })
    })
  })

  return changed ? document.body.innerHTML : html
}

const PasteMarkdown = Extension.create({
  name: 'pasteMarkdown',

  transformPastedHTML(html) {
    return normalizePastedTableSpans(html)
  },

  addProseMirrorPlugins() {
    return [
      new Plugin({
        props: {
          handlePaste: (_view, event) => {
            const text = event.clipboardData?.getData('text/plain')
            const html = event.clipboardData?.getData('text/html')

            if (!text || html || !/(^|[^!])\[[^\]]+\]\([^)]+\)/m.test(text)) {
              return false
            }

            return this.editor.commands.insertContent(text, {
              contentType: 'markdown',
            })
          },
        },
      }),
    ]
  },
})

export interface ContentInputClassName {
  root?: string
  toolbar?: string
  content?: string
  editor?: string
}

interface Props {
  error?: any
  onChange: any
  touched: any
  disabled?: boolean
  showToolbarOnFocus?: boolean
  placeholder: string
  autoFocus?: boolean
  content?: string
  className?: ContentInputClassName
  data?: {
    test?: string
    cy?: string
  }
}

function ContentInput({
  content,
  onChange,
  disabled = false,
  showToolbarOnFocus = false,
  placeholder,
  autoFocus,
  error = '',
  touched,
  className,
  data,
}: Props): React.ReactElement {
  const t = useTranslations()
  const [isImageDropzoneOpen, setIsImageDropzoneOpen] = useState(false)

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        codeBlock: false,
      }),
      Image,
      Markdown,
      PasteMarkdown,
      Placeholder.configure({
        placeholder: placeholder,
        emptyEditorClass: 'is-editor-empty',
      }),
      CodeBlockLowlight.configure({
        lowlight,
      }),
      TableKit,
    ],
    content: normalizeLegacyEmptyContent(content),
    contentType: 'markdown',
    immediatelyRender: false,
    autofocus: autoFocus ? 'end' : false,
    editable: !disabled,
    onUpdate: ({ editor }) => {
      onChange(editor.getMarkdown())
    },
    editorProps: {
      attributes: {
        'data-cy': data?.cy || '',
        'data-test': data?.test || '',
        class: twMerge(
          'prose prose-sm prose-blockquote:text-gray-500 focus:outline-none! max-w-none leading-6 min-h-[80px]',
          className?.editor
        ),
      },
    },
  })

  // Sync content prop when it changes externally
  useEffect(() => {
    if (!editor) return
    const normalizedContent = normalizeLegacyEmptyContent(content)
    if (
      normalizeMarkdown(normalizedContent) !==
      normalizeMarkdown(editor.getMarkdown())
    ) {
      editor.commands.setContent(normalizedContent, {
        emitUpdate: false,
        contentType: 'markdown',
      })
    }
  }, [content, editor])

  // Sync disabled/editable state
  useEffect(() => {
    if (!editor) return
    editor.setEditable(!disabled, false)
  }, [disabled, editor])

  if (!editor) {
    return (
      <div
        className={twMerge(
          disabled && 'pointer-events-none opacity-70',
          'relative min-h-[120px] flex-1 rounded border border-solid',
          error && touched && 'border-red-500',
          className?.root
        )}
      >
        <div className={twMerge('p-3 text-gray-400', className?.content)}>
          {placeholder}
        </div>
      </div>
    )
  }

  return (
    <div
      className={twMerge(
        disabled && 'pointer-events-none opacity-70',
        'relative flex-1 rounded border border-solid',
        showToolbarOnFocus && 'group',
        error && touched && 'border-red-500',
        className?.root
      )}
    >
      <style>{`
        .ProseMirror p.is-editor-empty:first-child::before {
          color: #a3adb7;
          content: attr(data-placeholder);
          float: left;
          height: 0;
          pointer-events: none;
        }
      `}</style>

      <div className={twMerge('p-3', className?.content)}>
        <EditorContent editor={editor} />
      </div>

      <div
        className={twMerge(
          'toolbar bg-uzh-grey-20 mr-10 flex h-8 w-full flex-row px-1 text-sm',
          showToolbarOnFocus && 'hidden group-focus-within:flex'
        )}
      >
        <div
          className={twMerge('flex flex-1 flex-row gap-1', className?.toolbar)}
        >
          <Tooltip
            tooltip={t('shared.contentInput.boldStyle')}
            className={{
              tooltip: 'max-w-[45%] text-sm md:max-w-[70%] md:text-base',
            }}
          >
            <ToolbarButton
              active={editor.isActive('bold')}
              onClick={(e: React.MouseEvent) => {
                e.preventDefault()
                editor.chain().focus().toggleBold().run()
              }}
            >
              <FontAwesomeIcon
                icon={faBold}
                color={editor.isActive('bold') ? 'black' : 'grey'}
              />
            </ToolbarButton>
          </Tooltip>

          <Tooltip
            tooltip={t('shared.contentInput.italicStyle')}
            className={{
              tooltip: 'max-w-[45%] text-sm md:max-w-[70%] md:text-base',
            }}
          >
            <ToolbarButton
              active={editor.isActive('italic')}
              onClick={(e: React.MouseEvent) => {
                e.preventDefault()
                editor.chain().focus().toggleItalic().run()
              }}
            >
              <FontAwesomeIcon
                icon={faItalic}
                color={editor.isActive('italic') ? 'black' : 'grey'}
              />
            </ToolbarButton>
          </Tooltip>

          <Tooltip
            tooltip={t('shared.contentInput.codeStyle')}
            className={{
              tooltip: 'max-w-full text-sm md:max-w-full md:text-base',
            }}
          >
            <ToolbarButton
              active={editor.isActive('code')}
              onClick={(e: React.MouseEvent) => {
                e.preventDefault()
                editor.chain().focus().toggleCode().run()
              }}
            >
              <FontAwesomeIcon
                icon={faCode}
                color={editor.isActive('code') ? 'black' : 'grey'}
              />
            </ToolbarButton>
          </Tooltip>

          <Tooltip
            tooltip={t('shared.contentInput.citationStyle')}
            className={{
              tooltip: 'max-w-[35%] text-sm md:max-w-[70%] md:text-base',
            }}
          >
            <ToolbarButton
              active={editor.isActive('blockquote')}
              onClick={(e: React.MouseEvent) => {
                e.preventDefault()
                editor.chain().focus().toggleBlockquote().run()
              }}
            >
              <FontAwesomeIcon
                icon={faQuoteRight}
                color={editor.isActive('blockquote') ? 'black' : 'grey'}
              />
            </ToolbarButton>
          </Tooltip>

          <Tooltip
            tooltip={t('shared.contentInput.numberedList')}
            className={{
              tooltip: 'max-w-[35%] text-sm md:max-w-[50%] md:text-base',
            }}
          >
            <ToolbarButton
              active={editor.isActive('orderedList')}
              onClick={(e: React.MouseEvent) => {
                e.preventDefault()
                editor.chain().focus().toggleOrderedList().run()
              }}
            >
              <FontAwesomeIcon
                icon={faListOl}
                color={editor.isActive('orderedList') ? 'black' : 'grey'}
              />
            </ToolbarButton>
          </Tooltip>

          <Tooltip
            tooltip={t('shared.contentInput.unnumberedList')}
            className={{
              tooltip: 'max-w-[40%] text-sm md:max-w-[50%] md:text-base',
            }}
          >
            <ToolbarButton
              active={editor.isActive('bulletList')}
              onClick={(e: React.MouseEvent) => {
                e.preventDefault()
                editor.chain().focus().toggleBulletList().run()
              }}
            >
              <FontAwesomeIcon
                icon={faListUl}
                color={editor.isActive('bulletList') ? 'black' : 'grey'}
              />
            </ToolbarButton>
          </Tooltip>

          <Tooltip
            delay={2000}
            tooltip={t('shared.contentInput.image')}
            className={{
              tooltip: 'max-w-[45%] text-sm md:max-w-[70%] md:text-base',
            }}
          >
            <ToolbarButton
              active={isImageDropzoneOpen}
              onClick={(e: React.MouseEvent) => {
                e.preventDefault()
                setIsImageDropzoneOpen((prev) => !prev)
              }}
            >
              <FontAwesomeIcon icon={faImage} color="grey" />
            </ToolbarButton>
          </Tooltip>

          <Tooltip
            tooltip={t('shared.contentInput.latex')}
            className={{
              tooltip: 'max-w-[45%] text-sm md:max-w-[70%] md:text-base',
            }}
          >
            <ToolbarButton
              active={false}
              onClick={(e: React.MouseEvent) => {
                e.preventDefault()
                editor.chain().focus().insertContent('$$1 + 2$$').run()
              }}
            >
              <FontAwesomeIcon icon={faSuperscript} color="grey" />
            </ToolbarButton>
          </Tooltip>

          <Tooltip
            tooltip={t('shared.contentInput.latexCentered')}
            className={{
              tooltip: 'max-w-[45%] text-sm md:max-w-[70%] md:text-base',
            }}
          >
            <ToolbarButton
              active={false}
              onClick={(e: React.MouseEvent) => {
                e.preventDefault()
                editor
                  .chain()
                  .focus()
                  .insertContent('\n$$\n1 + 2\n$$\n', {
                    contentType: 'markdown',
                  })
                  .run()
              }}
            >
              <div className="flex flex-row items-center gap-0.5">
                <FontAwesomeIcon icon={faSuperscript} color="grey" />
                <span className="text-[9px] font-bold text-gray-500">C</span>
              </div>
            </ToolbarButton>
          </Tooltip>

          <Tooltip
            tooltip={t('shared.contentInput.codeBlock')}
            className={{
              tooltip: 'max-w-[45%] text-sm md:max-w-[70%] md:text-base',
            }}
          >
            <ToolbarButton
              data-cy="toolbar-code-block"
              active={editor.isActive('codeBlock')}
              onClick={(e: React.MouseEvent) => {
                e.preventDefault()
                editor.chain().focus().toggleCodeBlock().run()
              }}
            >
              <FontAwesomeIcon
                icon={faTerminal}
                color={editor.isActive('codeBlock') ? 'black' : 'grey'}
              />
            </ToolbarButton>
          </Tooltip>

          <Tooltip
            tooltip={t('shared.contentInput.table')}
            className={{
              tooltip: 'max-w-[45%] text-sm md:max-w-[70%] md:text-base',
            }}
          >
            <ToolbarButton
              data-cy="toolbar-table"
              active={editor.isActive('table')}
              onClick={(e: React.MouseEvent) => {
                e.preventDefault()
                if (!editor.isActive('table')) {
                  editor
                    .chain()
                    .focus()
                    .insertTable({ rows: 3, cols: 3, withHeaderRow: true })
                    .run()
                }
              }}
            >
              <FontAwesomeIcon
                icon={faTable}
                color={editor.isActive('table') ? 'black' : 'grey'}
              />
            </ToolbarButton>
          </Tooltip>
        </div>

        {editor.isActive('table') && (
          <div className="border-uzh-grey-40 mr-3 flex flex-row items-center gap-1 border-l pl-2">
            <Tooltip tooltip={t('shared.contentInput.addRow')}>
              <ToolbarButton
                data-cy="table-add-row"
                active={false}
                onClick={(e: React.MouseEvent) => {
                  e.preventDefault()
                  editor.chain().focus().addRowAfter().run()
                }}
              >
                <span className="text-[10px] font-bold">+R</span>
              </ToolbarButton>
            </Tooltip>
            <Tooltip tooltip={t('shared.contentInput.deleteRow')}>
              <ToolbarButton
                data-cy="table-delete-row"
                active={false}
                onClick={(e: React.MouseEvent) => {
                  e.preventDefault()
                  editor.chain().focus().deleteRow().run()
                }}
              >
                <span className="text-[10px] font-bold text-red-500">-R</span>
              </ToolbarButton>
            </Tooltip>
            <Tooltip tooltip={t('shared.contentInput.addColumn')}>
              <ToolbarButton
                data-cy="table-add-column"
                active={false}
                onClick={(e: React.MouseEvent) => {
                  e.preventDefault()
                  editor.chain().focus().addColumnAfter().run()
                }}
              >
                <span className="text-[10px] font-bold">+C</span>
              </ToolbarButton>
            </Tooltip>
            <Tooltip tooltip={t('shared.contentInput.deleteColumn')}>
              <ToolbarButton
                data-cy="table-delete-column"
                active={false}
                onClick={(e: React.MouseEvent) => {
                  e.preventDefault()
                  editor.chain().focus().deleteColumn().run()
                }}
              >
                <span className="text-[10px] font-bold text-red-500">-C</span>
              </ToolbarButton>
            </Tooltip>
            <Tooltip tooltip={t('shared.contentInput.deleteTable')}>
              <ToolbarButton
                data-cy="table-delete"
                active={false}
                onClick={(e: React.MouseEvent) => {
                  e.preventDefault()
                  editor.chain().focus().deleteTable().run()
                }}
              >
                <span className="text-[10px] font-bold text-red-700">Del</span>
              </ToolbarButton>
            </Tooltip>
          </div>
        )}

        <ToolbarButton
          active={false}
          onClick={(e: React.MouseEvent) => {
            e.preventDefault()
            editor.chain().focus().undo().run()
          }}
          className="mr-3"
        >
          <FontAwesomeIcon icon={faRotateLeft} color="grey" />
        </ToolbarButton>

        <ToolbarButton
          active={false}
          onClick={(e: React.MouseEvent) => {
            e.preventDefault()
            editor.chain().focus().redo().run()
          }}
          className="mr-0.5"
        >
          <FontAwesomeIcon icon={faRotateRight} color="grey" />
        </ToolbarButton>
      </div>

      {isImageDropzoneOpen && (
        <div
          className={twMerge(
            'border-t-0! absolute z-10 flex w-full flex-col rounded-b-md border-2 border-solid bg-white md:flex-row',
            showToolbarOnFocus && 'hidden group-focus-within:flex'
          )}
        >
          <MediaLibrary
            onImageClick={(href, name) => {
              editor.chain().focus().setImage({ src: href, alt: name }).run()
              setIsImageDropzoneOpen(false)
            }}
          />
        </div>
      )}
    </div>
  )
}

const ToolbarButton = React.forwardRef<
  HTMLSpanElement,
  PropsWithChildren<{
    active: boolean
    onClick?: (e: React.MouseEvent<HTMLElement>) => void
    className?: string
    [key: string]: any
  }>
>(({ className, active, onClick, children, ...props }, ref) => (
  <span
    {...props}
    onClick={onClick}
    className={twMerge(
      className,
      'hover:bg-uzh-grey-20 my-auto flex h-7 w-7 cursor-pointer items-center justify-center rounded',
      active && 'bg-uzh-grey-40'
    )}
    ref={ref}
  >
    {children}
  </span>
))
ToolbarButton.displayName = 'ToolbarButton'

export default ContentInput
