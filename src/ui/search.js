import util from './util'

function numberWithCommas(x) {
    return x.toString().replace(/\B(?<!\.\d*)(?=(\d{3})+(?!\d))/g, ",");
}

export default function SearchUI(main, callback) {
    this.reqcount = 0;

    this.dot_anim = null;

    this.main = main;

    this.init = () => {
        let search = this;

        this.input = util.input('text', 'search-input',
            {"spellcheck": "false", "placeholder": "Type a level or id here"});

        this.input.onkeyup = (e) => {
            if (e.key == "Enter") search.searchStart();
        };

        let search_button = util.div('searchbar-button', 
            util.iconify('fa-solid:search', ['search-glass', 'searchbar-button']) );

        search_button.onclick = () => this.searchStart();

        this.section = util.div('search-section', [
            util.div('search-field', [
                util.div('searchbar-button', 
                    util.iconify('mdi:filter', 'icon') ),
                
                this.input,
                search_button
            ])
        ]);

        util.add(this.main.mainui, this.section);
    }

    this.removeList = () => {
        if (this.section.childNodes.length == 2)
            this.section.removeChild(this.section.childNodes[1]);
    }

    this.createLoadingPanel = () => {
        this.removeList();

        const TEXT = 'Waiting for a response';
        const FRAMES = [
            '..', '.', '', '.', '..', '...'
        ];

        let frame_num = 0;
        let title = util.element('p', 'loading-title', "Waiting for a response...");

        let panel = util.div('search-list', [
            title,
            util.element('p', 'loading-desc', "Waiting for the GD servers to respond. This could take a while.")
        ]);

        this.dot_anim = setInterval(() => {
            title.textContent = TEXT + FRAMES[frame_num];
            frame_num++;

            if (frame_num >= FRAMES.length) frame_num = 0;
        }, 500);

        util.add(this.section, panel);
    }

    this.createSearchLevel = (level) => {
        let face_classes = ['level-face'];
        if (!level.face.startsWith('demon')) face_classes.push('scaledown');

        let searchlvl = util.div('search-level', [
            util.div('level-left', 
                util.img(this.main.faces[level.face], face_classes) ),
            util.div('level-info', [
                util.element('p', 'level-title', level.title),
                util.element('p', 'level-author', 'by ' + level.author)
            ]),
            util.div('level-stats', [
                util.div('level-stat', [
                    util.element('span', 'stat-text', numberWithCommas(level.plays) ),
                    util.iconify('fa-solid:play', 'stat-icon')
                ]),
                util.div('level-stat', [
                    util.element('span', 'stat-text', numberWithCommas(level.likes) ),
                    util.iconify('heroicons-solid:thumb-up', ['stat-icon', 'like'])
                ])
            ])
        ]);

        searchlvl.onclick = () => callback('level-click', level.id);
        return searchlvl;
    }

    this.createList = (levels) => {
        if (this.dot_anim) {
            clearInterval(this.dot_anim);
            this.dot_anim = null;
        }

        this.removeList();

        let close = util.div('search-closebox', util.iconify('fe:close', 'search-close'));

        console.log(close);

        close.onclick = () => this.removeList();

        let content = util.div('search-content');

        let list = util.div('search-list', [
            util.div('search-top', close),
            content
        ]);

        for (let lvl of levels)
            util.add(content, this.createSearchLevel(lvl));

        util.add(this.section, list);
    }

    this.searchStart = () => {
        let query = this.input.value.trim();
        if (query == "") return;

        if (this.dot_anim) {
            clearInterval(this.dot_anim);
            this.dot_anim = null;
        }

        let reqnum = ++this.reqcount;
        let search = this;

        this.createLoadingPanel();

        callback('search', query)
            .then(levels => {
                if (reqnum == search.reqcount)
                this.createList(levels)
            })
            .catch(console.err);
    }
}