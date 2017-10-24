import React from 'react'
import PropTypes from 'prop-types'
import { Message } from 'semantic-ui-react'

const propTypes = {
  message: PropTypes.string.isRequired,
}

const Messager = ({ message }) => (
  <div className="messager">
    <Message>{message}</Message>

    <style jsx>{`
      .messager {
        padding: 1rem;
      }
    `}</style>
  </div>
)

Messager.propTypes = propTypes

export default Messager
