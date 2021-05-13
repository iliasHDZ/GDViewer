let util;
util = {
    element: (tag, classes = [], children = [], opts = {}) => {
        let elem = document.createElement(tag);

        if (typeof classes == "string")
            elem.classList.add(classes)
        else if (typeof classes == "object")
            for (let c of classes)
                elem.classList.add(c);

        for (const [key, value] of Object.entries(opts))
            elem.setAttribute(key, value);

        if (Array.isArray(children))
            for (let c of children)
                util.add(elem, c);
        else util.add(elem, children);
        
        return elem;
    },
    iconify: (icon, classes = [], opts = {}) => {
        if (Array.isArray(classes)) classes.push('iconify');
        else classes = ['iconify', classes];

        return util.element('span', classes, [], 
            Object.assign({"data-icon": icon, "data-inline": "false"}, opts) );
    },
    input: (type, classes = [], opts = {}) => {
        return util.element('input', classes, [], 
            Object.assign({"type": type}, opts) );
    },
    img: (url, classes = [], opts = {}) => {
        if (typeof url == "string")
            return util.element('img', classes, [], 
                Object.assign({"src": url}, opts) );
        else {
            let ret = url.cloneNode(false);

            if (typeof classes == "string")
                ret.classList.add(classes)
            else if (typeof classes == "object")
                for (let c of classes)
                    ret.classList.add(c);

            for (const [key, value] of Object.entries(opts))
                ret.setAttribute(key, value);

            return ret;
        }
    },
    a: (href, classes = [], text = "", opts = {}) => {
        return util.element('a', classes, text, 
            Object.assign({"href": href}, opts) );
    },
    div: (classes = [], children = [], opts = {}) => {
        return util.element('div', classes, children, opts );
    },
    add: (dst, src) => {
        if (typeof src == "string")
            dst.appendChild( document.createTextNode(src) );
        else
            dst.appendChild(src);
    }
};

export default util;