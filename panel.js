"use strict";

require('js-ext/lib/object.js');
require('polyfill');
require('./css/panel.css');

/**
 *
 *
 *
 * <i>Copyright (c) 2014 ITSA - https://github.com/itsa</i>
 * New BSD License - http://choosealicense.com/licenses/bsd-3-clause/
 *
 * @module focusmanager
 * @class FocusManager
 * @since 0.0.1
*/

var NAME = '[panel]: ',
    SYNC_TIMER = 1000,
    PANEL_Z = 1000,
    MODAL_Z = 2000,
    PANEL_TOP = 999,
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

    Event = require('event-mobile')(window);
    DD = require('drag')(window);
    DD.init(); // ITSA combines the Drag-module with drag-drop into ITSA.DD

    insertModalLayer = function() {
       DOCUMENT.body.addSystemElement('<div class="itsa-modal-layer itsa-no-display"></div>', null, true);
    };

    insertModalLayer();

    setupEvents = function() {
        Event.after('tap', function(e) {
            var buttonNode = e.target,
                panel = buttonNode.inside('[plugin-panel="true"]');
            panel._plugin.panel.model.visible = false;
        }, '[plugin-panel="true"] >div[is="header"] button, [plugin-panel="true"] >div[is="footer"] button, [plugin-panel="true"] >button');
    };

    setupEvents();

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
            modalLayer.toggleClass('itsa-no-display', !show);
        }
    };

    DOCUMENT.createPanel = function(data, systemNode) {
        var panel;
        if (!Object.isObject(data)) {
            data = {
                content: data
            };
        }
        if (systemNode) {
            panel = DOCUMENT.body.addSystemElement('<div></div>');
        }
        else {
            panel = DOCUMENT.body.prepend('<div></div>');
        }
        panel.plug('panel', null, data);
        // does NOT return the node, but `model` so it can be controled!
        return data;
    };

    window._ITSAmodules.Panel = Panel = DOCUMENT.definePlugin('panel', null, {
        attrs: {
            header: 'string',
            content: 'string',
            footer: 'string',
            visible: 'boolean',
            onTopWhenShowed: 'boolean',
            headerCloseBtn: 'boolean',
            stack: 'number',
            left: 'number',
            top: 'number',
            center: 'boolean',
            modal: 'boolean',
            draggable: 'boolean',
            focusmanaged: 'boolean'
        },
        defaults: {
            visible: false,
            onTopWhenShowed: true,
            stack: 1,
            center: true,
            modal: true,
            focusmanaged: true,
            headerCloseBtn: false
        },
        render: function() {
            var instance = this,
                host = instance.host,
                newContent;
            host.setClass('itsa-hidden');
            newContent = '<div is="header"></div>'+
                         '<div is="content"></div>'+
                         '<div is="footer"></div>' +
                         '<button class="panel-close">x</button>';
            host.setHTML(newContent);
        },
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
                buttonCloseNode = host.getElement('>button'),
                zIndex, isOnTop;
            (header==='undefined') && (header=undefined);
            (footer==='undefined') && (footer=undefined);
            if (model.headerCloseBtn && !header) {
                header = '';
            }
            header && headerNode.setHTML(header || '');
            buttonCloseNode.toggleClass('itsa-no-display', !model.headerCloseBtn);
            headerNode.toggleClass('itsa-hidden', !header);
            contentNode.setHTML(content || '');
            contentNode.plug('scroll');
            footer && footerNode.setHTML(footer || '');
            footerNode.toggleClass('itsa-hidden', !footer);

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

            if (model.center && (!instance._prevCenter || !model.draggable)) {
                model.left = Math.round((window.getWidth()-host.width)/2);
                model.top = Math.round((window.getHeight()-host.height)/2);
                host.setInlineStyles([
                    {property: 'left', value: model.left+'px'},
                    {property: 'top', value: model.top+'px'}
                ]);
            }
            else if (!model.center && !host.hasClass('dd-dragging')) {
                host.setInlineStyles([
                    {property: 'left', value: model.left+'px'},
                    {property: 'top', value: model.top+'px'}
                ]);
            }
            // prevent re-centering: that would be unhandy when the panel is draggable:
            instance._prevCenter = model.center;
            // we can plug/unplug multiple times --> node-plugin won't do anything when there are no changes
            host[(model.draggable ? '' : 'un')+'plug']('dd');
            host[(model.focusmanaged ? '' : 'un')+'plug']('fm');
            host.toggleClass('itsa-full-draggable', model.draggable && !header);
            if (model.draggable && header) {
                 host.hasAttr('dd-handle') || host.setAttr('dd-handle', 'div[is="header"]');
            }
            else {
                 host.hasAttr('dd-handle') && host.removeAttr('dd-handle');
            }

            host.toggleClass('itsa-hidden', !model.visible);
            if (isOnTop && model.modal && !host.hasClass('focussed')) {
                host.focus();
            }
        },
        showOnTop: function() {
            stackManager.setOnTop(this.host);
        },
        destroy: function() {
            var host = this.host;
            host.removeInlineStyle('z-index');
            host.unplug('dd');
            host.unplug('fm');
            host.removeClass(['itsa-hidden', 'itsa-full-draggable']);
            stackManager.unRegisterModal(host);
        }
    });

    return Panel;
};