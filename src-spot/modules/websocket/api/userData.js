'use strict'

/**
 * Websocket API user data stream endpoints
 * @module Websocket
 * @param {*} superclass
 */
const UserData = superclass => class extends superclass {
/**
 *
 * Start a new user data stream.<br>
 *
 *
 * {@link https://developers.binance.com/docs/binance-spot-api-docs/web-socket-api#start-user-data-stream-user_stream}
 *
 */
  startUserDataStream () {
    this.sendMessageWithAPIKey('userDataStream.start')
  }

  /**
  * Ping user data stream.< br>
  *
  * Ping a user data stream to keep it alive.<br>
  *
  *
  * {@link https://developers.binance.com/docs/binance-spot-api-docs/web-socket-api#ping-user-data-stream-user_stream}
  *
  * @param {string} listenKey
  *
  */
  pingUserDataStream (listenKey) {
    this.sendMessageWithAPIKey('userDataStream.ping', { listenKey })
  }

  /**
  * Stop user data stream.< br>
  *
  * Explicitly stop and close the user data stream.<br>
  *
  *
  * {@link https://developers.binance.com/docs/binance-spot-api-docs/web-socket-api#stop-user-data-stream-user_stream}
  *
  */
  stopUserDataStream (listenKey) {
    this.sendMessageWithAPIKey('userDataStream.stop', { listenKey })
  }
}
module.exports = UserData
