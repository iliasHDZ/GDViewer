import util from './util'
import {GDRenderer} from './../GDRenderW/main'

import {EditorLevel} from './../level'
import parser from './../levelparse'

import levelcode from './../startup.gmd'

import SearchUI from './search'
import InfoUI   from './info'

import requests from './../requests'

import pako from 'pako'

const Buffer = require('buffer/').Buffer;

export default function MainUI(body, head) {
    this.body = body;
    this.head = head;

    this.canvas;
    this.renderer;

    this.panning = false;

    this.level = {
        level: {info: {}, data: {}}
    };

    this.faces = {};

    this.options = {
        antialias:  false,
        grid:       true,
        axis:       true,
        guidelines: true
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

        this.renderer.renderLevel(
            this.level,
            this.canvas.width,
            this.canvas.height,
            this.options
        );
    }

    this.decodeLevel = (data) => {
        let decoded = Buffer.from(data, 'base64');
        return new TextDecoder("utf-8").decode(pako.ungzip(decoded));
    }

    this.loadLevel = (level) => {
        this.level = new EditorLevel(
            this.renderer,
            parser.code2object(this.decodeLevel(level.data))
        );

        this.renderer.camera.x    = 400;
        this.renderer.camera.y    = -200;
        this.renderer.camera.zoom = 1;
        this.updateCanvas();

        if (typeof URL_EMBED === 'undefined')
            this.info.loadLevel({
                title:  level.name,
                author: level.author,
                face:   level.difficultyFace,
                likes:  level.likes,
                plays:  level.downloads,
                desc:   level.description,
                song_title:  level.songName,
                song_author: level.songAuthor
            });

        this.levelLoaded();
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
            util.a('https://gdviewers.tk', 'footer-link', "GDViewer", {target: '_blank'}),
            " - ",
            util.a('https://github.com/IliasHDZ/GDViewer', 'footer-link', "GitHub", {target: '_blank'}),
            " - MIT License - By ",
            util.a('https://github.com/IliasHDZ', 'footer-link', "IliasHDZ", {target: '_blank'}),
            " - UI Design By ",
            util.a('https://fasner.io/Laica', 'footer-link', "Laica", {target: '_blank'}),
        ]);

        util.add(this.mainui, this.footer);
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

    this.init = () => {
        this.canvas  = util.element('canvas');

        this.mainui  = util.element('div', 'main-ui',
            util.element('div', 'viewport', this.canvas) );

        util.add(this.body, this.mainui);

        let gl = this.canvas.getContext('webgl', {antialias: false});

        this.renderer = new GDRenderer(gl, (r) => {
            if (r.loaded) {
                this.updateCanvas();
                this.assetsLoaded();
            }
        });

        this.renderer.camera.x = 660;
        this.renderer.camera.y = -100;

        if (typeof URL_EMBED !== 'undefined') {
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
            this.level = new EditorLevel(
                this.renderer,
                parser.code2object(this.decodeLevel(levelcode))
            );
            this.updateCanvas();
            this.levelLoaded();
        }

        window.onresize = () => this.updateCanvas();

        this.preloadFaces();

        this.canvas.onmousedown = (e) => {
            if (e.button != 0) return;

            this.panning = true;
            let main = this;

            let update = () => {
                main.updateCanvas();
                if (main.panning)
                    window.requestAnimationFrame(update);
            }
            update();
        };
        document.onmouseup   = () => this.panning = false;

        document.onmousemove = (e) => {
            if (this.panning) {
                let cam = this.renderer.camera;

                cam.x -= e.movementX / cam.zoom;
                cam.y -= e.movementY / cam.zoom;
            }
        }

        this.canvas.onwheel = (e) => {
            let cam = this.renderer.camera;

            if(e.deltaY >= 0) cam.zoom *= 1 - (e.deltaY/1000);
            else cam.zoom /= 1 - (e.deltaY/-1000);

            if(cam.zoom > 10) cam.zoom = 10;
            else if(cam.zoom < 0.2) cam.zoom = 0.2;
            
            this.updateCanvas();
        };

        util.add(this.head, util.element('script', [], [], {'src': "https://code.iconify.design/1/1.0.7/iconify.min.js"}) );
        util.add(this.head, util.element('link',   [], [], {'rel': "preconnect", 'href': "https://fonts.gstatic.com"}) );
        util.add(this.head, util.element('link', [], [],
            {'rel': "stylesheet", 'href': "https://fonts.googleapis.com/css2?family=Open+Sans:ital,wght@0,400;0,600;1,400;1,600&display=swap"}) );

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
                                        face:   lvl.difficultyFace,
                                        plays:  lvl.downloads,
                                        likes:  lvl.likes
                                    });

                                resolve(disp);
                            })
                            .catch(reject);
                    });
                else if (t == 'level-click') {
                    this.info.setLoading();
                    requests.downloadLevel(p)
                        .then(data => this.loadLevel(data))
                        .catch(console.err);
                }
            });
            this.search.init();

            this.info = new InfoUI(this, (t, p) => {
                if (t == "grid") this.options.grid = p;
                if (t == "axis") this.options.axis = p;
                if (t == "guidelines") this.options.guidelines = p;

                this.updateCanvas();
            });

            this.info.init(this.options);
        }

        this.generateFooter();
        this.setLoadingScreen();
    };
}