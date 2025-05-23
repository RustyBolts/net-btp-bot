const SpotLogger = require("../record/SpotLogger");
const { getSymbolPrecision } = require("./ExchangeInfo");
const SpotTrade = require("./SpotTrade");

const logger = new SpotLogger();
const spot = new SpotTrade();

class MarketTicket {
    constructor() {

        // 訂單追蹤回查間隔
        this.ticketInterval = 0;
    }

    //#region 訂單

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
                const precision = await getSymbolPrecision(symbol);
                trackingCallback(baseSymbol, quoteSymbol, orderTicket, precision);

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