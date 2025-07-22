class StrategyProxy {
    constructor() {
    }
    execute(baseSymbol, quoteSymbol, funds) {
        console.log(`Executing strategy for ${baseSymbol} ${quoteSymbol} with ${funds} funds`);
    }
    pause(baseSymbol, quoteSymbol) {
        console.log(`Pausing strategy for ${baseSymbol} ${quoteSymbol}`);
    }
    resume(baseSymbol, quoteSymbol) {
        console.log(`Resuming strategy for ${baseSymbol} ${quoteSymbol}`);
    }
    stop(baseSymbol, quoteSymbol) {
        console.log(`Stopping strategy for ${baseSymbol} ${quoteSymbol}`);
    }
    profit(baseSymbol, quoteSymbol, onlySell = true, profitRate = 0.01) {
        console.log(`Profiting strategy for ${baseSymbol} ${quoteSymbol}`);
    }
    bid(baseSymbol, quoteSymbol, spent = 0) {
        console.log(`Buying strategy for ${baseSymbol} ${quoteSymbol} with ${spent} funds`);
    }
    ask(baseSymbol, quoteSymbol, quantity = 0) {
        console.log(`Selling strategy for ${baseSymbol} ${quoteSymbol} with ${quantity} quantity`);
    }
    tracking() {
        console.log(`Tracking strategy`);
    }
    fill(baseSymbol, quoteSymbol, funds) {
        console.log(`Filling strategy for ${baseSymbol} ${quoteSymbol} with ${funds} funds`);
    }
    query() {
        return {
            SOLUSDT: { base: 3.434, quote: 3292.4799999999996 },
            PEPEUSDT: { base: 0, quote: 4054.48884083 }
        };
    }
    rsi(baseSymbol, quoteSymbol, rsiHigh = 70, rsiLow = 30, interval = '4h') {
        console.log(`Calculating RSI for ${baseSymbol} ${quoteSymbol} with ${rsiHigh} ${rsiLow}, interval: ${interval}`);
    }
}
module.exports = StrategyProxy;