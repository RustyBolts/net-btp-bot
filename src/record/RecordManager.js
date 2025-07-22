const GridTradingRecord = require("./GridTradingRecord");

class RecordManager {
    static instance = null;

    constructor() {
        if (RecordManager.instance) {
            return RecordManager.instance;
        }

        this.gridTradingRecord = new GridTradingRecord();

        this.entryPrice = {};
        this.onlySell = {};// 只做賣的交易對

        RecordManager.instance = this;
    }

    static getInstance() {
        if (!RecordManager.instance) {
            new RecordManager();
        }
        return RecordManager.instance;
    }

    async waitRead() {
        return await this.gridTradingRecord.read();
    }

    setOrderRecord(data) {
        this.gridTradingRecord.writeOrder(data);
    }

    setStockRecord(data) {
        this.gridTradingRecord.writeStock(data);
    }

    setRsiRecord(data) {
        this.gridTradingRecord.writeRsi(data);
    }

    removeOrderRecord(data) {
        this.gridTradingRecord.delOrder(data);
    }

    removeStockRecord(data) {
        this.gridTradingRecord.delStock(data);
    }

    getFunds(baseSymbol, quoteSymbol) {
        return this.gridTradingRecord.getFunds(baseSymbol, quoteSymbol);
    }

    getAllStocks() {
        return this.gridTradingRecord.getStocks();
    }

    getStock(baseSymbol, quoteSymbol) {
        return this.gridTradingRecord.getStocks(baseSymbol, quoteSymbol);
    }

    getAllOrders() {
        return this.gridTradingRecord.getOrders();
    }

    getOrder(baseSymbol, quoteSymbol) {
        return this.gridTradingRecord.getOrders(baseSymbol, quoteSymbol);
    }

    getAllRsi() {
        return this.gridTradingRecord.getRsi();
    }

    getRsi(baseSymbol, quoteSymbol) {
        return this.gridTradingRecord.getRsi(baseSymbol, quoteSymbol);
    }

    setCalmRecord(pause, baseSymbol = '', quoteSymbol = '') {
        this.gridTradingRecord.setCalm(pause, baseSymbol, quoteSymbol);
    }

    getEntryPrice(baseSymbol, quoteSymbol) {
        const symbol = `${baseSymbol}${quoteSymbol}`;
        return this.entryPrice[symbol] || 0;
    }

    setEntryPrice(price, baseSymbol, quoteSymbol) {
        const symbol = `${baseSymbol}${quoteSymbol}`;
        this.entryPrice[symbol] = price;
    }

    getProfitStatus(baseSymbol, quoteSymbol) {
        const symbol = `${baseSymbol}${quoteSymbol}`;
        return this.onlySell[symbol] || false;
    }

    setProfitRecord(onlySell, baseSymbol = '', quoteSymbol = '') {
        const symbol = `${baseSymbol}${quoteSymbol}`;
        if (this.onlySell[symbol] !== onlySell) {// 不同狀態才寫入紀錄
            this.onlySell[symbol] = onlySell;
            this.gridTradingRecord.setProfit(onlySell, baseSymbol, quoteSymbol);
        }
    }

}

module.exports = RecordManager;