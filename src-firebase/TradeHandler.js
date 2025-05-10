const { addNotifyKeyMap, removeNotifyKeyMap, applicate, broadcast } = require("./core/FirebaseBridge");
require('dotenv').config();
/**
 * 
  // setTimeout(() => {
  //   applicate(roomId, 'join', 'Hello World');// 使用applicate 傳遞資料給HOST
  //   // listen(false, roomId, 'Applicate');// 使用listen 進行監聽通道
  //   applicate(roomId, 'end');//使用END 結束 applicate 監聽通道, CLIENT 端無法請求
  // }, 1000);
  // setTimeout(() => applicate(roomId, 'join', 'Hello World2'), 2000);//KEY VALUE 傳遞到HOST
  // setTimeout(() => applicate(roomId, null), 3000);// 結束監聽通道
  // broadcast 可傳遞資料給CLIENT
 */

class TradeHandler {
    constructor(roomID, strategyProxy) {
        this.loginedPlayers = {};
        this.strategyProxy = strategyProxy;
        this.gaze = {};
        addNotifyKeyMap(roomID, {
            'verify': this.cmd_verify.bind(this),
            'execute': this.cmd_execute.bind(this),
            'fill': this.cmd_fill.bind(this),
            'pause': this.cmd_pause.bind(this),
            'resume': this.cmd_resume.bind(this),
            'profit': this.cmd_profit.bind(this),
            'stop': this.cmd_stop.bind(this),
            'bid': this.cmd_bid.bind(this),
            'ask': this.cmd_ask.bind(this),
            'tracking': this.cmd_tracking.bind(this),
            'query': this.cmd_query.bind(this),
            'gaze': this.cmd_gaze.bind(this),
            'quit': this.cmd_quit.bind(this),
            'end': this.cmd_end.bind(this),
            'ping': this.cmd_ping.bind(this),
        }, this);
    }

    cmd_verify(roomID, key, value) {
        const data = value.split(' '),
            playerID = data[0],
            verifyCode = data[1];

        this.loginedPlayers[playerID] = verifyCode === process.env.PASSWORD;
        if (this.loginedPlayers[playerID]) {
            value = `${playerID} success`;
        } else {
            value = `${playerID} fail`;
        }

        broadcast(roomID, key, value, [playerID]);
    }

    async cmd_execute(roomID, key, value) {
        const data = value.split(' '),
            playerID = data[0],
            baseSymbol = data[1],
            quoteSymbol = data[2],
            funds = data[3],
            verify = this.loginedPlayers[playerID];

        if (verify && baseSymbol && quoteSymbol && funds) {
            await this.strategyProxy.execute(baseSymbol, quoteSymbol, parseFloat(funds));
            value = `${playerID} success ${baseSymbol} ${quoteSymbol}`;
        } else {
            value = `${playerID} fail verify_${Number(verify)} ${baseSymbol} ${quoteSymbol} ${funds}`;
        }

        broadcast(roomID, key, value, [playerID]);
    }

    cmd_fill(roomID, key, value) {
        const data = value.split(' '),
            playerID = data[0],
            baseSymbol = data[1],
            quoteSymbol = data[2],
            funds = data[3],
            verify = this.loginedPlayers[playerID];

        if (verify && baseSymbol && quoteSymbol && funds) {
            this.strategyProxy.fill(baseSymbol, quoteSymbol, parseFloat(funds));
            value = `${playerID} success`;
        } else {
            value = `${playerID} fail verify_${Number(verify)} ${baseSymbol} ${quoteSymbol} ${funds}`;
        }

        broadcast(roomID, key, value, [playerID]);
    }

    cmd_pause(roomID, key, value) {
        const data = value.split(' '),
            playerID = data[0],
            baseSymbol = data[1] || '',
            quoteSymbol = data[2] || '',
            verify = this.loginedPlayers[playerID];

        if (verify) {
            this.strategyProxy.pause(baseSymbol, quoteSymbol);
            value = `${playerID} success ${baseSymbol} ${quoteSymbol}`;
        } else {
            value = `${playerID} fail verify_${Number(verify)}`;
        }

        broadcast(roomID, key, value, [playerID]);
    }

    cmd_resume(roomID, key, value) {
        const data = value.split(' '),
            playerID = data[0],
            baseSymbol = data[1] || '',
            quoteSymbol = data[2] || '',
            verify = this.loginedPlayers[playerID];

        if (verify) {
            this.strategyProxy.resume(baseSymbol, quoteSymbol);
            value = `${playerID} success ${baseSymbol} ${quoteSymbol}`;
        } else {
            value = `${playerID} fail verify_${Number(verify)}`;
        }

        broadcast(roomID, key, value, [playerID]);
    }

    cmd_profit(roomID, key, value) {
        const data = value.split(' '),
            playerID = data[0],
            baseSymbol = data[1] || '',
            quoteSymbol = data[2] || '',
            verify = this.loginedPlayers[playerID];

        if (verify) {
            this.strategyProxy.profit(baseSymbol, quoteSymbol);
            this.strategyProxy.resume(baseSymbol, quoteSymbol);//todo 看是要分開還是統一，目前是ui 操作先暫停再決定要profit或stop，之後再改成統一的
            value = `${playerID} success ${baseSymbol} ${quoteSymbol}`;
        } else {
            value = `${playerID} fail verify_${Number(verify)}`;
        }

        broadcast(roomID, key, value, [playerID]);
    }

    cmd_stop(roomID, key, value) {
        const data = value.split(' '),
            playerID = data[0],
            baseSymbol = data[1] || '',
            quoteSymbol = data[2] || '',
            verify = this.loginedPlayers[playerID];

        if (verify) {
            this.strategyProxy.stop(baseSymbol, quoteSymbol);
            value = `${playerID} success ${baseSymbol} ${quoteSymbol}`;
        } else {
            value = `${playerID} fail verify_${Number(verify)}`;
        }

        broadcast(roomID, key, value, [playerID]);
    }

    async cmd_bid(roomID, key, value) {
        const data = value.split(' '),
            playerID = data[0],
            baseSymbol = data[1],
            quoteSymbol = data[2],
            verify = this.loginedPlayers[playerID];

        if (verify && baseSymbol && quoteSymbol) {
            await this.strategyProxy.bid(baseSymbol, quoteSymbol);
            this.cmd_query(roomID, 'query', `${playerID}`);
        } else {
            value = `${playerID} fail verify_${Number(verify)} ${baseSymbol} ${quoteSymbol}`;
        }
        console.log(value);
    }

    async cmd_ask(roomID, key, value) {
        const data = value.split(' '),
            playerID = data[0],
            baseSymbol = data[1],
            quoteSymbol = data[2],
            verify = this.loginedPlayers[playerID];

        if (verify && baseSymbol && quoteSymbol) {
            await this.strategyProxy.ask(baseSymbol, quoteSymbol);
            this.cmd_query(roomID, 'query', `${playerID}`);
        } else {
            value = `${playerID} fail verify_${Number(verify)} ${baseSymbol} ${quoteSymbol}`;
        }
    }

    cmd_tracking(roomID, key, value) {
        const data = value.split(' '),
            playerID = data[0],
            verify = this.loginedPlayers[playerID];

        if (verify) {
            this.strategyProxy.tracking();
            value = `${playerID} success`;
        } else {
            value = `${playerID} fail verify_${Number(verify)}`;
        }

        broadcast(roomID, key, value, [playerID]);
    }

    cmd_query(roomID, key, value) {
        const data = value.split(' '),
            playerID = data[0];

        const assets = this.strategyProxy.query();
        value = `${playerID} ${JSON.stringify(assets)}`;
        broadcast(roomID, key, value, [playerID]);
    }

    cmd_gaze(roomID, key, value) {
        const data = value.split(' '),
            playerID = data[0],
            baseSymbol = data[1],
            quoteSymbol = data[2],
            gaze = data[3] === '1',
            verify = this.loginedPlayers[playerID];

        if (verify && baseSymbol && quoteSymbol) {
            const symbol = `${baseSymbol}_${quoteSymbol}`;
            this.gaze[symbol] = gaze;
            value = `${playerID} success ${baseSymbol} ${quoteSymbol} gaze_${Number(gaze)}`;
        } else {
            value = `${playerID} fail verify_${Number(verify)} ${baseSymbol} ${quoteSymbol}`;
        }

        broadcast(roomID, key, value, [playerID]);
    }

    cmd_quit(roomID, key, value) {
        const data = value.split(' '),
            playerID = data[0];

        delete this.loginedPlayers[playerID];
        broadcast(roomID, null, null, [playerID]);

        if (Object.keys(this.loginedPlayers).length === 0) {
            applicate(roomID, null);//移除連線
        }
    }

    cmd_end(roomID, key, value) {
        removeNotifyKeyMap(roomID, this);
        applicate(roomID, null);//移除連線
    }

    cmd_ping(roomID, key, value) {
        const data = value.split(' '),
            playerID = data[0];

        if (playerID) {
            broadcast(roomID, 'pong', value, [playerID]);
        } else {
            console.log('ping without playerID');
        }
    }
}

module.exports = TradeHandler;