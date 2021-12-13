import React from 'react'
import Zoom from 'react-medium-image-zoom'
import 'react-medium-image-zoom/dist/styles.css'

function ImageModal({ title, description, src, className }) {
  return (
    <Zoom overlayBgColorEnd="gray">
      <div className="flex flex-col gap-4 p-2 bg-white md:gap-8 md:flex-row">
        <div className="flex-1 p-1 border border-solid rounded md:max-w-[450px]">
          <img src={src} className={className} />
        </div>

        <div className="flex-1 text-base">
          <div className="font-bold">{title}</div>
          <p>{description}</p>
        </div>
      </div>
    </Zoom>
  )
}

ImageModal.Group = function ImageModalGroup({ children }) {
  return <div className="flex flex-col gap-2">{children}</div>
}

export default ImageModal
