const { addNotifyKeyMap, removeNotifyKeyMap, applicate } = require("./core/FirebaseBridge");

class RoomHandler {
    constructor(roomID) {
        this.roommates = [];
        addNotifyKeyMap(roomID, {
            'join': this.cmd_join.bind(this),
            'quit': this.cmd_quit.bind(this),
            'end': this.cmd_end.bind(this),
        }, this);
    }

    cmd_join(roomID, key, value) {
        console.log(key, value);
        const data = value.split(' ');
        let playerID = data[0];
        this.roommates.push(playerID);
    }

    cmd_quit(roomID, key, value) {
        console.log(key, value);
        const data = value.split(' ');
        let playerID = data[0];
        this.roommates.some((item, index) => {
            if (item === playerID) {
                this.roommates.splice(index, 1);
                return true;
            }
        });
    }

    cmd_end(roomID, key, value) {
        removeNotifyKeyMap(roomID, this);
        // applicate(roomId, null);//移除連線
    }
}

module.exports = RoomHandler;