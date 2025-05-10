'use strict'

const APIBase = require('./APIBase')
const { HttpsProxyAgent } = require('https-proxy-agent')
const restfulModules = require('./modules/restful')
const { flowRight } = require('./helpers/utils')

// 代理配置
require('dotenv').config()
// const proxyAgent = new HttpsProxyAgent(process.env.QUOTAGUARDSTATIC_URL)

class Spot extends flowRight(...Object.values(restfulModules))(APIBase) {
  constructor(apiKey = '', apiSecret = '', options = {}) {
    options.baseURL = options.baseURL || 'https://api.binance.com'
    // options.httpsAgent = proxyAgent;// 使用代理
    super({
      apiKey,
      apiSecret,
      ...options
    })
  }
}

module.exports = Spot
