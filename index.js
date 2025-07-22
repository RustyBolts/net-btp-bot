const express = require('express');

const { login, listen } = require('./src-firebase/core/FirebaseBridge');
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

  // await clear('TEST', 'ONE');
  const roomId = '11111111';//randomString().toLocaleUpperCase().slice(0, 12);
  const trade = new TradeHandler(roomId, strategyProxy);
  listen(true, roomId, 'Applicate');// 啟用監聽通道 "Applicate"

  strategyProxy.tracking();
});
