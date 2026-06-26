require('dotenv').config();

const TelegramBot = require('node-telegram-bot-api');
const axios = require('axios');
const schedule = require('node-schedule');
const fs = require('fs');
const qs = require('qs');
const nodemailer = require('nodemailer');
const { generatePrakiraanImages } = require('./prakiraan');
const { MONTHS: KALEIDOSKOP_MONTHS, generateMonthlyKaleidoscope, generateWeeklyKaleidoscope } = require('./kaleidoskop');
const kecamatanMap = require('./DashboardNextJS/kecamatan_map.json');

// ================= CONFIG =================
const TOKEN = process.env.BOT_TOKEN;
const GMAIL_USER = process.env.GMAIL_USER;
const GMAIL_PASS = process.env.GMAIL_PASS;

const URL = 'http://172.19.0.202/cgi-bin/cmcgi/cmss_web_input.process.pl';
const REALTIME_URL = 'http://172.22.64.250:3127';
const REALTIME_USER = 'admin';
const REALTIME_PASS = 'admin';

const BMKGSATU_URL = 'https://bmkgsatu.bmkg.go.id';
const BMKGSATU_USER = process.env.BMKGSATU_USER;
const BMKGSATU_PASS = process.env.BMKGSATU_PASS;
const BMKGSATU_STATION_NAME = 'Stasiun Meteorologi Pangsuma';

const ALLOWED_USERNAMES = ['neptruesun'];

// ================= BOT INIT =================
const bot = new TelegramBot(TOKEN, { polling: true });

bot.deleteMyCommands().catch(e => console.log('DELETE COMMANDS ERROR:', e.message));

let schedules = [];
let history = [];
let verifiedUsers = {}; 
let jobs = {};
let sessions = {};
let messageHistory = {};

// ================= STORAGE =================
function saveSchedules() { fs.writeFileSync('schedules.json', JSON.stringify(schedules, null, 2)); }
function loadSchedules() { if (fs.existsSync('schedules.json')) { try { schedules = JSON.parse(fs.readFileSync('schedules.json')); } catch(e){schedules=[];} } }
function saveHistoryLog() { fs.writeFileSync('history.json', JSON.stringify(history, null, 2)); }
function loadHistoryLog() { if (fs.existsSync('history.json')) { try { history = JSON.parse(fs.readFileSync('history.json')); } catch(e){history=[];} } else { fs.writeFileSync('history.json', '[]'); } }
function saveUsers() { fs.writeFileSync('users.json', JSON.stringify(verifiedUsers, null, 2)); }
function loadUsers() { if (fs.existsSync('users.json')) { try { verifiedUsers = JSON.parse(fs.readFileSync('users.json')); } catch(e){verifiedUsers={};} } }

// ================= AUTH FUNCTIONS =================
function isAllowed(msg) {
    return true;
}

function isAuthenticated(userId) {
    const user = verifiedUsers[userId];
    if (!user) return false;
    const now = Date.now();
    if (now - user.lastVerified > 7 * 24 * 60 * 60 * 1000) return false;
    if (now - user.lastActive > 3 * 24 * 60 * 60 * 1000) return false;
    user.lastActive = now;
    saveUsers();
    return true;
}

// ================= EMAIL SETUP =================
const transporter = nodemailer.createTransport({ 
    service: 'gmail', 
    auth: { user: GMAIL_USER, pass: GMAIL_PASS } 
});

async function sendOTP(email, otp) {
    try { 
        await transporter.sendMail({ 
            from: `"🏛️ DIGITALISASI BMKG" <${GMAIL_USER}>`, 
            to: email, 
            subject: '🔒 Bot Access Verification', 
            text: `Kode verifikasi Anda adalah: ${otp}\n\nKode ini berlaku selama 10 menit. Jangan berikan kode ini kepada siapapun.` 
        }); 
        return true; 
    } catch (e) { 
        console.log('MAIL ERR:', e.message); 
        return false; 
    }
}

// ================= TRACKING =================
function addToHistory(chatId, messageId) {
    if (!messageHistory[chatId]) messageHistory[chatId] = [];
    messageHistory[chatId].push(messageId);
}
const _sendMessage = bot.sendMessage.bind(bot);
bot.sendMessage = async (chatId, text, options) => {
    try { 
        const msg = await _sendMessage(chatId, text, options); 
        if (msg) addToHistory(chatId, msg.message_id); 
        return msg; 
    } catch (e) { console.log('BOT SEND ERROR:', e.message); }
};

const _editMessageText = bot.editMessageText.bind(bot);
bot.editMessageText = async (text, options) => {
    try {
        const msg = await _editMessageText(text, options);
        if (msg && typeof msg === 'object') addToHistory(options.chat_id, msg.message_id);
        return msg;
    } catch (e) {}
};

// ================= API CALLS =================
async function sendMetar(message) {
    try {
        await axios.post(URL, qs.stringify({ message }), {
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            timeout: 10000
        });
        return true;
    } catch (err) { return false; }
}

async function verifyConnection() {
    try { await axios.get(URL, { timeout: 8000 }); return true; } 
    catch (err) { return !!err.response; }
}

async function getLatestSensorData() {
    try {
        const lRes = await axios.post(`${REALTIME_URL}/api/login`, { username: REALTIME_USER, password: REALTIME_PASS }, { timeout: 5000 });
        const token = lRes.data.data.accessToken;
        
        // 1. Get latest METAR text from /api/code (usually updated every 30-60 mins)        
        const resCode = await axios.get(`${REALTIME_URL}/api/code`, { headers: { 'Authorization': `Bearer ${token}` }, timeout: 5000 });
        const codeData = resCode.data?.data?.[0] || {};

        // 2. Get latest minute-by-minute raw data from historical CSV
        const dateStr = new Date().toISOString().split('T')[0];
        const resHist = await axios.get(`${REALTIME_URL}/api/historical/${dateStr}.csv`, { headers: { 'Authorization': `Bearer ${token}` }, timeout: 10000 });
        
        const lines = resHist.data.trim().split(/\r?\n/);
        if (lines.length < 2) {
            console.log('CSV empty, using codeData fallback');
            return codeData;
        }

        const d = lines[0].includes(';') ? ';' : ',', h = lines[0].split(d).map(s => s.trim().replace(/^\ufeff/, ''));
        const lastRow = lines[lines.length - 1].split(d);
        const getI = (n) => h.indexOf(n);
        const cl = (v) => {
            if (!v || v === '' || v === 'null') return NaN;
            let n = parseFloat(v.toString().replace(/\"/g,'').replace(',','.'));
            return isNaN(n) ? NaN : n;
        };

        const raw = {
            icao_id: codeData.raw_data?.icao_id || 'WIOP',
            temperature: cl(lastRow[getI('temperature_avg_60')]),
            dewpoint: cl(lastRow[getI('dewpoint_avg_60')]),
            humidity: cl(lastRow[getI('humidity_avg_60')]),
            wind_dir: cl(lastRow[getI('wind_direction_prevailing_60')]),
            wind_speed: cl(lastRow[getI('wind_speed_avg_60')]) * 1.94384, // convert m/s to KT
            qnh: cl(lastRow[getI('qnh_avg_60')]),
            qfe: cl(lastRow[getI('qfe_avg_60')])
        };

        // Final fallback to codeData values if CSV has NaNs for critical fields
        if (isNaN(raw.temperature)) raw.temperature = codeData.raw_data?.temperature || 0;
        if (isNaN(raw.dewpoint)) raw.dewpoint = codeData.raw_data?.dewpoint || 0;
        if (isNaN(raw.qnh)) raw.qnh = codeData.raw_data?.qnh || 1013;

        return {
            metar_text: codeData.metar_text || 'NO RECENT METAR',
            timestamp: (parseInt(lastRow[0]) || Date.now()/1000) * 1000,
            raw_data: raw
        };
    } catch (e) { console.log('FETCH ERR:', e.message); return null; }
}

async function fetchRealtimeData() {
    const data = await getLatestSensorData();
    if (!data) return '❌ *FAILED:* Could not reach sensor server.';
    const raw = data.raw_data;
    let rh = raw.humidity;
    if (!rh || isNaN(rh)) rh = 100 * Math.pow((112 - 0.1 * raw.temperature + raw.dewpoint) / (112 + 0.9 * raw.temperature), 8);
    return `🏛️ *DIGITALISASI BMKG*\n\n📊 *REALTIME DATA SENSOR*\n\n📝 *METAR TEXT:*\n\`${data.metar_text}\`\n\n📍 *Station:* ${raw.icao_id}\n🌡 *Temp:* ${raw.temperature.toFixed(1)}°C\n💧 *Dewpoint:* ${raw.dewpoint.toFixed(1)}°C\n🌫 *Humidity:* ${Math.round(rh)}%\n💨 *Wind:* ${Math.round(raw.wind_dir||0)}° / ${raw.wind_speed.toFixed(1)} KT\n📉 *Pressure:* QNH ${Math.floor(raw.qnh||1013)} / QFE ${Math.floor(raw.qfe||1000)} hPa\n\n🕒 *Last Update:*\n${new Date(data.timestamp).toLocaleString('en-GB', {timeZone: 'UTC'})} UTC`;
}

// ================= DATA PROCESSING =================
async function generateIkhtisar(dateStr, chatId, loaderMsgId) {
    try {
        if (loaderMsgId) await bot.editMessageText(`⏳ *[1/3] Downloading:* Fetching raw records for ${dateStr}...`, { chat_id: chatId, message_id: loaderMsgId, parse_mode: 'Markdown' });
        const lRes = await axios.post(`${REALTIME_URL}/api/login`, { username: REALTIME_USER, password: REALTIME_PASS }, { timeout: 5000 });
        const token = lRes.data.data.accessToken;
        const res = await axios.get(`${REALTIME_URL}/api/historical/${dateStr}.csv`, { headers: { 'Authorization': `Bearer ${token}` }, timeout: 35000 });
        if (loaderMsgId) await bot.editMessageText(`⏳ *[2/3] Analyzing:* Calculating extreme parameters...`, { chat_id: chatId, message_id: loaderMsgId, parse_mode: 'Markdown' });
        
        const lines = res.data.trim().split(/\r?\n/); if (lines.length < 2) return { report: "❌ *ERROR:* No data records found for " + dateStr };
        const d = lines[0].includes(';') ? ';' : ',', h = lines[0].split(d).map(s => s.trim().replace(/^\ufeff/, ''));
        const rows = lines.slice(1).map(l => l.split(d));
        const getI = (n) => h.indexOf(n);
        const tI = getI('temperature_avg_60'), hI = getI('humidity_avg_60'), rI = getI('precipitation_accum_3600'), wsI = getI('wind_speed_max_60'), wdI = getI('wind_direction_prevailing_60');
        
        let tS=0,tC=0,tX=-999,tN=999,hS=0,hC=0,hX=-999,hN=999,wsX=0,rain=0;
        const sectors = ["N","NE","E","SE","S","SW","W","NW"];
        const sectorFreqs = new Array(8).fill(0);

        rows.forEach(r => {
            const cl = (v) => (!v||v==='')?NaN:parseFloat(v.toString().replace(/\"/g,'').replace(',','.'));
            const tv=cl(r[tI]),hv=cl(r[hI]),wv=cl(r[wsI]),rv=cl(r[rI]);
            if (!isNaN(tv)) { tS+=tv; tC++; tX=Math.max(tX,tv); tN=Math.min(tN,tv); }
            if (!isNaN(hv)) { hS+=hv; hC++; hX=Math.max(hX,hv); hN=Math.min(hN,hv); }
            if (!isNaN(wv)) wsX=Math.max(wsX,wv);
            
            const wdv = cl(r[wdI]);
            if (!isNaN(wdv)) {
                // 8 sectors: each is 45 degrees wide.
                // N: 337.5 - 22.5 (centered at 0)
                let idx = Math.floor(((wdv + 22.5) % 360) / 45);
                sectorFreqs[idx]++;
            }
            if (new Date(r[0]*1000).getUTCMinutes() === 59 && !isNaN(rv)) rain+=rv;
        });
        if (tC===0) return { report: "❌ *ERROR:* Data file is empty or corrupted." };
        
        const domIdx = sectorFreqs.indexOf(Math.max(...sectorFreqs));
        const dom = sectorFreqs[domIdx] > 0 ? `${sectors[domIdx]} (${(domIdx * 45).toFixed(0)}°)` : "-";
        
        if (loaderMsgId) await bot.editMessageText(`⏳ *[3/3] Finalizing:* Formatting daily report...`, { chat_id: chatId, message_id: loaderMsgId, parse_mode: 'Markdown' });
        
        let rep = `📊 *IKHTISAR HARIAN - ${dateStr}*\n\n🌡 *TEMPERATUR*\n- 🔺 Max: *${tX.toFixed(1)}°C*\n- 🔻 Min: *${tN.toFixed(1)}°C*\n- ⚖️ Avg: *${(tS/tC).toFixed(1)}°C*\n\n💧 *KELEMBAPAN (RH)*\n- 🔺 Max: *${Math.round(hX)}%*\n- 🔻 Min: *${Math.round(hN)}%*\n- ⚖️ Avg: *${Math.round(hS/hC)}%*\n\n💨 *ANGIN*\n- ⚡ Max: *${wsX.toFixed(1)} m/s* (${(wsX*1.94).toFixed(1)} KT)\n- 🧭 Dominan: *${dom}*\n\n🌧 *HUJAN 24 JAM*\n- ☔ Total: *${rain.toFixed(1)} mm*`;
        return { report: rep, rawData: res.data };
    } catch (e) { return { report: "❌ *ERROR:* " + e.message }; }
}

async function generateGraphData(type, dateStr, chatId, loaderMsgId) {
    const updateStatus = async (status) => {
        if (loaderMsgId) {
            const time = new Date().toLocaleTimeString('en-GB', { hour12: false });
            try { await bot.editMessageText(`⏳ *GENERATE ${type.toUpperCase()}*\n\`[${time}] ${status}\``, { chat_id: chatId, message_id: loaderMsgId, parse_mode: 'Markdown' }); } catch (e) {}
        }
    };

    try {
        await updateStatus("Authenticating...");
        const lRes = await axios.post(`${REALTIME_URL}/api/login`, { username: REALTIME_USER, password: REALTIME_PASS }, { timeout: 5000 });
        
        await updateStatus(`Downloading ${dateStr}.csv...`);
        const res = await axios.get(`${REALTIME_URL}/api/historical/${dateStr}.csv`, { headers: { 'Authorization': `Bearer ${lRes.data.data.accessToken}` }, timeout: 30000 });
        
        await updateStatus("Processing data...");
        const lines = res.data.trim().split(/\r?\n/); 
        if (lines.length < 2) throw new Error("Dataset is empty");
        
        const d = lines[0].includes(';') ? ';' : ',', h = lines[0].split(d).map(s => s.trim().replace(/^\ufeff/, ''));
        const rows = lines.slice(1).map(l => l.split(d)), getI = (n) => h.indexOf(n);
        const cl = (v) => (!v||v==='')?NaN:parseFloat(v.toString().replace(/\"/g,'').replace(',','.'));
        
        let config = {}, caption = `📊 *ANALISA ${type.toUpperCase()} - ${dateStr}*`;

        if (type === '💨 Windrose') {
            await updateStatus("Saving data for Python script...");
            fs.writeFileSync('temp_data.csv', res.data);
            await updateStatus("Generating image via Python...");
            const { execSync } = require('child_process');
            let output;
            try {
                output = execSync(`python generate_windrose.py temp_data.csv windrose.png`).toString();
            } catch (err) {
                throw new Error("Python script failed: " + err.message);
            }
            const summaryMatch = output.match(/Summary: Dominant=(.*), MaxSpeed=(.*)/);
            if (summaryMatch) {
                caption += `\n\n💨 *Summary:*\n- 🧭 Dominan: *${summaryMatch[1]}*\n- ⚡ Max: *${summaryMatch[2]} KT*`;
            }
            return { photoBuffer: fs.readFileSync('windrose.png'), caption };
        } else if (type === '🌡 T-Td-RH') {            const tI = getI('temperature_avg_60'), hI = getI('humidity_avg_60'), tdI = getI('dewpoint_avg_60');
            const lbls = [], tD = [], tdD = [], hD = [];
            rows.forEach((r, i) => { if (i % 60 === 0) { const ts = new Date(r[0]*1000); lbls.push(ts.toISOString().substr(11, 5)); tD.push(cl(r[tI])); tdD.push(cl(r[tdI])); hD.push(cl(r[hI])); } });
            config = { type: 'line', data: { labels: lbls, datasets: [{ label: 'Temp', data: tD, borderColor: 'red' }, { label: 'Td', data: tdD, borderColor: 'green' }, { label: 'RH', data: hD, borderColor: 'blue' }] } };
        } else if (type === '🌧 Rainfall') {
            const rI = getI('precipitation_accum_3600'), lbls = [], rD = []; let tot = 0;
            rows.forEach(r => { const ts = new Date(r[0]*1000); if (ts.getUTCMinutes() === 59) { const v = cl(r[rI])||0; lbls.push(ts.toISOString().substr(11, 5)); rD.push(v); tot += v; } });
            caption += `\n\n🌧 *Total: ${tot.toFixed(1)} mm*`;
            config = { type: 'bar', data: { labels: lbls, datasets: [{ label: 'Rain (mm)', data: rD, backgroundColor: 'blue' }] } };
        }

        await updateStatus("Rendering...");
        const url = `https://quickchart.io/chart?c=${encodeURIComponent(JSON.stringify(config))}&width=800&height=800&version=2`;

        const imgRes = await axios.get(url, { responseType: 'arraybuffer', timeout: 20000 });
        await updateStatus("Uploading...");
        return { photoBuffer: imgRes.data, caption };
    } catch (e) { 
        await updateStatus(`❌ FAIL: ${e.message}`);
        return { report: `❌ *ERROR:* ${e.message}` }; 
    }
}

// ================= SCHEDULER =================
function formatMetarWindDirection(value) {
    const degrees = Number(value);
    if (!Number.isFinite(degrees)) return '360';
    const normalized = ((degrees % 360) + 360) % 360;
    const rounded = Math.round(normalized / 10) * 10;
    return String(rounded === 0 ? 360 : rounded).padStart(3, '0');
}

function registerSchedule(item) {
    const job = schedule.scheduleJob({ hour: item.hour, minute: item.minute, tz: 'Etc/UTC' }, async () => {
        let msg = item.message;
        let isSmart = false;
        if (item.type === 'SMART') {
            isSmart = true;
            console.log(`[SCHEDULE] Running SMART METAR for ID: ${item.id}`);
            const s = await getLatestSensorData();
            if (s && s.raw_data) {
                const r = s.raw_data;
                const day = new Date().getUTCDate().toString().padStart(2, '0');
                const time = String(item.hour).padStart(2,'0')+String(item.minute).padStart(2,'0');
                
                // Wind logic: Calm if < 1 KT
                const wSpd = Math.round(r.wind_speed || 0);
                const wDir = formatMetarWindDirection(r.wind_dir);
                const w = wSpd < 1 ? '00000KT' : `${wDir}${String(wSpd).padStart(2,'0')}KT`;
                
                const f = (v) => {
                    const rv = Math.round(v || 0);
                    return (rv < 0 ? 'M' : '') + Math.abs(rv).toString().padStart(2, '0');
                };

                const qnh = Math.floor(r.qnh || 1013);
                msg = `SAID40 ${r.icao_id} ${day}${time}\nMETAR ${r.icao_id} ${day}${time}Z ${w} ${item.visibility} ${item.weather} ${item.clouds} ${f(r.temperature)}/${f(r.dewpoint)} Q${qnh.toString().padStart(4,'0')} NOSIG=`;
                console.log(`[SCHEDULE] Generated METAR: ${msg.replace(/\n/g, ' ')}`);
            } else {
                console.error(`[SCHEDULE] FAILED to fetch sensor data for ID: ${item.id}`);
                bot.sendMessage(item.chatId, `🚨 *SCHEDULE FAILED*\nCould not fetch sensor data for SMART METAR ID \`${item.id}\` at ${item.hour}:${item.minute} UTC.`, { parse_mode: 'Markdown' });
                return;
            }
        }
        
        let success = false, att = 0; 
        while (!success && att < 4) { 
            att++; 
            if (att>1) await new Promise(r=>setTimeout(r,30000)); 
            success = await sendMetar(msg); 
        }

        if (success) {
            history.push({ id: item.id, message: msg, sender: item.createdBy||'SYSTEM', timestamp: new Date().toISOString() });
            saveHistoryLog();
            schedules = schedules.filter(x=>x.id!==item.id);
            if (jobs[item.id]) jobs[item.id].cancel();
            saveSchedules();
            
            const typeLabel = isSmart ? '🚀 SMART SCHEDULE' : '⏰ MANUAL SCHEDULE';
            bot.sendMessage(item.chatId, `✅ *METAR DELIVERED*\n\n📌 *Type:* ${typeLabel}\n🆔 *ID:* \`${item.id}\`\n📝 *Sandi:*\n\`${msg}\`\n🚀 *Status:* SUCCESS`, { parse_mode: 'Markdown' });
        } else {
            bot.sendMessage(item.chatId, `🚨 *DELIVERY FAILED*\n\n🆔 *ID:* \`${item.id}\`\nUTC: ${String(item.hour).padStart(2,'0')}:${String(item.minute).padStart(2,'0')}\n📝 *Sandi:*\n\`${msg}\`\n\nPlease check server connection.`, {
                parse_mode: 'Markdown',
                reply_markup: { inline_keyboard: [[{ text: '🔄 Retry Now', callback_data: `retry_${item.id}` }]] }
            });
        }
    });
    jobs[item.id] = job;
}

// ================= MENUS =================
function mainMenu() { return { reply_markup: { keyboard: [['📈 Ikhtisar', '☁️ Prakiraan'], ['📊 Graph', '🌐 BMKGsatu'], ['🚀 AR Weather'], ['❌ Close']], resize_keyboard: true } }; }
function prakiraanMenu() {
    return {
        reply_markup: {
            keyboard: [
                ['☁️ Infografis Prakiraan'],
                ['🗺️ Peta Kecamatan (Mini App)'],
                ['🏠 Back to Home']
            ],
            resize_keyboard: true
        }
    };
}
function arWeatherMenu() {
    return {
        reply_markup: {
            keyboard: [
                [{ text: "🎥 Buka Kamera AR", web_app: { url: "https://untuk-vercel.vercel.app/ar-weather" } }],
                [{ text: "🗺️ Buka Peta Kecamatan", web_app: { url: "https://untuk-vercel.vercel.app/kecamatan-map" } }],
                ['🏠 Back to Home']
            ],
            resize_keyboard: true
        }
    };
}
function graphMenu() { return { reply_markup: { keyboard: [['💨 Windrose', '🌡 T-Td-RH'], ['🌧 Rainfall'], ['🏠 Back to Home']], resize_keyboard: true } }; }
function metarMenu() { return { reply_markup: { keyboard: [['📊 Realtime Data', '📤 Send Now'], ['⏰ Manual Schedule', '✨ Smart Schedule'], ['📋 Active Schedule', '📜 History'], ['🔌 Check Connection', '🧹 Clear Chat'], ['🏠 Back to Home']], resize_keyboard: true } }; }
function bmkgsatuMenu() { return { reply_markup: { keyboard: [['🗓 Kaleidoskop Bulanan'], ['🔍 Cek Koneksi', '🏠 Back to Home']], resize_keyboard: true } }; }
function kaleidoskopYearKeyboard() {
    const currentYear = new Date().getFullYear();
    const years = Array.from({ length: 6 }, (_, index) => String(currentYear - index));
    return {
        keyboard: [...chunkKeyboard(years, 3), ['\u274c Cancel', '\ud83c\udfe0 Back to Home']],
        resize_keyboard: true
    };
}
function kaleidoskopMonthKeyboard(year) {
    const current = new Date();
    const months = KALEIDOSKOP_MONTHS.map((name, index) => ({ name, month: index + 1 }))
        .filter(item => year < current.getFullYear() || item.month <= current.getMonth() + 1)
        .map(item => item.name);
    return {
        keyboard: [...chunkKeyboard(months, 3), ['\u2b05\ufe0f Pilih Tahun'], ['\u274c Cancel', '\ud83c\udfe0 Back to Home']],
        resize_keyboard: true
    };
}
function chunkKeyboard(items, size) {
    return Array.from({ length: Math.ceil(items.length / size) }, (_, row) => items.slice(row * size, row * size + size));
}
function kaleidoskopYearReplyKeyboard() {
    const currentYear = new Date().getFullYear();
    const years = Array.from({ length: 6 }, (_, index) => String(currentYear - index));
    return {
        reply_markup: {
            keyboard: [...chunkKeyboard(years, 3), ['\u274c Cancel', '\ud83c\udfe0 Back to Home']],
            resize_keyboard: true
        }
    };
}
function kaleidoskopMonthReplyKeyboard(year) {
    const current = new Date();
    const months = KALEIDOSKOP_MONTHS.map((name, index) => ({ name, month: index + 1 }))
        .filter(item => year < current.getFullYear() || item.month <= current.getMonth() + 1)
        .map(item => item.name);
    return {
        reply_markup: {
            keyboard: [...chunkKeyboard(months, 3), ['\u2b05\ufe0f Pilih Tahun'], ['\u274c Cancel', '\ud83c\udfe0 Back to Home']],
            resize_keyboard: true
        }
    };
}
function formatKeyboardDate(dateText) {
    return `${Number(dateText.slice(8, 10))} ${KALEIDOSKOP_MONTHS[Number(dateText.slice(5, 7)) - 1]} ${dateText.slice(0, 4)}`;
}
function buildKaleidoskopWeekOptions() {
    const today = new Date();
    const utcToday = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()));
    const day = utcToday.getUTCDay() || 7;
    const currentMonday = new Date(utcToday);
    currentMonday.setUTCDate(utcToday.getUTCDate() - day + 1);
    return Array.from({ length: 8 }, (_, index) => {
        const start = new Date(currentMonday);
        start.setUTCDate(currentMonday.getUTCDate() - index * 7);
        const end = new Date(start);
        end.setUTCDate(start.getUTCDate() + 6);
        if (end > utcToday) end.setTime(utcToday.getTime());
        const startDate = start.toISOString().slice(0, 10);
        const endDate = end.toISOString().slice(0, 10);
        return {
            label: `${formatKeyboardDate(startDate)} - ${formatKeyboardDate(endDate)}`,
            startDate,
            endDate
        };
    });
}
function kaleidoskopWeekReplyKeyboard(options) {
    return {
        reply_markup: {
            keyboard: [...options.map(option => [option.label]), ['\u274c Cancel', '\ud83c\udfe0 Back to Home']],
            resize_keyboard: true
        }
    };
}
function bmkgsatuMenu() {
    return {
        reply_markup: {
            keyboard: [
                ['\ud83d\uddd3 Kaleidoskop Bulanan', '\ud83d\udcc5 Kaleidoskop Mingguan'],
                ['\ud83d\udd0d Cek Koneksi', '\ud83c\udfe0 Back to Home']
            ],
            resize_keyboard: true
        }
    };
}
async function sendKaleidoskopResult(cid, period, generator) {
    const loader = await bot.sendMessage(cid, `*Menyiapkan Kaleidoskop ${period}...*`, { parse_mode: 'Markdown' });
    try {
        const updateProgress = async text => {
            await bot.editMessageText(`*Kaleidoskop ${period}*\n${text}...`, {
                chat_id: cid,
                message_id: loader.message_id,
                parse_mode: 'Markdown'
            });
        };
        const result = await generator(updateProgress);
        await bot.deleteMessage(cid, loader.message_id).catch(() => {});
        await bot.sendPhoto(cid, result.image, {
            caption: `*Kaleidoskop Cuaca Pangsuma - ${period}*\n\nDiolah dari ${result.summary.observationCount} pengamatan Sinoptik.`,
            parse_mode: 'Markdown'
        });
        delete sessions[cid];
        return bot.sendMessage(cid, 'Infografis kaleidoskop selesai.', { ...backSubMenu('BMKGsatu') });
    } catch (error) {
        console.error('KALEIDOSKOP ERR:', error.message);
        await bot.editMessageText(`*Kaleidoskop gagal dibuat*\n\n${error.message}`, {
            chat_id: cid,
            message_id: loader.message_id,
            parse_mode: 'Markdown',
            ...backSubMenu('BMKGsatu')
        });
        delete sessions[cid];
        return;
    }
}
function ikhtisarDateMenu() { 
    const t = new Date().toISOString().split('T')[0], y = new Date(Date.now()-86400000).toISOString().split('T')[0];
    return { reply_markup: { keyboard: [[`Hari Ini (${t})`], [`Kemarin (${y})`], ['📅 Open Calendar'], ['🏠 Back to Home']], resize_keyboard: true } };
}
function backSubMenu(cat) { return { reply_markup: { keyboard: [[`🔙 Back to ${cat.toUpperCase()} MENU`], ['🏠 Back to Home']], resize_keyboard: true } }; }
function hourPicker() { return { reply_markup: { keyboard: [['00','01','02','03','04','05'],['06','07','08','09','10','11'],['12','13','14','15','16','17'],['18','19','20','21','22','23'],['❌ Cancel','🏠 Back to Home']], resize_keyboard: true } }; }
function minutePicker() { return { reply_markup: { keyboard: [['00','30'],['❌ Cancel','🏠 Back to Home']], resize_keyboard: true } }; }
function weatherPicker() { return { reply_markup: { keyboard: [['Blank (None)'],['TS','BR','-RA','NSW'],['❌ Cancel','🏠 Back to Home']], resize_keyboard: true } }; }

function createCalendarKeyboard(year, month) {
    const names = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'], d = new Date(year, month, 1), kb = [];
    const prev = new Date(year, month - 1, 1), next = new Date(year, month + 1, 1);
    kb.push([{ text: '◀', callback_data: `cal_nav_${prev.getFullYear()}_${prev.getMonth()}` }, { text: `${names[month]} ${year}`, callback_data: 'cal_ignore' }, { text: '▶', callback_data: `cal_nav_${next.getFullYear()}_${next.getMonth()}` }]);
    kb.push(['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map(x => ({ text: x, callback_data: 'cal_ignore' })));
    let row = []; for (let i = 0; i < d.getDay(); i++) row.push({ text: ' ', callback_data: 'cal_ignore' });
    while (d.getMonth() === month) { const date = d.getDate(); row.push({ text: String(date), callback_data: `cal_set_${year}-${String(month + 1).padStart(2, '0')}-${String(date).padStart(2, '0')}` }); if (row.length === 7) { kb.push(row); row = []; } d.setDate(date + 1); }
    if (row.length > 0) { while (row.length < 7) row.push({ text: ' ', callback_data: 'cal_ignore' }); kb.push(row); }
    return { inline_keyboard: kb };
}

// ================= HANDLERS =================
bot.on('callback_query', async (q) => {
    if (!isAllowed(q)) return;
    const cid = q.message.chat.id, data = q.data;
    if (data && data.startsWith('kal_')) {
        await bot.answerCallbackQuery(q.id, { text: 'Pilih periode dari keyboard bawah.' }).catch(() => {});
        return bot.sendMessage(cid, 'Menu kaleidoskop sekarang memakai keyboard bawah. Silakan buka lagi dari BMKGsatu.', { ...bmkgsatuMenu() });
    }
    if (data === 'kal_cancel') {
        delete sessions[cid];
        await bot.answerCallbackQuery(q.id);
        await bot.deleteMessage(cid, q.message.message_id).catch(() => {});
        return bot.sendMessage(cid, 'Operasi kaleidoskop dibatalkan.', { ...bmkgsatuMenu() });
    }
    if (data === 'kal_back_year') {
        await bot.answerCallbackQuery(q.id);
        return bot.editMessageText('🗓 *Pilih tahun kaleidoskop:*', {
            chat_id: cid,
            message_id: q.message.message_id,
            parse_mode: 'Markdown',
            ...kaleidoskopYearReplyKeyboard()
        });
    }
    if (data.startsWith('kal_year_')) {
        const year = Number(data.split('_')[2]);
        sessions[cid] = { mode: 'kaleidoskop_month', year };
        await bot.answerCallbackQuery(q.id);
        return bot.editMessageText(`🗓 *Kaleidoskop ${year}*\nPilih bulan:`, {
            chat_id: cid,
            message_id: q.message.message_id,
            parse_mode: 'Markdown',
            reply_markup: kaleidoskopMonthKeyboard(year)
        });
    }
    if (data.startsWith('kal_month_')) {
        const [, , yearText, monthText] = data.split('_');
        const year = Number(yearText), month = Number(monthText);
        await bot.answerCallbackQuery(q.id);
        await bot.deleteMessage(cid, q.message.message_id).catch(() => {});
        if (!isAuthenticated(cid)) {
            delete sessions[cid];
            sessions[cid] = { mode: 'auth_email', target: '🌐 BMKGsatu' };
            return bot.sendMessage(cid, '🔒 *VERIFIKASI DIPERLUKAN*\n\nUntuk alasan keamanan, silakan masukkan email *@bmkg.go.id* Anda untuk melanjutkan:', { parse_mode: 'Markdown' });
        }
        const period = `${KALEIDOSKOP_MONTHS[month - 1]} ${year}`;
        const loader = await bot.sendMessage(cid, `⏳ *Menyiapkan Kaleidoskop ${period}...*`, { parse_mode: 'Markdown' });
        try {
            const updateProgress = async text => {
                await bot.editMessageText(`⏳ *Kaleidoskop ${period}*\n${text}...`, {
                    chat_id: cid,
                    message_id: loader.message_id,
                    parse_mode: 'Markdown'
                });
            };
            const result = await generateMonthlyKaleidoscope(year, month, BMKGSATU_USER, BMKGSATU_PASS, updateProgress);
            await bot.deleteMessage(cid, loader.message_id).catch(() => {});
            await bot.sendPhoto(cid, result.image, {
                caption: `🗓 *Kaleidoskop Cuaca Pangsuma — ${period}*\n\nDiolah dari ${result.summary.observationCount} pengamatan Sinoptik.`,
                parse_mode: 'Markdown'
            });
            delete sessions[cid];
            return bot.sendMessage(cid, '✅ Infografis kaleidoskop selesai.', { ...backSubMenu('BMKGsatu') });
        } catch (error) {
            console.error('KALEIDOSKOP ERR:', error.message);
            await bot.editMessageText(`❌ *Kaleidoskop gagal dibuat*\n\n${error.message}`, {
                chat_id: cid,
                message_id: loader.message_id,
                parse_mode: 'Markdown',
                ...backSubMenu('BMKGsatu')
            });
            delete sessions[cid];
            return;
        }
    }
    if (data === 'cal_ignore') return bot.answerCallbackQuery(q.id);
    if (data.startsWith('cal_nav_')) {
        const [_, __, y, m] = data.split('_');
        bot.editMessageText('Select Date:', { chat_id: cid, message_id: q.message.message_id, reply_markup: createCalendarKeyboard(parseInt(y), parseInt(m)) });
    } else if (data.startsWith('cal_set_')) {
        const dStr = data.substring(8), mode = (sessions[cid] || {}).mode || 'ikhtisar_date';
        bot.answerCallbackQuery(q.id); bot.deleteMessage(cid, q.message.message_id);
        const ldr = await bot.sendMessage(cid, `⏳ *Memproses data untuk ${dStr}...*`, { parse_mode: 'Markdown' });
        if (mode === 'ikhtisar_date') {
            const res = await generateIkhtisar(dStr, cid, ldr.message_id);
            if (res.report) { await bot.sendMessage(cid, res.report, { parse_mode: 'Markdown' }); bot.sendMessage(cid, '✅ *Proses Selesai.*', { parse_mode: 'Markdown', ...backSubMenu('Ikhtisar') }); }
        } else {
            if (!isAuthenticated(cid)) {
                bot.deleteMessage(cid, ldr.message_id).catch(() => {});
                delete sessions[cid];
                sessions[cid] = { mode: 'auth_email', target: '📊 Graph' };
                return bot.sendMessage(cid, '🔒 *VERIFIKASI DIPERLUKAN*\n\nUntuk alasan keamanan, silakan masukkan email *@bmkg.go.id* Anda untuk melanjutkan:', { parse_mode: 'Markdown' });
            }
            const res = await generateGraphData((sessions[cid]||{}).chartType, dStr, cid, ldr.message_id);
            if (res.photoBuffer) { await bot.sendPhoto(cid, res.photoBuffer, { caption: res.caption, parse_mode: 'Markdown' }); bot.sendMessage(cid, '✅ *Grafik Berhasil Dibuat.*', { parse_mode: 'Markdown', ...backSubMenu('Graph') }); }
            else bot.sendMessage(cid, res.report || 'Error', { parse_mode: 'Markdown', ...backSubMenu('Graph') });
        }
        delete sessions[cid];
    } else if (data.startsWith('retry_')) {
        const item = schedules.find(x => x.id === Number(data.split('_')[1])); if (item && await sendMetar(item.message)) bot.sendMessage(cid, '✅ *RETRY SUCCESS*', { parse_mode: 'Markdown', ...backSubMenu('METAR') });
    } else if (data.startsWith('delete_')) {
        const id = Number(data.split('_')[1]); 
        schedules = schedules.filter(x => x.id !== id); 
        if (jobs[id]) {
            jobs[id].cancel();
            delete jobs[id];
        }
        saveSchedules(); 
        bot.sendMessage(cid, '🗑 *Jadwal Terhapus*', { parse_mode: 'Markdown', ...backSubMenu('METAR') });
    } else if (data.startsWith('kecamatan_')) {
        const kName = data.split('_')[1];
        const info = kecamatanMap[kName];
        if (!info) return bot.sendMessage(cid, '❌ *Kecamatan tidak ditemukan.*');
        
        // Fetch forecast based on adm4
        // Since we don't have a specific single-kecamatan fetcher, we can use the batch fetch
        const ldr = await bot.sendMessage(cid, `⏳ *Mengambil prakiraan untuk ${kName}...*`, { parse_mode: 'Markdown' });
        try {
            const data = await fetch('https://api.bmkg.go.id/publik/prakiraan-cuaca?adm4=' + info.adm4, { cache: 'no-store' }).then(r => r.json());
            const entry = data.data[0];
            const cuaca = entry.cuaca[0][0]; // Take first time slot
            bot.editMessageText(`☁️ *Prakiraan Cuaca ${kName}*\n\n📍 *Kecamatan:* ${kName}\n🌡 *Suhu:* ${cuaca.t}°C\n💧 *Kelembapan:* ${cuaca.hu}%\n💨 *Angin:* ${cuaca.ws} KT (${cuaca.wd})\n⛈ *Cuaca:* ${cuaca.weather_desc}`, { chat_id: cid, message_id: ldr.message_id, parse_mode: 'Markdown' });
        } catch(e) {
            bot.editMessageText(`❌ *Gagal mengambil data:* ${e.message}`, { chat_id: cid, message_id: ldr.message_id, parse_mode: 'Markdown' });
        }
    } else if (data === 'back_prakiraan') {
        bot.editMessageText('☁️ *Prakiraan Menu*', { chat_id: cid, message_id: q.message.message_id, parse_mode: 'Markdown', ...prakiraanMenu() });
    } else if (data === 'back_home') { delete sessions[cid]; bot.sendMessage(cid, '🏛️ *DIGITALISASI BMKG*', { parse_mode: 'Markdown', ...mainMenu() }); }
    bot.answerCallbackQuery(q.id).catch(() => {});
});

bot.on('message', async (msg) => {
    if (!isAllowed(msg) || !msg.text) return;
    const text = msg.text, cid = msg.chat.id;

    if (text === '/start' || text === '🏠 Back to Home') { delete sessions[cid]; return bot.sendMessage(cid, '🏛️ *DIGITALISASI BMKG*\nSelamat datang di Pangsuma Budi.', { parse_mode: 'Markdown', ...mainMenu() }); }
    
    // Auth Check
    const isAuth = isAuthenticated(cid);
    const session = sessions[cid];
    if ((text === '✈️ METAR' || text === '/metar' || text === '📊 Graph' || text === '/graph' || text === '🌐 BMKGsatu' || text === '/bmkgsatu') && !isAuth) { 
        sessions[cid] = { mode: 'auth_email', target: text }; 
        return bot.sendMessage(cid, '🔒 *VERIFIKASI DIPERLUKAN*\n\nUntuk alasan keamanan, silakan masukkan email *@bmkg.go.id* Anda untuk melanjutkan:', { parse_mode: 'Markdown' }); 
    }
    if (session && session.mode === 'auth_email') {
        if (!text.endsWith('@bmkg.go.id')) return bot.sendMessage(cid, '❌ *Format Salah:* Gunakan email resmi @bmkg.go.id', { parse_mode: 'Markdown' });
        const otp = Math.floor(100000 + Math.random() * 900000); session.mode = 'auth_otp'; session.email = text; session.otp = otp;
        bot.sendMessage(cid, `⏳ *Mengirim kode verifikasi ke ${text}...*`, { parse_mode: 'Markdown' });
        if (await sendOTP(text, otp)) return bot.sendMessage(cid, '✅ *OTP Terkirim!* Silakan masukkan 6 digit kode verifikasi Anda:', { parse_mode: 'Markdown' });
        else { delete sessions[cid]; return bot.sendMessage(cid, '❌ *Gagal mengirim email.* Hubungi admin.', { parse_mode: 'Markdown', ...mainMenu() }); }
    }
    if (session && session.mode === 'auth_otp') {
        if (text == session.otp) { 
            const target = session.target || '✈️ METAR';
            verifiedUsers[cid] = { email: session.email, lastVerified: Date.now(), lastActive: Date.now() }; 
            saveUsers(); 
            delete sessions[cid]; 
            let welcomeMsg = '✅ *Verifikasi Berhasil!* Akses dibuka.\n';
            if (target === '📊 Graph' || target === '/graph') {
                welcomeMsg += 'Silakan ketik /graph atau pilih menu 📊 Graph kembali.';
            } else if (target === '🌐 BMKGsatu' || target === '/bmkgsatu') {
                welcomeMsg += 'Silakan ketik /bmkgsatu atau pilih menu 🌐 BMKGsatu kembali.';
            } else {
                welcomeMsg += 'Silakan ketik /metar untuk masuk ke menu METAR.';
            }
            return bot.sendMessage(cid, welcomeMsg, { parse_mode: 'Markdown', ...mainMenu() }); 
        }
        else return bot.sendMessage(cid, '❌ *OTP Salah.* Silakan coba lagi:', { parse_mode: 'Markdown' });
    }

    // Navigation
    if (text === '✈️ METAR MENU' || text === '🔙 Back to METAR MENU') return bot.sendMessage(cid, '✈️ *METAR MENU*', { parse_mode: 'Markdown', ...metarMenu() });
    if (text === '📈 IKHTISAR MENU' || text === '🔙 Back to IKHTISAR MENU') return bot.sendMessage(cid, '📈 *IKHTISAR MENU*', { parse_mode: 'Markdown', ...ikhtisarDateMenu() });
    if (text === '🔙 Back to GRAPH MENU') {
        if (!isAuth) {
            sessions[cid] = { mode: 'auth_email', target: '📊 Graph' };
            return bot.sendMessage(cid, '🔒 *VERIFIKASI DIPERLUKAN*\n\nUntuk alasan keamanan, silakan masukkan email *@bmkg.go.id* Anda untuk melanjutkan:', { parse_mode: 'Markdown' });
        }
        return bot.sendMessage(cid, '📊 *GRAPH MENU*', { parse_mode: 'Markdown', ...graphMenu() });
    }
    if (text === '🔙 Back to BMKGSATU MENU') {
        if (!isAuth) {
            sessions[cid] = { mode: 'auth_email', target: '🌐 BMKGsatu' };
            return bot.sendMessage(cid, '🔒 *VERIFIKASI DIPERLUKAN*\n\nUntuk alasan keamanan, silakan masukkan email *@bmkg.go.id* Anda untuk melanjutkan:', { parse_mode: 'Markdown' });
        }
        return bot.sendMessage(cid, '🌐 *BMKGsatu MENU*', { parse_mode: 'Markdown', ...bmkgsatuMenu() });
    }
    
    if (text === '📈 Ikhtisar') { sessions[cid] = { mode: 'ikhtisar_date' }; return bot.sendMessage(cid, '📈 *IKHTISAR MENU*\nPilih tanggal laporan:', { parse_mode: 'Markdown', ...ikhtisarDateMenu() }); }
    if (text === '☁️ Prakiraan') { return bot.sendMessage(cid, '☁️ *Prakiraan Menu*', { parse_mode: 'Markdown', ...prakiraanMenu() }); }
    if (text === '☁️ Infografis Prakiraan') {
        const ldr = await bot.sendMessage(cid, '⏳ *Menyiapkan Infografis Prakiraan...*\n_Mohon tunggu, sedang mengambil data BMKG._', { parse_mode: 'Markdown' });
        try {
            const files = await generatePrakiraanImages();
            for (const file of files) {
                const caption = file.includes('_h0_') ? '☁️ *Prakiraan Cuaca Hari Ini*' : '☁️ *Prakiraan Cuaca Besok (H+1)*';
                await bot.sendPhoto(cid, fs.readFileSync(file), { caption, parse_mode: 'Markdown' });
                fs.unlinkSync(file);
            }
            bot.deleteMessage(cid, ldr.message_id).catch(() => {});
        } catch (e) {
            console.error('PRAKIRAAN ERR:', e.message);
            bot.editMessageText(`❌ *GAGAL:* ${e.message}`, { chat_id: cid, message_id: ldr.message_id, parse_mode: 'Markdown' });
        }
        return;
    }
    if (text === '🗺️ Peta Kecamatan (Mini App)') {
        return bot.sendMessage(cid, '🗺️ *Peta Interaktif Kecamatan*\n\nKlik tombol di bawah untuk membuka peta:', {
            parse_mode: 'Markdown',
            reply_markup: {
                inline_keyboard: [[ { text: "🗺️ Buka Peta Kecamatan", web_app: { url: "https://untuk-vercel.vercel.app/kecamatan-map" } } ]]
            }
        });
    }
    if (text === '🌐 Prakiraan Kecamatan') { return bot.sendMessage(cid, '🌐 *Pilih Kecamatan:*', { parse_mode: 'Markdown', ...kecamatanMenu() }); }
    if (text === '✈️ METAR' || text === '/metar') return bot.sendMessage(cid, '✈️ *METAR MENU*\nSilakan pilih fitur operasional:', { parse_mode: 'Markdown', ...metarMenu() });
    if (text === '📊 Graph' || text === '/graph') return bot.sendMessage(cid, '📊 *GRAPH MENU*\nPilih jenis grafik:', { parse_mode: 'Markdown', ...graphMenu() });
    if (text === '🌐 BMKGsatu' || text === '/bmkgsatu') return bot.sendMessage(cid, '🌐 *BMKGsatu MENU*\nData Sinoptik diolah menjadi informasi cuaca untuk masyarakat.', { parse_mode: 'Markdown', ...bmkgsatuMenu() });

    if (text === '🚀 AR Weather') { return bot.sendMessage(cid, '🚀 *AR WEATHER & MAP PANGSUMA*\n\nPilih fitur navigasi cuaca:', { parse_mode: 'Markdown', ...arWeatherMenu() }); }

    if (text === '☁️ Prakiraan') {
        const ldr = await bot.sendMessage(cid, '⏳ *Menyiapkan Infografis Prakiraan...*\n_Mohon tunggu, sedang mengambil data BMKG._', { parse_mode: 'Markdown' });
        try {
            const files = await generatePrakiraanImages();
            for (const file of files) {
                const caption = file.includes('_h0_') ? '☁️ *Prakiraan Cuaca Hari Ini*' : '☁️ *Prakiraan Cuaca Besok (H+1)*';
                await bot.sendPhoto(cid, fs.readFileSync(file), { caption, parse_mode: 'Markdown' });
                fs.unlinkSync(file);
            }
            bot.deleteMessage(cid, ldr.message_id).catch(() => {});
        } catch (e) {
            console.error('PRAKIRAAN ERR:', e.message);
            bot.editMessageText(`❌ *GAGAL:* ${e.message}`, { chat_id: cid, message_id: ldr.message_id, parse_mode: 'Markdown' });
        }
        return;
    }

    if (text === '📊 Realtime Data') { const rt = await fetchRealtimeData(); return bot.sendMessage(cid, rt, { parse_mode: 'Markdown', ...backSubMenu('METAR') }); }
    if (text === '🔌 Check Connection') { const up = await verifyConnection(); return bot.sendMessage(cid, up ? '✅ *Server REACHABLE*' : '❌ *Server UNREACHABLE*', { parse_mode: 'Markdown', ...backSubMenu('METAR') }); }
    if (text.includes('Kaleidoskop Bulanan')) {
        if (!isAuth) {
            sessions[cid] = { mode: 'auth_email', target: '🌐 BMKGsatu' };
            return bot.sendMessage(cid, '🔒 *VERIFIKASI DIPERLUKAN*\n\nUntuk alasan keamanan, silakan masukkan email *@bmkg.go.id* Anda untuk melanjutkan:', { parse_mode: 'Markdown' });
        }
        sessions[cid] = { mode: 'kaleidoskop_year' };
        return bot.sendMessage(cid, `🗓 *Kaleidoskop Cuaca Bulanan*\n\nSumber: Sinoptik BMKG Satu\nStasiun: ${BMKGSATU_STATION_NAME}\n\nPilih tahun:`, {
            parse_mode: 'Markdown',
            reply_markup: kaleidoskopYearKeyboard()
        });
    }
    if (text.includes('Kaleidoskop Mingguan')) {
        if (!isAuth) {
            sessions[cid] = { mode: 'auth_email', target: '🌐 BMKGsatu' };
            return bot.sendMessage(cid, '🔒 *VERIFIKASI DIPERLUKAN*\n\nUntuk alasan keamanan, silakan masukkan email *@bmkg.go.id* Anda untuk melanjutkan:', { parse_mode: 'Markdown' });
        }
        const options = buildKaleidoskopWeekOptions();
        sessions[cid] = { mode: 'kaleidoskop_week', options };
        return bot.sendMessage(cid, `📅 *Kaleidoskop Cuaca Mingguan*\n\nSumber: Sinoptik BMKG Satu\nStasiun: ${BMKGSATU_STATION_NAME}\n\nPilih periode minggu:`, {
            parse_mode: 'Markdown',
            ...kaleidoskopWeekReplyKeyboard(options)
        });
    }
    if (text === '🔍 Cek Koneksi') {
        if (!isAuth) {
            sessions[cid] = { mode: 'auth_email', target: '🌐 BMKGsatu' };
            return bot.sendMessage(cid, '🔒 *VERIFIKASI DIPERLUKAN*\n\nUntuk alasan keamanan, silakan masukkan email *@bmkg.go.id* Anda untuk melanjutkan:', { parse_mode: 'Markdown' });
        }
        const ldr = await bot.sendMessage(cid, '⏳ *Menghubungi BMKGsatu...*', { parse_mode: 'Markdown' });
        try {
            const login = await axios.post(
                `${BMKGSATU_URL}/api/v21/user/session/login`,
                { username: BMKGSATU_USER, password: BMKGSATU_PASS },
                { timeout: 15000 }
            );
            const connected = Boolean(login.data?.data?.token);
            await bot.editMessageText(
                connected
                    ? `🌐 *BMKGsatu - STATUS*\n\n✅ *Status:* Terhubung\n📍 *Stasiun:* ${BMKGSATU_STATION_NAME}`
                    : '❌ *BMKGsatu tidak mengembalikan token login.*',
                { chat_id: cid, message_id: ldr.message_id, parse_mode: 'Markdown', ...backSubMenu('BMKGsatu') }
            );
        } catch (e) {
            await bot.editMessageText(
                `❌ *Koneksi BMKGsatu gagal*\n\n${e.message}`,
                { chat_id: cid, message_id: ldr.message_id, parse_mode: 'Markdown', ...backSubMenu('BMKGsatu') }
            );
        }
        return;
    }
    
    if (text === '📤 Send Now') { sessions[cid] = { mode: 'send_now' }; return bot.sendMessage(cid, '✍️ *Kirim METAR Sekarang*\nSilakan masukkan sandi METAR lengkap:', { parse_mode: 'Markdown', reply_markup: { keyboard: [['❌ Cancel', '🏠 Back to Home']], resize_keyboard: true } }); }
    if (text === '⏰ Manual Schedule') { sessions[cid] = { mode: 'hour' }; return bot.sendMessage(cid, '⏰ *Jadwal Manual*\nPilih Jam (UTC):', { parse_mode: 'Markdown', ...hourPicker() }); }
    if (text === '✨ Smart Schedule') { sessions[cid] = { mode: 'smart_hour' }; return bot.sendMessage(cid, '✨ *Smart Schedule*\nPilih Jam (UTC):', { parse_mode: 'Markdown', ...hourPicker() }); }
    
    if (text === '📋 Active Schedule') { const s = schedules.filter(x => x.chatId === cid); if (s.length === 0) return bot.sendMessage(cid, 'ℹ️ Tidak ada jadwal aktif.', { parse_mode: 'Markdown', ...backSubMenu('METAR') }); s.forEach(i => bot.sendMessage(cid, `🆔 ID: \`${i.id}\`\n🕒 UTC: *${i.hour}:${i.minute}*\n📝 Tipe: ${i.type||'MANUAL'}`, { parse_mode: 'Markdown', reply_markup: { inline_keyboard: [[{ text: '🗑 Hapus Jadwal', callback_data: `delete_${i.id}` }]] } })); return bot.sendMessage(cid, '--- Akhir Daftar ---', { parse_mode: 'Markdown', ...backSubMenu('METAR') }); }
    if (text === '📜 History') { if (history.length === 0) return bot.sendMessage(cid, 'ℹ️ Riwayat pengiriman kosong.', { parse_mode: 'Markdown', ...backSubMenu('METAR') }); let hT = '📜 *RIWAYAT PENGIRIMAN (5 TERAKHIR)*\n'; history.slice(-5).reverse().forEach(e => hT += `\n📅 ${new Date(e.timestamp).toLocaleString()}\n📝 \`${e.message}\`\n👤 By: ${e.sender}\n---`); return bot.sendMessage(cid, hT, { parse_mode: 'Markdown', ...backSubMenu('METAR') }); }
    if (text === '🧹 Clear Chat') { const msgs = messageHistory[cid] || []; msgs.forEach(m => bot.deleteMessage(cid, m).catch(()=>{})); messageHistory[cid] = []; return bot.sendMessage(cid, '🧹 *Chat Dibersihkan*', { parse_mode: 'Markdown', ...mainMenu() }); }
    
    if (['💨 Windrose','🌡 T-Td-RH','🌧 Rainfall'].includes(text)) { 
        if (!isAuth) {
            sessions[cid] = { mode: 'auth_email', target: '📊 Graph' };
            return bot.sendMessage(cid, '🔒 *VERIFIKASI DIPERLUKAN*\n\nUntuk alasan keamanan, silakan masukkan email *@bmkg.go.id* Anda untuk melanjutkan:', { parse_mode: 'Markdown' });
        }
        sessions[cid] = { mode: 'graph_date', chartType: text }; 
        return bot.sendMessage(cid, `📊 *${text}*\nPilih tanggal grafik:`, { parse_mode: 'Markdown', ...ikhtisarDateMenu() }); 
    }

    // Session Processing
    if (!session) return;
    if (session.mode === 'kaleidoskop_year') {
        const year = Number(text);
        if (!Number.isInteger(year) || year < 2000 || year > new Date().getFullYear()) {
            return bot.sendMessage(cid, 'Pilih tahun dari keyboard yang tersedia.', { ...kaleidoskopYearReplyKeyboard() });
        }
        sessions[cid] = { mode: 'kaleidoskop_month', year };
        return bot.sendMessage(cid, `🗓 *Kaleidoskop ${year}*\nPilih bulan:`, {
            parse_mode: 'Markdown',
            ...kaleidoskopMonthReplyKeyboard(year)
        });
    }
    if (session.mode === 'kaleidoskop_month') {
        if (text.includes('Pilih Tahun')) {
            sessions[cid] = { mode: 'kaleidoskop_year' };
            return bot.sendMessage(cid, '🗓 *Pilih tahun kaleidoskop:*', {
                parse_mode: 'Markdown',
                ...kaleidoskopYearReplyKeyboard()
            });
        }
        const month = KALEIDOSKOP_MONTHS.findIndex(name => name.toLowerCase() === text.toLowerCase()) + 1;
        if (!month) {
            return bot.sendMessage(cid, 'Pilih bulan dari keyboard yang tersedia.', { ...kaleidoskopMonthReplyKeyboard(session.year) });
        }
        const period = `${KALEIDOSKOP_MONTHS[month - 1]} ${session.year}`;
        return sendKaleidoskopResult(cid, period, updateProgress =>
            generateMonthlyKaleidoscope(session.year, month, BMKGSATU_USER, BMKGSATU_PASS, updateProgress)
        );
    }
    if (session.mode === 'kaleidoskop_week') {
        const option = (session.options || []).find(item => item.label === text);
        if (!option) {
            return bot.sendMessage(cid, 'Pilih periode minggu dari keyboard yang tersedia.', { ...kaleidoskopWeekReplyKeyboard(session.options || buildKaleidoskopWeekOptions()) });
        }
        return sendKaleidoskopResult(cid, option.label, updateProgress =>
            generateWeeklyKaleidoscope(option.startDate, option.endDate, BMKGSATU_USER, BMKGSATU_PASS, updateProgress)
        );
    }
    if (session.mode === 'send_now') { 
        bot.sendMessage(cid, '⏳ *Sedang mengirim METAR...*', { parse_mode: 'Markdown' });
        if (await sendMetar(text)) { 
            history.push({ message: text, sender: msg.from.username, timestamp: new Date().toISOString() }); 
            saveHistoryLog(); 
            bot.sendMessage(cid, `✅ *METAR TERKIRIM*\n\n📝 *Sandi:*\n\`${text}\`\n🚀 *Status:* SUCCESS`, { parse_mode: 'Markdown', ...backSubMenu('METAR') }); 
        } else bot.sendMessage(cid, '❌ *FAILED:* Server tidak merespon.', { parse_mode: 'Markdown', ...backSubMenu('METAR') }); 
        delete sessions[cid]; 
    }
    else if (session.mode === 'hour' || session.mode === 'smart_hour') { session.hour = parseInt(text); session.mode = session.mode === 'smart_hour' ? 'smart_minute' : 'minute'; bot.sendMessage(cid, '🕒 *Pilih Menit:*', { parse_mode: 'Markdown', ...minutePicker() }); }
    else if (session.mode === 'minute' || session.mode === 'smart_minute') { session.minute = parseInt(text); if (session.mode === 'smart_minute') { session.mode = 'smart_visibility'; bot.sendMessage(cid, '👀 *Masukkan Jarak Pandang (Visibility):*', { parse_mode: 'Markdown', reply_markup: { keyboard: [['❌ Cancel','🏠 Back to Home']], resize_keyboard: true } }); } else { session.mode = 'message'; bot.sendMessage(cid, '✍️ *Masukkan Sandi METAR Lengkap:*', { parse_mode: 'Markdown', reply_markup: { keyboard: [['❌ Cancel','🏠 Back to Home']], resize_keyboard: true } }); } }
    else if (session.mode === 'smart_visibility') { session.visibility = text; session.mode = 'smart_weather'; bot.sendMessage(cid, '⛈ *Pilih Kondisi Cuaca (Present Weather):*', { parse_mode: 'Markdown', ...weatherPicker() }); }
    else if (session.mode === 'smart_weather') { session.weather = text === 'Blank (None)' ? ' ' : text; session.mode = 'smart_clouds'; bot.sendMessage(cid, '☁️ *Masukkan Kondisi Awan (Clouds):*', { parse_mode: 'Markdown', reply_markup: { keyboard: [['❌ Cancel','🏠 Back to Home']], resize_keyboard: true } }); }
    else if (session.mode === 'smart_clouds') { const item = { id: Date.now(), hour: session.hour, minute: session.minute, visibility: session.visibility, weather: session.weather, clouds: text, chatId: cid, type: 'SMART', createdBy: msg.from.username }; schedules.push(item); saveSchedules(); registerSchedule(item); bot.sendMessage(cid, `✅ *SMART SCHEDULE REGISTERED*\n\n🆔 ID: \`${item.id}\`\n🕒 Jam: *${item.hour}:${item.minute} UTC*\nℹ️ Bot akan menarik data sensor otomatis pada jam tersebut.`, { parse_mode: 'Markdown', ...backSubMenu('METAR') }); delete sessions[cid]; }
    else if (session.mode === 'message') { const item = { id: Date.now(), hour: session.hour, minute: session.minute, message: text, chatId: cid, createdBy: msg.from.username }; schedules.push(item); saveSchedules(); registerSchedule(item); bot.sendMessage(cid, `✅ *MANUAL SCHEDULE REGISTERED*\n\n🆔 ID: \`${item.id}\`\n🕒 Jam: *${item.hour}:${item.minute} UTC*`, { parse_mode: 'Markdown', ...backSubMenu('METAR') }); delete sessions[cid]; }
    else if ((session.mode === 'ikhtisar_date' || session.mode === 'graph_date') && (text.startsWith('Hari Ini') || text.startsWith('Kemarin'))) {
        const d = text.match(/\((.*?)\)/)[1];
        if (session.mode === 'ikhtisar_date') {
            const ldr = await bot.sendMessage(cid, `⏳ *Sedang memproses...*`, { parse_mode: 'Markdown' });
            const res = await generateIkhtisar(d, cid, ldr.message_id); 
            if (res.report) { 
                await bot.sendMessage(cid, res.report, { parse_mode: 'Markdown' }); 
                bot.sendMessage(cid, '✅ *Proses Ikhtisar Selesai.*', { parse_mode: 'Markdown', ...backSubMenu('Ikhtisar') }); 
            }
            delete sessions[cid];
        }
        else { 
            if (!isAuthenticated(cid)) {
                delete sessions[cid];
                sessions[cid] = { mode: 'auth_email', target: '📊 Graph' };
                return bot.sendMessage(cid, '🔒 *VERIFIKASI DIPERLUKAN*\n\nUntuk alasan keamanan, silakan masukkan email *@bmkg.go.id* Anda untuk melanjutkan:', { parse_mode: 'Markdown' });
            }
            const ldr = await bot.sendMessage(cid, `⏳ *Sedang memproses...*`, { parse_mode: 'Markdown' });
            const res = await generateGraphData(session.chartType, d, cid, ldr.message_id); 
            if (res.photoBuffer) { 
                await bot.sendPhoto(cid, res.photoBuffer, { caption: res.caption, parse_mode: 'Markdown' }); 
                bot.sendMessage(cid, '✅ *Grafik Siap.*', { parse_mode: 'Markdown', ...backSubMenu('Graph') }); 
            } else bot.sendMessage(cid, res.report || 'Error', { parse_mode: 'Markdown', ...backSubMenu('Graph') }); 
            delete sessions[cid];
        }
    } else if (text === '📅 Open Calendar') { bot.sendMessage(cid, '📅 *Pilih Tanggal:*', { parse_mode: 'Markdown', reply_markup: createCalendarKeyboard(new Date().getFullYear(), new Date().getMonth()) }); }
    if (text === '❌ Cancel') { delete sessions[cid]; return bot.sendMessage(cid, '❌ *Operasi Dibatalkan.*', { parse_mode: 'Markdown', ...mainMenu() }); }
    if (text === '❌ Close') { delete sessions[cid]; return bot.sendMessage(cid, '🔒 *Budi Closed.* Sampai jumpa!', { reply_markup: { remove_keyboard: true } }); }
});

bot.on('polling_error', (e) => console.log('POLLING ERROR:', e.message));
loadHistoryLog(); 
loadSchedules(); 
console.log(`[INIT] Loading ${schedules.length} schedules...`);
schedules.forEach(item => {
    console.log(`[INIT] Registering schedule ID: ${item.id} (${item.hour}:${item.minute} UTC)`);
    registerSchedule(item);
});
loadUsers();
console.log('🏛️ DIGITALISASI BMKG RUNNING');
