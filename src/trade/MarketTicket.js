const { getSymbolPrecision, adjustPrice, adjustQuantity } = require("./ExchangeInfo");
const { googleLogcat } = require("../record/GoogleSpreadsheetRecord");
const RecordManager = require("../record/RecordManager");
const SpotLogger = require("../record/SpotLogger");
const SpotTrade = require("./SpotTrade");
const rm = RecordManager.getInstance();
const logger = new SpotLogger();
const spot = new SpotTrade();

class MarketTicket {
    constructor() {

        // 訂單追蹤回查間隔
        this.ticketInterval = 0;
    }

    /**
     * 發佈至線上日誌
     * @param {string} baseSymbol 
     * @param {string} quoteSymbol 
     * @param {object} orderRecord 完成交易單的內容
     * @returns 
     */
    async logcat(baseSymbol, quoteSymbol, orderRecord = {}) {
        const symbol = `${baseSymbol}${quoteSymbol}`;
        const funds = rm.getFunds(baseSymbol, quoteSymbol);
        const availableFunds = this.getAvailableFunds(baseSymbol, quoteSymbol);

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

        const avgPrice = rm.getEntryPrice(baseSymbol, quoteSymbol);
        return googleLogcat(symbol, funds, avgPrice, orderRecord);
    }

    //#region 下單交易

    /**
     * 建立買單
     * @param {string} baseSymbol 
     * @param {string} quoteSymbol 
     * @param {number} quantity 下單金額
     * @param {number} value 買入數量
     * @returns 
     */
    async bidTicket(baseSymbol, quoteSymbol, quantity, value) {
        // 檢查錢包資產
        const spotBalance = await spot.getBalances(quoteSymbol);
        if (!spotBalance) {
            logger.log(baseSymbol, quoteSymbol, '無此資產:', quoteSymbol);
            return 'insufficient';
        }
        if (spotBalance.free < value) {
            logger.log(baseSymbol, quoteSymbol, `錢包${quoteSymbol}餘額不足:`, spotBalance.free);
            return 'insufficient';
        }

        // 開始買入
        return await this.spotTrade(baseSymbol, quoteSymbol, 'BUY', quantity);
    }

    /**
     * 建立賣單
     * @param {string} baseSymbol 
     * @param {string} quoteSymbol 
     * @param {number} quantity 賣出數量
     * @returns 
     */
    async askTicket(baseSymbol, quoteSymbol, quantity) {
        // 檢查錢包資產
        const spotBalance = await spot.getBalances(baseSymbol);
        if (!spotBalance) {
            logger.log(baseSymbol, quoteSymbol, '無此資產:', baseSymbol);
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
            return 'failed';
        }

        const log = (...message) => logger.log(baseSymbol, quoteSymbol, ...message);
        const orderRecord = await this.recordOrder(baseSymbol, quoteSymbol, orderTicket, precision);

        const { status } = orderTicket;
        if (status === 'NEW' || status === 'PARTIALLY_FILLED ') {
            // const availableFunds = this.getAvailableFunds(baseSymbol, quoteSymbol);
            // log('剩餘資金:', availableFunds);
            // const avgPrice = await this.resultBidTicket(baseSymbol, quoteSymbol, false);
            // rm.setEntryPrice(avgPrice, baseSymbol, quoteSymbol);
            // log('買入平均價格:', avgPrice);
            // await this.recordOrder(baseSymbol, quoteSymbol, orderTicket, precision);
            return 'filling';
        }

        if (status === 'FILLED') {
            const availableFunds = this.getAvailableFunds(baseSymbol, quoteSymbol);
            if (side === 'BUY') {
                const avgPrice = await this.resultBidTicket(baseSymbol, quoteSymbol, false);
                rm.setEntryPrice(avgPrice, baseSymbol, quoteSymbol);
                log('剩餘資金:', availableFunds, '買入平均價格:', avgPrice);
            } else {
                // 出售時先刪除所有買入訂單，結算可用資金與商品數量 todo 這邊都是預設full 的情況
                rm.setStockRecord({
                    baseSymbol, quoteSymbol,
                    funds: availableFunds,
                    profit: rm.getProfitStatus(baseSymbol, quoteSymbol),
                    calm: false,
                });

                // 結算以獲得平均價格，並刪除所有買入訂單
                const avgPrice = await this.resultBidTicket(baseSymbol, quoteSymbol, true);
                rm.setEntryPrice(0, baseSymbol, quoteSymbol);
                log('結算前買入平均價格:', avgPrice);

                const sellOutQty = await this.resultAskTicket(baseSymbol, quoteSymbol);
                log('賣出數量:', sellOutQty);
            }
            this.logcat(baseSymbol, quoteSymbol, orderRecord);
            return 'filled';
        }

        return 'failed';
    }

    async recordOrder(baseSymbol, quoteSymbol, orderTicket, precision) {
        const { orderId, transactTime, cummulativeQuoteQty, executedQty, status, side, fills } = orderTicket;

        // 計算交易成本與倉位
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
        logger.log(baseSymbol, quoteSymbol, 'orderTicket:', orderTicket);
        logger.log(baseSymbol, quoteSymbol, 'baseCommission:', baseCommission, 'quoteCommission:', quoteCommission, 'spent:', spent, 'quantity:', quantity);

        const price = this.getFilledAvgPrice(fills, precision);
        const orderRecord = {
            baseSymbol, quoteSymbol, orderId,
            status, side, transactTime,
            price, quantity, spent
        };
        rm.setOrderRecord(orderRecord);
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

    getFilledAvgPrice(fills, precision) {
        // const totalValue = fills.map(({ price, qty }) => parseFloat(price) * parseFloat(qty));
        // const totalQty = fills.map(({ qty }) => parseFloat(qty));
        // const avgPrice = totalValue.reduce((acc, cur) => acc + cur, 0) / totalQty.reduce((acc, cur) => acc + cur, 0);
        // return avgPrice;

        let totalValue = 0;
        let totalQty = 0;
        fills.forEach(({ price, qty }) => {
            totalValue += parseFloat(price) * parseFloat(qty);
            totalQty += parseFloat(qty);
        });
        return adjustPrice(totalValue / totalQty, precision);
    }

    getAvailableFunds(baseSymbol, quoteSymbol) {
        let totalSpent = 0;
        const order = rm.getOrder(baseSymbol, quoteSymbol);
        Object.keys(order).forEach(orderId => {
            const { status, side, transactTime, quantity, price, spent } = order[orderId];
            if (status === 'FILLED') {
                // console.log(orderId, status, '進行已完成訂單結算');
                totalSpent += spent;//spent: BUY為負值;SELL為正值
                // } else {
                //     console.log(orderId, status, '進行未完成訂單結算');
            }
            // todo 處理不是 filled 的情況，賣出失敗時撤掉並不一定要刪掉訂單，可以計算資金還原
        });
        return rm.getFunds(baseSymbol, quoteSymbol) + totalSpent;
    }

    getAvailableGoods(baseSymbol, quoteSymbol) {
        let goods = 0;
        const order = rm.getOrder(baseSymbol, quoteSymbol);
        Object.keys(order).forEach(orderId => {
            const { status, side, transactTime, quantity, price, spent } = order[orderId];
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
            logger.log(baseSymbol, quoteSymbol, 'orders:', order);
            logger.log(baseSymbol, quoteSymbol, '負數商品數量，可能有問題', goods);
            goods = 0;
        }
        return goods;
    }

    async resultBidTicket(baseSymbol, quoteSymbol, delBuyOrders) {
        const order = rm.getOrder(baseSymbol, quoteSymbol);
        const resultOrderIds = [];
        var avgPrice = 0, stackValue = 0, stackQty = 0;
        Object.keys(order).forEach(orderId => {
            const { status, side, transactTime, quantity, price, spent } = order[orderId];
            if (side === 'BUY' && status === 'FILLED') {
                stackValue += spent;
                stackQty += quantity;
                resultOrderIds.push(orderId);
            }
        });

        const symbol = `${baseSymbol}${quoteSymbol}`;
        const precision = await getSymbolPrecision(symbol);
        avgPrice = adjustPrice(-stackValue / stackQty, precision);//spent 在買入時紀錄為負值 todo avgPrice 在精度方面，官方提供的數字有問題，這邊通用小數點8以下

        if (!delBuyOrders) {
            return avgPrice;
        }

        // 清除所有買入訂單
        resultOrderIds.forEach(orderId => {
            rm.removeOrderRecord({ baseSymbol, quoteSymbol, orderId });
        });

        return avgPrice;
    }

    async resultAskTicket(baseSymbol, quoteSymbol) {
        const order = rm.getOrder(baseSymbol, quoteSymbol);
        const resultOrderIds = [];
        var sellOutQty = 0;
        var sellPrice = 0;
        Object.keys(order).forEach(orderId => {
            const { status, side, transactTime, quantity, price, spent } = order[orderId];
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
            rm.removeOrderRecord({ baseSymbol, quoteSymbol, orderId });
        });

        const entryPrice = rm.getEntryPrice(baseSymbol, quoteSymbol);
        if (entryPrice) {
            const avgPrice = entryPrice;
            const diff = sellPrice - avgPrice;
            const value = diff * sellOutQty;
            logger.log(baseSymbol, quoteSymbol, '已實現盈虧:', value.toFixed(6), '(', (diff / avgPrice * 100).toFixed(2), '%)');
        }

        return sellOutQty;
    }

    //#endregion

    //#region 訂單檢查

    /**
     * 追蹤訂單
     * @param {*} fillingOrders 
     * @param {*} trackingCallback 
     */
    async ticketTracking(fillingOrders, trackingCallback) {
        // 檢查未完成訂單是否處理完成
        Object.keys(fillingOrders).forEach(async (orderId) => {
            const [baseSymbol, quoteSymbol] = fillingOrders[orderId];
            const symbol = `${baseSymbol}${quoteSymbol}`;
            const orderTicket = await spot.getOrder(symbol, orderId);
            const orderStatus = orderTicket.status;
            if (orderStatus === 'FILLED') {
                // 變更交易訂單紀錄
                const precision = await getSymbolPrecision(symbol);
                this.recordOrder(baseSymbol, quoteSymbol, orderTicket, precision);

                // 開始追蹤交易倉位
                trackingCallback(baseSymbol, quoteSymbol);

                delete fillingOrders[orderId];
                logger.log(baseSymbol, quoteSymbol, orderId, '完成買入，改追蹤交易倉位');
            } else if (orderStatus === 'NEW' || orderStatus === 'PARTIALLY_FILLED') {
                logger.log(baseSymbol, quoteSymbol, orderId, '仍未完成買入，繼續追蹤訂單狀態');
            } else {
                delete fillingOrders[orderId];
                logger.log(baseSymbol, quoteSymbol, orderId, '(停止追蹤)未知訂單', orderStatus);
            }

            // 持續追蹤未完成訂單
            this.delayTicketTracking(fillingOrders, 60, trackingCallback);
        });
    }

    delayTicketTracking(fillingOrders, delaySec, trackingCallback) {
        this.ticketInterval && clearTimeout(this.ticketInterval);
        if (fillingOrders?.length > 0) {
            console.log('處理中訂單:', fillingOrders);
            this.ticketInterval = setTimeout(() => {
                this.ticketTracking(fillingOrders, trackingCallback);
            }, delaySec * 1000);
        }
    }

    //#endregion
}

module.exports = MarketTicket;