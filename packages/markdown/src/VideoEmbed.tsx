import React from 'react'
import { getVideoEmbedSrc, type VideoEmbedDescriptor } from './VideoEmbedUrl.js'

export function VideoEmbed(
  descriptor: VideoEmbedDescriptor
): React.ReactElement {
  const providerName = descriptor.provider === 'youtube' ? 'YouTube' : 'Kaltura'

  return (
    <span className="my-4 block aspect-video w-full overflow-hidden rounded-md border border-slate-200">
      <iframe
        title={`${providerName} video player`}
        src={getVideoEmbedSrc(descriptor)}
        className="h-full w-full border-0"
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
        allowFullScreen
        loading="lazy"
      />
    </span>
  )
}
