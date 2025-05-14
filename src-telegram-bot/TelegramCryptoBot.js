const TelegramBot = require('node-telegram-bot-api');

require('dotenv').config();
const token = process.env.TELEGRAM_BOT_TOKEN;
const bot = new TelegramBot(token, { polling: true });

class TelegramCryptoBot {
    constructor(strategyProxy) {
        this.strategyProxy = strategyProxy;
        this.loginedPlayers = {};
        this.verify();
        this.query();
        this.execute();
        this.fill();
        this.pause();
        this.resume();
        this.profit();
        this.stop();
        this.tracking();
        this.ip();
        this.rsi();

        this.strategyProxy.notifyCallback = (message) => {
            Object.keys(this.loginedPlayers).forEach(chatId => {
                bot.sendMessage(chatId, message);
            });
        };
    }

    verify() {
        const cmd = '/verify';
        bot.onText(cmd, (msg) => {
            const password = msg.text.replace(`${cmd} `, '');
            const chatId = msg.chat.id;

            if (password === process.env.PASSWORD) {
                bot.sendMessage(chatId, `${msg.chat.first_name} 證驗通過`);

                this.loginedPlayers[chatId] = true;
            } else {
                bot.sendMessage(chatId, '驗證錯誤');
            }

            // {
            //     message_id: 55,
            //     from: {
            //       id: 571031162,
            //       is_bot: false,
            //       first_name: 'Naert',
            //       username: 'NaertLin',
            //       language_code: 'zh-hans'
            //     },
            //     chat: {
            //       id: 571031162,
            //       first_name: 'Naert',
            //       username: 'NaertLin',
            //       type: 'private'
            //     },
            //     date: 1732703155,
            //     text: '/login abc',
            //     entities: [ { offset: 0, length: 6, 
            //   type: 'bot_command' } ]
            //   }
        });
    }

    query() {
        var assets = {};
        const cmd = '/query';
        bot.onText(cmd, (msg) => {
            const chatId = msg.chat.id;
            assets = this.strategyProxy.query();

            const inline = Object.keys(assets).map(symbol => {
                return [{ text: symbol, callback_data: symbol }];
            });
            bot.sendMessage(chatId, '查询:運作中代幣列表', {
                reply_markup: {
                    inline_keyboard: inline
                }
            });
        });

        bot.on('callback_query', async (callbackQuery) => {
            const chatId = callbackQuery.message.chat.id;
            const symbol = callbackQuery.data;
            bot.sendMessage(chatId, `${symbol}交易對:\n持有代幣${assets[symbol].base}\n運作資金${assets[symbol].quote.toFixed(2)}`);
        });
    }

    execute() {
        const cmd = '/execute';
        bot.onText(cmd, (msg) => {
            const chatId = msg.chat.id;

            if (this.loginedPlayers[chatId]) {
                const split = msg.text.split(' ');
                const cryptoSymbol = split[1];
                const quantity = parseFloat(split[2]);

                if (!cryptoSymbol) {
                    return bot.sendMessage(chatId, '請輸入代幣類別');
                }

                if (!quantity) {
                    return bot.sendMessage(chatId, '請輸入資金(USDT)數量');
                }

                this.strategyProxy.execute(cryptoSymbol.toUpperCase(), 'USDT', quantity);
                const assets = this.strategyProxy.query();
                const symbol = `${cryptoSymbol.toUpperCase()}USDT`;

                var message = `執行交易策略:\n新增 ${cryptoSymbol.toUpperCase()}USDT 交易對, 資金加入 ${quantity} USDT`;
                if (assets[symbol]) {
                    message += `\n已持有 ${assets[symbol].base} 代幣\n運作資金 ${assets[symbol].quote.toFixed(2)} USDT`;
                }
                bot.sendMessage(chatId, message);

            } else {
                bot.sendMessage(chatId, '未完成身份驗證');
            }
        });
    }

    fill() {
        const cmd = '/fill';
        bot.onText(cmd, (msg) => {
            const chatId = msg.chat.id;

            if (this.loginedPlayers[chatId]) {
                const split = msg.text.split(' ');
                const cryptoSymbol = split[1];
                const quantity = parseFloat(split[2]);

                if (!cryptoSymbol) {
                    return bot.sendMessage(chatId, '請輸入代幣類別');
                }

                if (!quantity) {
                    return bot.sendMessage(chatId, '請輸入資金(USDT)數量');
                }

                this.strategyProxy.fill(cryptoSymbol.toUpperCase(), 'USDT', quantity);
                const assets = this.strategyProxy.query();
                const symbol = `${cryptoSymbol.toUpperCase()}USDT`;

                if (assets[symbol]) {
                    var message = `${symbol} 交易對人工金流 ${quantity} USDT`;
                    message += `\n已持有 ${assets[symbol].base} 代幣\n運作資金 ${assets[symbol].quote.toFixed(2)} USDT`;
                    bot.sendMessage(chatId, message);
                } else {
                    bot.sendMessage(chatId, '現無此交易對執行中，請使用 /execute 指令');
                }
            } else {
                bot.sendMessage(chatId, '未完成身份驗證');
            }
        });
    }

    pause() {
        const cmd = '/pause';
        bot.onText(cmd, (msg) => {
            const chatId = msg.chat.id;

            if (this.loginedPlayers[chatId]) {
                const split = msg.text.split(' ');
                const cryptoSymbol = split[1];
                if (cryptoSymbol && cryptoSymbol !== 'all') {
                    const assets = this.strategyProxy.query();
                    const symbol = `${cryptoSymbol.toUpperCase()}USDT`;
                    if (!assets[symbol]) {
                        return bot.sendMessage(chatId, '策略中無此交易對加入');
                    }

                    this.strategyProxy.pause(cryptoSymbol.toUpperCase(), 'USDT');
                    bot.sendMessage(chatId, `暫停交易策略: 指定代幣 ${symbol}`);
                } else if (cryptoSymbol === 'all') {
                    this.strategyProxy.pause();
                    bot.sendMessage(chatId, '暫停交易策略: 所有代幣');
                } else {
                    bot.sendMessage(chatId, '請輸入代幣類別');
                }
            } else {
                bot.sendMessage(chatId, '未完成身份驗證');
            }
        });
    }

    resume() {
        const cmd = '/resume';
        bot.onText(cmd, (msg) => {
            const chatId = msg.chat.id;

            if (this.loginedPlayers[chatId]) {
                const split = msg.text.split(' ');
                const cryptoSymbol = split[1];
                if (cryptoSymbol && cryptoSymbol !== 'all') {
                    const assets = this.strategyProxy.query();
                    const symbol = `${cryptoSymbol.toUpperCase()}USDT`;
                    if (!assets[symbol]) {
                        return bot.sendMessage(chatId, '策略中無此交易對加入');
                    }

                    this.strategyProxy.resume(cryptoSymbol.toUpperCase(), 'USDT');
                    bot.sendMessage(chatId, `恢復追蹤交易策略: 指定代幣 ${symbol}`);
                } else if (cryptoSymbol === 'all') {
                    this.strategyProxy.resume();
                    bot.sendMessage(chatId, '恢復追蹤交易策略: 所有代幣');
                } else {
                    bot.sendMessage(chatId, '請輸入代幣類別');
                }
            } else {
                bot.sendMessage(chatId, '未完成身份驗證');
            }
        });
    }

    profit() {
        const cmd = '/profit';
        bot.onText(cmd, (msg) => {
            const chatId = msg.chat.id;

            if (this.loginedPlayers[chatId]) {
                const split = msg.text.split(' ');
                const cryptoSymbol = split[1];
                const profitRate = parseFloat(split[2]);
                if (cryptoSymbol && cryptoSymbol !== 'all') {
                    const assets = this.strategyProxy.query();
                    const symbol = `${cryptoSymbol.toUpperCase()}USDT`;
                    if (!assets[symbol]) {
                        return bot.sendMessage(chatId, '策略中無此交易對加入');
                    }

                    this.strategyProxy.profit(cryptoSymbol.toUpperCase(), 'USDT', true, profitRate);
                    bot.sendMessage(chatId, `結束交易策略 - 止盈: 指定代幣 ${symbol}`);
                } else if (cryptoSymbol === 'all') {
                    this.strategyProxy.profit();
                    bot.sendMessage(chatId, '結束交易策略 - 止盈: 所有代幣');
                } else {
                    bot.sendMessage(chatId, '請輸入代幣類別');
                }
            } else {
                bot.sendMessage(chatId, '未完成身份驗證');
            }
        });
    }

    stop() {
        const cmd = '/stop';
        bot.onText(cmd, (msg) => {
            const chatId = msg.chat.id;

            if (this.loginedPlayers[chatId]) {
                const split = msg.text.split(' ');
                const cryptoSymbol = split[1];
                if (cryptoSymbol && cryptoSymbol !== 'all') {
                    const assets = this.strategyProxy.query();
                    const symbol = `${cryptoSymbol.toUpperCase()}USDT`;
                    if (!assets[symbol]) {
                        return bot.sendMessage(chatId, '策略中無此交易對加入');
                    }

                    this.strategyProxy.stop(cryptoSymbol.toUpperCase(), 'USDT');
                    bot.sendMessage(chatId, `結束交易策略 - 止損: 指定代幣 ${symbol}`);
                } else if (cryptoSymbol === 'all') {
                    this.strategyProxy.stop();
                    bot.sendMessage(chatId, '結束交易策略 - 止損: 所有代幣');
                } else {
                    bot.sendMessage(chatId, '請輸入代幣類別');
                }
            } else {
                bot.sendMessage(chatId, '未完成身份驗證');
            }
        });
    }

    tracking() {
        const cmd = '/tracking';
        bot.onText(cmd, (msg) => {
            const chatId = msg.chat.id;
            if (this.loginedPlayers[chatId]) {
                this.strategyProxy.tracking();
                bot.sendMessage(chatId, '交易策略追蹤中');
            } else {
                bot.sendMessage(chatId, '未完成身份驗證');
            }
        });
    }

    ip() {
        const cmd = '/ip';
        bot.onText(cmd, (msg) => {
            const chatId = msg.chat.id;

            if (this.loginedPlayers[chatId]) {
                require('axios').get('https://api.ipify.org?format=json')
                    .then((response) => {
                        bot.sendMessage(chatId, `Public IP Address: ${response.data.ip}`);
                    })
                    .catch((error) => {
                        bot.sendMessage(chatId, `Error occurred: ${error}`);
                    });
            }
        });
    }

    rsi() {
        const cmd = '/rsi';
        bot.onText(cmd, (msg) => {
            const chatId = msg.chat.id;

            let message = 'RSI 調整回傳訊息:';
            if (this.loginedPlayers[chatId]) {
                const split = msg.text.split(' ');
                const cryptoSymbol = split[1];
                if (cryptoSymbol && cryptoSymbol !== 'all') {
                    const assets = this.strategyProxy.query();
                    const symbol = `${cryptoSymbol.toUpperCase()}USDT`;
                    console.log(symbol, assets[symbol]);
                    if (!assets[symbol]) {
                        return bot.sendMessage(chatId, '策略中無此交易對加入');
                    }

                    const values = split[2].split('-');
                    if (values.length === 2) {
                        const high = parseInt(values[0], 10);
                        const low = parseInt(values[1], 10);
                        if (typeof high === 'number' && typeof low === 'number') {
                            if (high < low) {
                                message = `RSI 輸入順序為 {high}-{low}, high不可低於low`;
                            } else {
                                this.strategyProxy.rsi(cryptoSymbol.toUpperCase(), 'USDT', high, low);
                                message = `調整交易RSI - ${symbol}: HIGH ${high} LOW ${low}`;
                            }
                        } else {
                            message = `輸入 /rsi ${cryptoSymbol} ${high}-${low}\n錯誤, 需要數字`;
                        }

                    } else {
                        message = '輸入格式為 /rsi {symbol} {high}-{low}';
                    }
                } else if (cryptoSymbol === 'all') {
                    bot.sendMessage(chatId, '調整交易RSI : 所有代幣');

                    const values = split[2].split('-');
                    if (values.length === 2) {
                        const high = parseInt(values[0], 10);
                        const low = parseInt(values[1], 10);
                        if (typeof high === 'number' && typeof low === 'number') {
                            if (high < low) {
                                message = `RSI 輸入順序為 {high}-{low}, high不可低於low`;
                            } else {
                                this.strategyProxy.rsi('', '', high, low);
                                message = `調整交易RSI - 所有交易對: HIGH ${high} LOW ${low}`;
                            }
                        } else {
                            message = `輸入 /rsi ${high}-${low}\n錯誤, 需要數字`;
                        }

                    } else {
                        message = '輸入格式為 /rsi {high}-{low}';
                    }
                } else {
                    bot.sendMessage(chatId, '請輸入代幣類別');
                }

            } else {
                message = '未完成身份驗證';
            }
            bot.sendMessage(chatId, message);
        });
    }
}

module.exports = TelegramCryptoBot;