import React from 'react'

function KlickerUZH({ color, fontSize }) {
  return (
    <span className="logo">
      Klicker
      <span className="high">UZH</span>
      <style jsx>{`
        .logo {
          color: ${color};
          font-size: ${fontSize}rem;
          font-weight: bold;
          line-height: ${fontSize}rem;
        }

        .logo > .high {
          font-size: ${fontSize / 2}rem;
          line-height: ${fontSize / 2}rem;
          vertical-align: top;
        }
      `}</style>
    </span>
  )
}

KlickerUZH.defaultProps = { color: '#375164', fontSize: 2 }

export default KlickerUZH
