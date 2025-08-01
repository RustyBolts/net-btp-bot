const { Console } = require("console");
const fs = require("fs");
const output = fs.createWriteStream("./logs/spot-stdout.log");
const errorOutput = fs.createWriteStream("./logs/spot-stderr.log");
const logger = new Console({ stdout: output, stderr: errorOutput });
const { getTimestamp } = require('./ExchangeInfo');
const Spot = require('../../src-spot/spot');
require('dotenv').config();
const apiKey = process.env.API_KEY;
const secretKey = process.env.SECRET_KEY;
// const client = new Spot(apiKey, secretKey, {});
const client = new Spot(apiKey, secretKey, { logger: logger });

class SpotTrade {

    /**
     * 取得用戶資金
     * @param {string} assetSymbol 
     * @returns 
     */
    async getBalances(assetSymbol) {
        try {
            const result = await client.account({
                timestamp: getTimestamp()
            });
            client.logger.log(result.data);

            // 設定最小資產閾值，過濾小額資產
            const minAssetThreshold = 0.0001;

            // 過濾出 free 和 locked 資產大於閾值的項目
            const balances = result.data.balances.filter(asset =>
                parseFloat(asset.free) >= minAssetThreshold
                || parseFloat(asset.locked) >= minAssetThreshold
            );

            if (assetSymbol) {
                assetSymbol = assetSymbol.toUpperCase();
                const balance = balances.find(asset => asset.asset === assetSymbol);
                if (balance) {
                    return balance;
                }
            }
            return balances;
        } catch (error) {
            client.logger.error(error);
        }
    }

    async marketTrade(symbol, amount, side, type = 'MARKET') {
        try {
            const result = await client.newOrder(symbol, side, type, {
                quantity: amount,
                timestamp: getTimestamp()
            });
            client.logger.log("Spot Trade Result:\n", result.data, "\n");
            return result.data;
        } catch (error) {
            client.logger.error("Error in spot trading:", error);
            // console.log(error.data.code);
            // console.log(error.data.msg);
            // -2015: Invalid API-key, IP, or permissions for action
            // data: {
            //     code: -2015,
            //     msg: 'Invalid API-key, IP, or permissions for action.'
            // }
        }
    }

    async getOrder(symbol, orderId) {
        try {
            const order = await client.getOrder(symbol, {
                orderId,
                timestamp: getTimestamp()
            });
            return order;
        } catch (error) {
            client.logger.error(error);
        }
    }

    async getKlines(symbol, interval = '1m', limit = 500) {
        try {
            const result = await client.klines(symbol, interval, {
                limit: limit,
            });
            client.logger.log("Klines Result:\n", result.data, "\n");
            return result.data;
        } catch (error) {
            client.logger.error(error);
        }
    }

    async getTickerPrice(symbol) {
        try {
            const result = await client.tickerPrice(symbol);
            client.logger.log("Ticker Price:", result.data);
            return parseFloat(result.data.price);
        } catch (error) {
            client.logger.error(error);
        }
    }
}

module.exports = SpotTrade;