import Image from '@theme/IdealImage'
import React from 'react'
import Zoom from 'react-medium-image-zoom'
import 'react-medium-image-zoom/dist/styles.css'

function ImageModal({ title, description, src, className }) {
  return (
    <Zoom>
      <div className="flex flex-col bg-white md:flex-row md:gap-8 md:p-2">
        <div className="order-2 flex-1 rounded border border-solid border-gray-300 p-1 md:order-1 md:max-w-[450px]">
          <Image img={src} className={className} />
        </div>

        <div className="order-1 flex-1 text-base md:order-2">
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
