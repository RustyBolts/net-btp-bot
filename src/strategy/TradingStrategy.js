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
const e = require("express");
const calculate = new StrategyCalculate();
const trendChecker = new MarketTrendChecker();
const divergenceChecker = new DivergenceChecker();

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
            rsiLow = 30, rsiHigh = 70, maxLossPercentage = 0.05,
            smaPeriod = 50, emaPeriod = 20, rsiPeriod = 14,
            macdOptions = { fastPeriod: 12, slowPeriod: 26, signalPeriod: 9 }
        } = options;

        // 計算技術指標
        const smaTrend = calculate.SMA(prices, smaPeriod);
        const emaTrend = calculate.EMA(prices, emaPeriod);
        const macdSignal = calculate.MACD(prices, macdOptions);
        const RSI = calculate.RSI(prices, rsiPeriod);
        const bollingerBands = calculate.bollingerBands(prices);
        const { upper: upperBand, lower: lowerBand, pb: percentB } = bollingerBands;

        // 背離檢查
        const divergences = divergenceChecker.checkDivergence(prices, RSI);
        var divergence = 'NEUTRAL';
        if (divergences.length > 0) {
            divergence = divergences[divergences.length - 1].type;
        }

        // log('SMA:', smaTrend, 'EMA:', emaTrend, 'MACD:', macdSignal.histogram.toFixed(8));

        // 趨勢分析
        const rsi = RSI[RSI.length - 1];
        const fibonacciLevels = calculate.fibonacciLevels(prices);
        const trend = trendChecker.checkTrend(prices, currentPrice, bollingerBands, rsi, smaTrend, emaTrend, macdSignal, fibonacciLevels);

        log(trend, '趨勢 |', divergence, '背離');
        log(`RSI ${Math.abs(rsiHigh - rsi) > Math.abs(rsi - rsiLow) ? rsiLow + '↓' : rsiHigh + '↑'}:`, rsi, '| PB:', percentB);
        log(this.getPriceLevel(bollingerBands, fibonacciLevels, currentPrice, entryPrice).join('\n'));

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
                else if (trend === 'RESISTANCE') {
                    if ((currentPrice - entryPrice) / entryPrice > 0.05) {
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
                            action = 'OVER_BOUGHT';
                        } else {
                            action = 'GAZE';
                        }
                    }
                }
            }
        }
        else if (rsi < rsiLow) {
            if (trend === 'SUPPORT') {
                action = 'BUY';
            }
            else if (trend === 'DOWNTREND' && rsi < 30) {
                if (entryPrice === 0 && rsi > 25) {
                    if (lowerBand > currentPrice) {
                        action = 'BUCKET';
                    } else {
                        action = 'GAZE';
                    }
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

    isBullish(prices, currentPrice) {
        const fibonacciLevels = calculate.fibonacciLevels(prices);
        // console.log('止損停止交易檢查', fibonacciLevels, currentPrice);
        return currentPrice < fibonacciLevels['23.6%'];
    }
}

module.exports = TradingStrategy;

/**
 * 優化建議
    1 異常處理
    在價格數據不足時（如小於 RSI 或布林通道的 period），應提示錯誤。
    2 性能優化
    如果頻繁計算指標，考慮緩存過去的計算結果，避免重複計算。
    3 靈活配置
    允許用戶動態配置 RSI 和布林通道的參數（例如周期和標準差倍數）。
 */