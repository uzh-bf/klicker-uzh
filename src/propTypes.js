import PropTypes from 'prop-types'

export const statisticsShape = PropTypes.shape({
  max: PropTypes.number.isRequired,
  mean: PropTypes.number.isRequired,
  median: PropTypes.number.isRequired,
  min: PropTypes.number.isRequired,
})

export const sessionStatusShape = PropTypes.oneOf(['CREATED', 'RUNNING', 'COMPLETED'])
