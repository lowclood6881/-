// crimeTimeUtil.js
// 犯罪時間格式檢查與相關工具函式

/**
 * 檢查犯罪時間格式，回傳 {success, text}
 * @param {string} str
 * @returns {{success: boolean, text: string}}
 */
function checkCrimeTime(str) {
    if (!str) return {success:false, text:""};
    if (!/^\d+$/.test(str)) return {success:false, text:"僅能輸入數字"};
    if (str.length === 2 || str.length === 3) return {success:true, text:`${str}年間某日`};
    if (str.length === 4 || str.length === 5) {
        let year = str.slice(0, str.length - 2);
        let month = str.slice(-2);
        if (parseInt(month) < 1 || parseInt(month) > 12) return {success:false, text:"月份錯誤"};
        return {success:true, text:`${year}年${parseInt(month)}月間某日`};
    }
    if (str.length === 6 || str.length === 7) {
        let year = str.slice(0, str.length - 4);
        let month = str.slice(-4, -2);
        let day = str.slice(-2);
        let monthErr = (parseInt(month) < 1 || parseInt(month) > 12);
        let dayErr = false;
        if (!monthErr) {
            let maxDays = getMaxDaysInMonth(parseInt(year), parseInt(month));
            dayErr = (parseInt(day) < 1 || parseInt(day) > maxDays);
        }
        if (monthErr || dayErr) return {success:false, text: monthErr ? "月份錯誤" : "日期錯誤"};
        return {success:true, text:`${year}年${parseInt(month)}月${parseInt(day)}日某時`};
    }
    if (str.length === 8 || str.length === 9) {
        let year = str.slice(0, str.length - 6);
        let month = str.slice(-6, -4);
        let day = str.slice(-4, -2);
        let hour = str.slice(-2);
        let monthErr = (parseInt(month) < 1 || parseInt(month) > 12);
        let dayErr = false;
        let hourErr = false;
        if (!monthErr) {
            let maxDays = getMaxDaysInMonth(parseInt(year), parseInt(month));
            dayErr = (parseInt(day) < 1 || parseInt(day) > maxDays);
        }
        hourErr = (parseInt(hour) < 0 || parseInt(hour) > 23);
        if (monthErr || dayErr || hourErr) return {success:false, text: monthErr ? "月份錯誤" : (dayErr ? "日期錯誤" : "小時錯誤")};
        return {success:true, text:`${year}年${parseInt(month)}月${parseInt(day)}日${parseInt(hour)}時許`};
    }
    if (str.length === 10 || str.length === 11) {
        let year = str.slice(0, str.length - 8);
        let month = str.slice(-8, -6);
        let day = str.slice(-6, -4);
        let hour = str.slice(-4, -2);
        let min = str.slice(-2);
        let monthErr = (parseInt(month) < 1 || parseInt(month) > 12);
        let dayErr = false;
        let hourErr = false;
        let minErr = false;
        if (!monthErr) {
            let maxDays = getMaxDaysInMonth(parseInt(year), parseInt(month));
            dayErr = (parseInt(day) < 1 || parseInt(day) > maxDays);
        }
        hourErr = (parseInt(hour) < 0 || parseInt(hour) > 23);
        minErr = (parseInt(min) < 0 || parseInt(min) > 59);
        if (monthErr || dayErr || hourErr || minErr) return {success:false, text: monthErr ? "月份錯誤" : (dayErr ? "日期錯誤" : (hourErr ? "小時錯誤" : "分鐘錯誤"))};
        return {success:true, text:`${year}年${parseInt(month)}月${parseInt(day)}日${parseInt(hour)}時${parseInt(min)}分許`};
    }
    return {success:false, text:"格式錯誤"};
}

/**
 * 取得某年某月的天數
 * @param {number} year
 * @param {number} month
 * @returns {number}
 */
function getMaxDaysInMonth(year, month) {
    if ([1, 3, 5, 7, 8, 10, 12].includes(month)) return 31;
    if ([4, 6, 9, 11].includes(month)) return 30;
    if (month === 2) return isLeapYear(year) ? 29 : 28;
    return 31;
}

/**
 * 判斷是否為閏年（民國年）
 * @param {number} year
 * @returns {boolean}
 */
function isLeapYear(year) {
    if (year === 89) return false;
    return (year - 1) % 4 === 0 && year >= 77;
}

// 掛到全域，方便多個 html 共用
window.checkCrimeTime = checkCrimeTime;
window.getMaxDaysInMonth = getMaxDaysInMonth;
window.isLeapYear = isLeapYear; 