/*jshint multistr:true */

this.recline = this.recline || {};
this.recline.View = this.recline.View || {};

(function($, my) {

// ## Linegraph view for a Dataset using nvd3 graphing library.
//
// Initialization arguments (in a hash in first parameter):
//
// * model: recline.Model.Dataset
// * state: (optional) configuration hash of form:
//
//        { 
//          group: {column name for x-axis},
//          series: [{column name for series A}, {column name series B}, ... ],
//          colors: ["#edc240", "#afd8f8", ...]
//        }
//
// NB: should *not* provide an el argument to the view but must let the view
// generate the element itself (you can then append view.el to the DOM.
    my.NVD3Graph = Backbone.View.extend({

  template: '<div class="recline-graph"> \
      <div class="panel nvd3graph_{{viewId}}"style="display: block;"> \
        <div id="nvd3chart_{{viewId}}"><svg></svg></div>\
      </div> \
    </div> ',

  initialize: function(options) {
    var self = this;

    this.el = $(this.el);
    _.bindAll(this, 'render', 'redraw');
    this.needToRedraw = false;
    this.model.bind('change', this.render);
    this.model.fields.bind('reset', this.render);
    this.model.fields.bind('add', this.render);
    this.model.records.bind('add', this.redraw);
    this.model.records.bind('reset', this.redraw);
    var stateData = _.extend({
        group: null,
        series: [],
        colors: ["#edc240", "#afd8f8", "#cb4b4b", "#4da74d", "#9440ed"],
        graphType: "lineChart",
        id: 0
      },
      options.state
    );
    this.state = new recline.Model.ObjectState(stateData);


    this.editor = new my.GraphControls({
      model: this.model,
      state: this.state.toJSON()
    });
    this.editor.state.bind('change', function() {
      self.state.set(self.editor.state.toJSON());
      self.redraw();
    });
    this.elSidebar = this.editor.el;
  },




    render: function() {
    var self = this;

    var tmplData = this.model.toTemplateJSON();
    tmplData["viewId"] = this.state.get("id");



    var htmls = Mustache.render(this.template, tmplData);
    $(this.el).html(htmls);
    this.$graph = this.el.find('.panel.nvd3graph_' + tmplData["viewId"]);
    return this;
  },

  redraw: function() {
    // There appear to be issues generating a Flot graph if either:

    // * The relevant div that graph attaches to his hidden at the moment of creating the plot -- Flot will complain with
    //
    //   Uncaught Invalid dimensions for plot, width = 0, height = 0
    // * There is no data for the plot -- either same error or may have issues later with errors like 'non-existent node-value' 
    var areWeVisible = !jQuery.expr.filters.hidden(this.el[0]);
    if ((!areWeVisible || this.model.records.length === 0)) {
      this.needToRedraw = true;
      return;
    }

    // check we have something to plot
    if (this.state.get('group') && this.state.get('series')) {
      // faff around with width because flot draws axes *outside* of the element width which means graph can get push down as it hits element next to it
      this.$graph.width(this.el.width() - 20);

      // nvd3
        var seriesNVD3 = this.createSeriesNVD3();
        var graphType = this.state.get("graphType") ;
        var viewId = this.state.get("id");
        var model = this.model;

        nv.addGraph(function() {




            switch(graphType) {
                case 'lineChart':
                    var chart = nv.models.lineChart();
                    break;
                case "stackedAreaChart":
                    var chart = nv.models.stackedAreaChart()
                        .clipEdge(true);
                    break;
                case "bulletChart" :
                    var chart = nv.models.bulletChart();

                    break;
                case "cumulativeLineChart":
                    var chart = nv.models.cumulativeLineChart();
                    break;
                case "discreteBarChart":
                    var chart = nv.models.discreteBarChart()
                   .staggerLabels(true)
                   .tooltips(false)
                   .showValues(true) ;



                    chart.discretebar.dispatch.on('elementClick', function(e) {
                        //console.log(e);
                        var filters = model.queryState.get('filters');


                        filters.push({field: "x", fieldType: "string", type: "term", term: e.pointIndex});

                        model.queryState.set({filters: filters});
                        model.queryState.trigger('change');


                    })




                    break;
                case "multiBarChart":
                    var chart = nv.models.multiBarChart();

                    break;
       }



        if(seriesNVD3.xAxisIsDate) {

            chart.xAxis
                .showMaxMin(false)
                .tickFormat(function(d) { return d3.time.format('%x')(new Date(d)) });

        } else
        {
            chart.xAxis
                .tickFormat(d3.format(',r'));
        }

  		chart.yAxis
      		.tickFormat(d3.format(',.2f'));




  		d3.select('#nvd3chart_' +viewId + '  svg')
      		.datum(seriesNVD3)
    		.transition().duration(500)
      		.call(chart);

        nv.utils.windowResize(chart.update);

  return  chart;
});


    }
  },

    show: function() {
    // because we cannot redraw when hidden we may need to when becoming visible
    if (this.needToRedraw) {
      this.redraw();
    }
  },


  
  createSeriesNVD3: function() {

      var self = this;
      var series = [];
      var colors = this.state.get("colors") ;

      var xAxisIsDate = false;

      _.each(this.state.attributes.series, function(field) {
          var points = [];

          _.each(self.model.records.models, function(doc, index) {
              var xfield = self.model.fields.get(self.state.attributes.group);
              var x = doc.getFieldValue(xfield);

              var yfield = self.model.fields.get(field);
              var y = doc.getFieldValue(yfield);

              var isDateTime = xfield.get('type') === 'date';

              if (isDateTime) {
                  xAxisIsDate = true;
              }

              points.push({x: x, y: y});
          });

          series.push({values: points, key: field, color:  colors[series.length]});


      });
      return series;
}


});

my.GraphControls = Backbone.View.extend({
  className: "editor",
  template: ' \
  <div class="editor"> \
    <form class="form-stacked"> \
      <label>Group Column (x-axis)</label> \
        <div class="input editor-group"> \
          <select> \
          <option value="">Please choose ...</option> \
          {{#fields}} \
          <option value="{{id}}">{{label}}</option> \
          {{/fields}} \
          </select> \
        </div> \
        <div class="editor-series-group"> \
        </div> \
      </div> \
      <div class="editor-buttons"> \
        <button class="btn editor-add">Add Series</button> \
      </div> \
      <div class="editor-buttons editor-submit" comment="hidden temporarily" style="display: none;"> \
        <button class="editor-save">Save</button> \
        <input type="hidden" class="editor-id" value="chart-1" /> \
      </div> \
    </form> \
  </div> \
',
  templateSeriesEditor: ' \
    <div class="editor-series js-series-{{seriesIndex}}"> \
      <label>Series <span>{{seriesName}} (y-axis)</span> \
        [<a href="#remove" class="action-remove-series">Remove</a>] \
      </label> \
      <div class="input"> \
        <select> \
        {{#fields}} \
        <option value="{{id}}">{{label}}</option> \
        {{/fields}} \
        </select> \
      </div> \
    </div> \
  ',
  events: {
    'change form select': 'onEditorSubmit',
    'click .editor-add': '_onAddSeries',
    'click .action-remove-series': 'removeSeries'
  },

  initialize: function(options) {
    var self = this;
    this.el = $(this.el);
    _.bindAll(this, 'render');
    this.model.fields.bind('reset', this.render);
    this.model.fields.bind('add', this.render);
    this.state = new recline.Model.ObjectState(options.state);
    this.render();
  },



  render: function() {
    var self = this;
    var tmplData = this.model.toTemplateJSON();

    tmplData["viewId"]  =  this.state.get("id");;


    var htmls = Mustache.render(this.template, tmplData);
    this.el.html(htmls);


    // set up editor from state
    if (this.state.get('graphType')) {
      this._selectOption('.editor-type', this.state.get('graphType'));
    }
    if (this.state.get('group')) {
      this._selectOption('.editor-group', this.state.get('group'));
    }
    // ensure at least one series box shows up
    var tmpSeries = [""];
    if (this.state.get('series').length > 0) {
      tmpSeries = this.state.get('series');
    }
    _.each(tmpSeries, function(series, idx) {
      self.addSeries(idx);
      self._selectOption('.editor-series.js-series-' + idx, series);
    });
    return this;
  },

  // Private: Helper function to select an option from a select list
  //
  _selectOption: function(id,value){
    var options = this.el.find(id + ' select > option');
    if (options) {
      options.each(function(opt){
        if (this.value == value) {
          $(this).attr('selected','selected');
          return false;
        }
      });
    }
  },

  onEditorSubmit: function(e) {
    var select = this.el.find('.editor-group select');
    var $editor = this;
    var $series  = this.el.find('.editor-series select');
    var series = $series.map(function () {
      return $(this).val();
    });
    var updatedState = {
      series: $.makeArray(series),
      group: this.el.find('.editor-group select').val(),
      graphType: this.el.find('.editor-type select').val()
    };
    this.state.set(updatedState);
  },

  // Public: Adds a new empty series select box to the editor.
  //
  // @param [int] idx index of this series in the list of series
  //
  // Returns itself.
  addSeries: function (idx) {
    var data = _.extend({
      seriesIndex: idx,
      seriesName: String.fromCharCode(idx + 64 + 1)
    }, this.model.toTemplateJSON());

    var htmls = Mustache.render(this.templateSeriesEditor, data);
    this.el.find('.editor-series-group').append(htmls);
    return this;
  },

  _onAddSeries: function(e) {
    e.preventDefault();
    this.addSeries(this.state.get('series').length);
  },

  // Public: Removes a series list item from the editor.
  //
  // Also updates the labels of the remaining series elements.
  removeSeries: function (e) {
    e.preventDefault();
    var $el = $(e.target);
    $el.parent().parent().remove();
    this.onEditorSubmit();
  }
});

})(jQuery, recline.View);

