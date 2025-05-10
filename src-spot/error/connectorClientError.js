'use strict'

const Error = require('./error')

class ConnectorClientError extends Error {
  constructor (errorMessage) {
    super(errorMessage)
    this.name = 'ConnectorClientError'
  }
}

module.exports = ConnectorClientError
