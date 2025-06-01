const { getSymbolPrecision } = require("./ExchangeInfo");
const { write } = require("../../src-firebase/core/FirebaseBridge");
const RecordManager = require("../record/RecordManager");
const SpotLogger = require("../record/SpotLogger");
const TradingStrategy = require("../strategy/TradingStrategy");
const KlineData = require("../record/KlineData");
const MarketTicket = require("./MarketTicket");
const rm = RecordManager.getInstance();
const logger = new SpotLogger();
const strategy = new TradingStrategy();
const kline = new KlineData();
const ticket = new MarketTicket();

class GridStrategyTrade {
    constructor() {
        this.trackingInterval = {};

        this.rsi = {};
        this.startTime = {};// 交易對啟動時間
        this.maxLossPercentage = 0.06;// 最大損失比例
    }

    setFunds(baseSymbol, quoteSymbol, funds) {
        rm.setStockRecord({
            baseSymbol, quoteSymbol,
            funds: funds,
            profit: rm.getProfitStatus(baseSymbol, quoteSymbol),
            calm: false,
        });

        ticket.logcat(baseSymbol, quoteSymbol);
    }

    setKlineData(baseSymbol, quoteSymbol, timeInterval = '4hr') {
        kline.setKlineInterval(`${baseSymbol}${quoteSymbol}`, timeInterval);
    }

    queryStocks() {
        const result = {};
        const stocks = rm.getAllStocks();
        Object.keys(stocks).forEach((quoteSymbol) => {
            Object.keys(stocks[quoteSymbol]).forEach((baseSymbol) => {
                const symbol = `${baseSymbol}${quoteSymbol}`;
                result[symbol] = {
                    base: ticket.getAvailableGoods(baseSymbol, quoteSymbol),
                    quote: ticket.getAvailableFunds(baseSymbol, quoteSymbol),
                };
            });
        });
        return result;
    }

    async queryStockAvgPrice(baseSymbol, quoteSymbol) {
        const avgPrice = await ticket.resultBidTicket(baseSymbol, quoteSymbol, false);
        return avgPrice;
    }

    /**
     * 下訂單後未完成，執行追蹤訂單後完成，進入交易追蹤流程
     * @param {object[]} fillingOrders 
     */
    resumeTicketTracking(fillingOrders) {
        ticket.delayTicketTracking(fillingOrders, 0.5, (baseSymbol, quoteSymbol) => {
            // 開始追蹤交易倉位
            this.delayStrategyTracking(baseSymbol, quoteSymbol, 0.1);
        });
    }

    /**
     * 追蹤交易策略，並根據策略決定是否進行交易
     * @param {string} baseSymbol 
     * @param {string} quoteSymbol 
     */
    async strategyTracking(baseSymbol, quoteSymbol) {
        const log = (...message) => logger.log(baseSymbol, quoteSymbol, ...message);

        const symbol = `${baseSymbol}${quoteSymbol}`;
        const prices = await kline.updatePrices(symbol, 100);
        const currentPrice = prices[prices.length - 1];

        const rsiHigh = this.rsi[symbol]?.high || 60;
        const rsiLow = this.rsi[symbol]?.low || 40;
        const runningTime = Date.now() - this.startTime[symbol];

        // 輸入秒數，轉成時分秒
        const timeStr = new Date(runningTime).toISOString().substring(11, 19);
        log(symbol, rm.getProfitStatus(baseSymbol, quoteSymbol) ? '====ONLY_SELL====' : `================= 已運行`, timeStr);

        var delayMins = kline.getKlineDelayMins(symbol);
        var trackType = 'strategy';
        var entryPrice = rm.getEntryPrice(baseSymbol, quoteSymbol);
        const options = { rsiLow, rsiHigh, maxLossPercentage: this.maxLossPercentage };
        const {
            action,
            trend,
            rsi,
            bollingerBands,
            fibonacciLevels
        } = strategy.determineTradeAction(log, prices, currentPrice, entryPrice, options);
        const isPause = rm.getStock(baseSymbol, quoteSymbol).calm;
        if (isPause) {
            log('[ CALM ', action, ']', symbol, 'XXXX');
            trackType = 'calm';
            delayMins *= 5;
        }
        else if (action === 'GAZE') {
            log('[', action, ']', symbol);
            delayMins /= 5;
        }
        else if (
            action === 'STOP_LOSS'
            || (action === 'DOWN_TREND' && this.checkEerlyStopLoss(baseSymbol, quoteSymbol, currentPrice))
        ) {
            log('[', action, ']', symbol, '止損出清流程');
            trackType = await this.sell(baseSymbol, quoteSymbol);
            this.notify(`${symbol}執行止損,止損價格:${currentPrice.toFixed(2)} ${quoteSymbol}`);
        }
        else if (action === 'SELL') {
            log('[', action, ']', symbol);
            trackType = await this.sell(baseSymbol, quoteSymbol);
        }
        else if (action === 'BUY' || action === 'SUPPLY') {
            const step = {
                'BUY': 0.95,
                'SUPPLY': 0.9,
                // 'BUCKET': 0.5,
            };
            const divide = 5;
            const precision = await getSymbolPrecision(symbol);
            const slippage = precision.tickSize * 5;// 滑點範圍: 以市價下單會買到為止，價格可能會因此滑坡買到currentPrice 更高的價格，用購入數量來修正 (倉位價格會變高，最後一倉可能不足購入)
            const quantity = rm.getFunds(baseSymbol, quoteSymbol) / (currentPrice + slippage) / divide;// 修正數量，市價買入時可能會滑坡，造成購入價格平均比預算高一點點，這邊先調整一下讓5等分能正常分倉買入
            // log('修正數量:', quantity - precision.stepSize);
            log('[', action, ']', quantity, baseSymbol);
            trackType = await this.buy(baseSymbol, quoteSymbol, quantity, currentPrice, step[action]);
        }
        else if (action === 'OVER_BOUGHT' || action === 'BUCKET') {
            log('[', action, ']', symbol);

            // 機器人通知
            this.notify(`${action} ${symbol} ，手動做單提醒!`);
            delayMins /= 2;
        }
        else {
            log('[', action, ']', symbol, '>>>');
        }

        entryPrice = rm.getEntryPrice(baseSymbol, quoteSymbol);
        if (entryPrice) {
            const qty = ticket.getAvailableGoods(baseSymbol, quoteSymbol);
            const diff = currentPrice - entryPrice;
            const value = diff * qty;
            log('未實現盈虧:', value.toFixed(6), '(', (diff / entryPrice * 100).toFixed(2), '%)');
        }

        write('STOCK', symbol, JSON.stringify({
            action, trend, rsi, bollingerBands, fibonacciLevels,
            currentPrice, entryPrice,
        }));

        console.log('\n');

        const delaySec = 60 * delayMins;
        if (trackType === 'ticket') {
            setTimeout(() => this.tracking(), delaySec * 1000);
        } else if (trackType === 'strategy') {
            this.delayStrategyTracking(baseSymbol, quoteSymbol, delaySec);
        } else if (trackType === 'calm') {
            this.delayStrategyTracking(baseSymbol, quoteSymbol, delaySec);
        }
    }

    /**
     * 延遲追蹤交易策略
     * @param {string} baseSymbol 
     * @param {string} quoteSymbol 
     * @param {number} delaySec 延遲秒數
     */
    delayStrategyTracking(baseSymbol, quoteSymbol, delaySec) {
        const symbol = `${baseSymbol}${quoteSymbol}`;
        this.clearTrackingIntervalTimeout(symbol);
        this.trackingInterval[symbol] = setTimeout(() => {
            this.strategyTracking(baseSymbol, quoteSymbol);
        }, delaySec * 1000);
    }

    clearTrackingIntervalTimeout(symbol) {
        if (symbol) {
            if (this.trackingInterval[symbol]) {
                clearTimeout(this.trackingInterval[symbol]);
            }
            return;
        }
        Object.keys(this.trackingInterval).forEach((symbol) => {
            this.clearTrackingIntervalTimeout(symbol);
        });
    }

    // 檢查是否提前認賠止損
    checkEerlyStopLoss(baseSymbol, quoteSymbol, currentPrice) {
        var stopLoss = false;
        const order = rm.getOrder(baseSymbol, quoteSymbol);
        if (order) {
            const now = Date.now();
            const stockTimeouts = Object.keys(order).map((orderId) => {
                const orderTicket = order[orderId];
                const orderStatus = orderTicket.status;
                if (orderStatus === 'FILLED') {
                    return now - orderTicket.transactTime;
                }
                return 0;// 只處理立即 FILLED 單
            });

            const log = (...message) => logger.log(baseSymbol, quoteSymbol, ...message);
            log(stockTimeouts);
            const last = stockTimeouts.sort((a, b) => b - a)[0];
            const entryPrice = rm.getEntryPrice(baseSymbol, quoteSymbol);
            if (last && entryPrice) {
                const diff = currentPrice - entryPrice;
                const percentage = diff / entryPrice;
                if (percentage <= -this.maxLossPercentage) return true;

                const hours = last / (60 * 60 * 1000);
                let i = 18;
                for (; i > 0; i--) {
                    if (hours > i * 4) stopLoss = percentage > 0.03 - 0.005 * i;
                    if (stopLoss) break;
                }
                stopLoss ? log(hours, '執行提前止盈止損') : log(hours, '延時檢查止盈止損');
            }
        }
        return stopLoss;
    }

    /**
     * 下訂買入掛單
     * @param {string} baseSymbol 
     * @param {string} quoteSymbol 
     * @param {number} quantity 
     * @param {number} tickerPrice 
     * @param {number} step 倉位間隔，預設1
     * @returns 
     */
    async buy(baseSymbol, quoteSymbol, quantity, tickerPrice, step = 1) {
        const log = (...message) => logger.log(baseSymbol, quoteSymbol, ...message);
        if (rm.getProfitStatus(baseSymbol, quoteSymbol)) {
            log('止盈限價，不進行買入');
            return 'strategy';
        }

        // 多筆分倉的情況下，盡可能讓每一筆越買越低價，避免符合購入的條件一直買入
        const entryPrice = rm.getEntryPrice(baseSymbol, quoteSymbol);
        if (entryPrice > 0 && entryPrice * step < tickerPrice) {
            // 沒有越買越低，跳掉
            log('買入目標價格:', entryPrice * step, quoteSymbol);
            return 'strategy';
        }

        // 先檢查是否有足夠資金
        const funds = ticket.getAvailableFunds(baseSymbol, quoteSymbol);
        const value = tickerPrice * quantity;
        if (funds < value) {
            log('剩餘資金:', funds, quoteSymbol, '不足購入');
            return 'strategy';
        }

        const result = await ticket.bidTicket(baseSymbol, quoteSymbol, quantity, value);
        switch (result) {
            case 'filling':
                log('交易中...');
                return 'ticket';

            case 'filled':
                log('交易成功');

                break;
            case 'failed':
                log('交易失敗');
                this.notify(`交易失敗: ${symbol} ${side} ${value}訂單無法成立`);

                break;
            case 'insufficient':
                log('資金不足');
                this.notify(`交易失敗: ${baseSymbol} ${quoteSymbol} 可用資金無法進行交易`);

                break;
            default:
                log('未知錯誤');
                break;
        }

        return 'strategy';
    }

    /**
     * 下訂賣出掛單
     * @param {string} baseSymbol 
     * @param {string} quoteSymbol 
     * @returns 
     */
    async sell(baseSymbol, quoteSymbol) {
        const quantity = ticket.getAvailableGoods(baseSymbol, quoteSymbol);
        if (quantity <= 0) {
            return 'strategy';
        }
        const log = (...message) => logger.log(baseSymbol, quoteSymbol, ...message);
        log('可售出數量:', quantity);

        const result = await ticket.askTicket(baseSymbol, quoteSymbol, quantity);
        switch (result) {
            case 'filling':
                log('交易中...');
                return 'ticket';

            case 'filled':
                log('交易成功');

                const symbol = `${baseSymbol}${quoteSymbol}`;
                if (rm.getProfitStatus(baseSymbol, quoteSymbol)) {
                    rm.setProfitRecord(false, baseSymbol, quoteSymbol);
                    this.clearTicketStock(baseSymbol, quoteSymbol);
                    log(symbol, '止盈結算，停止追蹤策略');
                    return 'stop trade';
                }

                break;
            case 'failed':
                log('交易失敗');
                this.notify(`交易失敗: ${symbol} ${side} ${quantity}訂單無法成立`);

                break;
            case 'insufficient':
                log('資金不足');
                this.notify(`交易失敗: ${baseSymbol} ${quoteSymbol} 倉位不足無法進行交易`);

                break;
            default:
                log('請求失敗', result);
                return 'stop trade';
        }

        return 'strategy';
    }

    /**
     * 清除倉位資料與相關策略追蹤使用的資料
     * @param {string} baseSymbol 
     * @param {string} quoteSymbol 
     */
    async clearTicketStock(baseSymbol, quoteSymbol) {
        const symbol = `${baseSymbol}${quoteSymbol}`;
        kline.clearPrices(symbol);
        this.clearTrackingIntervalTimeout(symbol);
        delete this.startTime[symbol];

        rm.removeStockRecord({ baseSymbol, quoteSymbol });
    }

    notify(message) {
        console.log(`console message: ${message}`);
    }
}

module.exports = GridStrategyTrade;