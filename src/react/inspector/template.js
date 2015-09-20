var domUtils = require('basis.dom');
var domEventUtils = require('basis.dom.event');
var setStyle = require('basis.cssom').setStyle;
var getBoundingRect = require('basis.layout').getBoundingRect;
var Value = require('basis.data').Value;
var Balloon = require('basis.ui.popup').Balloon;

var fileAPI = require('../api/file.js');
var componentBoundMarker = '__view';

var document = global.document;
var templateInfo = resource('./template-info/index.js');

var inspectDepth = 0;
var inspectMode = new Value({ value: false });

var overlay = domUtils.createElement({
  css: {
    pointerEvents: 'none',
    transition: 'all .05s',
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    right: 0,
    zIndex: 10000,
    background: 'rgba(110,163,217,0.7)'
  }
});
var boxElement = domUtils.createElement({
  css: {
    visibility: 'hidden',
    position: 'absolute'
  }
});

function pickHandler(event){
  event.die();

  if (event.mouseRight)
  {
    stopInspect();
    return;
  }

  var component = pickupTarget.value;

  if (component)
  {
    stopInspect();

    if (event.altKey)
    {
      var info = basis.reactApi.getDevInfo(component.element._currentElement);

      if (info && info.loc)
        fileAPI.openFile(info.loc);
      else
        console.info('Object create location doesn\'t resolved:', component, info);
    }
    else
    {
      templateInfo().set(component.node);
    }
  }
}

var pickupTarget = new Value({
  handler: {
    change: function(){
      var component = this.value || null;

      if (component)
      {
        var rectNode = component.node;
        var rect;

        if (rectNode.nodeType == 3)
        {
          rectNode = document.createRange();
          rectNode.selectNodeContents(component.node);
        }

        rect = getBoundingRect(rectNode);

        if (rect)
        {
          var style = {
            left: rect.left + 'px',
            top: rect.top + 'px',
            width: rect.width + 'px',
            height: rect.height + 'px'
          };
          setStyle(overlay, style);
          setStyle(boxElement, style);
          document.body.appendChild(overlay);
          document.body.appendChild(boxElement);
        }
      }
      else
      {
        domUtils.remove(overlay);
        domUtils.remove(boxElement);
        inspectDepth = 0;
      }

      nodeInfoPopup().update({
        node: component && component.node,
        element: component && component.element
      });
    }
  }
});

var nodeInfoPopup = basis.fn.lazyInit(function(){
  return new Balloon({
    dir: 'left bottom left top',
    template: resource('./template/template_hintPopup.tmpl'),
    autorotate: [
      'left top left bottom',
      //'center center center center',
      // 'left top left top',
      // 'left bottom left bottom',
      'right bottom right top',
      'right top right bottom'
      // 'right bottom right bottom',
      // 'right top right top'
    ],
    binding: {
      openFileSupported: {
        events: 'delegateChanged update',
        getter: function(){
          var basisjsTools = typeof basisjsToolsFileSync != 'undefined' ? basisjsToolsFileSync : basis.devtools;
          return basisjsTools && typeof basisjsTools.openFile == 'function';
        }
      },
      name: {
        events: 'delegateChanged update',
        getter: function(node){
          var element = node.data.element;
          var data = element && basis.reactApi.getInfo(element);
          if (data)
            return data.name;
        }
      },
      instanceLocation: {
        events: 'delegateChanged update',
        getter: function(node){
          var element = node.data.element;
          return basis.reactApi.getDevInfo(element && element._currentElement, 'loc');
        }
      }
    },
    handler: {
      update: function(){
        if (this.data.node)
          this.show(boxElement);
        else
          this.hide();
      },
      hide: function(){
        this.update({
          tmpl: null
        });
      }
    }
  });
});

function contextmenuHandler(e){
  e.die();
  stopInspect();
}

function startInspect(){
  if (!inspectMode.value)
  {
    if (templateInfo.isResolved())
      templateInfo().set();

    domEventUtils.addGlobalHandler('mousemove', mousemoveHandler);
    domEventUtils.addGlobalHandler('mousewheel', mouseWheelHandler);
    domEventUtils.addGlobalHandler('wheel', mouseWheelHandler);
    domEventUtils.addGlobalHandler('DOMMouseScroll', mouseWheelHandler);
    domEventUtils.addGlobalHandler('mousedown', domEventUtils.kill);
    domEventUtils.addGlobalHandler('mouseup', domEventUtils.kill);
    domEventUtils.addGlobalHandler('contextmenu', contextmenuHandler);
    domEventUtils.addGlobalHandler('click', pickHandler);

    inspectMode.set(true);
  }
}

function stopInspect(){
  if (inspectMode.value)
  {
    domEventUtils.removeGlobalHandler('mousemove', mousemoveHandler);
    domEventUtils.removeGlobalHandler('mousewheel', mouseWheelHandler);
    domEventUtils.removeGlobalHandler('wheel', mouseWheelHandler);
    domEventUtils.removeGlobalHandler('DOMMouseScroll', mouseWheelHandler);
    domEventUtils.removeGlobalHandler('mousedown', domEventUtils.kill);
    domEventUtils.removeGlobalHandler('mouseup', domEventUtils.kill);
    domEventUtils.removeGlobalHandler('contextmenu', contextmenuHandler);
    domEventUtils.removeGlobalHandler('click', pickHandler);

    inspectMode.set(false);
    pickupTarget.set();
  }
}

var lastMouseX;
var lastMouseY;
var DEPTH_MODE_MOVE_THRESHOLD = 8;

function mousemoveHandler(event){
  var dx = Math.abs(event.mouseX - lastMouseX);
  var dy = Math.abs(event.mouseY - lastMouseY);
  var cursor = event.sender;
  var instance;

  if (inspectDepth && lastMouseX && dx < DEPTH_MODE_MOVE_THRESHOLD && dy < DEPTH_MODE_MOVE_THRESHOLD)
    return;

  lastMouseX = event.mouseX;
  lastMouseY = event.mouseY;

  if (instance = basis.reactApi.getComponent(cursor))
    inspectDepth = 0;

  pickupTarget.set(instance);
}

function mouseWheelHandler(event){
  var delta = event.wheelDelta;
  var sender = event.sender;
  var cursor = sender;

  var tempDepth = inspectDepth + delta;
  var curDepth = 0;
  var lastRefId;
  var lastDepth;
  var refId;

  do {
    if (refId = cursor[componentBoundMarker])
    {
      lastRefId = refId;
      lastDepth = curDepth;

      if (tempDepth < 0 || curDepth == tempDepth)
        break;

      curDepth++;
    }
  }
  while (cursor = cursor.parentNode);

  pickupTarget.set(lastRefId);
  inspectDepth = lastDepth;

  event.die();
}

//
//  exports
//
module.exports = {
  name: 'Component',
  startInspect: startInspect,
  stopInspect: stopInspect,
  inspectMode: inspectMode,
  isActive: function(){
    return inspectMode.value;
  }
};
