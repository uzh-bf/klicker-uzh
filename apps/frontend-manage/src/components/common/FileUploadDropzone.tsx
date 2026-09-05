import Loader from '@klicker-uzh/shared-components/src/Loader'
import type { ReactNode } from 'react'
import Dropzone, { type FileRejection } from 'react-dropzone'
import { twMerge } from 'tailwind-merge'

interface FileUploadDropzoneProps {
  accept: Record<string, string[]>
  title: ReactNode
  description?: ReactNode
  activeDescription?: ReactNode
  inputAriaLabel?: string
  compact?: boolean
  isUploading?: boolean
  maxSize?: number
  multiple?: boolean
  onDropAccepted: (files: File[]) => void | Promise<void>
  onDropRejected?: (fileRejections: FileRejection[]) => void
  data?: {
    cy?: string
  }
  className?: {
    root?: string
    title?: string
    description?: string
  }
}

export default function FileUploadDropzone({
  accept,
  title,
  description,
  activeDescription,
  inputAriaLabel,
  compact = false,
  isUploading = false,
  maxSize,
  multiple = false,
  onDropAccepted,
  onDropRejected,
  data,
  className,
}: FileUploadDropzoneProps) {
  return (
    <Dropzone
      onDropAccepted={onDropAccepted}
      onDropRejected={onDropRejected}
      multiple={multiple}
      accept={accept}
      maxSize={maxSize}
      disabled={isUploading}
    >
      {({ getRootProps, getInputProps, isDragActive }) => (
        <div
          {...getRootProps({
            className: twMerge(
              'flex-1 p-2',
              isUploading
                ? 'cursor-not-allowed opacity-60'
                : 'hover:cursor-pointer hover:bg-slate-100',
              compact ? 'flex min-h-10 items-center' : 'flex min-h-32 flex-col',
              className?.root
            ),
            'data-cy': data?.cy,
            'aria-busy': isUploading,
            'aria-disabled': isUploading,
            'aria-label': inputAriaLabel,
            role: 'button',
            tabIndex: isUploading ? -1 : 0,
          })}
        >
          <div className={twMerge('font-bold', className?.title)}>
            {compact && isDragActive && activeDescription
              ? activeDescription
              : title}
          </div>
          {!compact && (
            <div className={twMerge('mt-2', className?.description)}>
              {isUploading ? (
                <Loader />
              ) : isDragActive && activeDescription ? (
                activeDescription
              ) : (
                description
              )}
            </div>
          )}
          <input
            type="file"
            {...getInputProps({
              'aria-label': inputAriaLabel,
            })}
          />
        </div>
      )}
    </Dropzone>
  )
}
