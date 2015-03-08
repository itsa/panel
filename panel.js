"use strict";
/**
 * Creating floating Panel-nodes which can be shown and hidden.
 *
 *
 * <i>Copyright (c) 2014 ITSA - https://github.com/itsa</i>
 * New BSD License - http://choosealicense.com/licenses/bsd-3-clause/
 *
 *
 * @module panel
 * @class Panel
 * @since 0.0.1
*/

require('js-ext/lib/object.js');
require('js-ext/lib/string.js');
require('polyfill');
require('./css/panel.css');


var NAME = '[panel]: ',
    PANEL_Z = 1000,
    MODAL_Z = 2000,
    PANEL_TOP = 999,
    MAX_WIDTH_FULL_BUTTONS = 150,
    createHashMap = require('js-ext/extra/hashmap.js').createMap;

module.exports = function (window) {

    var DOCUMENT = window.document,
        LightMap = require('js-ext/extra/lightmap.js'),
        Panel, Event, setupEvents, DD, stackManager, insertModalLayer;

    window._ITSAmodules || Object.protectedProp(window, '_ITSAmodules', createHashMap());

/*jshint boss:true */
    if (Panel=window._ITSAmodules.Panel) {
/*jshint boss:false */
        return Panel; // Panel was already created
    }

    require('window-ext')(window);
    require('node-plugin')(window);
    require('focusmanager')(window);
    require('scrollable')(window);

    Event = require('event-mobile')(window);
    DD = require('drag')(window);
    DD.init(); // ITSA combines the Drag-module with drag-drop into ITSA.DD

    /*
     * Generates a modal-layer.
     *
     * @method insertModalLayer
     * @protected
     * @since 0.0.1
     */
    insertModalLayer = function() {
       DOCUMENT.body.addSystemElement('<div class="itsa-modal-layer itsa-nodisplay"></div>', null, true);
    };

    insertModalLayer();

    /*
     * Sets up all events needed for Panel's to work well.
     *
     * @method setupEvents
     * @protected
     * @since 0.0.1
     */
    setupEvents = function() {
        Event.defineEvent('panel:buttonhide').defaultFn(function(e) {
            var model = e.model;
            model.visible = false;
            (typeof model.callback==='function') && model.callback(e.button);
        });
        Event.before('panel:buttonhide', function(e) {
            var model = e.model;
            if (typeof model.validate==='function') {
                model.validate(e) || e.preventDefault();
            }
        });
        Event.after('tap', function(e) {
            var buttonNode = e.target,
                panelNode = buttonNode.inside('[plugin-panel="true"]'),
                plugin = panelNode._plugin.panel,
                model = plugin.model;
            Event.emit(panelNode, 'panel:buttonhide', {button: buttonNode, plugin: plugin, model: model});
        }, '[plugin-panel="true"] >div[is="header"] button, [plugin-panel="true"] >div[is="footer"] button, [plugin-panel="true"] >button');
    };

    setupEvents();

    /*
     * An object with several method to control stacked panels.
     *
     * @property stackManager
     * @type Object
     * @protected
     * @since 0.0.1
     */
    stackManager = DOCUMENT.stackManager = {
        elements: new LightMap(),
        isOnTop: function(host) {
            return (this.topElement===host);
        },
        setOnTop: function(host) {
            this.topElement = host;
        },
        registerModal: function(host) {
            var instance = this;
            instance.elements.set(host, true);
            instance.showModalLayer(true);
        },
        unRegisterModal: function(host) {
            var instance = this;
            instance.elements.delete(host);
            instance.hasModalElements() || instance.showModalLayer(false);
        },
        hasModalElements: function() {
            return (this.elements.size()>0);
        },
        showModalLayer: function(show) {
            var modalLayer = DOCUMENT.getElement('body >div[is="system-node"].itsa-modal-layer', true);
            modalLayer.toggleClass('itsa-nodisplay', !show);
        }
    };

    /*
     * Creates a new Panel-node which is prepended to body.
     *
     * @for document
     * @method createPanel
     * @param data {Object} the panel plugin's `model`-object
     * @param [systemNode] {boolean} whether the created node should be a systemnode
     * @return {HTMLElement} the created panelNode
     * @since 0.0.1
     */
    DOCUMENT.createPanel = function(data, systemNode) {
        var panel;
        if (!Object.isObject(data)) {
            console.warn('document.createPanel should be invoked with an object as first argument.');
            return;
        }
        if (systemNode) {
            panel = DOCUMENT.body.addSystemElement('<div></div>');
        }
        else {
            panel = DOCUMENT.body.prepend('<div></div>');
        }
        panel.plug('panel', null, data);
        return panel;
    };

    window._ITSAmodules.Panel = Panel = DOCUMENT.definePlugin('panel', function() {
        var instance = this,
            model = instance.model,
            host = instance.host,
            allDivs, serverHeader, serverContent, serverFooter;

        if (host.getAttr('panel-rendered')==='true') {
            // serverside rendered --> we might need to catch header, content and footer
            // for they aren't set in the attributes
            allDivs = host.getAll('>div');
            serverHeader = allDivs[0] && allDivs[0].getHTML();
            serverContent = allDivs[1] && allDivs[1].getHTML();
            serverFooter = allDivs[2] && allDivs[2].getHTML();
            serverHeader && instance.defineWhenUndefined('header', serverHeader);
            serverContent && instance.defineWhenUndefined('content', serverContent);
            if (serverFooter) {
                instance.defineWhenUndefined('footer', serverFooter);
            }
        }
        instance._resizeHandler = Event.after('UI:resize', function() {
            var isMobileWidth = (window.getWidth()<=480);
            model.center && instance.centerPanel();
            host[((model.draggable && !isMobileWidth) ? '' : 'un')+'plug']('dd');
            instance.setPanelWidth(isMobileWidth);
        });
    }, {
        /*
         * All panel's attributes: these attributes will be read during initalization and updated during `sync`
         * In the dom, the attributenames are prepended with `pluginName-`. The property-values should be the property-types
         * that belong to the property, this way the attributes get right casted into model.
         *
         * @property attrs
         * @default {
         *    visible: 'boolean',
         *    onTopWhenShowed: 'boolean',
         *    headerCloseBtn: 'boolean',
         *    stack: 'number',
         *    left: 'number',
         *    top: 'number',
         *    center: 'boolean',
         *    minWidth: 'number',
         *    maxWidth: 'number',
         *    minHeight: 'number',
         *    maxHeight: 'number',
         *    modal: 'boolean',
         *    draggable: 'boolean',
         *    focusmanaged: 'boolean'
         * }
         * @type Object
         * @since 0.0.1
        */
        attrs: {
            visible: 'boolean',
            onTopWhenShowed: 'boolean',
            headerCloseBtn: 'boolean',
            stack: 'number',
            left: 'number',
            top: 'number',
            center: 'boolean',
            minWidth: 'number',
            maxWidth: 'number',
            minHeight: 'number',
            maxHeight: 'number',
            modal: 'boolean',
            draggable: 'boolean',
            focusmanaged: 'boolean'
        },
        /*
         * Any default values for attributes specified by `attrs`.
         *
         * @property defaults
         * @default {
         *    visible: false,
         *    onTopWhenShowed: true,
         *    stack: 1,
         *    center: true,
         *    modal: true,
         *    focusmanaged: true,
         *    headerCloseBtn: false
         * }
         * @type Object
         * @since 0.0.1
        */
        defaults: {
            visible: false,
            onTopWhenShowed: true,
            stack: 1,
            center: true,
            modal: true,
            focusmanaged: true,
            headerCloseBtn: false
        },
        /*
         * Renders the plugin. This method is invoked only once: at the end of initialization.
         * It should be used to render any nodes inside the host. Not all plugins need this.
         *
         * @method render
         * @since 0.0.1
         */
        render: function() {
            var instance = this,
                host = instance.host,
                newContent;
            host.setClass('itsa-hidden');
            newContent = '<div is="header"></div>'+
                         '<div is="content"></div>'+
                         '<div is="footer"></div>' +
                         '<button class="panel-close pure-button">x</button>';
            host.setHTML(newContent);
        },
        /*
         * Syncs plugin.model's data with the host. Not its attributes: they will be synced automaticly.
         * Is invoked after every change of plugin.model's data.
         *
         * @method sync
         * @since 0.0.1
         */
        sync: function() {
            var instance = this,
                host = instance.host,
                model = instance.model,
                header = model.header,
                content = model.content,
                footer = model.footer,
                stack = model.stack,
                divs = host.getAll('>div'),
                headerNode = divs[0],
                contentNode = divs[1],
                footerNode = divs[2],
                isMobileWidth = (window.getWidth()<=480),
                buttonCloseNode = host.getElement('>button'),
                showHeaderCloseBtn = model.headerCloseBtn,
                zIndex, isOnTop;
            (header==='undefined') && (header=undefined);
            (footer==='undefined') && (footer=undefined);
            if (!footer || !footer.contains('button')) {
                showHeaderCloseBtn = true;
            }
            if (showHeaderCloseBtn && !header) {
                header = '';
            }
            (header!==undefined) && headerNode.setHTML(header || '');
            buttonCloseNode.toggleClass('itsa-nodisplay', !showHeaderCloseBtn);

            headerNode.toggleClass('itsa-hidden', (header===undefined));
            contentNode.setHTML(content || '');
            contentNode.plug('scroll');
            (footer!==undefined) && footerNode.setHTML(footer || '');
            footerNode.toggleClass('itsa-hidden', (footer===undefined));

            zIndex = (model.modal ? MODAL_Z : PANEL_Z);

            if (model.visible && model.modal) {
                stackManager.registerModal(host);
            }
            else {
                stackManager.unRegisterModal(host);
            }

            if (model.onTopWhenShowed && model.visible && host.hasClass('itsa-hidden')) {
                instance.showOnTop();
            }

            isOnTop = stackManager.isOnTop(host);
            zIndex += isOnTop ? PANEL_TOP : stack;

            host.setInlineStyle('z-index', zIndex);

            model.minWidth && host.setInlineStyle('minWidth', model.minWidth);
            model.minHeight && host.setInlineStyle('minHeight', model.minHeight);
            model.maxHeight && host.setInlineStyle('maxHeight', model.maxHeight);
            instance.setPanelWidth(isMobileWidth);

            if (model.center && (!model.draggable || ((instance._previousVisible!==true) && model.visible))) {
                instance.centerPanel();
            }
            else if (!model.center && !host.hasClass('dd-dragging')) {
                host.setInlineStyles([
                    {property: 'left', value: model.left+'px'},
                    {property: 'top', value: model.top+'px'}
                ]);
            }
            // we can plug/unplug multiple times --> node-plugin won't do anything when there are no changes
            host[((model.draggable && !isMobileWidth) ? '' : 'un')+'plug']('dd');
            host[(model.focusmanaged ? '' : 'un')+'plug']('fm');
            host.toggleClass('itsa-full-draggable', model.draggable && !header);
            if (model.draggable && header) {
                 host.hasAttr('dd-handle') || host.setAttr('dd-handle', '>div:first-child');
            }
            else {
                 host.hasAttr('dd-handle') && host.removeAttr('dd-handle');
            }

            host.toggleClass('itsa-hidden', !model.visible);
            // if there is a change of model.visible, the fire an event:
            if (instance._previousVisible!==model.visible) {
                Event.emit(host, 'panel:'+ (model.visible ? 'shown' : 'hidden'), {plugin: instance, model: model});
                instance._previousVisible = model.visible;
            }
            if (isOnTop && model.modal) {
                host.focus();
            }
        },
        /*
         * Centeres the panel on the screen.
         *
         * @method centerPanel
         * @since 0.0.1
         */
        centerPanel: function() {
            var instance = this,
                host = instance.host,
                model = instance.model;
            model.left = Math.round((window.getWidth()-host.width)/2);
            model.top = Math.round((window.getHeight()-host.height)/2);
            host.setInlineStyles([
                {property: 'left', value: model.left+'px'},
                {property: 'top', value: model.top+'px'}
            ]);
        },
        /*
         * Sets the style `maxWidth` and the attribute `expand-buttons`. These need to be set after width-changes of either the panel or the screen.
         *
         * @method setPanelWidth
         * @param isMobileWidth {Boolean} whether the current screen-width is `mobile-width`
         * @since 0.0.1
         */
        setPanelWidth: function(isMobileWidth) {
            var instance = this,
                host = instance.host,
                model = instance.model;
            if (isMobileWidth) {
                host.hasInlineStyle('maxWidth') && host.removeInlineStyle('maxWidth');
                host.setAttr('expand-buttons', 'true');
            }
            else {
                if (model.maxWidth) {
                    host.setInlineStyle('maxWidth', model.maxWidth);
                    if (host.width>MAX_WIDTH_FULL_BUTTONS) {
                        host.removeAttr('expand-buttons');
                    }
                    else {
                        host.setAttr('expand-buttons', 'true');
                    }
                }
                else {
                     host.removeAttr('expand-buttons');
                }
            }
        },
        /*
         * Maes this panel as the `top`-panel of the stack.
         *
         * @method showOnTop
         * @since 0.0.1
         */
        showOnTop: function() {
            stackManager.setOnTop(this.host);
        },
        /*
         * Cleansup the plugin. Is invoked whenever a plugin gets unplugged or its host gets removed from the dom.
         *
         * @method destroy
         * @since 0.0.1
         */
        destroy: function() {
            var instance = this,
                host = instance.host;
            instance._resizeHandler.detach();
            host.removeInlineStyle('z-index');
            host.unplug('dd');
            host.unplug('fm');
            host.removeClass(['itsa-hidden', 'itsa-full-draggable']);
            stackManager.unRegisterModal(host);
            host.empty();
        }
    });

    return Panel;
};