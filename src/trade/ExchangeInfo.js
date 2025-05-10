const exchangeInfoCache = {
    data: null,      // 緩存的 exchangeInfo 數據
    lastUpdated: 0,  // 最後更新的時間戳
    cacheTTL: 24 * 60 * 60 * 1000 // 緩存有效時間（毫秒），此處為 1 天
};
// const fs = require("fs");
// const { Console } = require("console");
// const output = fs.createWriteStream("./logs/exchangeInfo.log");
// const logger = new Console({ stdout: output });
// const Spot = require('@binance/connector/src/spot');
const Spot = require('../../src-spot/spot');
const client = new Spot();

var difftime = 0;
async function getServerTime() {
    try {
        // console.log("Local Time:", Date.now());
        const raw = await client.time();
        // console.log("Server Time:", raw.data.serverTime);
        difftime = raw.data.serverTime - Date.now();
        // console.log('時間差:', difftime);
        return difftime;
    } catch (error) {
        // logger.error(error);
    }
}

// 獲取並緩存 exchangeInfo 的函數
async function getExchangeInfo() {
    const now = Date.now();

    // 如果緩存未過期，直接返回緩存數據
    if (exchangeInfoCache.data && (now - exchangeInfoCache.lastUpdated < exchangeInfoCache.cacheTTL)) {
        return exchangeInfoCache.data;
    }

    // 調用 API 更新緩存
    try {
        const exchangeInfo = await client.exchangeInfo();
        exchangeInfoCache.data = exchangeInfo.data;
        exchangeInfoCache.lastUpdated = now;
        // exchangeInfo.data.symbols.forEach(symbolData => logger.log(symbolData));
        return exchangeInfo.data;
    } catch (error) {
        // logger.log("Error fetching exchange info:", error);
        throw error;
    }
}

function getTimestamp() {
    console.log('推送時間戳:', (Date.now() + difftime), '(', difftime, ')');
    return Date.now() + difftime;
}

// 獲取指定交易對的價格精度與數量精度
async function getSymbolPrecision(symbol) {
    try {
        // 獲取緩存的 exchangeInfo
        const exchangeInfo = await getExchangeInfo();

        // 查找指定交易對的精度信息
        const symbolInfo = exchangeInfo.symbols.find(item => item.symbol === symbol);

        if (!symbolInfo) {
            throw new Error(`Symbol ${symbol} not found.`);
        }

        // 返回價格精度與數量精度
        const { baseAssetPrecision, quotePrecision, filters } = symbolInfo;
        const lotSizeFilter = filters.find(filter => filter.filterType === 'LOT_SIZE');
        const tickSizeFilter = filters.find(filter => filter.filterType === 'PRICE_FILTER');

        return {
            pricePrecision: baseAssetPrecision,
            quantityPrecision: quotePrecision,
            minQty: parseFloat(lotSizeFilter.minQty),
            stepSize: parseFloat(lotSizeFilter.stepSize),
            tickSize: parseFloat(tickSizeFilter.tickSize),
        };
    } catch (error) {
        console.error("Error fetching symbol precision:", error);
        throw error;
    }
}

function adjustPrice(price, precisionInfo) {
    const { pricePrecision, quantityPrecision, minQty, stepSize, tickSize } = precisionInfo;

    // 修正價格
    // const adjustedPrice = (Math.floor(price / tickSize) * tickSize).toFixed(pricePrecision);
    const adjustedPrice = (Math.floor(price / tickSize) * tickSize).toFixed(8);//todo avgPrice 在精度方面，官方提供的數字有問題，這邊通用小數點8以下
    return parseFloat(adjustedPrice);
}

function adjustQuantity(quantity, precisionInfo) {
    const { pricePrecision, quantityPrecision, minQty, stepSize, tickSize } = precisionInfo;

    // 修正數量
    const adjustedQuantity = (Math.floor(quantity / stepSize) * stepSize).toFixed(quantityPrecision);

    // 檢查數量是否小於最小交易數量
    if (parseFloat(adjustedQuantity) < minQty) {
        throw new Error(`Quantity ${adjustedQuantity} is less than the minimum allowed ${minQty}`);
    }

    return parseFloat(adjustedQuantity);
}

module.exports = {
    getExchangeInfo,
    getServerTime,
    getTimestamp,
    getSymbolPrecision,
    adjustPrice,
    adjustQuantity,
}