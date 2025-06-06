'use strict'

/**
 * API Portfolio Margin endpoints
 * @module PortfolioMargin
 * @param {*} superclass
 */
const PortfolioMargin = superclass => class extends superclass {
  /**
   * Get Portfolio Margin Account Info (USER_DATA)<br>
   *
   * GET /sapi/v1/portfolio/account<br>
   *
   * {@link https://developers.binance.com/docs/derivatives/portfolio-margin-pro/account/Get-Classic-Portfolio-Margin-Account-Info}
   *
   * @param {object} [options]
   * @param {number} [options.recvWindow]
   *
   */
  portfolioMarginAccount (options = {}) {
    return this.signRequest(
      'GET',
      '/sapi/v1/portfolio/account',
      options
    )
  }

  /**
   * Portfolio Margin Collateral Rate (MARKET_DATA)<br>
   *
   * GET /sapi/v1/portfolio/collateralRate<br>
   *
   * {@link https://developers.binance.com/docs/derivatives/portfolio-margin-pro/market-data/Classic-Portfolio-Margin-Collateral-Rate}
   */
  portfolioMarginCollateralRate () {
    return this.publicRequest(
      'GET',
      '/sapi/v1/portfolio/collateralRate'
    )
  }

  /**
   * Query Portfolio Margin Bankruptcy Loan Amount (USER_DATA)<br>
   *
   * GET /sapi/v1/portfolio/pmLoan<br>
   *
   * {@link https://developers.binance.com/docs/derivatives/portfolio-margin-pro/account/Query-Classic-Portfolio-Margin-Bankruptcy-Loan-Amount}
   *
   * @param {object} [options]
   * @param {number} [options.recvWindow] - The value cannot be greater than 60000
   */
  portfolioMarginBankruptcyLoanAmount (options = {}) {
    return this.signRequest(
      'GET',
      '/sapi/v1/portfolio/pmLoan',
      options
    )
  }

  /**
   * Portfolio Margin Bankruptcy Loan Repay (USER_DATA)<br>
   *
   * POST /sapi/v1/portfolio/repay<br>
   *
   * {@link https://developers.binance.com/docs/derivatives/portfolio-margin-pro/account/Classic-Portfolio-Margin-Bankruptcy-Loan-Repay}
   *
   * @param {object} [options]
   * @param {number} [options.recvWindow] - The value cannot be greater than 60000
   */
  portfolioMarginBankruptcyLoanRepay (options = {}) {
    return this.signRequest(
      'POST',
      '/sapi/v1/portfolio/repay',
      options
    )
  }
}

module.exports = PortfolioMargin
