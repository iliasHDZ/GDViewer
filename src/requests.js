const hostname = "https://gdbrowser.com";
let proxy    = import.meta.env.DEV ? "http://127.0.0.1:8000" : "";
const opts = {
    method: "GET"
};

export default {
    downloadLevel: (id) => {
        return new Promise((resolve, reject) => {
            let retData;
            fetch(proxy + "/getlevels/" + id, opts)
                .then(res => res.json())
                .then(data => {
                    if (data == -1) reject();
                    else {
                        retData = data[0];
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
            fetch(proxy + "/getlevels/" + encodeURIComponent(query), opts)
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