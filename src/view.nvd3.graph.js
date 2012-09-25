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
            seriesNameField: [],
            seriesValues: [],
            colors: ["#edc240", "#afd8f8", "#cb4b4b", "#4da74d", "#9440ed"],
            graphType: "lineChart",
            xLabel: "",
            id: 0



      },
      options.state
    );
    this.state = new recline.Model.ObjectState(stateData);


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
    var self=this;
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
    if (this.state.get('group') && this.state.get('seriesValues')) {
      // faff around with width because flot draws axes *outside* of the element width which means graph can get push down as it hits element next to it
      this.$graph.width(this.el.width() - 20);

      // nvd3
        var state = this.state;
        var seriesNVD3 = this.createSeriesNVD3();

        var graphType = this.state.get("graphType") ;
        var viewId = this.state.get("id");
        var model = this.model;
		var state = this.state;
        var xLabel = this.state.get("xLabel");
        var yLabel = this.state.get("yLabel");


        nv.addGraph(function() {
            var chart;
            // todo per gli stacked è necessario ciclare sulla serie per inserire dati null o zero dove non siano presenti

            switch(graphType) {
                case 'lineChart':
                    chart = nv.models.lineChart();
                    break;
                case "stackedAreaChart":
                    chart = nv.models.stackedAreaChart()
                        .clipEdge(true);
                    break;
                case "multiBarHorizontalChart":
                    chart = nv.models.multiBarHorizontalChart()
                    break;
                case "bulletChart" :
                    chart = nv.models.bulletChart();
                     break;
                case "cumulativeLineChart":
                    chart = nv.models.cumulativeLineChart()
                    break;
                case "discreteBarChart":
                    chart = nv.models.discreteBarChart()
                        .staggerLabels(true)
                        .tooltips(false)
                        .showValues(true);

                        chart.discretebar.dispatch.on('elementClick', function(e) {
                            self.applyFiltersAndSelections(e.series);
                        });
                break;
                case "multiBarChart":
                    chart = nv.models.multiBarChart();
                    break;
            }

            chart.x(function(d) { return d[0] })
                .y(function(d) { return d[1] });

			var     xfield =  model.fields.get(state.attributes.group);
			if (xLabel == null || xLabel == "" || typeof xLabel == 'undefined')
				xLabel = xfield.get('label')

			if (yLabel == null || yLabel == "" || typeof yLabel == 'undefined')
				yLabel = state.attributes.seriesValues.join("/");

            chart.yAxis
                .axisLabel(yLabel)

                .tickFormat(d3.format('.02f'));

			if (xfield.get('type') == 'DATE' || 
				(xfield.get('type') == 'STRING' && xLabel.indexOf('date') >= 0 && model.recordCount > 0 && new Date(model.records.get(0).get(xLabel)) instanceof Date))
			{
				chart.xAxis
					.axisLabel(xLabel)
					.tickFormat(function(d) {
             			return d3.time.format('%x')(new Date(d))
		           })
			}
			else
			{
				chart.xAxis
					.axisLabel(xLabel)
					.tickFormat(d3.format(',r'));
			}


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

  applyFiltersAndSelections: function(series) {

      var actions = this.options.actions;
      var state = this.options.state;

      var selection ;
      if(actions.FiltersTargetDataset != null
          || actions.SelectionsTargetDataset != null) {



      if(state.seriesNameField != null) {
          // we use a field to define series
          // todo fieldtype must be evaluated on fields structure
          selection = {field: state.seriesNameField, type: "term", term:series.key, fieldType: "string"}   ;
      } else
      {
          // todo to be verified, series index must be used
          selection = {field: state.series[series.id], type: "term", term:series.key, fieldType: "string"}       ;
      }

          if(actions.FiltersTargetDataset != null) {
              for (var i = 0; i < actions.FiltersTargetDataset.length; i++) {
                  actions.FiltersTargetDataset[i].queryState.addFilter(selection);
              }
          }

          if(actions.SelectionsTargetDataset != null) {
              for (var i = 0; i < actions.SelectionsTargetDataset.length; i++) {
                  actions.SelectionsTargetDataset[i].queryState.addSelection(selection);
              }
          }

      }
  },
  
  createSeriesNVD3: function() {

      var self = this;
      var series = [];
      var colors = this.state.get("colors") ;
      var seriesNameField = self.model.fields.get(this.state.attributes.seriesNameField) ;
      var seriesValues = self.model.fields.get(this.state.attributes.seriesValues);
      if(seriesValues == null)
          seriesValues = this.state.get("seriesValues") ;

      var xAxisIsDate = false;

      var records = self.model.records.models;
      var xfield =  self.model.fields.get(self.state.attributes.group);

      var seriesTmp = {};

      var color = 0;

     if(seriesNameField != null) {

         _.each(records, function(doc, index) {
             //console.log(doc);

             var key = doc.getFieldValue(seriesNameField);
             var tmpS;

             if(seriesTmp[key] != null ) { tmpS = seriesTmp[key]  }
             else {
                 tmpS = {key: key, values: [], color:  colors[color]}
                 color=color+1;
             };


             var points = [];
             var x = parseFloat(doc.getFieldValue(xfield));
             var y = parseFloat(doc.getFieldValue(seriesValues));
             tmpS["values"].push([x, y]);

             //console.log("xfield: " + xfield + " seriesvalue: " + seriesValues + " seriesNameField: " + seriesNameField + " key: " + key + " x: "+ x + " y: "+ y);
             seriesTmp[key] = tmpS;

         });

         for (var j in seriesTmp) {
             series.push(seriesTmp[j]);
         }
         //console.log(seriesTmp);

     }
      else {
         // todo this has to be merged with above, only one branch has to be present
         //console.log(seriesValues);
       _.each(seriesValues, function(field) {
           color=color+1;

          var points = [];

          _.each(records, function(doc, index) {


              var x = doc.getFieldValue(xfield);

              var yfield = self.model.fields.get(field);
              var y = doc.getFieldValue(yfield);

              var isDateTime = xfield.get('type') === 'date';

              if (isDateTime) {
                  xAxisIsDate = true;
              }

              //points.push({x: x, y: y});
              points.push([x,y]);
              //console.log("x: " +x + " y: " + y + " doc: " + doc);

          });

          series.push({values: points, key: field, color:  colors[color]});
       });
     }

      //console.log(JSON.stringify(series));
      return series;
}


});



})(jQuery, recline.View);

