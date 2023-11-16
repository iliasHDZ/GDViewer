import util from './util'

function numberWithCommas(x) {
    return x.toString().replace(/\B(?<!\.\d*)(?=(\d{3})+(?!\d))/g, ",");
}

export default function InfoUI(main, callback) {
    this.main = main;

    this.toggleHidden = (element) => {
        if (element.classList.contains('hidden')) {
            element.classList.remove('hidden');
            return false;
        } else {
            element.classList.add('hidden');
            return true;
        }
    }

    this.setCloser = (element, closed) => {
        let closer = element.childNodes[0];
        if (closed)
            closer.setAttribute('class', 'iconify closer-closed closer');
        else
            closer.setAttribute('class', 'iconify closer');
    }

    this.toggleCheckbox = (checkbox) => {
        if (checkbox.classList.contains('checked')) {
            checkbox.setAttribute('class', 'checkbox');
            checkbox.childNodes[0].setAttribute('class', 'iconify checkmark hidden');
            return false;
        } else {
            checkbox.setAttribute('class', 'checkbox checked');
            checkbox.childNodes[0].setAttribute('class', 'iconify checkmark');
            return true;
        }
    }

    this.createLevelInfo = (level) => {
        let content = util.div('linfo-content', [
            util.element('p', 'linfo-desc', level.desc),
            util.div('linfo-song', [
                util.element('p', 'lsong-title', level.song_title),
                util.element('p', 'lsong-author', 'by ' + level.song_author)
            ])
        ]);
        let closer = util.div('level-closer', 
            util.iconify('fe:arrow-down', 'closer') );

        closer.onclick = () => 
            this.setCloser(closer, this.toggleHidden(content));

        return util.div('info-level', [
            util.div('linfo-top', [
                util.img(this.main.faces[level.face], 'level-face'),
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
                ]),
                closer
            ]),
            content
        ]);
    }

    this.createCategory = (name, content) => {
        let cont   = util.div('cat-cont', content);
        let closer = util.div('cat-closer', 
            util.iconify('fe:arrow-down', 'closer'));

        closer.onclick = () => 
            this.setCloser(closer, this.toggleHidden(cont));

        return util.div('info-category', [
            util.div('cat-top', [
                util.element('p', 'info-title', name),
                closer
            ]),
            cont
        ]);
    }

    this.createCheckbox = (title, checked, callback) => {
        let classes = ['checkmark'];
        if (!checked) classes.push('hidden');

        let cclasses = ['checkbox'];
        if (checked) cclasses.push('checked');

        let checkbox = util.div(cclasses, 
            util.iconify('topcoat:checkmark', classes) );

        checkbox.onclick = () => callback(this.toggleCheckbox(checkbox));

        return util.div('checkbox-sec', [
            checkbox,
            util.element('span', 'checkbox-text', title)
        ]);
    }

    this.loadLevel = (level) => {
        this.level_cont.innerHTML = '';
        util.add(this.level_cont, this.createLevelInfo(level));
    }

    this.setLoading = () => {
        this.level_cont.innerHTML = '';
        util.add(this.level_cont,
            util.div('info-loading', [
                util.element('p', 'loading-title', "Loading level..."),
                util.element('p', 'loading-desc',  "Fetching the level to display it.")
            ]));
    }

    this.init = (opts) => {
        let show_cat = this.createCategory("Currently Showing", 
            util.div('info-loading', [
                util.element('p', 'loading-title', "No level loaded"),
                util.element('p', 'loading-desc',  "Type a level in the search bar to start!")
            ]));

        this.level_cont = show_cat.childNodes[1];

        this.section = util.div('info-section', [
            show_cat,
            this.createCategory("Settings", [
                this.createCheckbox("Hide triggers", opts.hideTriggers, (c) => callback('hideTriggers', c)),
            ]),
        ]);

        util.add(this.main.mainui, this.section);
    }
}