const { write } = require("../../src-firebase/core/FirebaseBridge");
const SpotTrade = require("../trade/SpotTrade");

const spot = new SpotTrade();

// K線資料參考索引
const KLINE = {
    Opening: 1,     // 開盤價 
    Highest: 2,     // 最高價 
    Lowest: 3,      // 最低價 
    Closing: 4,     // 收盤價 
    Valume: 5,      // 成交額 
    // todo 其他參數可以再補入，這邊單純是Array 的順序 
};

// 時間間距  
const TimeInterval = {
    MINUTES_01: '1m',
    MINUTES_03: '3m',
    MINUTES_05: '5m',
    MINUTES_15: '15m',
    MINUTES_30: '30m',
    HOURS_01: '1h',
    HOURS_02: '2h',
    HOURS_04: '4h',
    HOURS_06: '6h',
    HOURS_08: '8h',
    HOURS_12: '12h',
    DAYS_1: '1d',
    DAYS_3: '3d',
    WEEK_1: '1w',
    MONTH_1: '1M',
};

// 延遲時間
const DelayMins = {
    [TimeInterval.MINUTES_01]: 1,
    [TimeInterval.MINUTES_03]: 3,
    [TimeInterval.MINUTES_05]: 5,
    [TimeInterval.MINUTES_15]: 15,
    [TimeInterval.MINUTES_30]: 30,
    [TimeInterval.HOURS_01]: 60,
    [TimeInterval.HOURS_02]: 2 * 60,
    [TimeInterval.HOURS_04]: 4 * 60,
    [TimeInterval.HOURS_06]: 6 * 60,
    [TimeInterval.HOURS_08]: 8 * 60,
    [TimeInterval.HOURS_12]: 12 * 60,
    [TimeInterval.DAYS_1]: 24 * 60,
    [TimeInterval.DAYS_3]: 3 * 24 * 60,
    [TimeInterval.WEEK_1]: 7 * 24 * 60,
};

class KlineData {
    constructor() {
        this.prices = {};
        this.interval = {};
        this.delayMins = {};
        this.updateTime = {};
    }

    setKlineInterval(symbol, interval) {
        this.interval[symbol] = interval;
        switch (interval) {
            case TimeInterval.MINUTES_05:
                this.delayMins[symbol] = 0.5;
                break;
            case TimeInterval.MINUTES_15:
                this.delayMins[symbol] = DelayMins[TimeInterval.MINUTES_01];
                break;
            case TimeInterval.MINUTES_30:
                this.delayMins[symbol] = DelayMins[TimeInterval.MINUTES_03];
                break;
            case TimeInterval.HOURS_01:
                this.delayMins[symbol] = DelayMins[TimeInterval.MINUTES_05];
                break;
            case TimeInterval.HOURS_04:
                this.delayMins[symbol] = DelayMins[TimeInterval.MINUTES_05];
                break;
            default:
                delete this.delayMins[symbol];
                console.log('不支援這個間隔');
                return;
        }
        // todo ui 要調整可以調不同interval，但目前只讀4hr 的欄位, 只能強制清kline
        this.clearPrices(symbol);
    }

    clearPrices(symbol) {
        this.prices[symbol] = {};
        this.updateTime[symbol] = 0;
    }

    async updatePrices(symbol, limit = 100) {
        const delayMins = this.getKlineDelayMins(symbol);
        const interval = this.interval[symbol];
        const runningMins = this.updateTime[symbol] ? (Date.now() - this.updateTime[symbol]) / 60000 : 0;
        if (runningMins % DelayMins[interval] < delayMins) {
            const cIndex = KLINE.Closing;
            const klineList = await spot.getKlines(symbol, interval, limit);
            // write(`KLINE/${symbol}`, interval, JSON.stringify(klineList.map((kline) => kline.slice(0, 5))));//抓資料0~5，對應KLINE 的順序
            write(`KLINE/${symbol}`, '4hr', JSON.stringify(klineList.map((kline) => kline.slice(0, 5))));//抓資料0~5，對應KLINE 的順序
            // todo 寫4hr 是為了配合UI讀入的資料庫欄位名稱，需要改成能隨UI 修改間隔

            this.prices[symbol] = klineList.map((kline) => parseFloat(kline[cIndex]));
            this.updateTime[symbol] = Date.now();
        } else {
            // 快速更新，只更新最後一筆
            const tickerPrice = await spot.getTickerPrice(symbol);
            this.prices[symbol][limit - 1] = tickerPrice;
        }

        return this.prices[symbol];
    }

    getKlineDelayMins(symbol) {
        return this.delayMins[symbol] || 60;// 保護延遲60分鐘
    }

    getUpdateTime(symbol) {
        return this.updateTime[symbol] || 0;
    }
}

module.exports = KlineData;