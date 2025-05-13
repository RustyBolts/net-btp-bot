const fs = require('fs');
const { Console } = require('console');

class SpotLogger {
    constructor() {
        this.logger = {};
    }

    getFilePath(baseSymbol, quoteSymbol) {
        return `./logs/spot-${baseSymbol}${quoteSymbol}-stdout.log`;
    }

    // 紀錄 log
    log(baseSymbol, quoteSymbol, ...message) {
        const symbol = `${baseSymbol}${quoteSymbol}`;
        if (!this.logger[symbol]) {
            const filePath = this.getFilePath(baseSymbol, quoteSymbol);
            const output = fs.createWriteStream(filePath);
            if (!fs.existsSync(filePath)) {
                fs.writeFileSync(filePath, 'first update');
            }
            this.logger[symbol] = new Console({ stdout: output });
        }

        this.logger[symbol].log(...message);

        console.log(...message);
    }

    // 紀錄 error
    error(...message) {
        this.log('\n[error]', message, '\n');
    }

    // 紀錄 warn
    warn(...message) {
        this.log('\n[warn]', message, '\n');
    }

    // 紀錄 info
    info(...message) {
        this.log('\n[info]', message, '\n');
    }

    // 紀錄 debug
    debug(...message) {
        this.log('\n[debug]', message, '\n');
    }
}

module.exports = SpotLogger;