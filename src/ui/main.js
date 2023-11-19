import util from './util'
import {Renderer, GDLevel, WebGLContext, Vec2} from 'gdrweb'

import SearchUI from './search'
import InfoUI   from './info'

import requests from './../requests'

import startup from '../startup.json'

export default function MainUI(body, head) {
    this.body = body;
    this.head = head;

    this.canvas;
    this.renderer;

    this.playSection = null;
    this.playing = false;
    this.audio = null;

    this.panning = false;

    this.level = {
        level: {info: {}, data: {}}
    };

    this.faces = {};

    this.options = {
        hideTriggers: false
    };

    this.preloadFaces = () => {
        const url   = ( (typeof URL_EMBED !== 'undefined') ? "../" : "" ) + "assets/faces/";
        const faces = ["auto", "unrated", "easy", "normal", "hard", "harder", "insane",
                       "demon-easy", "demon-medium", "demon-hard", "demon-insane", "demon-extreme"];

        let imgs = [];

        for (const face of faces) {
            this.faces[face] = new Image();
            this.faces[face].src = url + face + ".png";

            this.faces[face + "-featured"] = new Image();
            this.faces[face + "-featured"].src = url + face + "-featured.png";

            this.faces[face + "-epic"] = new Image();
            this.faces[face + "-epic"].src = url + face + "-epic.png";
        }
    }

    this.updateCanvas = () => {
        this.canvas.width  = window.innerWidth;
        this.canvas.height = window.innerHeight;

        this.renderer.render(this.level, this.options);
    }

    this.isCanvasUpdating = false;
    this.shouldCanvasUpdate = false;

    const updateCallback = () => {
        this.isCanvasUpdating = true;

        if (this.shouldCanvasUpdate)
            this.updateCanvas();
        this.shouldCanvasUpdate = false;
        requestAnimationFrame(updateCallback);
    }

    this.requestCanvasUpdate = () => {
        this.shouldCanvasUpdate = true;
        
        if (!this.isCanvasUpdating)
            requestAnimationFrame(updateCallback);
    }

    this.loadingLevel = false;

    this.loadLevel = (level) => {
        if (this.playing)
            this.stopLevel();

        if (this.loadingLevel)
            return;

        console.log(level);

        this.loadingLevel = true;

        this.level = GDLevel.fromBase64String(this.renderer, level.data);
        this.levelInfo = level;

        this.audio = null;

        this.renderer.camera.x    = 400;
        this.renderer.camera.y    = 200;
        this.renderer.camera.zoom = 1;
        this.updateCanvas();

        if (typeof URL_EMBED === 'undefined')
            this.info.loadLevel({
                title:  level.name,
                author: level.author,
                face:   level.face,
                likes:  level.likes,
                plays:  level.plays,
                desc:   level.description,
                song_title:  level.songName,
                song_author: level.songAuthor
            });

        this.levelLoaded();
        this.loadingLevel = false;
    };

    this.loading_screen = null;

    this.setLoadingScreen = function() {
        this.closeLoadingScreen();

        this.loading_screen = util.div('loading-screen', 
            util.div('loading-container', [
                util.element('p', 'loading-text', "GDViewer"),
                util.element('p', 'loading-subtext', "Loading level and assets...")
            ])
        );

        util.add(this.body, this.loading_screen);
    }

    this.closeLoadingScreen = function() {
        if (this.loading_screen) {
            this.body.removeChild(this.loading_screen)
            this.loading = null;
        }
    }

    this.generateFooter = function() {
        this.footer = util.element('p', 'footer-section', [
            util.a('https://github.com/IliasHDZ/GDViewer', 'footer-link', "GDViewer", {target: '_blank'}),
            " - Powered by ",
            util.a('https://github.com/IliasHDZ/GDRWeb', 'footer-link', "GDRWeb", {target: '_blank'}),
            " - Created by ",
            util.a('https://github.com/IliasHDZ', 'footer-link', "IliasHDZ", {target: '_blank'}),
            " - UI Design By Nora",
        ]);

        util.add(this.mainui, this.footer);
    }

    this.loadAudio = function() {
        if (!this.levelInfo || typeof(this.levelInfo.customSong) != 'number' || this.levelInfo.customSong == 0)
            return;

        const level = this;
        return new Promise((resolve, _) => {
            const audio = new Audio(requests.resolvePath(`/getsong/${this.levelInfo.customSong}.mp3`));

            audio.addEventListener('canplaythrough', () => {
                audio.volume = 0.2;
                level.audio = audio;
                resolve();
            });

            audio.onerror = () => {
                resolve();
            }
        });   
    }

    this.setPlayLoad = (v) => {
        this.playButton.style.display = v ? 'none' : '';
        this.playLoader.style.display = v ? '' : 'none';
    }

    this.playLevel = async function() {
        if (this.audio == null) {
            this.setPlayLoad(true);
            await this.loadAudio();
        }

        this.setPlayLoad(false);

        if (this.audio == null)
            return;

        this.audioStartTime = performance.now() / 1000;
        this.audio.play();
        this.audio.currentTime = this.level.timeAt(Math.max(this.renderer.camera.x, 0)) + this.level.song_offset;
        this.audioStartOffset = this.audio.currentTime - this.level.song_offset;

        this.playing = true;
        const level = this;
        const update = () => {
            if (level.playing)
                window.requestAnimationFrame(update);    

            const deltaFromStart = (performance.now() / 1000) - level.audioStartTime;
            level.renderer.camera.x = level.level.posAt(level.audioStartOffset + deltaFromStart);
            this.requestCanvasUpdate();
        }
        
        this.playMusicIcon.style.display = 'none';
        this.playStopIcon.style.display  = '';

        update();
    }

    this.stopLevel = async function() {
        this.playing = false;
        if (this.audio != null)
            this.audio.pause();
        
        this.playMusicIcon.style.display = '';
        this.playStopIcon.style.display  = 'none';
    }

    this.playButtonPress = async function() {
        if (this.playing)
            await this.stopLevel();
        else
            await this.playLevel();
    }

    this.generatePlayButton = function() {
        this.playMusicIcon = util.div('play-music', util.iconify('fa-solid:music', ['play-button', 'play-icon']));
        this.playStopIcon  = util.div('play-stop', util.iconify('fa-solid:stop', ['play-button', 'play-icon']), {style: 'display: none;'});
        this.playLoader    = util.div('play-loader', [], {style: 'display: none;'});

        this.playButton = util.div('play-button', [
            this.playMusicIcon,
            this.playStopIcon
        ]);

        this.playSection = util.div('play-section', [
            this.playButton,
            this.playLoader
        ]);

        this.playButton.onclick = () => this.playButtonPress();

        util.add(this.mainui, this.playSection);
    }

    this.assets_done = false;
    this.level_done  = false;

    this.assetsLoaded = () => {
        this.assets_done = true;

        if (this.assets_done && this.level_done) this.closeLoadingScreen();
    }

    this.levelLoaded = () => {
        this.level_done = true;

        if (this.assets_done && this.level_done) this.closeLoadingScreen();
    }

    this.loadLevelFromServers = async (id) => {
        if (this.searchLevelLoading)
            return;
        window.history.pushState({id}, '', window.location.origin + window.location.pathname + "?id=" + id);
        this.searchLevelLoading = true;
        this.info.setLoading();
        const data = await requests.downloadLevel(id)
        this.loadLevel(data);
        this.searchLevelLoading = false;
    }

    this.loadStartupLevel = () => {
        this.level = GDLevel.fromBase64String(this.renderer, startup);
    }

    this.searchLevelLoading = false;

    this.init = async () => {
        this.canvas  = util.element('canvas');

        this.mainui  = util.element('div', 'main-ui',
            util.element('div', 'viewport', this.canvas) );

        util.add(this.body, this.mainui);

        await Renderer.initTextureInfo(
            "../assets/GJ_GameSheet-hd.plist",
            "../assets/GJ_GameSheet02-hd.plist"
        );

        this.renderer = new Renderer(
            new WebGLContext(this.canvas), 
            "../assets/GJ_GameSheet-hd.png",
            "../assets/GJ_GameSheet02-hd.png"
        );
        
        await this.renderer.loadBackgrounds(name => `../assets/backgrounds/${name}.png`);
        await this.renderer.loadGrounds(name => `../assets/grounds/${name}.png`);

        this.renderer.camera.x = 610;
        this.renderer.camera.y = 275;

        /*if (typeof URL_EMBED !== 'undefined') {
            let params = new URLSearchParams(window.location.search);

            console.log(params.get('levelid'));

            if (params.has('levelid')) {
                requests.downloadLevel(params.get('levelid'))
                    .then(data => {
                        this.loadLevel({
                            data: data.data
                        });
                        this.updateCanvas();
                    })
                    .catch(e => {
                        this.loadLevel({
                            data: levelcode
                        });
                        console.error(e);
                        this.updateCanvas();
                    });
            } else {
                this.loadLevel({
                    data: levelcode
                });
                this.updateCanvas();
            }
        } else {
        }*/
        this.canvas.width  = window.innerWidth;
        this.canvas.height = window.innerHeight;

        this.preloadFaces();

        if (typeof URL_EMBED === 'undefined') {
            this.search = new SearchUI(this, (t, p) => {
                if (t == 'search')
                    return new Promise((resolve, reject) => {
                        requests.searchLevels(p)
                            .then(lvls => {
                                let disp = [];

                                for (let lvl of lvls)
                                    disp.push({
                                        id:     +lvl.id,
                                        title:  lvl.name,
                                        author: lvl.author,
                                        face:   lvl.face,
                                        plays:  lvl.plays,
                                        likes:  lvl.likes
                                    });

                                resolve(disp);
                            })
                            .catch(reject);
                    });
                else if (t == 'level-click') {
                    this.loadLevelFromServers(p);
                }
            });
            this.search.init();

            this.info = new InfoUI(this, (t, p) => {
                if (t == "hideTriggers") this.options.hideTriggers = p;

                this.requestCanvasUpdate();
            });

            this.info.init(this.options);
        }

        const params = new URLSearchParams(window.location.search);
        let urlLevelLoaded = false;
        if (params.has('id') && !isNaN(+params.get('id'))) {
            const id = +params.get('id');
            try {
                await this.loadLevelFromServers(id);
                urlLevelLoaded = true;
            } catch {}
        }

        if (!urlLevelLoaded)
            this.loadStartupLevel();
        this.levelLoaded();
        this.updateCanvas();

        setTimeout(() => this.requestCanvasUpdate(), 2000);

        window.onresize = () => this.requestCanvasUpdate();

        this.canvas.onmousedown = (e) => {
            if (e.button != 0) return;

            this.panning = true;
            let main = this;

            main.requestCanvasUpdate();
        };
        document.onmouseup   = () => this.panning = false;

        document.onmousemove = (e) => {
            if (this.panning) {
                let cam = this.renderer.camera;

                cam.x -= e.movementX / cam.zoom;
                cam.y += e.movementY / cam.zoom;
                this.requestCanvasUpdate();
            }
        }

        this.canvas.onwheel = (e) => {
            let cam = this.renderer.camera;

            if(e.deltaY >= 0) cam.zoom *= 1 - (e.deltaY/1000);
            else cam.zoom /= 1 - (e.deltaY/-1000);

            if(cam.zoom > 10) cam.zoom = 10;
            else if(cam.zoom < 0.2) cam.zoom = 0.2;
            
            this.requestCanvasUpdate();
        };

        util.add(this.head, util.element('script', [], [], {'src': "https://code.iconify.design/1/1.0.7/iconify.min.js"}) );
        util.add(this.head, util.element('link',   [], [], {'rel': "preconnect", 'href': "https://fonts.gstatic.com"}) );
        util.add(this.head, util.element('link', [], [],
            {'rel': "stylesheet", 'href': "https://fonts.googleapis.com/css2?family=Open+Sans:ital,wght@0,400;0,600;1,400;1,600&display=swap"}) );


        this.generatePlayButton();
        this.generateFooter();
    };
}