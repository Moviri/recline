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

    this.model.bind('query:done', this.redraw);


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

  getActionsForEvent: function(eventType) {
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

        var state = this.state;
        var seriesNVD3 = this.createSeriesNVD3();

        var graphType = this.state.get("graphType") ;
        var viewId = this.state.get("id");


        nv.addGraph(function() {
            var chart = self.getGraph[graphType](self);


  		d3.select('#nvd3chart_' + viewId + '  svg')
      		    .datum(seriesNVD3)
    		    .transition()
                .duration(500)
      		    .call(chart);

        nv.utils.windowResize(chart.update);

        return  chart;
    });
  },

        setAxis: function(axis, chart) {
            var self=this;

            var xLabel = self.state.get("xLabel");

            if(axis == "all" || axis == "x") {
              var xfield =  self.model.fields.get(self.state.attributes.group);

              // set label
              if (xLabel == null || xLabel == "" || typeof xLabel == 'undefined')
                  xLabel = xfield.get('label');

                // set data format
                chart.xAxis
                        .axisLabel(xLabel)
                        .tickFormat(self.getFormatter[xfield.get('type')]);

          } else if(axis == "all" || axis == "y")
          {
              var yLabel = self.state.get("yLabel");

              if (yLabel == null || yLabel == "" || typeof yLabel == 'undefined')
                  yLabel = state.attributes.seriesValues.join("/");

              // todo yaxis format must be passed as prop
              chart.yAxis
                  .axisLabel(yLabel)
                  .tickFormat(d3.format('s'));

          }
        },

  getFormatter: {
    "string": d3.format(',s') ,
    "float":  d3.format(',r') ,
    "integer":d3.format(',r') ,
    "date":   function(d) { return d3.time.format('%x')(new Date(d)); }
  },


  getGraph: {
          "multiBarChart":          function(view) {
              var chart = nv.models.multiBarChart();
              view.setAxis("all", chart);
              return chart;
          },
          "lineChart":              function(view) {
              var chart = nv.models.lineChart();
              view.setAxis("all", chart);
              return chart; },
          "lineWithFocusChart":     function(view) {
              var chart = nv.models.lineWithFocusChart();
              view.setAxis("all", chart);
              return chart;
          },
          "indentedTree":           function(view) { return nv.models.indentedTree(); },
          "stackedAreaChart":       function(view) {
              var chart = nv.models.stackedAreaChart();
              view.setAxis("all", chart);
              return chart;
          },
          "multiBarHorizontalChart":function(view) {
              var chart = nv.models.multiBarHorizontalChart();
              view.setAxis("all", chart);
              return chart;
          },
          "bulletChart":            function(view) {
              var chart = nv.models.bulletChart();
              return chart;
          },
          "linePlusBarChart":       function(view) {
              var chart = nv.models.linePlusBarChart();
              view.setAxis("all", chart);
              return chart;
          },
          "cumulativeLineChart":    function(view) {
              var chart = nv.models.cumulativeLineChart();
              view.setAxis("all", chart);
              return chart;
          },
      "scatterChart":    function(view) {
          var chart = nv.models.scatterChart();
          chart.showDistX(true)
              .showDistY(true);
          view.setAxis("all", chart);
          return chart;
      },
          "discreteBarChart":       function(view) {
              var actions = view.getActionsForEvent("selection");
              var chart = nv.models.discreteBarChart();
              view.setAxis("all", chart);

              if(actions.length > 0)
                  chart.discretebar.dispatch.on('elementClick', function(e) {
                      view.doActions(actions, [e.point.record]);
                  });
              return chart;

          },
          "lineWithBrushChart":     function(view) {
              var actions = self.getActionsForEvent("selection");
              var chart;

              if(actions.length > 0) {
                  chart = nv.models.lineWithBrushChart(
                      {callback: function(x) {

                          // selection is done on x axis so I need to take the record with range [min_x, max_x]
                          // is the group attribute
                          var record_min = _.min(x, function(d) { return d.min.x }) ;
                          var record_max = _.max(x, function(d) { return d.max.x });

                          view.doActions(actions, [record_min.min.record, record_max.max.record]);

                      }});

              } else {
                  chart = nv.models.lineWithBrushChart();
              }
              view.setAxis("all", chart);
              return  chart
          },
          "multiBarWithBrushChart": function(view) {
              var chart = multiBarWithBrushChart;
              view.setAxis("all", chart);
              return chart;
          },
          "pieChart":               function() { return nv.models.pieChart(); }
      },


  doActions: function(actions, records) {

      _.each(actions, function(d) {
          d.action.doAction(records, d.mapping);
      });

  },

  createSeriesNVD3: function() {

      var self = this;
      var series = [];

      //  {type: "byFieldName", fieldvaluesField: ["y", "z"]}
      var seriesAttr = this.state.attributes.series;

      var fillEmptyValuesWith = seriesAttr.fillEmptyValuesWith;

      //var seriesNameField = self.model.fields.get(this.state.attributes.seriesNameField) ;
      //var seriesValues = self.model.fields.get(this.state.attributes.seriesValues);
      //if(seriesValues == null)
      //var seriesValues = this.state.get("seriesValues") ;

      var xAxisIsDate = false;


      var resultType = "filtered";
      if(self.options.useFilteredData !== null && self.options.useFilteredData === false)
        resultType = "original";

      var records = self.model.getRecords(resultType);  //self.model.records.models;

      var xfield =  self.model.fields.get(self.state.attributes.group);

      if (xfield.get('type') === 'date') {
          xAxisIsDate = true;
      }

      var uniqueX = [];
      var sizeField;
      if(seriesAttr.sizeField) {
          sizeField =  self.model.fields.get(seriesAttr.sizeField);
      }


      // series are calculated on data, data should be analyzed in order to create series
     if(seriesAttr.type == "byFieldValue") {
         var seriesTmp = {};
         var seriesNameField =  self.model.fields.get(seriesAttr.seriesField);
         var fieldValue = self.model.fields.get(seriesAttr.valuesField);

         _.each(records, function(doc, index) {

             // key is the field that identiy the value that "build" series
             var key = doc.getFieldValueUnrendered(seriesNameField);
             var tmpS;

             // verify if the serie is already been initialized
             if(seriesTmp[key] != null ) { tmpS = seriesTmp[key]  }
             else {
                 var color  = doc.getFieldColor(seriesNameField);
                 if(color != null)
                    tmpS = {key: key, values: [], color:  color};
                 else
                    tmpS = {key: key, values: []};
             };

             var x = doc.getFieldValueUnrendered(xfield);
             var y = doc.getFieldValueUnrendered(fieldValue);

             var point = {x: x, y: y, record: doc};
             if(sizeField)
                 point["size"] = doc.getFieldValueUnrendered(sizeField);

             tmpS.values.push(point);

             if(fillEmptyValuesWith != null) {
                 uniqueX.push(x);

             }

             seriesTmp[key] = tmpS;

         });

         for (var j in seriesTmp) {
             series.push(seriesTmp[j]);
         }

     }
      else if(seriesAttr.type == "byFieldName" || seriesAttr.type == "byPartitionedField"){
         // todo this has to be merged with above, only one branch has to be present

         var serieNames;
         if(seriesAttr.type == "byFieldName")
            serieNames =  seriesAttr.valuesField;
         else {
             serieNames = [];
             _.each(seriesAttr.aggregationFunctions, function(a) {
                 _.each(self.model.getPartitionedFieldsForAggregationFunction(a, seriesAttr.aggregatedField), function(f)
                 {
                     serieNames.push(f.get("id"));
                 })

             });

         }

       _.each(serieNames, function(field) {
          var yfield = self.model.fields.get(field);

          var points = [];

          _.each(records, function(doc, index) {

              var x = doc.getFieldValueUnrendered(xfield);

              try {

                var y = doc.getFieldValueUnrendered(yfield);
                  if(y != null) {
                      var point = {x: x, y: y, record: doc, color: doc.getFieldColor(yfield)};

                      if(sizeField)
                        point["size"] = doc.getFieldValueUnrendered(sizeField);

                      points.push(point);

                      if(fillEmptyValuesWith != null) {
                        uniqueX.push(x);
                      }
                  }

              }
              catch(err) {
                //console.log("Can't add field [" + field + "] to graph, filtered?")
              }
          });

           if(points.length>0)
            series.push({values: points, key: field, color: yfield.getColorForPartition()});
       });

     } else throw "views.nvd3.graph.js: unsupported or not defined type " + seriesAttr.type;

      // foreach series fill empty values
      if(fillEmptyValuesWith != null) {
         uniqueX = _.unique(uniqueX);
          _.each(series, function(s) {
              // foreach series obtain the unique list of x
              var tmpValues = _.map(s.values, function(d) { return d.x});
              // foreach non present field set the value
              _.each(_.difference(uniqueX, tmpValues), function(diff) {
                  s.values.push({x: diff, y: fillEmptyValuesWith});
              });

          });
      }

      return series;
}


});



})(jQuery, recline.View);

