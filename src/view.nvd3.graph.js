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

  getAcionsForEvent: function(eventType) {
      var self=this;
      var actions = [];

      _.each(self.options.actions, function(d) {
          if( _.contains(d.event, eventType))
            actions.push(d);
          });

      return actions;
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
      //this.$graph.width(this.el.width() - 20);

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

                    var actions = self.getAcionsForEvent("click");

                    if(actions.length > 0)
                        chart.discretebar.dispatch.on('elementClick', function(e) {
                            self.doActions(actions, [e.point.record]);
                        });
                break;
                case "multiBarChart":
                    chart = nv.models.multiBarChart().stacked(true).showControls(false);
                    break;
                case "lineWithBrushChart":
                    chart = nv.models.lineWithBrushChart({'callback': function(x) {
                        //self.doActions("elementSelection", e);
                        alert(x);
                        }, 'trendlines': true, 'minmax': true});
                    break;
                case "multiBarWithBrushChart":
                    chart = nv.models.multiBarWithBrushChart(function(x) {
                        //self.doActions("elementSelection", e);
                        alert(x);
                    });
                    break;
            }

            chart.x(function(d)    { return d.x; })
                    .y(function(d) { return d.y; });

			var xfield =  model.fields.get(state.attributes.group);
			xfield.set('type', xfield.get('type').toLowerCase());
			
			if (xLabel == null || xLabel == "" || typeof xLabel == 'undefined')
				xLabel = xfield.get('label')

			if (yLabel == null || yLabel == "" || typeof yLabel == 'undefined')
				yLabel = state.attributes.seriesValues.join("/");

            chart.yAxis
                .axisLabel(yLabel)
                .tickFormat(d3.format('s'));

			if (xfield.get('type') == 'date' || 
				(xfield.get('type') == 'string' && xLabel.indexOf('date') >= 0 && model.recordCount > 0 && new Date(model.records.get(0).get(xLabel)) instanceof Date))
			{
				chart.xAxis
					.axisLabel(xLabel)
					.tickFormat(function(d) {
             			return d3.time.format('%x')(new Date(d)) ;
		           })   ;
			}
			else
			{
				chart.xAxis
					.axisLabel(xLabel)
					.tickFormat(d3.format(',r'));
			}


  		d3.select('#nvd3chart_' +viewId + '  svg')
      		    .datum(seriesNVD3)
    		    .transition()
                .duration(500)
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

  doActions: function(actions, records) {

      _.each(actions, function(d) {
          d.action.doAction(records, d.mapping);
      });

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

      // series are calculated on data, data should be analyzed in order to create series
     if(seriesNameField != null) {

         _.each(records, function(doc, index) {

             // key is the field that identiy the value that "build" series
             var key = doc.getFieldValueUnrendered(seriesNameField);
             var tmpS;

             // verify if the serie is already been initialized
             if(series[key] == null ) { tmpS = seriesTmp[key]  }
             else {
                 tmpS = {key: key, values: [], color:  colors[color]}
                 color=color+1;
             };


             var points = [];
             var x = doc.getFieldValueUnrendered(xfield);
             var y = doc.getFieldValueUnrendered(seriesValues);
             tmpS["values"].push({x: x, y: y, record: doc});

             seriesTmp[key] = tmpS;

         });

         for (var j in seriesTmp) {
             series.push(seriesTmp[j]);
         }

     }
      else {
         // todo this has to be merged with above, only one branch has to be present
         //console.log(seriesValues);
       _.each(seriesValues, function(field) {
           color=color+1;

          var points = [];

          _.each(records, function(doc, index) {

              var x = doc.getFieldValueUnrendered(xfield);

              try {
                var yfield = self.model.fields.get(field);
                var y = doc.getFieldValueUnrendered(yfield);

                var isDateTime = xfield.get('type') === 'date';

                if (isDateTime) {
                    xAxisIsDate = true;
                }

                points.push({x: x, y: y, record: doc});

              }
              catch(err) {
                //console.log("Can't add field [" + field + "] to graph, filtered?")
              }
          });

           if(points.length>0)
            series.push({values: points, key: field, color:  colors[color]});
       });
     }


      return series;
}


});



})(jQuery, recline.View);

