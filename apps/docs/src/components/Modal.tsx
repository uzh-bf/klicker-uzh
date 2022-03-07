import React, { useState } from 'react'
import { Dialog } from '@headlessui/react'

function Modal({ imgSrc, caption }) {
  let [isOpen, setIsOpen] = useState(true)

  return (
    <Dialog open={isOpen} onClose={() => setIsOpen(false)}>
      <Dialog.Overlay />
      <Dialog.Title>{caption}</Dialog.Title>
      <Dialog.Description>
        <img src={imgSrc} />
      </Dialog.Description>
    </Dialog>
  )
}

export default Modal
