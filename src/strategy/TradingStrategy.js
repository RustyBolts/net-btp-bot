/**
 * RSI 的計算

    使用 technicalindicators 的 RSI.calculate 方法。
    輸入價格數據和時間周期（默認為 14 天）。
    結果是 RSI 值的數組，取最後一個值作為當前的 RSI 值。
    布林通道的計算

    使用 technicalindicators 的 BollingerBands.calculate 方法。
    輸入價格數據、時間周期和標準差倍數（默認為 20 和 2）。
    結果是布林通道的數組，取最後一個值的上下軌（upper 和 lower）。
    判斷交易動作

    當當前價格低於布林通道下軌，且 RSI < 30 時，返回 BUY。
    當當前價格高於布林通道上軌，且 RSI > 70 時，返回 SELL。
    否則返回 HOLD。

    (async () => {
        const strategy = new TradingStrategy();
        const prices = [45.0, 46.0, 47.0, 46.5, 47.5, 48.0, 47.5, 48.5, 49.0, 50.0, 51.0, 52.0, 53.0, 54.0, 55.0];

        const action = await strategy.determineTradeAction(prices);
        console.log('建議動作:', action); // BUY, SELL 或 HOLD
    })();
 */
const SpotLogger = require("../record/SpotLogger");
const StrategyCalculate = require("./StrategyCalculate");
const MarketTrendChecker = require("./MarketTrendChecker");
const DivergenceChecker = require("./DivergenceChecker");
const calculate = new StrategyCalculate();
const trendChecker = new MarketTrendChecker();
const divergenceChecker = new DivergenceChecker();

// // 指標快取
// const indicatorCache = new Map();
// const getCached = (key, computeFn, ttl = 0) => {
//     const now = Date.now();
//     if (indicatorCache.has(key)) {
//         const entry = indicatorCache.get(key);
//         if (now - entry.timestamp < ttl) {
//             return entry.value;
//         }
//     }
//     const value = computeFn();
//     indicatorCache.set(key, { value, timestamp: now });
//     return value;
// };

class TradingStrategy {

    /**
     * 判斷交易動作
     * @param {SpotLogger} log 
     * @param {number[]} prices 
     * @param {number} currentPrice 
     * @param {number} entryPrice 
     * @param {object} options 
     * @returns 
     */
    determineTradeAction(log, prices, currentPrice, entryPrice = 0, options = {}) {
        const {
            rsiLow = 30, rsiHigh = 70, maxLossPercentage = 0.05, minProfitPercentage = 0.05,
            smaPeriod = 50, emaPeriod = 20, rsiPeriod = 14,
            macdOptions = { fastPeriod: 12, slowPeriod: 26, signalPeriod: 9 },
            bbPeriod = 20, bbStdDev = 2, cacheTTL = 0
        } = options;

        // 計算技術指標
        const smaTrend = calculate.SMA(prices, smaPeriod);
        const emaTrend = calculate.EMA(prices, emaPeriod);
        const macdSignal = calculate.MACD(prices, macdOptions);
        const RSI = calculate.RSI(prices, rsiPeriod);
        const bollingerBands = calculate.bollingerBands(prices);
        const { upper: upperBand, lower: lowerBand, pb: percentB } = bollingerBands;
        // todo 想進行快取，但沒有給symbol 的話會只取一個快取資料
        // // 檢查資料長度足夠
        // const priceLength = prices.length;
        // if (priceLength < Math.max(rsiPeriod, bbPeriod)) {
        //     throw new Error(`價格數據不足，至少需要 ${Math.max(rsiPeriod, bbPeriod)} 筆資料`);
        // }

        // // 計算技術指標（含快取）
        // const smaTrend = getCached(`SMA-${smaPeriod}-${priceLength}`, () => calculate.SMA(prices, smaPeriod), cacheTTL);
        // const emaTrend = getCached(`EMA-${emaPeriod}-${priceLength}`, () => calculate.EMA(prices, emaPeriod), cacheTTL);
        // const macdSignal = getCached(
        //     `MACD-${macdOptions.fastPeriod}-${macdOptions.slowPeriod}-${macdOptions.signalPeriod}-${priceLength}`,
        //     () => calculate.MACD(prices, macdOptions),
        //     cacheTTL
        // );
        // const RSI = getCached(`RSI-${rsiPeriod}-${priceLength}`, () => calculate.RSI(prices, rsiPeriod), cacheTTL);
        // const bollingerBands = getCached(
        //     `BB-${bbPeriod}-${bbStdDev}-${priceLength}`,
        //     () => calculate.bollingerBands(prices, bbPeriod, bbStdDev),
        //     cacheTTL
        // );
        // const { upper: upperBand, lower: lowerBand, pb: percentB } = bollingerBands;

        // 背離檢查
        // const divergences = divergenceChecker.checkDivergence(prices, RSI, currentPrice);
        // let divergence = [];
        // for (const d of divergences) {
        //     const decision = this.getDivergenceAction(d);
        //     divergence.push(`[${decision.action}] ${d.label} → ${decision.reason}`);
        // }
        const divergence = this.shouldTradeWithConfirmation(prices, RSI, macdSignal, currentPrice);

        // log('SMA:', smaTrend, 'EMA:', emaTrend, 'MACD:', macdSignal.histogram.toFixed(8));

        // 趨勢分析
        const rsi = RSI[RSI.length - 1];
        const fibonacciLevels = calculate.fibonacciLevels(prices);
        const trend = trendChecker.checkTrend(prices, currentPrice, bollingerBands, rsi, smaTrend, emaTrend, macdSignal, fibonacciLevels);

        // log(trend, '趨勢 |\n', divergence.join('\n'));
        log(trend, '趨勢 |', divergence.action, divergence.reason);
        log(`RSI ${Math.abs(rsiHigh - rsi) > Math.abs(rsi - rsiLow) ? rsiLow + '↓' : rsiHigh + '↑'}:`, rsi, '| PB:', percentB);
        log(this.getPriceLevel(bollingerBands, fibonacciLevels, currentPrice, entryPrice).join('\n'));
        log('最小獲利:', minProfitPercentage * 100, '% | 最大認賠:', maxLossPercentage * 100, '%');

        let action = 'HOLD';
        if (this.checkStopLoss(currentPrice, entryPrice, lowerBand, rsi, maxLossPercentage)) {
            action = 'STOP_LOSS';
            log('觸發認賠結算');
        }
        else if (rsi > rsiHigh) {
            if (entryPrice > 0) {
                action = 'HODL';

                if (trend === 'DOWNTREND') {
                    // 下跌趨勢，及時止盈止損
                    action = 'DOWN_TREND';
                }
                else if (trend === 'RESISTANCE' && fibonacciLevels['76.4%'] < currentPrice) {
                    if ((currentPrice - entryPrice) / entryPrice > minProfitPercentage) {
                        action = 'SELL';
                    } else {
                        action = 'GAZE';
                    }
                }
                else if (entryPrice < currentPrice) {
                    if (trend === 'OVERBOUGHT') {
                        action = 'OVER_BOUGHT';
                    }
                    else if (trend === 'UPTREND' && percentB > 1.2) {
                        if (rsi > 75) {
                            action = 'SELL';
                        } else {
                            action = 'GAZE';
                        }
                    }
                }
            }
        }
        else if (rsi < rsiLow) {
            if (trend === 'SUPPORT' && fibonacciLevels['23.6%'] > currentPrice) {
                action = 'BUY';
            }
            else if (trend === 'DOWNTREND' && rsi < 30) {
                if (entryPrice === 0 && rsi > 25) {
                    if (lowerBand > currentPrice) {
                        action = 'BUCKET';
                    } else {
                        action = 'GAZE';
                    }
                } else {
                    // 下跌趨勢，及時止盈止損
                    action = 'DOWN_TREND';
                }
            }
        }
        return { action, trend, rsi, bollingerBands, fibonacciLevels };
    }

    getPriceLevel(bollingerBands, fibonacciLevels, currentPrice, entryPrice) {
        const priceLevel = [];
        const { upper, middle, lower } = bollingerBands;
        [{
            n: '  upper', v: upper,
        }, {
            n: '  lower', v: lower,
        }, {
            n: '  middle', v: middle,
        }, {
            n: '> ticker', v: currentPrice,
        }, {
            n: ' [entry]', v: entryPrice,
        }, {
            n: '  fbi_23.6%', v: fibonacciLevels['23.6%'],
        }, {
            n: '  fbi_76.4%', v: fibonacciLevels['76.4%'],
        }].sort((a, b) => b.v - a.v).forEach(item => {
            if (item.v > 0)
                priceLevel.push(` ${item.n}\t${item.v}`);
            // log(' ', item.n, '\t', item.v);
        });
        return priceLevel;
    }

    checkStopLoss(currentPrice, entryPrice, lowerBand, rsi, maxLossPercentage = 0.05) {
        if (entryPrice === 0) {
            return false;
        }

        // 檢查是否超過最大損失比例
        const loss = (entryPrice - currentPrice) / entryPrice;
        if (loss >= maxLossPercentage) {
            console.log(`認賠觸發: 損失比例超過 ${maxLossPercentage * 100}%`);
            return true;
        }

        // 檢查是否跌破布林通道下軌並 RSI 過低
        if (currentPrice < lowerBand && rsi < 20) {
            console.log('認賠觸發: 價格跌破布林通道下軌，且 RSI 過低');
            return true;
        }

        return false;
    }

    /**
     * 根據背離訊號回傳操作建議
     * @param {Object} divergence - 單一背離訊號（含 type, strength, confirmation 等）
     * @returns {Object} 包含動作建議與原因
     */
    // getDivergenceAction(divergence) {
    //     const { type, strength, confirmation } = divergence;

    //     if (confirmation && strength === 'STRONG') {
    //         if (type === 'BULLISH') {
    //             return {
    //                 action: 'BUY',
    //                 reason: '強烈底背離且已確認，建議進場買入'
    //             };
    //         } else if (type === 'BEARISH') {
    //             return {
    //                 action: 'SELL',
    //                 reason: '強烈頂背離且已確認，建議清倉或放空'
    //             };
    //         }
    //     }

    //     if (!confirmation && strength === 'STRONG') {
    //         return {
    //             action: 'WATCH',
    //             reason: '背離強度高但尚未確認，建議觀察等待突破或跌破'
    //         };
    //     }

    //     if (confirmation && strength === 'MODERATE') {
    //         return {
    //             action: 'LIGHT_BUY_OR_SELL',
    //             reason: '中等強度背離已確認，可嘗試小部位操作'
    //         };
    //     }

    //     return {
    //         action: 'IGNORE',
    //         reason: '背離強度不足或尚未確認，不建議操作'
    //     };
    // }

    /**
     * 根據 RSI 與 MACD 的背離確認判斷交易行為
     * @param {Array} prices - 價格序列
     * @param {Array} rsi - RSI 指標序列
     * @param {Array} macd - MACD 指標序列
     * @param {number} currentPrice - 當前價格
     * @returns {Object} - 包含操作建議與理由
     */
    shouldTradeWithConfirmation(prices, rsi, macd, currentPrice) {
        const rsiSignals = divergenceChecker.checkDivergence(prices, rsi, currentPrice);
        const macdSignals = divergenceChecker.checkDivergence(prices, macd, currentPrice);

        for (const rsiSig of rsiSignals) {
            if (!rsiSig.confirmation || rsiSig.strength === 'WEAK') continue;

            const match = macdSignals.find(
                macdSig =>
                    macdSig.type === rsiSig.type &&
                    macdSig.confirmation &&
                    macdSig.strength !== 'WEAK'
            );

            if (match) {
                return {
                    action: rsiSig.type === 'BULLISH' ? 'BUY' : 'SELL',
                    reason: `確認 ${rsiSig.type} 背離 (RSI & MACD)：${rsiSig.label} | ${match.label}`
                };
            }
        }

        return { action: 'HOLD', reason: '無確認的雙重背離訊號' };
    }
}

module.exports = TradingStrategy;