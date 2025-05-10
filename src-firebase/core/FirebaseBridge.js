const { initializeApp } = require('firebase/app');
const { getAuth, signInWithEmailAndPassword } = require('firebase/auth');
const { getDatabase, ref, child, onValue, get, set, update, push, off, remove } = require('firebase/database');
const NotifyKeyMap = require('./NotifyKeyMap');
const e = require('express');

require('dotenv').config();
const PROJECT = process.env.PROJECT_NAME;
const notifyKeyMaps = {};
const database = getDatabase(initializeApp({
    apiKey: process.env.FIREBASE_API_KEY,
    authDomain: "fir-test-756e1.firebaseapp.com",
    databaseURL: "https://fir-test-756e1.firebaseio.com",
    projectId: "fir-test-756e1",
    storageBucket: "fir-test-756e1.appspot.com",
    messagingSenderId: "182531440628"
}));

// google 帳號登入
async function login(email, password) {
    try {
        const userCredential = await signInWithEmailAndPassword(getAuth(), email, password);
        return userCredential.user.uid;
    } catch (error) {
        throw new Error(`登入失敗: ${error.message}`);
    }
}

async function getData(path) {
    try {
        return await get(ref(database, path)).then(snapshot => snapshot.val());
    } catch (error) {
        throw new Error(`讀取失敗: ${error.message}`);
    }
}

async function setData(path, data) {
    try {
        return await set(ref(database, path), data);
    } catch (error) {
        throw new Error(`寫入失敗: ${error.message}`);
    }
}

async function updateData(paths, postKey, data) {
    const updates = {};
    paths.forEach(path => {
        updates[`${path}/${postKey}`] = data;
    });
    // console.log(updates, '--', data);
    return await update(ref(database), updates);
}

async function removeData(path) {
    return await remove(ref(database, path));
}

function addEventListener(path, callback, onlyOnce = false) {
    onValue(ref(database, path), (snapshot) => {
        const data = snapshot.val();
        data && callback(data);
    }, { onlyOnce });
}

function removeEventListener(path) {
    off(ref(database, path));
}

function onReceive(connectID, data) {
    let key = data, value = '';
    let spaceIndex = data.indexOf(' ');
    if (spaceIndex > 0) {
        key = data.slice(0, spaceIndex);
        value = data.slice(spaceIndex + 1);
    }
    notifyKeyMaps[connectID]?.forEach((notifyKeymap) => notifyKeymap.onReceive(connectID, key, value));
};

function addNotifyKeyMap(connectID, notifyKeymap, scope) {
    if (!notifyKeyMaps[connectID]) {
        notifyKeyMaps[connectID] = [];
    } else {
        notifyKeyMaps[connectID].some((notifyKeymap, index) => {
            if (notifyKeymap.scope === scope) {
                notifyKeyMaps[connectID].splice(index, 1);
                return true;
            }
            return false;
        });
    }
    notifyKeyMaps[connectID].push(new NotifyKeyMap(scope, notifyKeymap));
}

function removeNotifyKeyMap(connectID, scope) {
    const keymaps = notifyKeyMaps[connectID];
    if (keymaps) {
        const index = keymaps.findIndex((notifyKeymap) => notifyKeymap.scope === scope);
        if (index > -1) keymaps.splice(index, 1);
        if (keymaps.length === 0) delete notifyKeyMaps[connectID];
    }
}

module.exports = {
    login: login,
    getPostKey: () => push(child(ref(database), 'posts')).key,
    read: async (fold, key) => await getData(`${PROJECT}/D/${fold}/${key}`),
    write: async (fold, key, data) => await setData(`${PROJECT}/D/${fold}/${key}`, data),
    clear: async (fold, key) => await removeData(`${PROJECT}/D/${fold}/${key}`),
    addNotifyKeyMap: addNotifyKeyMap,
    removeNotifyKeyMap: removeNotifyKeyMap,
    listen: (enable, connectID, side, clientID = '') => {
        const path = `${PROJECT}/C/${connectID}/${clientID}/${side}`;
        enable
            ? addEventListener(path, (data) => onReceive(connectID, data))
            : removeEventListener(path);
    },
    applicate: async (connectID, key, value = '') => {
        const refPaths = [`${PROJECT}/C/${connectID}`];
        const data = value ? `${key} ${value}` : key;
        return await updateData(refPaths, 'Applicate', data);
    },
    broadcast: async (connectID, key, value = '', clientIDs = []) => {
        const refPaths = clientIDs.map(clientID => `${PROJECT}/C/${connectID}/${clientID}`);
        const data = value ? `${key} ${value}` : key;
        return await updateData(refPaths, 'Broadcast', data);
    }
};

// 讀取及寫入資料
// https://firebase.google.com/docs/database/web/read-and-write?hl=zh-tw