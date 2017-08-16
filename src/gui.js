import css from 'dom-css';
import isstring from 'is-string';

import themes from './themes';
import { theme } from './theme';

const styles = require('./styles/container-style.js');

import { ComponentManager } from './component-manager';

import { MenuBar } from './menu-bar';
import { Panel } from './panel';
import { ToastArea } from './toast-area';

export default class GUI {
    constructor(opts) {
        this.opts = opts;

        this.hasRoot = opts.root !== undefined;

        let InitValue = (value, defaultValue) => {
            if(value === undefined) value = defaultValue;
        }

        InitValue(opts, {});
        InitValue(opts.width, 300);
        opts.theme = isstring(opts.theme) ? themes[opts.theme] : themes.dark;
        InitValue(opts.root, document.body);
        InitValue(opts.align, 'right'); // Can be 'left' or 'right'
        InitValue(opts.opacity, 1.0);
        InitValue(opts.barMode, 'offset'); // Can be 'none', 'above', 'offset', or 'overlay'
        InitValue(opts.pollRateMS, 100);

        // Set theme global from opts
        theme.Set(opts.theme);

        this._ConstructElements();
        this._LoadStyles();

        this.componentManager = new ComponentManager();

        this.loadedComponents = [];

        // Begin component update loop
        this._UpdateComponents();

    }

    /**
     * Load any runtime styling information needed here.
     */
    _LoadStyles() {
        // Loads a font and appends it to the head
        let AppendFont = (href) => {
            var elem = document.createElement('style');
            elem.setAttribute('type', 'text/css');
            elem.setAttribute('rel', 'stylesheet');
            elem.setAttribute('href', href);
            document.getElementsByTagName('head')[0].appendChild(elem);
        }
        // Load the fonts we'll be using
        // Mono font
        AppendFont('//cdn.jsdelivr.net/font-hack/2.019/css/hack.min.css');
        // Theme font
        if(this.opts.theme.font) {
            // Set default font to theme font
            AppendFont(this.opts.theme.font.fontURL);
            css(this.container, {
                'font-family': this.opts.theme.font.fontFamily
            });
        } else {
            css(this.container, {
                'font-family': `'Hack', monospace`
            });
        }
    }

    /**
     * Create container, MenuBar, Panel, and ToastArea
     */
    _ConstructElements() {
        // Create the container that all the other elements will be contained within
        this.container = document.createElement('div');
        this.container.classList.add(styles['guify-container']);
        css(this.container, {
            top: (this.opts.barMode == 'above' && this.hasRoot) ? -this.opts.theme.sizing.menuBarHeight : '0',
        });
        this.opts.root.appendChild(this.container);

        // Create a menu bar if specified in `opts`
        if(this.opts.barMode !== 'none') {
            this.bar = new MenuBar(this.container, this.opts);
            this.bar.addListener('ontogglepanel', () => {
                this.panel.ToggleVisible();
            });
        }

        // Create panel
        this.panel = new Panel(this.container, this.opts);


        // Hide the panel if there is a menu bar
        if(this.opts.barMode !== 'none') {
            this.panel.SetVisible(false);
        } else {
            // Otherwise show it by default
            this.panel.SetVisible(true);
        }

        // Create toast area
        this.toaster = new ToastArea(this.container, this.opts);

    }

    /**
     * Polling loop that allows our components to update themselves.
     * You can set the frequency of this using `this.opts.pollRateMS`.
     */
    _UpdateComponents() {
        this.loadedComponents.forEach((component) => {
            if(component.binding) {
                // Update the component from its bound value if the value has changed
                if(component.binding.object[component.binding.property] != component.oldValue) {
                    component.SetValue(component.binding.object[component.binding.property]);
                    component.oldValue = component.binding.object[component.binding.property];
                }
            }
        });

        setTimeout(() => {
            window.requestAnimationFrame(() => {
                this._UpdateComponents();
            });
        }, this.opts.pollRateMS);

    }


    /**
     * Creates a new component in the panel based on the provided options.
     * @param {*} [obj] Either an opts object or an array of opts objects
     * @param {Object} [applyToAll] Each property of this object will be applied to all opts objects
     */
    Register(obj, applyToAll = {}) {
        if (Array.isArray(obj)) {
            obj.forEach((item) => {
                let merged = Object.assign(item, applyToAll);
                this._Register(merged);
            });
        }
        else {
            let merged = Object.assign(obj, applyToAll);
            this._Register(merged);
        }
    }

    /**
     * Creates new component in the panel based on the options provided.
     *
     * @param {Object} [opts] Options for the component
     */
    _Register(opts) {

        if (opts.object && opts.property)
            if (opts.object[opts.property] === undefined)
                throw new Error(`Object ${opts.object} has no property '${opts.property}'`);

        // Set opts properties from the input
        if(opts.object && opts.property) {
            opts.initial = opts.object[opts.property];
            // If no label is specified, generate it from property name
            //opts.label = opts.label || property;
        }

        let root = this.panel.element;

        // If a folder was specified, try to find a folder component with that name
        // and get its folderContainer.
        if(opts.folder) {
            let folderComp = this.loadedComponents.find((cmp) => {
                return cmp.opts.type === 'folder' && cmp.opts.label === opts.folder;
            });

            if(folderComp) root = folderComp.folderContainer;
            else throw new Error(`No folder exists with the name ${opts.folder}`);
        }

        let component = this.componentManager.Create(opts.type, root, opts);

        // Add binding properties if specified
        if(opts.object && opts.property) {
            component['binding'] = { object: opts.object, property: opts.property };
        }

        // If the component has events, add listeners for those events.
        if(component.on) {
            component.on('initialized', function (data) {
                if(opts.onInitialize)
                    opts.onInitialize(data);
            });

            component.on('input', (data) => {
                if(opts.object && opts.property)
                    opts.object[opts.property] = data;

                if(opts.onChange) {
                    opts.onChange(data);
                }
            });
        }

        this.loadedComponents.push(component);


    }

    /**
     * Displays a toast notification under the MenuBar at the top of the root.
     *
     * @param {String} [message] The string you want displayed in the notification.
     * @param {Integer} [stayMS] The number of milliseconds to display the notification for
     * @param {Integer} [transitionMS ] The number of milliseconds it takes for the notification to transition into disappearing
     */
    Toast(message, stayMS = 5000, transitionMS = 100) {
        this.toaster.CreateToast(message, stayMS, transitionMS);
    }



}
