import React from 'react'
import Zoom from 'react-medium-image-zoom'
import Image from '@theme/IdealImage'
import 'react-medium-image-zoom/dist/styles.css'

function ImageModal({ title, description, src, className }) {
  return (
    <Zoom overlayBgColorEnd="gray">
      <div className="flex flex-col bg-white md:p-2 md:gap-8 md:flex-row">
        <div className="order-2 md:order-1 flex-1 p-1 border border-gray-300 border-solid rounded md:max-w-[450px]">
          <Image img={src} className={className} />
        </div>

        <div className="flex-1 order-1 text-base md:order-2">
          <div className="font-bold">{title}</div>
          <p>{description}</p>
        </div>
      </div>
    </Zoom>
  )
}

ImageModal.Group = function ImageModalGroup({ children }) {
  return <div className="flex flex-col gap-8 md:gap-0">{children}</div>
}

export default ImageModal
