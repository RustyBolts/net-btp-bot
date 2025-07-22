class DivergenceChecker {

    /**
     * 檢查價格與指標的背離訊號
     * @param {Array} prices - 歷史價格數據
     * @param {Array} indicatorValues - 技術指標數據（如 RSI 或 MACD）
     * @param {number} currentPrice - 當前價格
     * @returns {Object} - 背離訊號資訊
     */
    checkDivergence(prices, indicatorValues, currentPrice) {
        const pricePeaks = this.findPeaks(prices);
        const indicatorPeaks = this.findPeaks(indicatorValues);

        const divergences = [];

        const priceHighs = pricePeaks.filter(p => p.type === 'HIGH');
        const indicatorHighs = indicatorPeaks.filter(p => p.type === 'HIGH');
        const priceLows = pricePeaks.filter(p => p.type === 'LOW');
        const indicatorLows = indicatorPeaks.filter(p => p.type === 'LOW');

        const minHighLen = Math.min(priceHighs.length, indicatorHighs.length);
        for (let i = 1; i < minHighLen; i++) {
            const prevPrice = priceHighs[i - 1];
            const currPrice = priceHighs[i];
            const prevInd = indicatorHighs[i - 1];
            const currInd = indicatorHighs[i];

            if (currPrice.value > prevPrice.value && currInd.value < prevInd.value) {
                const strength = this.evaluateStrength(currPrice.value - prevPrice.value, prevInd.value - currInd.value);
                const confirmation = currentPrice < currInd.value;
                divergences.push({
                    type: 'BEARISH',
                    strength,
                    confirmation,
                    peakType: 'HIGH',
                    pricePeak: currPrice,
                    indicatorPeak: currInd
                });
            }
        }

        const minLowLen = Math.min(priceLows.length, indicatorLows.length);
        for (let i = 1; i < minLowLen; i++) {
            const prevPrice = priceLows[i - 1];
            const currPrice = priceLows[i];
            const prevInd = indicatorLows[i - 1];
            const currInd = indicatorLows[i];

            if (currPrice.value < prevPrice.value && currInd.value > prevInd.value) {
                const strength = this.evaluateStrength(prevPrice.value - currPrice.value, currInd.value - prevInd.value);
                const confirmation = currentPrice > currInd.value;
                divergences.push({
                    type: 'BULLISH',
                    strength,
                    confirmation,
                    peakType: 'LOW',
                    pricePeak: currPrice,
                    indicatorPeak: currInd
                });
            }
        }

        for (const div of divergences) {
            const sign = div.type === 'BULLISH' ? '↗' : '↘';
            const conf = div.confirmation ? '✓已確認' : '!未確認';
            div.label = `${sign} ${div.type} 背離（${div.peakType}）：${div.strength} ${conf}`;
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

    /**
     * 
     * @param {number} priceDelta 價格變化
     * @param {number} indicatorDelta 指標變化
     * @returns 
     */
    evaluateStrength(priceDelta, indicatorDelta) {
        const score = Math.abs(priceDelta) + Math.abs(indicatorDelta);
        if (score > 20) return 'STRONG';
        if (score > 10) return 'MODERATE';
        return 'WEAK';
    }
}

module.exports = DivergenceChecker;