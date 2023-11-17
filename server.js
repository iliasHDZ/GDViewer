const express  = require('express');
const fs = require('fs');

const http = require('http');
const https = require('https');
const path = require('path');
const querystring = require('querystring');

const app = express();

let songCacheTracker = {};

let config;

function loadConfig() {
    try {
        config = JSON.parse(fs.readFileSync(path.resolve(__dirname, "./config.json")));
    } catch {
        return false;
    }
    return true;
}

if (!loadConfig()) {
    console.log("Could not find config.json");
    process.exit(-1);
}

function nowSecs() {
    return Math.floor(Date.now() / 1000);
}

const byteLabels = ['b', 'KiB', 'MiB', 'GiB', 'TiB'];

function byteSizeToString(size) {
    let label = 0;
    while (size > 1024) {
        size /= 1024;
        label++;
    }
    return size.toLocaleString('en-US', { maximumFractionDigits: 2 }) + ' ' + byteLabels[label];
}

function addToSongCache(id, size) {
    songCacheTracker[+id] = { time: nowSecs(), size };
}

function updateSongInCache(id) {
    if (!songCacheTracker[+id])
        return;

    songCacheTracker[+id].time = nowSecs();
}

function getSongCachePath(id) {
    return path.resolve(__dirname, `./songs/${id}.mp3`);
}

function deleteSongInCache(id) {
    fs.unlinkSync(getSongCachePath(id));
    delete songCacheTracker[id];
}

async function songCacheCleanUp() {
    console.log("Cleaning up song cache...");
    let songsDeleted = 0;
    for (let [k, v] of Object.entries(songCacheTracker)) {
        if (nowSecs() - v.time > config.max_song_cache_time) {
            deleteSongInCache(+k);
            songsDeleted++;
        }
    }
    console.log(`- ${songsDeleted} cached songs deleted!`);
}

function getSongCacheSize() {
    let ret = 0;
    for (let v of Object.values(songCacheTracker))
        ret += v.size;
    return ret;
}

function initSongCache() {
    console.log("Initializing song cache...");
    const files = fs.readdirSync(path.resolve(__dirname, './songs/'));
    for (let file of files) {
        const info = fs.lstatSync(path.resolve(__dirname, './songs/', file));
        if (info.isFile() && file.endsWith('.mp3')) {
            const id = +file.substring(0, file.length - 4);
            if (isNaN(id)) continue;

            addToSongCache(id, info.size);
        }
    }
}

let checkingup = false;

async function checkupSongCache() {
    if (checkingup)
        return;

    checkingup = true;
    let totalSize = getSongCacheSize();
    if (totalSize <= config.max_song_cache_size) {
        checkingup = false;
        return;
    }

    console.log(`Song cache too big, size: ${byteSizeToString(totalSize)} (max. ${byteSizeToString(config.max_song_cache_size)})`);

    await songCacheCleanUp();

    totalSize = getSongCacheSize();
    if (totalSize <= config.max_song_cache_size) {
        checkingup = false;
        return;
    }
    
    console.log(`Cache cleanup not enough, size: ${byteSizeToString(totalSize)} (max. ${byteSizeToString(config.max_song_cache_size)})`);
    console.log("Deleting songs randomly instead");

    let surplus = totalSize - config.max_song_cache_size;
    let songsDeleted = 0;

    for (let [k, v] of Object.entries(songCacheTracker)) {
        surplus -= v.size;
        deleteSongInCache(+k);
        songsDeleted++;
        if (surplus <= 0)
            break;
    }

    console.log(`- ${songsDeleted} cached songs deleted!`);
    checkingup = false;
}

initSongCache();
checkupSongCache();

function parseLevelResponse(data) {
    if (data == '-1') return '-1';
    let split = data.split(':');

    let retData = {};

    for (let i = 0; i < split.length; i += 2) {
        if (split[i] == '1')
            retData.id   = split[i + 1];
        if (split[i] == '2')
            retData.name = split[i + 1];
        if (split[i] == '4')
            retData.data = split[i + 1];
    }

    return retData;
}

function sendRequest(endpoint, params) {
    const pms = querystring.stringify(params);
    const opts = {
        host:   'www.boomlings.com',
        path:   '/database/' + endpoint,
        method: 'POST',
        headers: {
            "Accept": "*/*",
            "Content-Length": pms.length,
            "Content-Type":   "application/x-www-form-urlencoded"
        }
    }

    return new Promise((resolve, reject) => {
        let req = http.request(opts, (res) => {
            let ret = "";

            res.on('data', data => ret += data);
            res.on('end', () => resolve(ret));
            res.on('error', () => reject());
        });

        req.write( pms );
        req.end();
    });
}

async function getLevel(id) {
    const params = {
        gameVersion: '20',
        binaryVersion: '35',
        gdw: '0',
        accountID: '0',
        gjp: '',
        uuid: '0',
        levelID: id,
        inc: '1',
        extras: '0',
        secret: 'Wmfd2893gb7'
    };

    const data = await sendRequest("downloadGJLevel22.php", params);
    let res = parseLevelResponse(data);

    if (res == -1)
        return '-1';

    console.log(`DOWNLOAD: ${res.name} (${res.id})`);
    return res.data;
}

function trimTilde(str) {
    if (str.startsWith('~'))
        str = str.substring(1);
    if (str.endsWith('~'))
        str = str.substring(0, str.length - 1);
    return str;
}

function parseSongInfoResponse(data) {
    if (data == '-1') return null;
    let split = data.split('|');

    let retData = {};

    for (let i = 0; i < split.length; i += 2) {
        if (i + 1 >= split.length)
            break;

        let key = +trimTilde(split[i]);

        retData[key] = trimTilde(split[i + 1]);
    }

    return typeof(retData[10]) == 'string' ? decodeURIComponent(retData[10]) : null;
}

function downloadFile(url, destPath) {
    return new Promise((resolve, reject) => {
        fs.open(destPath, 'w', (err, fd) => {
            if (err)
                return reject(err);

            let totalSize = 0;

            let req = (url.startsWith('https') ? https : http).request(url, (res) => {
                res.on('data', (data) => {
                    totalSize += data.length;
                    fs.writeSync(fd, data);
                });
                res.on('end', () => {
                    fs.closeSync(fd);
                    resolve(totalSize);
                });
                res.on('error', e => {
                    fs.closeSync(fd);
                    fs.unlinkSync(destPath);
                    reject(e);
                });
            });
            req.on('error', e => {
                fs.closeSync(fd);
                fs.unlinkSync(destPath);
                reject(e);
            });
            req.end();
        });
    });
}

async function getSongUrl(id) {
    const params = {
        songID: '' + id,
        secret: 'Wmfd2893gb7'
    };

    const data = await sendRequest("getGJSongInfo.php", params);
    return parseSongInfoResponse(data);
}

async function getSongPath(id) {
    const songpath = getSongCachePath(id);

    if (fs.existsSync(songpath)) {
        updateSongInCache(id);
        return songpath;
    }

    const url = await getSongUrl(id);

    if (url == null)
        return null;

    const size = await downloadFile(url, songpath);

    await checkupSongCache();
    addToSongCache(id, size);
    return songpath;
}

app.get('/getlevel/:id', async (req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    if (isNaN(+req.params.id)) {
        res.write('-1');
        res.end();
        return;
    }

    try {
        res.write(await getLevel(Math.floor(req.params.id)));
    } catch {
        res.write('-1');
    }
    res.end();
});

app.get('/getsong/:id', async (req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    if (req.params.id.endsWith('.mp3')) {
        req.params.id = req.params.id.substring(0, req.params.id.length - 4);
    }

    if (isNaN(+req.params.id)) {
        res.write('-1');
        res.end();
        return;
    }

    let path = null;
    try {
        path = await getSongPath(Math.floor(req.params.id));
    } catch (e) {
        console.log(e);
        res.write('-1');
        res.end();
        return;
    }

    if (path == null) {
        res.write('-1');
        res.end();
        return;
    }

    const total = fs.statSync(path).size;

    if (fs.existsSync(path)) {
        if (!req.headers.range) {
            res.write(fs.readFileSync(path));
            res.end();
            return;
        }

        const range = req.headers.range;
        const parts = range.replace(/bytes=/, '').split('-');
        const partialStart = parts[0];
        const partialEnd = parts[1];

        const start = parseInt(partialStart, 10);
        const end = partialEnd ? parseInt(partialEnd, 10) : total - 1;
        const chunksize = (end - start) + 1;
        const rstream = fs.createReadStream(path, {start: start, end: end});

        res.writeHead(206, {
            'Content-Range': 'bytes ' + start + '-' + end + '/' + total,
            'Accept-Ranges': 'bytes', 'Content-Length': chunksize,
            'Content-Type': 'audio/mpeg'
        });
        rstream.pipe(res);
    } else {
        res.write('-1');
        res.end();
        return;
    }
});

app.use(express.static('dist'));

app.listen(config.port, () => console.log('Server running at ' + config.port));