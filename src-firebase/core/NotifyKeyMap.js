class NotifyKeyMap {
    constructor(scope, keyMap) {
        this.scope = scope;
        this.callbackMap = keyMap;
    }

    onReceive(connectID, key, value) {
        const callback = this.callbackMap[key];
        if (callback) {
            try {
                callback.call(this.scope, connectID, key, value);
            } catch (error) {
                console.error(`執行回調時錯誤: ${error.message}`);
            }
        }
    }
}

module.exports = NotifyKeyMap;