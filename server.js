const express  = require('express');
const fs = require('fs');

const http = require('http');
const https = require('https');
const path = require('path');
const querystring = require('querystring');

const app = express();

let songCacheTracker = {};

let config;

const officialSongs = {
    [-1]: ["Practice: Stay Inside Me", "OcularNebula", "StayInsideMe"],
    [0]: ["Stereo Madness",            "Foreverbound", "StereoMadness"],
    [1]: ["Back on Track",             "DJVI",         "BackOnTrack"],
    [2]: ["Polargeist",                "Step",         "Polargeist"],
    [3]: ["Dry Out",                   "DJVI",         "DryOut"],
    [4]: ["Base after Base",           "DJVI",         "BaseAfterBase"],
    [5]: ["Cant Let Go",               "DJVI",         "CantLetGo"],
    [6]: ["Jumper",                    "Waterflame",   "Jumper"],
    [7]: ["Time Machine",              "Waterflame",   "TimeMachine"],
    [8]: ["Cycles",                    "DJVI",         "Cycles"],
    [9]: ["xStep",                     "DJVI",         "xStep"],
    [10]: ["Clutterfunk",              "Waterflame",   "Clutterfunk"],
    [11]: ["Theory of Everything",     "DJ-Nate",      "TheoryOfEverything"],
    [12]: ["Electroman Adventures",    "Waterflame",   "ElectromanAdventures"],
    [13]: ["Clubstep",                 "DJ-Nate",      "Clubstep"],
    [14]: ["Electrodynamix",           "DJ-Nate",      "Electrodynamix"],
    [15]: ["Hexagon Force",            "Waterflame",   "HexagonForce"],
    [16]: ["Blast Processing",         "Waterflame",   "BlastProcessing"],
    [17]: ["Theory of Everything 2",   "DJ-Nate",      "TheoryOfEverything2"],
    [18]: ["Geometrical Dominator",    "Waterflame",   "GeometricalDominator"],
    [19]: ["Deadlocked",               "F-777",        "Deadlocked"],
    [20]: ["Fingerdash",               "MDK",          "Fingerdash"],
    [21]: ["The Seven Seas",           "F-777",        "The7Seas"],
    [22]: ["Viking Arena",             "F-777",        "VikingArena"],
    [23]: ["Airborne Robots",          "F-777",        "AirborneRobots"],
    [24]: ["The Challenge",            "RobTop",       ""],
    [25]: ["Payload",                  "Dex Arson",    "Payload"],
    [26]: ["Beast Mode",               "Dex Arson",    "BeastMode"],
    [27]: ["Machina",                  "Dex Arson",    "Machina"],
    [28]: ["Years",                    "Dex Arson",    "Years"],
    [29]: ["Frontlines",               "Dex Arson",    "Frontlines"],
    [30]: ["Space Pirates",            "Waterflame",   "SpacePirates"],
    [31]: ["Striker",                  "Waterflame",   "Striker"],
    [32]: ["Embers",                   "Dex Arson",    "Embers"],
    [33]: ["Round 1",                  "Dex Arson",    "Round1"],
    [34]: ["Monster Dance Off",        "F-777",        "MonsterDanceOff"],
    [35]: ["Press Start",              "MDK",          "PressStart"],
    [36]: ["Nock Em",                  "Bossfight",    "NockEm"],
    [37]: ["Power Trip",               "Boom Kitty",   "PowerTrip"]
};

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

        retData[+key] = trimTilde(split[i + 1]);
    }

    return retData;
}

function parseLevelResponse(data) {
    if (data == '-1') return '-1';
    let split = data.split(':');

    let retData = {};

    for (let i = 0; i < split.length; i += 2) {
        const value = split[i + 1];

        switch (+split[i]) {
        case 1: retData.id = +value; break;
        case 2: retData.name = value; break;
        case 3: retData.description = Buffer.from(value, 'base64').toString(); break;
        case 4: retData.data = value; break;
        case 6: retData.authorId = +value; break;
        case 9: retData.diff = +value / 10; break;
        case 10: retData.plays = +value; break;
        case 12: retData.officialSong = value; break;
        case 14: retData.likes = +value; break;
        case 17: retData.demon = +value == 1; break;
        case 19: retData.featured = +value > 0; break;
        case 25: retData.auto = +value == 1; break;
        case 35: retData.customSong = +value; break;
        case 42: retData.epic = +value == 1; break;
        case 43: retData.demonDiff = +value; break;
        }
    }

    let face = "";
    if (retData.auto)
        face = "auto";
    else if (retData.demon) {
        face = "demon-";
        face += ['hard', 'hard', 'hard', 'easy', 'medium', 'insane', 'extreme'][retData.demonDiff ?? 0];
    } else {
        face = ['unrated', 'easy', 'normal', 'hard', 'harder', 'insane'][retData.diff ?? 0];
    }

    if (retData.epic)
        face += "-epic";
    else if (retData.featured)
        face += "-featured";

    retData.face = face;
    return retData;
}

function parseLevelsResponse(data) {
    if (data == '-1') return '-1';
    let mainSplit = data.split('#');
    let split = mainSplit[0].split('|');

    let songs = [];

    let songsSplit = mainSplit[2].split(':');

    for (let songStr of songsSplit) {
        songs.push(parseSongInfoResponse(songStr));
    }

    let authors = {};

    for (let authStr of mainSplit[1].split('|')) {
        const split = authStr.split(':');
        authors[+split[0]] = split[1];
    }

    let ret = [];

    for (let lvl of split) {
        const lvlObj = parseLevelResponse(lvl);

        if (lvlObj.customSong != 0) {
            const song = songs.find(s => +s[1] == lvlObj.customSong);
            if (song) {
                lvlObj.songName   = song[2];
                lvlObj.songAuthor = song[4];
                lvlObj.songUrl    = `/getsong/${lvlObj.customSong}.mp3`;
            }
        } else {
            const song = officialSongs[+lvlObj.officialSong];
            if (song) {
                lvlObj.songName   = song[0];
                lvlObj.songAuthor = song[1];
                lvlObj.songUrl    = `/assets/songs/${song[2]}.mp3`;
            }
        }

        lvlObj.author = '-';
        if (lvlObj.authorId != 0) {
            const author = authors[lvlObj.authorId];
            if (author) {
                lvlObj.author = author;
            }
        }

        ret.push(lvlObj);
    }

    return ret;
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
        gameVersion: '21',
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

async function getLevels(query) {
    const params = {
        gameVersion: '21',
        binaryVersion: '35',
        gdw: '0',
        type: '0',
        str: query,
        diff: '-',
        len: '-',
        page: '0',
        total: '0',
        uncompleted: '0',
        onlyCompleted: '0',
        featured: '0',
        original: '0',
        twoPlayer: '0',
        coins: '0',
        epic: '0',
        secret: 'Wmfd2893gb7'
        
    };

    const data = await sendRequest("getGJLevels21.php", params);
    const res = parseLevelsResponse(data);
    //let res = parseLevelResponse(data);

    if (data == -1)
        return '-1';

    //console.log(`DOWNLOAD: ${res.name} (${res.id})`);
    return JSON.stringify(res, null, 4);//res.data;
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
    const res = parseSongInfoResponse(data);
    return typeof(res[10]) == 'string' ? decodeURIComponent(res[10]) : null;
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

app.get('/getlevels/:query', async (req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    if (typeof req.params.query != 'string') {
        res.write('-1');
        res.end();
        return;
    }

    try {
        res.write(await getLevels(req.params.query));
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
            'Content-Type': 'audio/mpeg',
            'Connection': 'keep-alive',
            'Keep-Alive': 'timeout=900'
        });
        rstream.pipe(res);
    } else {
        res.write('-1');
        res.end();
        return;
    }
});

app.use(express.static('dist'));

const listenCallback = () => console.log('Server running at ' + config.port);

if (config.https) {
    const privateKey = fs.readFileSync(config.privateKeyPath);
    const certificate = fs.readFileSync(config.certificatePath);
    
    https.createServer({
        key: privateKey,
        cert: certificate
    }, app).listen(config.port, listenCallback);
} else {
    app.listen(config.port, listenCallback);
}