const { getSymbolPrecision, adjustPrice, adjustQuantity } = require("./ExchangeInfo");
const { googleLogcat } = require("../record/GoogleSpreadsheetRecord");
const { write } = require("../../src-firebase/core/FirebaseBridge");
const SpotLogger = require("../record/SpotLogger");
const GridTradingRecord = require("../record/GridTradingRecord");
const TradingStrategy = require("../strategy/TradingStrategy");
const SpotTrade = require("./SpotTrade");
const logger = new SpotLogger();
const record = new GridTradingRecord();
const strategy = new TradingStrategy();
const spot = new SpotTrade();

// 時間間距  
const Interval = {
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

// K線資料參考索引
const KLINE = {
    Opening: 1,     // 開盤價 
    Highest: 2,     // 最高價 
    Lowest: 3,      // 最低價 
    Closing: 4,     // 收盤價 
    Valume: 5,      // 成交額 
    // todo 其他參數可以再補入，這邊單純是Array 的順序 
};

// 延遲時間
const DelayMins = {
    [Interval.MINUTES_01]: 1,
    [Interval.MINUTES_03]: 3,
    [Interval.MINUTES_05]: 5,
    [Interval.MINUTES_15]: 15,
    [Interval.MINUTES_30]: 30,
    [Interval.HOURS_01]: 60,
    [Interval.HOURS_02]: 2 * 60,
    [Interval.HOURS_04]: 4 * 60,
    [Interval.HOURS_06]: 6 * 60,
    [Interval.HOURS_08]: 8 * 60,
    [Interval.HOURS_12]: 12 * 60,
    [Interval.DAYS_1]: 24 * 60,
    [Interval.DAYS_3]: 3 * 24 * 60,
    [Interval.WEEK_1]: 7 * 24 * 60,
};

class GridStrategyTrade {
    constructor() {
        this.trackingInterval = {};
        this.ticketInterval = 0;
        this.entryPrice = {};

        this.rsi = {};

        this.kline4hrPrices = {};
        this.klineInverval = Interval.HOURS_04;
        this.klineDelayMins = DelayMins[Interval.MINUTES_15];
        this.klineRefreshCountMax = DelayMins[this.klineInverval];
        this.runningTime = {};

        this.onlySell = {};// 只做賣的交易對
    }

    calm(pause, baseSymbol = '', quoteSymbol = '') {
        record.setCalm(pause, baseSymbol, quoteSymbol);
    }

    stock() {
        return record.stock;
    }

    order(baseSymbol = '', quoteSymbol = '') {
        if (baseSymbol === '' || quoteSymbol === '')
            return record.order;
        return record.getOrders({ baseSymbol, quoteSymbol });
    }

    funds(baseSymbol, quoteSymbol) {
        return record.getFunds({ baseSymbol, quoteSymbol });
    }

    profit(onlySell, baseSymbol, quoteSymbol) {
        record.setProfit(onlySell, baseSymbol, quoteSymbol);

        const symbol = `${baseSymbol}${quoteSymbol}`;
        this.onlySell[symbol] = onlySell;

        onlySell && logger.log(baseSymbol, quoteSymbol, symbol, '已設定只止盈交易');
    }

    read() {
        return record.read();
    }

    write(baseSymbol, quoteSymbol, funds) {
        record.writeStock({
            baseSymbol, quoteSymbol,
            funds: funds,
            profit: this.onlySell[`${baseSymbol}${quoteSymbol}`] || false,
            calm: false,
        });
        this.logcat(baseSymbol, quoteSymbol);
    }

    /**
     * 追蹤交易策略，並根據策略決定是否進行交易
     * @param {string} baseSymbol 
     * @param {string} quoteSymbol 
     * @param {number} gazeDelayMins 延遲下一次策略檢查時間，單位分鐘
     */
    async strategyTracking(baseSymbol, quoteSymbol, gazeDelayMins) {
        const log = (...message) => logger.log(baseSymbol, quoteSymbol, ...message);

        const symbol = `${baseSymbol}${quoteSymbol}`;
        const prices = await this.getKlines(symbol);
        const currentPrice = prices[prices.length - 1];

        const rsiHigh = this.rsi[symbol]?.high || 60;
        const rsiLow = this.rsi[symbol]?.low || 40;

        const runningTime = this.runningTime[symbol] * 60 * 1000;
        this.runningTime[symbol] += gazeDelayMins;
        console.log(symbol, 'gazeDelayMins:', gazeDelayMins);

        // 輸入秒數，轉成時分秒
        const timeStr = new Date(runningTime).toISOString().substring(11, 19);
        log(symbol, this.onlySell[symbol] ? `===ONLY_SELL===${rsiHigh}` : `=====H${rsiHigh}==L${rsiLow}==== 已運行`, timeStr);

        gazeDelayMins = this.klineDelayMins;

        var trackType = 'strategy';
        const options = { rsiLow, rsiHigh, maxLossPercentage: 0.3 };
        const {
            action,
            trend,
            rsi,
            bollingerBands,
            fibonacciLevels
        } = strategy.determineTradeAction(log, prices, currentPrice, this.entryPrice[symbol], options);
        if (record.stock[quoteSymbol][baseSymbol].calm) {
            log('======= CALM =======');
            trackType = 'calm';
        }
        else if (action === 'GAZE') {
            log('[', action, ']', symbol);
            gazeDelayMins = DelayMins[Interval.MINUTES_01];
        }
        else if (
            action === 'STOP_LOSS'
            || (action === 'DOWNTREND' && this.checkEerlyStopLoss(baseSymbol, quoteSymbol, currentPrice))
        ) {
            log('[', action, ']', symbol, '止損出清流程');
            trackType = await this.sell(baseSymbol, quoteSymbol);
            this.resetRunningTime(symbol);
            this.kline4hrPrices[symbol] = {};
            gazeDelayMins = 60 * 12;
            this.notify(`${symbol}執行止損, 延遲${gazeDelayMins}分鐘後重啟`);
        }
        else if (action === 'SELL') {
            log('[', action, ']', symbol);
            trackType = await this.sell(baseSymbol, quoteSymbol);
        }
        else if (action === 'BUY' || action === 'SUPPLY' || action === 'BUCKET') {
            const step = {
                'BUY': 0.95,
                'SUPPLY': 0.9,
                'BUCKET': 0.5,
            };
            const divide = 5;
            const precision = await getSymbolPrecision(symbol);
            const slippage = precision.tickSize * 5;// 滑點範圍: 以市價下單會買到為止，價格可能會因此滑坡買到currentPrice 更高的價格，用購入數量來修正 (倉位價格會變高，最後一倉可能不足購入)
            const quantity = record.getFunds({ baseSymbol, quoteSymbol }) / (currentPrice + slippage) / divide;// 修正數量，市價買入時可能會滑坡，造成購入價格平均比預算高一點點，這邊先調整一下讓5等分能正常分倉買入
            // log('修正數量:', quantity - precision.stepSize);
            log('[', action, ']', quantity, baseSymbol);
            trackType = await this.buy(baseSymbol, quoteSymbol, quantity, currentPrice, step[action]);
        }
        else {
            log('[', action, ']', symbol, '>>>');
        }

        const entryPrice = this.entryPrice[symbol];
        if (entryPrice) {
            const qty = this.getAvailableGoods(baseSymbol, quoteSymbol);
            const diff = currentPrice - entryPrice;
            const value = diff * qty;
            log('未實現盈虧:', value.toFixed(6), '(', (diff / entryPrice * 100).toFixed(2), '%)');
        }

        write('STOCK', symbol, JSON.stringify({
            action, trend, rsi, bollingerBands, fibonacciLevels,
            currentPrice, entryPrice,
        }));

        console.log('\n');

        const delaySec = 60 * gazeDelayMins;
        if (trackType === 'ticket') {
            setTimeout(() => this.tracking(), delaySec * 1000);
        } else if (trackType === 'strategy') {
            this.delayStrategyTracking(baseSymbol, quoteSymbol, delaySec, gazeDelayMins);
        } else if (trackType === 'calm') {
            this.delayStrategyTracking(baseSymbol, quoteSymbol, 3600, 0);
        }
    }

    delayStrategyTracking(baseSymbol, quoteSymbol, delaySec, gazeDelayMins = 1) {
        const symbol = `${baseSymbol}${quoteSymbol}`;
        this.clearTrackingIntervalTimeout(symbol);
        this.trackingInterval[symbol] = setTimeout(() => {
            this.strategyTracking(baseSymbol, quoteSymbol, gazeDelayMins);
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

    async getKlines(symbol) {
        const limit = 100;
        if (this.runningTime[symbol] % this.klineRefreshCountMax < this.klineDelayMins) {
            const cIndex = KLINE.Closing;
            const klines = await spot.getKlines(symbol, this.klineInverval, limit);
            this.kline4hrPrices[symbol] = klines.map((kline) => parseFloat(kline[cIndex]));
            // console.log(symbol, 'klines:', klines.map((kline) => kline.slice(0, 5))[klines.length - 1]);
            write(`KLINE/${symbol}`, '4hr', JSON.stringify(klines.map((kline) => kline.slice(0, 5))));
        } else {
            const tickerPrice = await spot.getTickerPrice(symbol);
            this.kline4hrPrices[symbol][limit - 1] = tickerPrice;
        }

        return this.kline4hrPrices[symbol];
    }

    // 檢查是否提前認賠止損
    checkEerlyStopLoss(baseSymbol, quoteSymbol, currentPrice) {
        var stopLoss = false;
        const orders = record.order[quoteSymbol][baseSymbol];
        if (orders) {
            const now = Date.now();
            const symbol = `${baseSymbol}${quoteSymbol}`;
            const stockTimeouts = Object.keys(orders).map((orderId) => {
                const orderTicket = orders[orderId];
                const orderStatus = orderTicket.status;
                if (orderStatus === 'FILLED') {
                    return now - orderTicket.transactTime;
                }
                return 0;// 只處理立即 FILLED 單
            });

            const log = (...message) => logger.log(baseSymbol, quoteSymbol, ...message);
            log(stockTimeouts);
            const last = stockTimeouts.sort((a, b) => b - a)[0];
            const entryPrice = this.entryPrice[symbol];
            if (last && entryPrice) {
                const diff = currentPrice - entryPrice;
                const percentage = diff / entryPrice;

                const hours = last / (60 * 60 * 1000);
                if (hours > 264) {
                    stopLoss = percentage > -0.02;
                } else if (hours > 240) {
                    stopLoss = percentage > -0.015;
                } else if (hours > 216) {
                    stopLoss = percentage > -0.01;
                } else if (hours > 192) {
                    stopLoss = percentage > -0.005;
                } else if (hours > 168) {
                    stopLoss = percentage > 0.001;
                } else if (hours > 144) {
                    stopLoss = percentage > 0.003;
                } else if (hours > 120) {
                    stopLoss = percentage > 0.005;
                } else if (hours > 96) {
                    stopLoss = percentage > 0.007;
                } else if (hours > 72) {
                    stopLoss = percentage > 0.015;
                } else if (hours > 48) {
                    stopLoss = percentage > 0.02;
                }
                stopLoss && log(hours, '止損');
            }
        }
        return stopLoss;
    }

    // 追蹤訂單
    async ticketTracking(fillingOrders) {
        // 檢查未完成訂單是否處理完成
        Object.keys(fillingOrders).forEach(async (orderId) => {
            const [baseSymbol, quoteSymbol] = fillingOrders[orderId];
            const symbol = `${baseSymbol}${quoteSymbol}`;
            const orderTicket = await spot.getOrder(symbol, orderId);
            const orderStatus = orderTicket.status;
            if (orderStatus === 'FILLED') {
                const precision = await getSymbolPrecision(symbol);
                this.recordOrder(baseSymbol, quoteSymbol, orderTicket, precision);

                // 開始追蹤交易倉位
                this.delayStrategyTracking(baseSymbol, quoteSymbol, 0.1, 0);

                delete fillingOrders[orderId];
                logger.log(baseSymbol, quoteSymbol, orderId, '完成買入，改追蹤交易倉位');
            } else if (orderStatus === 'NEW' || orderStatus === 'PARTIALLY_FILLED') {
                logger.log(baseSymbol, quoteSymbol, orderId, '仍未完成買入，繼續追蹤訂單狀態');
            } else {
                delete fillingOrders[orderId];
                logger.log(baseSymbol, quoteSymbol, orderId, '(停止追蹤)未知訂單', orderStatus);
            }

            // 持續追蹤未完成訂單
            this.delayTicketTracking(fillingOrders, 60);
        });
    }

    delayTicketTracking(fillingOrders, delaySec) {
        this.ticketInterval && clearTimeout(this.ticketInterval);
        if (fillingOrders && fillingOrders.length > 0) {
            console.log('處理中訂單:', fillingOrders);
            this.ticketInterval = setTimeout(() => {
                this.ticketTracking(fillingOrders);
            }, delaySec * 1000);
        }
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
        const symbol = `${baseSymbol}${quoteSymbol}`;
        console.log('this.onlySell[', symbol, ']:', this.onlySell[symbol]);
        if (this.onlySell[symbol]) {
            log('止盈限價，不進行買入');
            return 'strategy';
        }

        // 多筆分倉的情況下，盡可能讓每一筆越買越低價，避免符合購入的條件一直買入
        const entryPrice = this.entryPrice[symbol];
        if (entryPrice > 0 && entryPrice * step < tickerPrice) {
            // 沒有越買越低，跳掉
            log('買入目標價格:', entryPrice * step, quoteSymbol);
            return 'strategy';
        }

        // 先檢查是否有足夠資金
        const funds = this.getAvailableFunds(baseSymbol, quoteSymbol);
        const value = tickerPrice * quantity;
        if (funds < value) {
            log('剩餘資金:', funds, quoteSymbol, '不足購入');
            return 'strategy';
        }

        const result = await this.bidTicket(baseSymbol, quoteSymbol, quantity, value);
        switch (result) {
            case 'filling':
                log('交易中...');
                return 'ticket';

            case 'filled':
                log('交易成功');

                break;
            case 'failed':
                log('交易失敗');

                break;
            case 'insufficient':
                log('資金不足');

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
        const quantity = this.getAvailableGoods(baseSymbol, quoteSymbol);
        if (quantity <= 0) {
            return 'strategy';
        }
        const log = (...message) => logger.log(baseSymbol, quoteSymbol, ...message);
        log('可售出數量:', quantity);

        const result = await this.askTicket(baseSymbol, quoteSymbol, quantity);
        switch (result) {
            case 'filling':
                log('交易中...');
                return 'ticket';

            case 'filled':
                log('交易成功');

                const symbol = `${baseSymbol}${quoteSymbol}`;
                if (this.onlySell[symbol]) {
                    // this.profit(baseSymbol, quoteSymbol, false);
                    this.clearTicketStock(baseSymbol, quoteSymbol);
                    log(symbol, '止盈結算，停止追蹤策略');
                    return 'stop trade';
                }

                break;
            case 'failed':
                log('交易失敗');

                break;
            case 'insufficient':
                log('資金不足');

                break;
            default:
                log('請求失敗', result);
                return 'stop trade';
        }

        return 'strategy';
    }

    async bidTicket(baseSymbol, quoteSymbol, quantity, value) {
        // 檢查錢包資產
        const spotBalance = await spot.getBalances(quoteSymbol);
        if (!spotBalance) {
            logger.log(baseSymbol, quoteSymbol, '無此資產:', quoteSymbol);
            this.notify(`交易失敗: ${baseSymbol} ${quoteSymbol} 無此資產`)
            return 'insufficient';
        }
        if (spotBalance.free < value) {
            logger.log(baseSymbol, quoteSymbol, `錢包${quoteSymbol}餘額不足:`, spotBalance.free);
            return 'insufficient';
        }

        // 開始買入
        return await this.spotTrade(baseSymbol, quoteSymbol, 'BUY', quantity);
    }

    async askTicket(baseSymbol, quoteSymbol, quantity) {
        // 檢查錢包資產
        const spotBalance = await spot.getBalances(baseSymbol);
        if (!spotBalance) {
            logger.log(baseSymbol, quoteSymbol, '無此資產:', baseSymbol);
            this.notify(`交易失敗: ${baseSymbol} ${quoteSymbol} 無此資產`)
            return 'insufficient';
        }
        if (spotBalance.free < quantity) {
            logger.log(baseSymbol, quoteSymbol, `可用${baseSymbol}餘額不足`);
            return 'insufficient';
        }

        logger.log(baseSymbol, quoteSymbol, '錢包可用餘額:', spotBalance.free, baseSymbol);

        // 開始賣出
        return await this.spotTrade(baseSymbol, quoteSymbol, 'SELL', quantity);
    }

    async spotTrade(baseSymbol, quoteSymbol, side, quantity) {
        // 現貨交易 (買入/賣出)
        const symbol = `${baseSymbol}${quoteSymbol}`;
        const precision = await getSymbolPrecision(symbol);
        const adjustedQuantity = adjustQuantity(quantity, precision);
        const orderTicket = await spot.marketTrade(symbol, adjustedQuantity, side);
        if (!orderTicket) {
            this.notify(`交易失敗: ${symbol} ${side} ${adjustedQuantity}訂單無法成立`);
            return 'failed';
        }

        const log = (...message) => logger.log(baseSymbol, quoteSymbol, ...message);
        const orderRecord = await this.recordOrder(baseSymbol, quoteSymbol, orderTicket, precision);

        const { status } = orderTicket;
        if (status === 'NEW' || status === 'PARTIALLY_FILLED ') {
            // const availableFunds = this.getAvailableFunds(baseSymbol, quoteSymbol);
            // log('剩餘資金:', availableFunds);
            // const avgPrice = await this.resultBidTicket(baseSymbol, quoteSymbol, false);
            // this.entryPrice[symbol] = avgPrice;
            // log('買入平均價格:', avgPrice);
            // await this.recordOrder(baseSymbol, quoteSymbol, orderTicket, precision);
            return 'filling';
        }

        if (status === 'FILLED') {
            const availableFunds = this.getAvailableFunds(baseSymbol, quoteSymbol);
            if (side === 'BUY') {
                log('剩餘資金:', availableFunds);

                const avgPrice = await this.resultBidTicket(baseSymbol, quoteSymbol, false);
                this.entryPrice[symbol] = avgPrice;
                log('買入平均價格:', avgPrice);

            } else {
                // 出售時先刪除所有買入訂單，結算可用資金與商品數量 todo 這邊都是預設full 的情況
                record.writeStock({
                    baseSymbol, quoteSymbol,
                    funds: availableFunds,
                    profit: this.onlySell[symbol] || false,
                    calm: false,
                });
                // record.writeStock({ baseSymbol, quoteSymbol, funds: availableFunds, profit: this.onlySell[symbol] || false });
                // record.writeStock({ baseSymbol, quoteSymbol, funds: availableFunds });

                // 結算以獲得平均價格，並刪除所有買入訂單
                const avgPrice = await this.resultBidTicket(baseSymbol, quoteSymbol, true);
                this.entryPrice[symbol] = 0;
                log('結算前買入平均價格:', avgPrice);

                const sellOutQty = await this.resultAskTicket(baseSymbol, quoteSymbol);
                log('賣出數量:', sellOutQty);
            }
            await this.logcat(baseSymbol, quoteSymbol, orderRecord);
            return 'filled';
        }

        return 'failed';
    }

    async recordOrder(baseSymbol, quoteSymbol, orderTicket, precision) {
        const { orderId, transactTime, cummulativeQuoteQty, executedQty, status, side, fills } = orderTicket;

        let baseCommission = 0;
        let quoteCommission = 0;
        fills.forEach(({ commissionAsset, commission }) => {
            if (commissionAsset === baseSymbol) {
                baseCommission += parseFloat(commission);
            } else if (commissionAsset === quoteSymbol) {
                quoteCommission += parseFloat(commission);
            }
        });

        const quantity = parseFloat(executedQty - baseCommission);
        const spent = adjustPrice(parseFloat(cummulativeQuoteQty) - quoteCommission, precision) * (side === 'BUY' ? -1 : 1);
        const avg = this.getFilledAvgPrice(fills);
        const price = adjustPrice(avg, precision);//每單可以會多筆成交，通常會用現價所以值應該會都一樣所以取第一筆。但可以想一下要不要算平均價格
        logger.log(baseSymbol, quoteSymbol, 'orderTicket:', orderTicket);
        logger.log(baseSymbol, quoteSymbol, 'baseCommission:', baseCommission, 'quoteCommission:', quoteCommission, 'spent:', spent, 'quantity:', quantity);

        const orderRecord = {
            baseSymbol, quoteSymbol, orderId,
            status, side, transactTime,
            price, quantity, spent
        };
        record.writeOrder(orderRecord);
        return orderRecord;

        // spot order ticket
        // {
        //     side: 'BUY',
        //     symbol: 'SOLUSDT',
        //     orderId: 8444136829,
        //     orderListId: -1,
        //     clientOrderId: 'C5IKbVqdWyHtscjbNqFaMq',
        //     transactTime: 1731849016053,        
        //     price: '0.00000000',
        //     origQty: '0.20000000',
        //     executedQty: '0.20000000',
        //     cummulativeQuoteQty: '46.55400000', 
        //     status: 'FILLED',
        //     timeInForce: 'GTC',
        //     type: 'MARKET',
        //     workingTime: 1731849016053,
        //     fills: [
        //       {
        //         price: '232.77000000',
        //         qty: '0.20000000',
        //         commission: '0.00005535',       
        //         commissionAsset: 'BNB',
        //         tradeId: 814221615
        //       }
        //     ],
        //     selfTradePreventionMode: 'EXPIRE_MAKER'
        // }
        // {
        //     side: 'SELL',
        //     symbol: 'SOLUSDT',
        //     orderId: 8442626155,
        //     orderListId: -1,
        //     clientOrderId: 'y2s5c98xAJJ9ZF2a1smI5D',
        //     transactTime: 1731843639412,
        //     price: '0.00000000',
        //     origQty: '0.15200000',
        //     executedQty: '0.15200000',
        //     cummulativeQuoteQty: '36.00272000',
        //     status: 'FILLED',
        //     timeInForce: 'GTC',
        //     type: 'MARKET',
        //     workingTime: 1731843639412,
        //     fills: [ [Object] ],
        //     selfTradePreventionMode: 'EXPIRE_MAKER'
        //   }

    }

    getFilledAvgPrice(fills) {
        const totalValue = fills.map(({ price, qty }) => {
            return parseFloat(price) * parseFloat(qty);
        });
        const totalQty = fills.map(({ qty }) => parseFloat(qty));
        const avgPrice = totalValue.reduce((acc, cur) => acc + cur, 0) / totalQty.reduce((acc, cur) => acc + cur, 0);
        return avgPrice;
    }

    async logcat(baseSymbol, quoteSymbol, orderRecord = {}) {
        const symbol = `${baseSymbol}${quoteSymbol}`;
        const funds = record.getFunds({ baseSymbol, quoteSymbol });
        const availableFunds = this.getAvailableFunds(baseSymbol, quoteSymbol);//重複

        if (!!orderRecord.orderId) {
            const price = orderRecord.price;
            const isSellSide = orderRecord.side === 'SELL';
            let tradeSide = isSellSide
                ? `清倉 ${orderRecord.quantity} ${baseSymbol}，售價${price} ${quoteSymbol}`
                : `${Math.round((funds - availableFunds) / funds * 5)}/5 持倉，均價${price} ${quoteSymbol}`;
            let tradeSpent = isSellSide
                ? `+${orderRecord.spent.toFixed(2)}`
                : `${orderRecord.spent.toFixed(2)}`;
            this.notify(`${symbol}\n${tradeSide}\n運作資金 (${tradeSpent}) ${availableFunds.toFixed(2)} / ${funds.toFixed(2)} ${quoteSymbol}`);
        }

        const avgPrice = this.entryPrice[symbol] || 0;
        return googleLogcat(symbol, funds, avgPrice, orderRecord);
    }

    getAvailableFunds(baseSymbol, quoteSymbol) {
        let totalSpent = 0;
        const orders = record.getOrders({ baseSymbol, quoteSymbol });
        Object.keys(orders).forEach(orderId => {
            const { status, side, transactTime, quantity, price, spent } = orders[orderId];
            if (status === 'FILLED') {
                console.log(orderId, status, '進行已完成訂單結算');
                totalSpent += spent;//spent: BUY為負值;SELL為正值
            } else {
                console.log(orderId, status, '進行未完成訂單結算');
            }
            // todo 處理不是 filled 的情況，賣出失敗時撤掉並不一定要刪掉訂單，可以計算資金還原
        });
        return record.getFunds({ baseSymbol, quoteSymbol }) + totalSpent;
    }

    getAvailableGoods(baseSymbol, quoteSymbol) {
        let goods = 0;
        const orders = record.getOrders({ baseSymbol, quoteSymbol });
        Object.keys(orders).forEach(orderId => {
            const { status, side, transactTime, quantity, price, spent } = orders[orderId];
            if (status === 'FILLED') {
                // console.log(orderId, status, '進行已完成訂單結算');//測試提醒用，但現在每輪都刷一次，減少資訊影響
                if (side === 'BUY') {
                    goods += quantity;
                } else if (side === 'SELL') {
                    goods -= quantity;
                }
            } else {
                console.log(orderId, status, '進行未完成訂單結算');
            }
            // todo 處理不是 filled 的情況，賣出失敗時撤掉並不一定要刪掉訂單，可以計算資金還原
        });
        if (goods < 0) {
            logger.log(baseSymbol, quoteSymbol, 'orders:', orders);
            logger.log(baseSymbol, quoteSymbol, '負數商品數量，可能有問題', goods);
            goods = 0;
        }
        return goods;
    }

    async resultBidTicket(baseSymbol, quoteSymbol, delBuyOrders) {
        const orders = record.getOrders({ baseSymbol, quoteSymbol });
        const resultOrderIds = [];
        var avgPrice = 0, stackValue = 0, stackQty = 0;
        Object.keys(orders).forEach(orderId => {
            const { status, side, transactTime, quantity, price, spent } = orders[orderId];
            if (side === 'BUY' && status === 'FILLED') {
                stackValue += spent;
                stackQty += quantity;
                resultOrderIds.push(orderId);
            }
        });

        const symbol = `${baseSymbol}${quoteSymbol}`;
        const precision = await getSymbolPrecision(symbol);
        avgPrice = adjustPrice(-stackValue / stackQty, precision);//spent 在買入時紀錄為負值 todo avgPrice 在精度方面，官方提供的數字有問題，這邊通用小數點8以下
        // avgPrice = adjustQuantity(-stackValue / stackQty, precision);//spent 在買入時紀錄為負值

        if (!delBuyOrders) {
            // this.entryPrice[symbol] = avgPrice;
            return avgPrice;
        }

        // 清除所有買入訂單
        resultOrderIds.forEach(orderId => {
            record.delOrder({ baseSymbol, quoteSymbol, orderId });
        });
        // this.entryPrice[symbol] = 0;

        return avgPrice;
    }

    async resultAskTicket(baseSymbol, quoteSymbol) {
        const orders = record.getOrders({ baseSymbol, quoteSymbol });
        const resultOrderIds = [];
        var sellOutQty = 0;
        var sellPrice = 0;
        Object.keys(orders).forEach(orderId => {
            const { status, side, transactTime, quantity, price, spent } = orders[orderId];
            if (side === 'SELL' && status === 'FILLED') {
                resultOrderIds.push(orderId);
                sellOutQty += quantity;
                sellPrice = price;
            }
        });

        const symbol = `${baseSymbol}${quoteSymbol}`;
        const precision = await getSymbolPrecision(symbol);
        sellOutQty = adjustQuantity(sellOutQty, precision);

        // 清除所有賣出訂單
        resultOrderIds.forEach(orderId => {
            record.delOrder({ baseSymbol, quoteSymbol, orderId });
        });

        if (this.entryPrice[symbol]) {
            const avgPrice = this.entryPrice[symbol];
            const diff = sellPrice - avgPrice;
            const value = diff * sellOutQty;
            logger.log(baseSymbol, quoteSymbol, '已實現盈虧:', value.toFixed(6), '(', (diff / avgPrice * 100).toFixed(2), '%)');
        }

        return sellOutQty;
    }

    /**
     * 清除倉位資料與相關策略追蹤使用的資料
     * @param {string} baseSymbol 
     * @param {string} quoteSymbol 
     */
    async clearTicketStock(baseSymbol, quoteSymbol) {
        const symbol = `${baseSymbol}${quoteSymbol}`;
        this.resetRunningTime(symbol);
        this.kline4hrPrices[symbol] = {};
        this.clearTrackingIntervalTimeout(symbol);
        this.onlySell[symbol] = false;

        record.delStock({ baseSymbol: baseSymbol, quoteSymbol: quoteSymbol });
    }

    resetRunningTime(symbol) {
        if (symbol) {
            this.runningTime[symbol] = 0;
            return;
        }
        Object.keys(this.runningTime)
            .forEach((symbol) => this.resetRunningTime(symbol));
    }

    notify(message) {
        console.log(`console message: ${message}`);
    }
}

module.exports = GridStrategyTrade;