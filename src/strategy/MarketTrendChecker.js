class MarketTrendChecker {

    /**
     * 檢查市場趨勢
     * @param {number[]} prices 
     * @param {object} options 
     * @returns 
     */
    checkTrend(prices, currentPrice, bollingerBands, rsi, smaTrend, emaTrend, macdSignal, fibonacciLevels) {
        // 判斷價格接近布林帶支撐/壓力位
        const bollingerPosition = this.checkBollingerBands(currentPrice, bollingerBands);

        // 計算斐波那契回調線
        const fibonacciPosition = this.checkFibonacciLevels(currentPrice, fibonacciLevels);

        // 綜合趨勢判斷
        const trend = this.analyzeTrend(smaTrend, emaTrend, rsi, macdSignal, bollingerPosition, fibonacciPosition);

        return trend;
    }

    /**
     * 檢查布林通道位置
     * @param {number} currentPrice 
     * @param {object} bollingerBands 
     * @returns 
     */
    checkBollingerBands(currentPrice, bollingerBands) {
        const { upper, lower, pb } = bollingerBands;

        if (currentPrice <= lower) {
            return 'NEAR_SUPPORT';
        }
        if (currentPrice >= upper) {
            return 'NEAR_RESISTANCE';
        }
        return 'WITHIN_RANGE';
    }

    /**
     * 
     * @param {number} currentPrice 
     * @param {keyvaluepair[]} fibonacciLevels 
     * @returns 
     */
    checkFibonacciLevels(currentPrice, fibonacciLevels) {
        // console.log('斐波那契位置:', fibonacciLevels);
        for (const [level, value] of Object.entries(fibonacciLevels)) {
            if (Math.abs(currentPrice - value) / value <= 0.01) { // 接近 1% 範圍內
                // if (currentPrice <= value && parseFloat(level) <= 23.6) { // 支撐位
                if (parseFloat(level) <= 23.6) { // 支撐位
                    // console.log('支撐位:', level, value);
                    return 'NEAR_SUPPORT';
                }
                // if (currentPrice >= value && parseFloat(level) >= 76.4) { // 壓力位
                if (parseFloat(level) >= 76.4) { // 壓力位
                    // console.log('壓力位:', level, value);
                    return 'NEAR_RESISTANCE';
                }
            }
        }
        return 'WITHIN_RANGE';
    }

    /**
     * 分析趨勢
     * @param {string} smaTrend 
     * @param {string} emaTrend 
     * @param {number} rsi 
     * @param {object} macdSignal 
     * @param {string} bollingerPosition 
     * @param {string} fibonacciPosition 
     * @returns 
     */
    analyzeTrend(smaTrend, emaTrend, rsi, macdSignal, bollingerPosition, fibonacciPosition) {
        let trend = 'NEUTRAL';

        // 綜合布林帶和斐波那契位置
        if (bollingerPosition === 'NEAR_SUPPORT' || fibonacciPosition === 'NEAR_SUPPORT') {
            trend = 'SUPPORT';
        } else if (bollingerPosition === 'NEAR_RESISTANCE' || fibonacciPosition === 'NEAR_RESISTANCE') {
            trend = 'RESISTANCE';
        }

        // 結合 SMA、EMA 和 MACD
        if (smaTrend === 'UP' && emaTrend === 'UP' && macdSignal.histogram > 0) {
            trend = 'UPTREND';
        } else if (smaTrend === 'DOWN' && emaTrend === 'DOWN' && macdSignal.histogram < 0) {
            trend = 'DOWNTREND';
        }

        // RSI 修正
        if (rsi > 80) {
            // console.log('RSI值>80，代表市場過熱，市場上已經交投熱絡，可能會反轉走下跌趨勢，或短線回檔機會增加。');
            trend = 'OVERBOUGHT';
        } else if (rsi < 20) {
            // console.log('RSI值<20，代表市場過冷，股價或許已跌到谷底且交投低迷，可能會反轉為上漲趨勢，或短線反彈機會增加。');
            trend = 'OVERSOLD';
        }

        return trend;
    }
}

module.exports = MarketTrendChecker;