import { Attachment } from '@klicker-uzh/graphql/dist/ops'
import { Button, Modal } from '@uzh-bf/design-system'
import Image from 'next/image'
import React, { useState } from 'react'

export interface QuestionAttachmentProps {
  attachment: Attachment
}

export function QuestionAttachment({
  attachment,
}: QuestionAttachmentProps): React.ReactElement {
  const [isOpen, setIsOpen] = useState(false)

  switch (attachment.type) {
    case 'JPEG':
    case 'PNG':
    case 'SVG':
    case 'WEBP':
    case 'LINK':
    case 'GIF':
      return (
        <Modal
          open={isOpen}
          trigger={
            <Button
              onClick={() => setIsOpen(true)}
              className={{ root: 'w-full h-full border-0' }}
            >
              <Image
                src={attachment.href}
                className="object-contain"
                fill
                alt={attachment.name}
              />
            </Button>
          }
          onClose={() => setIsOpen(false)}
        >
          <div className="relative flex flex-col justify-center w-full h-full text-center">
            <Image
              src={attachment.href}
              className="object-contain"
              fill
              alt={attachment.name}
            />
          </div>
        </Modal>
      )

    default:
      return <div>{attachment.name}</div>
  }
}

export default QuestionAttachment
