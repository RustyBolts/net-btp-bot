const axios = require('axios')
require('dotenv').config();

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const TELEGRAM_API = `https://api.telegram.org/bot${BOT_TOKEN}/setMyCommands`;

class TelegramCryptoBotCommands {
    async setBotCommands() {
        const commands = [
            { command: 'verify', description: '身份驗證: verify <驗證碼>' },
            { command: 'tracking', description: '追蹤交易' },
            { command: 'execute', description: '執行策略交易: execute <代幣類別> <資金數量>' },
            { command: 'fill', description: '填充資金: fill <代幣類別> <資金數量>' },
            { command: 'query', description: '查詢資金運用: query' },
            { command: 'pause', description: '暫停交易: pause <代幣類別> (代幣類別為 all 表示暫停所有交易)' },
            { command: 'resume', description: '恢復交易: resume <代幣類別> (代幣類別為 all 表示恢復所有交易)' },
            { command: 'stop', description: '結束交易: stop <代幣類別> (代幣類別為 all 表示結束所有交易)' },
            { command: 'profit', description: '止盈交易: profit <代幣類別> (代幣類別為 all 表示結束所有交易)' },
            { command: 'rsi', description: 'RSI交易範圍設定: rsi <代幣類別> <RSI上限>-<RSI下限> <K線圖時間間隔>' },
        ];

        const payload = {
            commands,
            scope: { type: 'default' },
            language_code: 'en',
        };

        const res = await axios.post(TELEGRAM_API, payload);
        console.log(res.data);
        return res.data;
    }
}

module.exports = TelegramCryptoBotCommands;
