const express = require('express');

const TelegramCryptoBot = require('./src-telegram-bot/TelegramCryptoBot');
const { login, read, write, listen, applicate } = require('./src-firebase/core/FirebaseBridge');
const GridTrading = require('./src/GridTrading');
const TradeHandler = require('./src-firebase/TradeHandler');
const { randomString } = require('./src-spot/helpers/utils');

require('dotenv').config();
const app = express();
const PORT = process.env.PORT || 8000;

const proxyId = process.env.PROXY_ID;
const proxyPw = process.env.PROXY_PW;

app.listen(PORT, async () => {
  console.log(`Server running on port ${PORT}`);

  const userid = await login(proxyId, proxyPw);
  const strategyProxy = new GridTrading();
  const bot = new TelegramCryptoBot(strategyProxy);

  // await clear('TEST', 'ONE');
  const roomId = '11111111';//randomString().toLocaleUpperCase().slice(0, 12);
  const trade = new TradeHandler(roomId, strategyProxy);
  listen(true, roomId, 'Applicate');// 啟用監聽通道 "Applicate"

  strategyProxy.tracking();
});

/**
 * https://www.npmjs.com/package/node-telegram-bot-api
 * npm i node-telegram-bot-api
 */