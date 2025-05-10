require('dotenv').config();
const scriptUrl = process.env.GOOGLE_SHEET_URL;
async function writeToGoogleScript(dataArray) {
    try {
        const result = await require('axios').get(scriptUrl, {
            params: {
                action: 'writeDataFromSheet',
                dataArray: dataArray.join(','), // 將數據以逗號分隔
            }
        });
        console.log(result.data);
    } catch (error) {
        console.error('發生錯誤：', error);
    };
}

/**
 * 以Google試算表存入交易紀錄
 * @param {string} symbol 
 * @param {number} funds 
 * @param {number} avgPrice 
 * @param {object} order 
 * @returns 
 */
async function googleLogcat(symbol, funds, avgPrice = 0, order = {}) {
    const time = new Date().toLocaleDateString('zh-TW', { hour12: false, hour: '2-digit', minute: '2-digit' });
    const { orderId = '-', status = '-', side = '-', price = '-', quantity = '-', spent = '-' } = order;
    // 呼叫函式: 要寫入試算表的數據陣列
    return writeToGoogleScript([
        // 交易資訊
        symbol, time, funds, avgPrice || '-',
        // 訂單資訊
        orderId, status, side, price, quantity, spent,
    ]);
}

module.exports = {
    googleLogcat,
};