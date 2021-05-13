const express  = require('express');
const requests = require('requests');

const http = require('http');
const querystring = require('querystring');

const app = express();

const PORT = 80;

function parseResponse(data) {
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

function getLevel(id) {
    const pms = querystring.stringify({
        levelID: id,
        secret: 'Wmfd2893gb7'
    });

    const opts = {
        host:   'boomlings.com',
        path:   `/database/downloadGJLevel22.php`,
        method: 'POST',
        headers: {
            "Content-Type":   "application/x-www-form-urlencoded",
            "Content-Length": pms.length
        }
    }

    return new Promise((resolve, reject) => {
        let req = http.request(opts, (res) => {
            let ret = "";

            res.on('data', data => ret += data);
            res.on('end', () => {
                let res = parseResponse(ret);

                if (res == -1) {
                    resolve('-1');
                    return;
                }

                console.log(`DOWNLOAD: ${res.name} (${res.id})`);
                resolve(res.data);
            });
            res.on('error', () => reject());
        });

        req.write( pms );
        req.end();
    });
}

app.get('/getlevel/*', (req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    getLevel(req.originalUrl.substr(10))
        .then(e => {
            res.write(e);
            res.end();
        })
        .catch(() => {
            res.write('-1');
            res.end();
        })
});

app.listen(PORT, () => console.log('Proxy server running at ' + PORT));