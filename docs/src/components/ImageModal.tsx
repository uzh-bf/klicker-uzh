import React from 'react'

function ImageModal({ title, description, src }) {
  return (
    <div className="flex flex-row gap-4">
      <div className="flex-initial w-48 p-1 border border-solid rounded md:w-96">
        <img src={src} />
      </div>
      <div className="flex-1 text-sm">
        <div className="font-bold">{title}</div>
        <p>{description}</p>
      </div>
    </div>
  )
}

export default ImageModal
