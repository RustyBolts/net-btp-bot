'use strict'

const { validateRequiredParameters } = require('../../helpers/validation')

/**
 * API mining endpoints
 * @module Mining
 * @param {*} superclass
 */
const Mining = superclass => class extends superclass {
  /**
   * Acquiring Algorithm (MARKET_DATA)<br>
   *
   * GET /sapi/v1/mining/pub/algoList<br>
   *
   * {@link https://developers.binance.com/docs/mining/rest-api/Acquiring-Algorithm}
   *
   * @param {object} [options]
   * @param {number} [options.recvWindow] - The value cannot be greater than 60000
   */
  miningAlgoList (options = {}) {
    return this.publicRequest(
      'GET',
      '/sapi/v1/mining/pub/algoList',
      options
    )
  }

  /**
   * Acquiring CoinName (MARKET_DATA)<br>
   *
   * GET /sapi/v1/mining/pub/coinList<br>
   *
   * {@link https://developers.binance.com/docs/mining/rest-api/Acquiring-CoinName}
   *
   * @param {object} [options]
   * @param {number} [options.recvWindow] - The value cannot be greater than 60000
   */
  miningCoinList (options = {}) {
    return this.publicRequest(
      'GET',
      '/sapi/v1/mining/pub/coinList',
      options
    )
  }

  /**
   * Request for Detail Miner List (USER_DATA)<br>
   *
   * GET /sapi/v1/mining/worker/detail<br>
   *
   * {@link https://developers.binance.com/docs/mining/rest-api/Request-for-Detail-Miner-List}
   *
   * @param {string} algo
   * @param {string} userName - Mining account
   * @param {string} workerName
   * @param {object} [options]
   * @param {number} [options.recvWindow] - The value cannot be greater than 60000
   */
  miningWorker (algo, userName, workerName, options = {}) {
    validateRequiredParameters({ algo, userName, workerName })
    return this.signRequest(
      'GET',
      '/sapi/v1/mining/worker/detail',
      Object.assign(options, {
        algo,
        userName,
        workerName
      })
    )
  }

  /**
   * Request for Miner List (USER_DATA)<br>
   *
   * GET /sapi/v1/mining/worker/list<br>
   *
   * {@link https://developers.binance.com/docs/mining/rest-api/Request-for-Miner-List}
   *
   * @param {string} algo
   * @param {string} userName - Mining account
   * @param {object} [options]
   * @param {number} [options.pageIndex] - Page number，default is first page, 1
   * @param {number} [options.sort] - sort sequence (default = 0)
   *    <br> 0 positive sequence, 1 negative sequence
   * @param {number} [options.sortColumn] - Sort by (default 1): <br> 1: miner name,
   *    <br> 2: real-time computing power, <br> 3: daily average computing power,
   *    <br> 4: real-time rejection rate, <br> 5: last submission time
   * @param {number} [options.workerStatus] - miners status (default = 0)
   *    <br> 0 all, 1 valid, 2 invalid, 3 failure
   * @param {number} [options.recvWindow] - The value cannot be greater than 60000
   */
  miningWorkerList (algo, userName, options = {}) {
    validateRequiredParameters({ algo, userName })
    return this.signRequest(
      'GET',
      '/sapi/v1/mining/worker/list',
      Object.assign(options, {
        algo,
        userName
      })
    )
  }

  /**
   * Revenue List (USER_DATA)<br>
   *
   * GET /sapi/v1/mining/payment/list<br>
   *
   * {@link https://developers.binance.com/docs/mining/rest-api/Earnings-List}
   *
   * @param {string} algo
   * @param {string} userName - Mining account
   * @param {object} [options]
   * @param {string} [options.coin]
   * @param {number} [options.startDate]
   * @param {number} [options.endDate]
   * @param {number} [options.pageIndex] - Page number，default is first page, 1
   * @param {number} [options.pageSize] - minimum 10, maximum 200
   * @param {number} [options.recvWindow] - The value cannot be greater than 60000
   */
  miningRevenueList (algo, userName, options = {}) {
    validateRequiredParameters({ algo, userName })
    return this.signRequest(
      'GET',
      '/sapi/v1/mining/payment/list',
      Object.assign(options, {
        algo,
        userName
      })
    )
  }

  /**
   * Extra Bonus List (USER_DATA)<br>
   *
   * GET /sapi/v1/mining/payment/other<br>
   *
   * {@link https://developers.binance.com/docs/mining/rest-api/Extra-Bonus-List}
   *
   * @param {string} algo
   * @param {string} userName
   * @param {object} [options]
   * @param {string} [options.coin]
   * @param {number} [options.startDate]
   * @param {number} [options.endDate]
   * @param {number} [options.pageIndex] - Page number，default is first page, 1
   * @param {number} [options.pageSize] - minimum 10, maximum 200
   * @param {number} [options.recvWindow] - The value cannot be greater than 60000
   */
  miningBonusList (algo, userName, options = {}) {
    validateRequiredParameters({ algo, userName })
    return this.signRequest(
      'GET',
      '/sapi/v1/mining/payment/other',
      Object.assign(options, {
        algo,
        userName
      })
    )
  }

  /**
   * Hashrate Resale List (USER_DATA)<br>
   *
   * GET /sapi/v1/mining/hash-transfer/config/details/list<br>
   *
   * {@link https://developers.binance.com/docs/mining/rest-api/Hashrate-Resale-List}
   *
   * @param {object} [options]
   * @param {number} [options.pageIndex] - Page number，default is first page, 1
   * @param {number} [options.pageSize] - minimum 10, maximum 200
   * @param {number} [options.recvWindow] - The value cannot be greater than 60000
   */
  miningHashrateResaleList (options = {}) {
    return this.signRequest(
      'GET',
      '/sapi/v1/mining/hash-transfer/config/details/list',
      options
    )
  }

  /**
   * Hashrate Resale Detail (USER_DATA)<br>
   *
   * GET /sapi/v1/mining/hash-transfer/profit/details<br>
   *
   * {@link https://developers.binance.com/docs/mining/rest-api/Hashrate-Resale-Detail}
   *
   * @param {number} configId - Mining ID
   * @param {string} userName - Mining Account
   * @param {object} [options]
   * @param {number} [options.pageIndex] - Page number，default is first page, 1
   * @param {number} [options.pageSize] - minimum 10, maximum 200
   * @param {number} [options.recvWindow] - The value cannot be greater than 60000
   */
  miningHashrateResaleDetail (configId, userName, options = {}) {
    validateRequiredParameters({ configId, userName })
    return this.signRequest(
      'GET',
      '/sapi/v1/mining/hash-transfer/profit/details',
      Object.assign(options, {
        configId,
        userName
      })
    )
  }

  /**
   * Hashrate Resale Request (USER_DATA)<br>
   *
   * POST /sapi/v1/mining/hash-transfer/config<br>
   *
   * {@link https://developers.binance.com/docs/mining/rest-api/Hashrate-Resale-Request}
   *
   * @param {string} userName - Mining Account
   * @param {string} algo
   * @param {number} startDate
   * @param {number} endDate
   * @param {string} toPoolUser - Mining Account
   * @param {number} hashRate - Resale hashrate h/s must be transferred
   * @param {object} [options]
   * @param {number} [options.recvWindow] - The value cannot be greater than 60000
   */
  miningHashrateResaleRequest (userName, algo, startDate, endDate,
    toPoolUser, hashRate, options = {}) {
    validateRequiredParameters({
      userName,
      algo,
      startDate,
      endDate,
      toPoolUser,
      hashRate
    })

    return this.signRequest(
      'POST',
      '/sapi/v1/mining/hash-transfer/config',
      Object.assign(options, {
        userName,
        algo,
        startDate,
        endDate,
        toPoolUser,
        hashRate
      })
    )
  }

  /**
   * Hashrate Resale Detail (USER_DATA)<br>
   *
   * POST /sapi/v1/mining/hash-transfer/config/cancel<br>
   *
   * {@link https://developers.binance.com/docs/mining/rest-api/Cancel-hashrate-resale-configuration}
   *
   * @param {number} configId - Mining ID
   * @param {string} userName
   * @param {object} [options]
   * @param {number} [options.recvWindow] - The value cannot be greater than 60000
   */
  miningHashrateResaleCancel (configId, userName, options = {}) {
    validateRequiredParameters({ configId, userName })
    return this.signRequest(
      'POST',
      '/sapi/v1/mining/hash-transfer/config/cancel',
      Object.assign(options, {
        configId,
        userName
      })
    )
  }

  /**
   * Statistic List (USER_DATA)<br>
   *
   * GET /sapi/v1/mining/statistics/user/status<br>
   *
   * {@link https://developers.binance.com/docs/mining/rest-api/Statistic-List}
   *
   * @param {string} algo
   * @param {string} userName - Mining account
   * @param {object} [options]
   * @param {number} [options.recvWindow] - The value cannot be greater than 60000
   */
  miningStatisticList (algo, userName, options = {}) {
    validateRequiredParameters({ algo, userName })
    return this.signRequest(
      'GET',
      '/sapi/v1/mining/statistics/user/status',
      Object.assign(options, {
        algo,
        userName
      })
    )
  }

  /**
   * Account List (USER_DATA)<br>
   *
   * GET /sapi/v1/mining/statistics/user/list<br>
   *
   * {@link https://developers.binance.com/docs/mining/rest-api/Account-List}
   *
   * @param {string} algo
   * @param {string} userName - Mining account
   * @param {object} [options]
   * @param {number} [options.recvWindow] - The value cannot be greater than 60000
   */
  miningAccountList (algo, userName, options = {}) {
    validateRequiredParameters({ algo, userName })
    return this.signRequest(
      'GET',
      '/sapi/v1/mining/statistics/user/list',
      Object.assign(options, {
        algo,
        userName
      })
    )
  }

  /**
   * Mining Account Earning (USER_DATA)<br>
   *
   * GET /sapi/v1/mining/payment/uid<br>
   *
   * {@link https://developers.binance.com/docs/mining/rest-api/Mining-Account-Earning}
   *
   * @param {string} algo - Algorithm(sha256)
   * @param {object} [options]
   * @param {number} [options.startDate] - Millisecond timestamp
   * @param {number} [options.endDate] - Millisecond timestamp
   * @param {number} [options.pageIndex] - Default 1
   * @param {number} [options.pageSize] - Min 10,Max 200
   * @param {number} [options.recvWindow] - The value cannot be greater than 60000
   */
  miningAccountEarning (algo, options = {}) {
    validateRequiredParameters({ algo })
    return this.signRequest(
      'GET',
      '/sapi/v1/mining/payment/uid',
      Object.assign(options, {
        algo
      })
    )
  }
}

module.exports = Mining
