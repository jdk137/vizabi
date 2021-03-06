/*!
 * VIZABI BARCHART
 */

import * as utils from 'base/utils';
import Tool from 'base/tool';

import BarChartComponent from './barchart-component';

import {
  timeslider,
  dialogs,
  buttonlist,
  treemenu
}
from 'components/_index';

var comp_template = 'barchart.html';

//BAR CHART TOOL
var BarChart = Tool.extend('BarChart', {

  /**
   * Initializes the tool (Bar Chart Tool).
   * Executed once before any template is rendered.
   * @param {Object} config Initial config, with name and placeholder
   * @param {Object} options Options such as state, data, etc
   */
  init: function(config, options) {

    this.name = "barchart";

    //specifying components
    this.components = [{
      component: BarChartComponent,
      placeholder: '.vzb-tool-viz',
      model: ["state.time", "state.entities", "state.marker", "language"] //pass models to component
    }, {
      component: timeslider,
      placeholder: '.vzb-tool-timeslider',
      model: ["state.time"]
    }, {
      component: dialogs,
      placeholder: '.vzb-tool-dialogs',
      model: ['state', 'ui', 'language']
    }, {
      component: buttonlist,
      placeholder: '.vzb-tool-buttonlist',
      model: ['state', 'ui', 'language']
    }, {
      component: treemenu,
      placeholder: '.vzb-tool-treemenu',
      model: ['state.marker', 'language']
    }];

    //constructor is the same as any tool
    this._super(config, options);
  },

  default_options: {
    state: {
      time: {},
      entities: {
        dim: "geo",
        show: {
          _defs_: {
            "geo": ["*"],
            "geo.cat": ["region"]
          }
        }
      },
      marker: {
        space: ["entities", "time"],
        label: {
          use: "property",
          which: "geo.name"
        },
        axis_y: {
          use: "indicator",
          which: "lex"
        },
        axis_x: {
          use: "property",
          which: "geo.name"
        },
        color: {
          use: "property",
          which: "geo.region"
        }
      }
    },
    data: {
      reader: "csv",
      path: "data/waffles/basic-indicators.csv"
    }
  }
});

export default BarChart;