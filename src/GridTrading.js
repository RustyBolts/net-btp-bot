const { getSymbolPrecision, getExchangeInfo } = require("./trade/ExchangeInfo");
const TelegramCryptoBot = require('../src-telegram-bot/TelegramCryptoBot');
const RecordManager = require("./record/RecordManager");
const StrategyProxy = require("./StrategyProxy");
const SpotLogger = require("./record/SpotLogger");
const SpotTrade = require("./trade/SpotTrade");
const GridStrategyTrade = require("./trade/GridStrategyTrade");
const rm = RecordManager.getInstance();
const logger = new SpotLogger();
const spot = new SpotTrade();
const trade = new GridStrategyTrade();

class GridTrading extends StrategyProxy {
    constructor() {
        super();

        this.cryptoBot = new TelegramCryptoBot(this);
        trade.notify = (message) => this.cryptoBot.notify(message);
    }

    /**
     * 暫停追蹤策略，暫停後可使用 resume 重新啟動
     * @param {string} baseSymbol 
     * @param {string} quoteSymbol 
     * @returns 
     */
    pause(baseSymbol = '', quoteSymbol = '') {
        if (baseSymbol === '' || quoteSymbol === '') {
            // 清除追蹤設定
            trade.clearTrackingIntervalTimeout();

            rm.setCalmRecord(true);
            return;
        }

        const symbol = `${baseSymbol}${quoteSymbol}`;
        trade.clearTrackingIntervalTimeout(symbol);

        rm.setCalmRecord(true, baseSymbol, quoteSymbol);
    }

    /**
     * 恢復追蹤策略
     * @param {string} baseSymbol 
     * @param {string} quoteSymbol 
     */
    async resume(baseSymbol = '', quoteSymbol = '') {
        if (baseSymbol === '' || quoteSymbol === '') {
            rm.setCalmRecord(false);
            this.tracking();
        } else {
            const avgPrice = await trade.queryStockAvgPrice(baseSymbol, quoteSymbol);
            rm.setEntryPrice(avgPrice, baseSymbol, quoteSymbol);
            rm.setCalmRecord(false, baseSymbol, quoteSymbol);
            trade.delayStrategyTracking(baseSymbol, quoteSymbol, 0.5);
        }
    }

    /**
     * 止盈獲利，設定只做賣的交易對，結算後停止交易對追蹤
     * @param {string} baseSymbol 
     * @param {string} quoteSymbol 
     * @param {boolean} onlySell 
     * @param {number} profitRate 
     */
    profit(baseSymbol = '', quoteSymbol = '', onlySell = true, profitRate = 0.01) {
        if (baseSymbol === '' || quoteSymbol === '') {
            const stocks = rm.getAllStocks();
            Object.keys(stocks).forEach((quote) => {
                Object.keys(stocks[quote]).forEach((base) => {
                    this.profit(base, quote, onlySell, profitRate);
                });
            });
        } else {
            const order = rm.getOrder(baseSymbol, quoteSymbol);
            if (onlySell && Object.keys(order).length === 0) {
                // 無訂單時不該做止盈設定
                return;
            }

            rm.setProfitRecord(onlySell, baseSymbol, quoteSymbol);
            onlySell && logger.log(baseSymbol, quoteSymbol, symbol, '已設定只止盈交易');
        }

        // todo profitRate 設定，在最後交易時檢查並決定是否賣出讓最後一單止盈獲利
    }

    /**
     * 清倉結算後停止交易對追蹤，清除資金
     * @param {string} baseSymbol 
     * @param {string} quoteSymbol 
     */
    async stop(baseSymbol = '', quoteSymbol = '') {
        const sellOutResult = async (baseSymbol, quoteSymbol) => {
            await trade.sell(baseSymbol, quoteSymbol);
            trade.clearTicketStock(baseSymbol, quoteSymbol);
            logger.log(baseSymbol, quoteSymbol, baseSymbol, quoteSymbol, '止損清算，停止追蹤策略');
        };
        if (baseSymbol === '' || quoteSymbol === '') {
            const stocks = rm.getAllStocks();
            Object.keys(stocks).forEach((quote) => {
                Object.keys(stocks[quote]).forEach(async (base) => {
                    await sellOutResult(base, quote);
                });
            });
        } else {
            sellOutResult(baseSymbol, quoteSymbol);
        }
    }

    /**
     * 查詢交易對數量
     * @returns 
     */
    query() {
        return trade.queryStocks();
    }

    /**
     * 設定RSI追蹤，同時設定k圖追蹤時間間隔
     * @param {string} baseSymbol 
     * @param {string} quoteSymbol 
     * @param {number} rsiHigh 
     * @param {number} rsiLow 
     * @param {string} interval k線圖時間間隔，輸入樣式如 1m, 5m, 15m, 1h, 4h 
     */
    rsi(baseSymbol = '', quoteSymbol = '', rsiHigh = 70, rsiLow = 30, interval = '4h') {
        if (rsiHigh < 50 || rsiLow > 50) {
            console.log('暫不處理high, low 互換', rsiHigh, rsiLow);
            return;
        }

        if (baseSymbol === '' || quoteSymbol === '') {
            const stocks = rm.getAllStocks();
            Object.keys(stocks).forEach((quote) => {
                Object.keys(stocks[quote]).forEach(async (base) => {
                    this.rsi(base, quote, rsiHigh, rsiLow, interval);
                    await new Promise(resolve => setTimeout(resolve, 1000));
                });
            });
        } else {
            const symbol = `${baseSymbol}${quoteSymbol}`;
            const rsi = { high: rsiHigh, low: rsiLow, interval: interval };
            trade.rsi[symbol] = rsi;
            console.log(symbol, rsiHigh, rsiLow, 'rsi:', rsi);

            trade.setKlineData(baseSymbol, quoteSymbol, interval);
            trade.delayStrategyTracking(baseSymbol, quoteSymbol, 1);

            rm.setRsiRecord({
                baseSymbol, quoteSymbol,
                rsi: rsi,
            });
        }
    }

    /**
     * 填充資金，累加方式補入資金量
     * @param {string} baseSymbol 
     * @param {string} quoteSymbol 
     * @param {number} funds 
     */
    fill(baseSymbol, quoteSymbol, funds) {
        const stockFunds = rm.getFunds(baseSymbol, quoteSymbol);
        funds += stockFunds;
        if (funds < 0) {
            logger.log(baseSymbol, quoteSymbol, baseSymbol, quoteSymbol, '資金為負數，填入資金失敗');
            return;
        }

        trade.setFunds(baseSymbol, quoteSymbol, funds);
    }

    /**
     * 指定交易對以執行策略，帶入可用資金
     * @param {string} baseSymbol 
     * @param {string} quoteSymbol 
     * @param {number} funds 資金
     */
    async execute(baseSymbol, quoteSymbol, funds) {
        rm.setEntryPrice(0, baseSymbol, quoteSymbol);

        const delaySec = 0.5;
        this.fill(baseSymbol, quoteSymbol, funds);
        trade.delayStrategyTracking(baseSymbol, quoteSymbol, delaySec);

        await new Promise(resolve => setTimeout(resolve, delaySec));
    }

    async bid(baseSymbol, quoteSymbol, spent = 0) {
        const symbol = `${baseSymbol}${quoteSymbol}`;
        const tickerPrice = await spot.getTickerPrice(symbol);
        var quantity;
        if (spent > 0) {
            quantity = spent / tickerPrice;
        } else {
            const divide = 5;
            const precision = await getSymbolPrecision(symbol);
            const stepSize = precision.stepSize * 5;// 滑點範圍: 以市價下單會買到為止，價格可能會因此滑坡買到currentPrice 更高的價格，用購入數量來修正 (倉位價格會變高，最後一倉可能不足購入)
            quantity = rm.getFunds(baseSymbol, quoteSymbol) / tickerPrice / divide - stepSize;
        }
        await trade.buy(baseSymbol, quoteSymbol, quantity, tickerPrice, 1);
        logger.log(baseSymbol, quoteSymbol, `[ BID ] ${symbol}`);
    }

    async ask(baseSymbol, quoteSymbol, quantity = 0) {// 先不管數量, 如果要做就是賣出數量，若指定數量比庫存數量多，就彈出警告並由使用者決定是否全賣
        await trade.sell(baseSymbol, quoteSymbol);

        const symbol = `${baseSymbol}${quoteSymbol}`;
        logger.log(baseSymbol, quoteSymbol, `[ ASK ] ${symbol}`);
    }

    /**
     * 追蹤所有交易對，確保執行策略或訂單追蹤
     */
    async tracking() {
        await getExchangeInfo();//先載入一筆交易所資訊

        await rm.waitRead();
        const rsiRecord = rm.getAllRsi();
        Object.keys(rsiRecord).forEach((quoteSymbol) => {
            Object.keys(rsiRecord[quoteSymbol]).forEach((baseSymbol) => {
                const symbol = `${baseSymbol}${quoteSymbol}`;
                trade.rsi[symbol] = rsiRecord[quoteSymbol][baseSymbol];
            });
        });

        const stocks = rm.getAllStocks();
        const orders = rm.getAllOrders();
        const fillingOrders = [];// 未完成訂單
        Object.keys(stocks).forEach((quoteSymbol) => {
            Object.keys(stocks[quoteSymbol]).forEach((baseSymbol, i) => {
                trade.setKlineData(baseSymbol, quoteSymbol, trade.rsi[`${baseSymbol}${quoteSymbol}`]?.interval ?? '4h');

                const symbol = `${baseSymbol}${quoteSymbol}`;
                const tickets = orders[quoteSymbol][baseSymbol];
                const onlySell = stocks[quoteSymbol][baseSymbol].profit ?? false;
                rm.setProfitRecord(onlySell, baseSymbol, quoteSymbol);//有異動才會儲存 onlySell 的線上資料

                // stock
                if (!tickets || Object.keys(tickets).length === 0) {
                    const stockFunds = stocks[quoteSymbol][baseSymbol].funds;
                    logger.log(baseSymbol, quoteSymbol, baseSymbol, quoteSymbol, '資金:', stockFunds);
                    if (stockFunds > 0) {
                        rm.setEntryPrice(0, baseSymbol, quoteSymbol);

                        trade.startTime[symbol] = Date.now();
                        trade.delayStrategyTracking(baseSymbol, quoteSymbol, 0.1 + i);
                    }
                    return;
                }

                // order
                Object.keys(tickets).forEach(async (orderId) => {
                    const orderStatus = tickets[orderId].status;
                    if (orderStatus === 'NEW' || orderStatus === 'PARTIALLY_FILLED') {
                        fillingOrders.push({ [orderId]: [baseSymbol, quoteSymbol] });
                    } else if (orderStatus === 'FILLED') {
                        const avgPrice = await trade.queryStockAvgPrice(baseSymbol, quoteSymbol);
                        rm.setEntryPrice(avgPrice, baseSymbol, quoteSymbol);

                        const stockFunds = stocks[quoteSymbol][baseSymbol].funds;
                        logger.log(baseSymbol, quoteSymbol, baseSymbol, quoteSymbol, '資金:', stockFunds);

                        trade.startTime[symbol] = Date.now();
                        trade.delayStrategyTracking(baseSymbol, quoteSymbol, 0.5 + i);
                    } else {
                        logger.log(baseSymbol, quoteSymbol, orderId, '未知訂單', orderStatus);
                    }
                });
            });
        });

        if (fillingOrders.length > 0) {
            trade.resumeTicketTracking(fillingOrders);
        }

        this.cryptoBot.notify('追蹤網格交易策略...');
    }
}

module.exports = GridTrading;