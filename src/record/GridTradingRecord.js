const { read, write } = require("../../src-firebase/core/FirebaseBridge");

class GridTradingRecord {
    constructor() {
        this.order = {};
        this.stock = {};
        this.rsi = {};
    }

    async read() {
        const recordData = await read('RECORD', 'GRID_TRADING');
        if (recordData) {
            this.order = recordData.order || {};
            this.stock = recordData.stock || {};
            this.rsi = recordData.rsi || {};
            // console.log('read', this.order);
            // console.log('read', this.stock);
        }
    }

    write() {
        write('RECORD', 'GRID_TRADING', {
            order: this.order,
            stock: this.stock,
            rsi: this.rsi,
        });
    }

    writeOrder(data) {
        const { baseSymbol, quoteSymbol, orderId,
            status, side, transactTime,
            quantity, price, spent
        } = data;

        // 紀錄
        const record = {
            [quoteSymbol]: {
                [baseSymbol]: {
                    [orderId]: {
                        symbol: `${baseSymbol}/${quoteSymbol}`,
                        status: status,
                        side: side,
                        transactTime: transactTime,
                        quantity: quantity,
                        price: price,
                        spent: spent,
                    }
                }
            }
        };

        if (!this.order[quoteSymbol])
            this.order[quoteSymbol] = {};

        if (!this.order[quoteSymbol][baseSymbol])
            this.order[quoteSymbol][baseSymbol] = {};

        this.order[quoteSymbol][baseSymbol][orderId] = record[quoteSymbol][baseSymbol][orderId];
        this.write();
    }

    writeStock(data) {
        const { baseSymbol, quoteSymbol, profit, calm, funds } = data;

        // 紀錄
        const record = {
            [quoteSymbol]: {
                [baseSymbol]: {
                    funds: funds,
                    profit: profit,
                    calm: calm,
                }
            }
        };

        if (!this.stock[quoteSymbol])
            this.stock[quoteSymbol] = {};

        if (!this.stock[quoteSymbol][baseSymbol])
            this.stock[quoteSymbol][baseSymbol] = {};

        this.stock[quoteSymbol][baseSymbol] = record[quoteSymbol][baseSymbol];
        this.write();
    }

    writeRsi(data) {
        console.log('data:', data);
        const { baseSymbol, quoteSymbol, rsi } = data;
        const { high, low, interval } = rsi;

        // 紀錄
        const record = {
            [quoteSymbol]: {
                [baseSymbol]: {
                    high: high,
                    low: low,
                    interval: interval
                }
            }
        };

        if (!this.rsi[quoteSymbol])
            this.rsi[quoteSymbol] = {};

        if (!this.rsi[quoteSymbol][baseSymbol])
            this.rsi[quoteSymbol][baseSymbol] = {};

        this.rsi[quoteSymbol][baseSymbol] = record[quoteSymbol][baseSymbol];
        this.write();
    }

    delOrder(data) {
        const { baseSymbol, quoteSymbol, orderId } = data;
        if (this.order[quoteSymbol] &&
            this.order[quoteSymbol][baseSymbol] &&
            this.order[quoteSymbol][baseSymbol][orderId]) {
            delete this.order[quoteSymbol][baseSymbol][orderId];
            this.write();
        }
    }

    delStock(data) {
        const { baseSymbol, quoteSymbol } = data;
        if (this.stock[quoteSymbol] &&
            this.stock[quoteSymbol][baseSymbol]) {
            delete this.stock[quoteSymbol][baseSymbol];
            delete this.rsi[quoteSymbol][baseSymbol];
            this.write();
        }
    }

    getFunds(baseSymbol = '', quoteSymbol = '') {
        if (baseSymbol === '' || quoteSymbol === '') {
            return 0;
        }

        if (this.stock[quoteSymbol] &&
            this.stock[quoteSymbol][baseSymbol]) {
            return this.stock[quoteSymbol][baseSymbol].funds;
        }
        return 0;
    }

    getStocks(baseSymbol = '', quoteSymbol = '') {
        if (baseSymbol === '' || quoteSymbol === '') {
            return this.stock;
        }

        if (this.stock[quoteSymbol] &&
            this.stock[quoteSymbol][baseSymbol]) {
            return this.stock[quoteSymbol][baseSymbol];
        }
        return {};
    }

    /**
     * 
     * @param {string} baseSymbol 
     * @param {string} quoteSymbol 
     * @returns 
     */
    getOrders(baseSymbol = '', quoteSymbol = '') {
        if (baseSymbol === '' || quoteSymbol === '') {
            return this.order;
        }

        if (this.order[quoteSymbol] &&
            this.order[quoteSymbol][baseSymbol]) {
            return this.order[quoteSymbol][baseSymbol];
        }
        return {};
    }

    getRsi(baseSymbol = '', quoteSymbol = '') {
        if (baseSymbol === '' || quoteSymbol === '') {
            return this.rsi;
        }

        if (this.rsi[quoteSymbol] &&
            this.rsi[quoteSymbol][baseSymbol]) {
            return this.rsi[quoteSymbol][baseSymbol];
        }
        return {};
    }

    /**
     * 設定止盈狀態 (只賣)
     * @param {boolean} onlySell 
     * @param {string} baseSymbol 
     * @param {string} quoteSymbol 
     */
    setProfit(onlySell, baseSymbol = '', quoteSymbol = '') {
        if (baseSymbol === '' || quoteSymbol === '') {
            Object.keys(this.stock).forEach(quote => {
                Object.keys(this.stock[quote]).forEach(base => {
                    this.setProfit(onlySell, base, quote);
                });
            });
        } else {
            if (this.stock[quoteSymbol] &&
                this.stock[quoteSymbol][baseSymbol]) {
                this.stock[quoteSymbol][baseSymbol].profit = onlySell;
                this.write();
            }
        }
    }

    /**
     * 設定冷靜狀態 (暫停交易)
     * @param {boolean} pause 
     * @param {string} baseSymbol 
     * @param {string} quoteSymbol 
     */
    setCalm(pause, baseSymbol = '', quoteSymbol = '') {
        if (baseSymbol === '' || quoteSymbol === '') {
            Object.keys(this.stock).forEach(quote => {
                Object.keys(this.stock[quote]).forEach(base => {
                    this.setCalm(pause, base, quote);
                });
            });
        } else {
            if (this.stock[quoteSymbol] &&
                this.stock[quoteSymbol][baseSymbol]) {
                this.stock[quoteSymbol][baseSymbol].calm = pause;
                this.write();
            }
        }
    }
}

module.exports = GridTradingRecord;