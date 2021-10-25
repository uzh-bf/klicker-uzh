import React from 'react'
import Image from 'next/image'

import KlickerUZHLogoSrc from '../../../public/img/KlickerUZH_Gray.png'

function KlickerLogo({ width }) {
  return (
    <span
      className="relative"
      style={{
        // height: 'auto',
        width,
      }}
    >
      <Image
        src={KlickerUZHLogoSrc}
        layout="fixed"
        alt="KlickerUZH Logo"
        height={width / 3}
        width={width}
      />
    </span>
  )
}

KlickerLogo.defaultProps = { width: 100 }

export default KlickerLogo
