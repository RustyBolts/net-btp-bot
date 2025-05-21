const { getSymbolPrecision, getExchangeInfo } = require("./trade/ExchangeInfo");
const StrategyProxy = require("./StrategyProxy");
const SpotLogger = require("./record/SpotLogger");
const GridStrategyTrade = require("./trade/GridStrategyTrade");
const SpotTrade = require("./trade/SpotTrade");
const logger = new SpotLogger();
const spot = new SpotTrade();
const trade = new GridStrategyTrade();

class GridTrading extends StrategyProxy {
    constructor() {
        super();

        trade.notify = (message) => {
            console.log('TG BOT:', message);
            this.notify(message);
        };
    }

    /**
     * 暫停追蹤策略，暫停後可使用 resume 重新啟動
     * @param {string} baseSymbol 
     * @param {string} quoteSymbol 
     * @returns 
     */
    pause(baseSymbol = '', quoteSymbol = '') {
        if (baseSymbol === '' || quoteSymbol === '') {
            // 重置追蹤執行時間
            trade.resetRunningTime();

            // 清除追蹤設定
            trade.clearTrackingIntervalTimeout();
            trade.kline4hrPrices = {};

            trade.calm(true);
            return;
        }

        const symbol = `${baseSymbol}${quoteSymbol}`;
        trade.resetRunningTime(symbol);
        trade.kline4hrPrices[symbol] = {};
        trade.clearTrackingIntervalTimeout(symbol);

        trade.calm(true, baseSymbol, quoteSymbol);
    }

    /**
     * 恢復追蹤策略
     * @param {string} baseSymbol 
     * @param {string} quoteSymbol 
     */
    async resume(baseSymbol = '', quoteSymbol = '') {
        if (baseSymbol === '' || quoteSymbol === '') {
            trade.calm(false);
            this.tracking();
        } else {
            const symbol = `${baseSymbol}${quoteSymbol}`;
            trade.resetRunningTime(symbol);
            trade.kline4hrPrices[symbol] = {};

            const avgPrice = await trade.resultBidTicket(baseSymbol, quoteSymbol, false);
            trade.entryPrice[symbol] = avgPrice;

            trade.calm(false, baseSymbol, quoteSymbol);
            trade.delayStrategyTracking(baseSymbol, quoteSymbol, 0.5, 0);
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
            const stock = trade.stock();
            Object.keys(stock).forEach((quote) => {
                Object.keys(stock[quote]).forEach((base) => {
                    this.profit(base, quote, onlySell, profitRate);
                });
            });
        } else {
            const orders = trade.order(baseSymbol, quoteSymbol);
            if (onlySell && Object.keys(orders).length === 0) {
                // 無訂單時不該做止盈設定
                return;
            }

            trade.profit(onlySell, baseSymbol, quoteSymbol);
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
            const stock = trade.stock();
            Object.keys(stock).forEach((quote) => {
                Object.keys(stock[quote]).forEach(async (base) => {
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
        const stocks = trade.stock();
        const result = {};
        Object.keys(stocks).forEach((quoteSymbol) => {
            Object.keys(stocks[quoteSymbol]).forEach((baseSymbol) => {
                const symbol = `${baseSymbol}${quoteSymbol}`;
                result[symbol] = {
                    base: trade.getAvailableGoods(baseSymbol, quoteSymbol),
                    quote: trade.getAvailableFunds(baseSymbol, quoteSymbol),
                };
            });
        });
        return result;
    }

    /**
     * 設定RSI追蹤
     * @param {string} baseSymbol 
     * @param {string} quoteSymbol 
     * @param {number} rsiHigh 
     * @param {number} rsiLow 
     */
    rsi(baseSymbol = '', quoteSymbol = '', rsiHigh = 70, rsiLow = 30) {
        if (rsiHigh < 50 || rsiLow > 50) {
            console.log('暫不處理high, low 互換', rsiHigh, rsiLow);
            return;
        }

        if (baseSymbol === '' || quoteSymbol === '') {
            const stock = trade.stock();
            Object.keys(stock).forEach((quote) => {
                Object.keys(stock[quote]).forEach(async (base) => {
                    const symbol = `${base}${quote}`;
                    trade.rsi[symbol] = { high: rsiHigh, low: rsiLow };
                    // console.log(symbol, rsiHigh, rsiLow);
                });
            });
        } else {
            const symbol = `${baseSymbol}${quoteSymbol}`;
            trade.rsi[symbol] = { high: rsiHigh, low: rsiLow };
            // console.log(symbol, rsiHigh, rsiLow);
        }
    }

    /**
     * 填充資金，累加方式補入資金量
     * @param {string} baseSymbol 
     * @param {string} quoteSymbol 
     * @param {number} funds 
     */
    fill(baseSymbol, quoteSymbol, funds) {
        const stockFunds = trade.funds(baseSymbol, quoteSymbol);
        funds += stockFunds;
        if (funds < 0) {
            logger.log(baseSymbol, quoteSymbol, baseSymbol, quoteSymbol, '資金為負數，填入資金失敗');
            return;
        }

        trade.write(baseSymbol, quoteSymbol, funds);
    }

    /**
     * 指定交易對以執行策略，帶入可用資金
     * @param {string} baseSymbol 
     * @param {string} quoteSymbol 
     * @param {number} funds 資金
     */
    async execute(baseSymbol, quoteSymbol, funds) {
        const symbol = `${baseSymbol}${quoteSymbol}`;
        trade.entryPrice[symbol] = 0;
        trade.resetRunningTime(symbol);

        const delaySec = 0.5;
        this.fill(baseSymbol, quoteSymbol, funds);
        trade.delayStrategyTracking(baseSymbol, quoteSymbol, delaySec, 0);

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
            quantity = trade.funds(baseSymbol, quoteSymbol) / tickerPrice / divide - stepSize;
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

        await trade.read();

        const stocks = trade.stock();
        const orders = trade.order();
        const fillingOrders = [];// 未完成訂單
        Object.keys(stocks).forEach((quoteSymbol) => {
            Object.keys(stocks[quoteSymbol]).forEach((baseSymbol, i) => {
                const symbol = `${baseSymbol}${quoteSymbol}`;
                // if (stocks[quoteSymbol][baseSymbol].calm === true) {
                //     return;
                // }

                const tickets = orders[quoteSymbol][baseSymbol];
                const onlySell = stocks[quoteSymbol][baseSymbol].profit ?? false;
                trade.onlySell[symbol] = onlySell;

                // stock
                if (!tickets || Object.keys(tickets).length === 0) {
                    const stockFunds = stocks[quoteSymbol][baseSymbol].funds;
                    logger.log(baseSymbol, quoteSymbol, baseSymbol, quoteSymbol, '資金:', stockFunds);
                    if (stockFunds > 0) {
                        trade.resetRunningTime(symbol);
                        trade.entryPrice[symbol] = 0;

                        trade.delayStrategyTracking(baseSymbol, quoteSymbol, 0.1 + i, 0);
                    }
                    return;
                }

                // order
                Object.keys(tickets).forEach(async (orderId) => {
                    const orderStatus = tickets[orderId].status;
                    if (orderStatus === 'NEW' || orderStatus === 'PARTIALLY_FILLED') {
                        fillingOrders.push({ [orderId]: [baseSymbol, quoteSymbol] });

                        trade.delayTicketTracking(fillingOrders, 0.5);
                    } else if (orderStatus === 'FILLED') {
                        const avgPrice = await trade.resultBidTicket(baseSymbol, quoteSymbol, false);

                        trade.resetRunningTime(symbol);
                        trade.entryPrice[symbol] = avgPrice;

                        const stockFunds = stocks[quoteSymbol][baseSymbol].funds;
                        logger.log(baseSymbol, quoteSymbol, baseSymbol, quoteSymbol, '資金:', stockFunds);

                        trade.delayStrategyTracking(baseSymbol, quoteSymbol, 0.5 + i, 0);
                    } else {
                        logger.log(baseSymbol, quoteSymbol, orderId, '未知訂單', orderStatus);
                    }
                });
            });
        });

        this.notify('追蹤網格交易策略...');
    }
}

module.exports = GridTrading;