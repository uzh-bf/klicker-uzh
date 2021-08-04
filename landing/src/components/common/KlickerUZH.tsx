import React from 'react'

function KlickerUZH({ color, fontSize }) {
  return (
    <span
      className="font-bold"
      style={{
        color,
        fontSize: `${fontSize}rem`,
        lineHeight: `${fontSize}rem`,
      }}
    >
      Klicker
      <span
        className="align-top"
        style={{
          fontSize: `${fontSize / 2}rem`,
          lineHeight: `${fontSize / 2}rem`,
        }}
      >
        UZH
      </span>
    </span>
  )
}

KlickerUZH.defaultProps = { color: '#375164', fontSize: 2 }

export default KlickerUZH
