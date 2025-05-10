class DivergenceChecker {

    /**
     * 檢查價格與指標的背離訊號
     * @param {Array} prices - 歷史價格數據
     * @param {Array} indicatorValues - 技術指標數據（如 RSI 或 MACD）
     * @returns {Object} - 背離訊號資訊
     */
    checkDivergence(prices, indicatorValues) {
        const pricePeaks = this.findPeaks(prices);
        const indicatorPeaks = this.findPeaks(indicatorValues);

        const divergences = [];

        // 比較價格與指標的高點和低點
        for (let i = 1; i < pricePeaks.length; i++) {
            const prevPricePeak = pricePeaks[i - 1];
            const currPricePeak = pricePeaks[i];

            const prevIndicatorPeak = indicatorPeaks[i - 1];
            const currIndicatorPeak = indicatorPeaks[i];

            if (!prevPricePeak || !currPricePeak || !prevIndicatorPeak || !currIndicatorPeak) {
                continue;
            }

            // 看跌背離：價格創新高，但指標下降
            if (
                currPricePeak.value > prevPricePeak.value &&
                currIndicatorPeak.value < prevIndicatorPeak.value
            ) {
                divergences.push({ type: 'BEARISH', pricePeak: currPricePeak, indicatorPeak: currIndicatorPeak });
            }

            // 看漲背離：價格創新低，但指標上升
            if (
                currPricePeak.value < prevPricePeak.value &&
                currIndicatorPeak.value > prevIndicatorPeak.value
            ) {
                divergences.push({ type: 'BULLISH', pricePeak: currPricePeak, indicatorPeak: currIndicatorPeak });
            }
        }

        return divergences;
    }

    /**
     * 找出數據中的局部高點和低點
     * @param {Array} values - 數據數組
     * @returns {Array} - 局部高點和低點
     */
    findPeaks(values) {
        const peaks = [];
        for (let i = 1; i < values.length - 1; i++) {
            if (values[i] > values[i - 1] && values[i] > values[i + 1]) {
                peaks.push({ index: i, value: values[i], type: 'HIGH' });
            } else if (values[i] < values[i - 1] && values[i] < values[i + 1]) {
                peaks.push({ index: i, value: values[i], type: 'LOW' });
            }
        }
        return peaks;
    }
}

module.exports = DivergenceChecker;