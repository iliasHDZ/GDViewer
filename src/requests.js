const hostname = "http://94.105.99.69:2000";
const opts = {
    method: "GET"
};

export default {
    downloadLevel: (id) => {
        return new Promise((resolve, reject) => {
            fetch(hostname + "/api/level/" + id + "?download=true", opts)
                .then(res => res.json())
                .then(data => {
                    if (data == -1) reject();
                    else resolve(data);
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
}