import React from 'react'

function KlickerLogo({ width }) {
  return <img src="img/KlickerUZH_Gray.png" height={width / 3} width={width} />
}

KlickerLogo.defaultProps = { width: 100 }

export default KlickerLogo
