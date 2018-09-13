import React from 'react'

const KlickerUZH = ({ fontSize }) => (
  <span className="logo">
    Klicker
    <span className="high">UZH</span>
    <style jsx>{`
      .logo {
        font-size: ${fontSize}rem;
      }

      .logo > .high {
        font-size: ${fontSize / 2}rem;
        vertical-align: top;
      }
    `}</style>
  </span>
)

KlickerUZH.defaultProps = { fontSize: 2 }

export default KlickerUZH
