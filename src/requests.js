const hostname = "https://gdbrowser.com";
const proxy    = "";
const opts = {
    method: "GET"
};

export default {
    downloadLevel: (id) => {
        return new Promise((resolve, reject) => {
            let retData;
            fetch(hostname + "/api/level/" + id, opts)
                .then(res => res.json())
                .then(data => {
                    if (data == -1) reject();
                    else {
                        retData = data;
                        return fetch(proxy + "/getlevel/" + id, opts);
                    }
                })
                .then(res => res.text())
                .then(data => {
                    if (data == -1) reject();
                    else {
                        retData.data = data;
                        resolve(retData);
                    }
                })
                .catch(reject);
        });
    },
    searchLevels: (query) => {
        return new Promise((resolve, reject) => {
            fetch(hostname + "/api/search/" + query, opts)
                .then(res => res.json())
                .then(data => {
                    if (data == -1) reject();
                    else resolve(data);
                })
                .catch(reject);
        });
    },
    resolvePath: (path) => {
        return proxy + path;
    }
}