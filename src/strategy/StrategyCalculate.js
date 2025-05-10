const { SMA, EMA, RSI, MACD, BollingerBands } = require('technicalindicators');

class StrategyCalculate {

    /**
     * 簡單移動平均線
     * @param {number[]} prices 
     * @param {*} period 
     * @returns 
     */
    SMA(prices, period) {
        const smaValues = SMA.calculate({ values: prices, period }).flat();
        const recentSMA = smaValues.pop();
        const previousSMA = smaValues.pop();

        return recentSMA > previousSMA ? 'UP' : 'DOWN';
    }

    /**
     * 指數移動平均線
     * @param {number[]} prices 
     * @param {number} period 
     * @returns 
     */
    EMA(prices, period) {
        const emaValues = EMA.calculate({ values: prices, period }).flat();
        const recentEMA = emaValues.pop();
        const previousEMA = emaValues.pop();

        return recentEMA > previousEMA ? 'UP' : 'DOWN';
    }

    /**
     * 相對強弱指標
     * @param {number[]} prices 
     * @param {number} period 
     * @returns 
     */
    RSI(prices, period = 14) {
        const inputRSI = {
            values: prices,
            period: period,
        };
        return RSI.calculate(inputRSI);
    }

    /**
     * 指數平滑異同移動平均線
     * @param {number[]} prices 價格，一定要大於 26 筆才能算出 MACD 值
     * @param {*} options 
     * @returns 
     */
    MACD(prices, options = { fastPeriod: 12, slowPeriod: 26, signalPeriod: 9 }) {
        const macdValues = MACD.calculate({
            values: prices,
            fastPeriod: options.fastPeriod,
            slowPeriod: options.slowPeriod,
            signalPeriod: options.signalPeriod,
            SimpleMAOscillator: false,
            SimpleMASignal: false,
        });

        const recentMACD = macdValues[macdValues.length - 1];
        return {
            macd: recentMACD.MACD,
            signal: recentMACD.signal,
            histogram: recentMACD.histogram,
        };
    }

    /**
     * 布林通道
     * @param {number[]} prices 
     * @param {number} period 
     * @param {number} multiplier 
     * @returns 
     */
    bollingerBands(prices, period = 20, multiplier = 2) {
        const inputBB = {
            values: prices,
            period: period,
            stdDev: multiplier,
        };
        // 返回布林通道，取最後一個值
        const bbValues = BollingerBands.calculate(inputBB);
        return bbValues[bbValues.length - 1];
    }
    // 布林極限指標％b＝（收盤價−支撐線數值）÷（壓力線−支撐線數值）×100
    // ※通道上軌=+2σ　通道下軌＝-2σ

    /**
     * 斐波那契級數
     * @param {number[]} prices 
     * @returns 
     */
    fibonacciLevels(prices) {
        const high = Math.max(...prices);
        const low = Math.min(...prices);
        const range = high - low;

        return {
            '76.4%': high - range * (1 - 0.764),
            '61.8%': high - range * (1 - 0.618),
            '50.0%': high - range * (1 - 0.5),
            '38.2%': high - range * (1 - 0.382),
            '23.6%': high - range * (1 - 0.236),
        };
    }
}

module.exports = StrategyCalculate;

/**
 * https://www.npmjs.com/package/technicalindicators
 * npm i technicalindicators 
 */