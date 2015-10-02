import d3 from 'd3';
import utils from './base/utils';
import Tool from './base/tool';
import Component from './base/component';
import Model from './base/model';
import Reader from './base/reader';
import globals from './base/globals';

//available readers
import * as readers from './readers/_index';

//register available readers
utils.forEach(readers, function(reader, name) {
  Reader.register(name, reader);
});

var Vzb = function(name, placeholder, options) {
  var tool = Tool.get(name);
  if(tool) {
    var t = new tool(placeholder, options);
    Vzb._instances[t._id] = t;
    return t;
  } else {
    utils.error('Tool "' + name + '" was not found.');
  }
};

//stores reference to each tool on the page
Vzb._instances = {};
//stores global variables accessible by any tool or component
Vzb._globals = globals;

//TODO: clear all objects and intervals as well
//garbage collection
Vzb.clearInstances = function(id) {
  if(id) {
    Vzb._instances[id] = void 0;
  } else {
    for(var i in Vzb._instances) {
      Vzb._instances[i].clear();
    }
    Vzb._instances = {};
  }
};

//makes all objects accessible
Vzb.Tool = Tool;
Vzb.Component = Component;
Vzb.Model = Reader;
Vzb.Reader = Reader;

export default Vzb;