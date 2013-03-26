/*jshint multistr:true */

this.recline = this.recline || {};
this.recline.View = this.recline.View || {};

(function ($, my) {

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

        template:'<div class="recline-graph"> \
      <div class="panel nvd3graph_{{viewId}}"style="display: block;"> \
        <div id="nvd3chart_{{viewId}}"><svg version="1.1" xmlns="http://www.w3.org/2000/svg" class="bstrap" width="{{width}}" height="{{height}}"> \
        	  <defs> \
		    	<marker id = "Circle" viewBox = "0 0 40 40" refX = "12" refY = "12" markerWidth = "6" markerHeight = "6" stroke = "white" stroke-width = "4" fill = "dodgerblue" orient = "auto"> \
		    	<circle cx = "12" cy = "12" r = "12"/> \
		    	</marker> \
		      </defs> \
        	</svg></div>\
      </div> \
    </div> ',

        initialize:function (options) {
            var self = this;

            this.uid = options.id || ("" + new Date().getTime() + Math.floor(Math.random() * 10000)); // generating an unique id for the chart
            this.el = $(this.el);
            _.bindAll(this, 'render', 'redraw', 'graphResize', 'changeDimensions');


            this.model.bind('change', this.render);
            this.model.fields.bind('reset', this.render);
            this.model.fields.bind('add', this.render);

            this.model.bind('query:done', this.redraw);
            this.model.queryState.bind('selection:done', this.redraw);
            this.model.bind('dimensions:change', this.changeDimensions);

            if (this.options.state.options && this.options.state.options.loader)
            	this.options.state.options.loader.bindChart(this);
            
            // remove unwanted options from original NVD3 options or an error line is logged each time
            this.extraOptions = {
        		timing: this.options.state.options.timing,
        		scaleTo100Perc: this.options.state.options.scaleTo100Perc,
            }
            if (this.options.state.options.timing)
            	delete this.options.state.options.timing
            	
            if (this.options.state.options.scaleTo100Perc)
            	delete this.options.state.options.scaleTo100Perc
        },

        changeDimensions: function() {
            var self=this;
            self.state.attributes.group = self.model.getDimensions();
        },

        render:function () {
            var self = this;
            self.trigger("chart:startDrawing")
            var stateData = _.extend({
                    group:null,
                    seriesNameField:[],
                    seriesValues:[],
                    colors:["#edc240", "#afd8f8", "#cb4b4b", "#4da74d", "#9440ed"],
                    graphType:"lineChart",
                    xLabel:"",
                    id:0
                },
                this.options.state
            );
            this.state = new recline.Model.ObjectState(stateData);

            var tmplData = this.model.toTemplateJSON();
            tmplData["viewId"] = this.uid;
            if (this.state.attributes.width)
            	tmplData.width = this.state.attributes.width;

            if (this.state.attributes.height)
            	tmplData.height = this.state.attributes.height;

            delete this.chart;
            

                var htmls = Mustache.render(this.template, tmplData);
                $(this.el).html(htmls);
                this.$graph = this.el.find('.panel.nvd3graph_' + tmplData["viewId"]);
                self.trigger("chart:endDrawing")
                return this;



        },

        getActionsForEvent:function (eventType) {
            var actions = [];

            _.each(this.options.actions, function (d) {
                if (_.contains(d.event, eventType))
                    actions.push(d);
            });

            return actions;
        },

        redraw:function () {
            var self = this;
            self.trigger("chart:startDrawing")

            if (self.model.recordCount == 0)
            {
                var svgElem = this.el.find('#nvd3chart_' + self.uid+ ' svg')
                svgElem.css("display", "block")
                // get computed dimensions
                var width = svgElem.width()
                var height = svgElem.height()

                // display noData message and exit
                svgElem.css("display", "none")
                this.el.find('#nvd3chart_' + self.uid).width(width).height(height).append(new recline.View.NoDataMsg().create());
                self.trigger("chart:endDrawing")
                return;
            }
            
            var svgElem = this.el.find('#nvd3chart_' + self.uid+ ' svg') 
        	svgElem.css("display", "block")
        	// get computed dimensions
        	var width = svgElem.width()
        	var height = svgElem.height()

            var state = this.state;
            var seriesNVD3 = this.createSeriesNVD3();
        	var totalValues = 0;
            if (seriesNVD3)
        	{
            	_.each(seriesNVD3, function(s) {
            		if (s.values)
            			totalValues += s.values.length
            	});
        	}
            if (!totalValues)
        	{
            	// display noData message and exit
            	svgElem.css("display", "none")
            	this.el.find('#nvd3chart_' + self.uid).width(width).height(height).append(new recline.View.NoDataMsg().create());
                self.trigger("chart:endDrawing")
            	return null;
        	}
            var graphType = this.state.get("graphType");

            var viewId = this.uid;

            var model = this.model;
            var state = this.state;
            var xLabel = this.state.get("xLabel");
            var yLabel = this.state.get("yLabel");

            nv.addGraph(function () {
                self.chart = self.getGraph[graphType](self);
                var svgElem = self.el.find('#nvd3chart_' + self.uid+ ' svg')
                var graphModel = self.getGraphModel(self, graphType)
                
                if (self.options.state.options.noTicksX)
                    self.chart.xAxis.tickFormat(function (d) { return ''; });                	
                if (self.options.state.options.noTicksY)
                    self.chart.yAxis.tickFormat(function (d) { return ''; });                	
	
                if (self.options.state.options.customTooltips)
            	{
                	var leftOffset = 10;
                	var topOffset = 0;
                    //console.log("Replacing original tooltips")
                    
                    var xfield = self.model.fields.get(self.state.attributes.group);
                    var yfield = self.model.fields.get(self.state.attributes.series);
                    
                    graphModel.dispatch.on('elementMouseover.tooltip', function(e) {
                    	var pos;
                    	if (e.e && e.e.pageY && e.e.pageX)
                    		pos = {top: e.e.pageY, left: e.e.pageX}
                    	else pos = {left: e.pos[0] + +svgElem.offset().left + 50, top: e.pos[1]+svgElem.offset().top}
                    	
                        var values;
                    	if (graphType.indexOf("Horizontal") >= 0)
                		{
                        	values = { 
                            		x: e.point.x,
                            		y: (yfield ? self.getFormatter[yfield.get('type')](e.point.y) : e.point.y), 
                    				yLabel: e.series.key,
                    				xLabel: (xfield ? xfield.get("label") : "") 
                    			}
                		}
                    	else
                		{
                        	values = { 
                            		x: (xfield ? self.getFormatter[xfield.get('type')](e.point.x) : e.point.x),
                            		y: e.point.y,
                    				xLabel: e.series.key,
                    				yLabel: (yfield ? yfield.get("label") : "")
                    			}
                		}
                    	values["record"] = e.point.record.attributes;
                    		
                        var content = Mustache.render(self.options.state.options.customTooltips, values);

                        nv.tooltip.show([pos.left+leftOffset, pos.top+topOffset], content, (pos.left < self.el[0].offsetLeft + self.el.width()/2 ? 'w' : 'e'), null, self.el[0]);
                      });
                    
                    graphModel.dispatch.on('elementMouseout.tooltip', function(e) {
                    	nv.tooltip.cleanup();
                    });
            	}

                if (self.state.attributes.options) {
                    _.each(_.keys(self.state.attributes.options), function (d) {
                        try {
                            self.addOption[d](self.chart, self.state.attributes.options[d]);
                        }
                        catch (err) {
                            console.log("view.nvd3.graph.js: cannot add options " + d + " for graph type " + graphType)
                        }
                    });
                }
                ;

                d3.select('#nvd3chart_' + self.uid + '  svg')
                    .datum(seriesNVD3)
                    .transition()
                    .duration(self.extraOptions.timing || 500)
                    .call(self.chart);

                nv.utils.windowResize(self.graphResize);
                self.trigger("chart:endDrawing")

                //self.graphResize()
                return  self.chart;
            });
        },

        graphResize:function () {
            var self = this;
            var viewId = this.uid;

            // this only works by previously setting the body height to a numeric pixel size (percentage size don't work)
            // so we assign the window height to the body height with the command below
            var container = self.el;
            while (!container.hasClass('container-fluid') && !container.hasClass('container'))
            	container = container.parent();
            
            if (typeof container != "undefined" && container != null 
            		&& (container.hasClass('container') || container.hasClass('container-fluid'))
            		&& container[0].style && container[0].style.height
            		&& container[0].style.height.indexOf("%") > 0) 
            {
	            $("body").height($(window).innerHeight() - 10);
	
	            var currAncestor = self.el;
	            while (!currAncestor.hasClass('row-fluid') && !currAncestor.hasClass('row'))
	                currAncestor = currAncestor.parent();
	
	            if (typeof currAncestor != "undefined" && currAncestor != null && (currAncestor.hasClass('row-fluid') || currAncestor.hasClass('row'))) {
	                var newH = currAncestor.height();
	                $('#nvd3chart_' + viewId).height(newH);
	                $('#nvd3chart_' + viewId + '  svg').height(newH);
	            }
            }
            if (self.chart && self.chart.update)
            	self.chart.update(); // calls original 'update' function
        },


        setAxis:function (axis, chart) {
            var self = this;

            var xLabel = self.state.get("xLabel");

            if (axis == "all" || axis == "x") {
            	var xAxisFormat = function(str) {return str;}
            	// axis are switched when using horizontal bar chart
            	if (self.state.get("graphType").indexOf("Horizontal") < 0)
        		{
                    var xfield = self.model.fields.get(self.state.attributes.group);
            		xAxisFormat = self.getFormatter[xfield.get('type')];

            		if (xLabel == null || xLabel == "" || typeof xLabel == 'undefined')
                        xLabel = xfield.get('label');
        		}
            	else xLabel = self.state.get("yLabel");

                // set data format
                chart.xAxis
                    .axisLabel(xLabel)
                    .tickFormat(xAxisFormat)

            } 
            if (axis == "all" || axis == "y") {
                var yLabel = self.state.get("yLabel");

                // todo yaxis format must be passed as prop
                var yAxisFormat = function(str) {return str;}
            	// axis are switched when using horizontal bar chart
                if (self.state.get("graphType").indexOf("Horizontal") >= 0)
            	{
                	var yfield = self.model.fields.get(self.state.attributes.group);            	
                	yAxisFormat = self.getFormatter[yfield.get('type')]
            		yLabel = self.state.get("xLabel");
            	}
                else
            	{
                    if (yLabel == null || yLabel == "" || typeof yLabel == 'undefined')
                        yLabel = self.state.attributes.seriesValues.join("/");
            	}
                	
                chart.yAxis
                    .axisLabel(yLabel)
                    .tickFormat(yAxisFormat);
            }
        },

        getFormatter:{
            "string":d3.format(',s'),
            "float":d3.format(',r'),
            "integer":d3.format(',r'),
            "date":function (d) {
                return d3.time.format('%x')(new Date(d));
            }

        },

        addOption:{
            "staggerLabels":function (chart, value) {
                chart.staggerLabels(value);
            },
            "tooltips":function (chart, value) {
                chart.tooltips(value);
            },
            "showValues":function (chart, value) {
                chart.showValues(value);
            },
            "tooltip": function(chart, value) {
                var t = function(key, x, y, e, graph) {
                    return value.replace("{x}", x)
                        .replace("{y}", y)
                        .replace("{key}", key);
                };
                chart.tooltip(t);
            },
            "minmax":function (chart, value) {
            },
            "trendlines":function (chart, value) {
            },
            "showLegend":function(chart, value) {
                chart.showLegend(value);
            },
            "showControls":function(chart, value) {
                chart.showControls(value);
            },
            showValues: function(chart, value) {
                chart.showValues(value);
            },
            "customTooltips":function (chart, value) { 
            },
            "stacked":function(chart, value) {
        		chart.stacked(value);
            },
            "grouped":function(chart, value) {
        		chart.stacked(!value);
            },
            "margin":function(chart, value) {
                chart.margin(value);
            },
        },


        getGraph:{
            "multiBarChart":function (view) {
                var chart;
                if (view.chart != null)
                    chart = view.chart;
                else
                    chart = nv.models.multiBarChart();

                view.setAxis("all", chart);
                return chart;
            },
            "lineChart":function (view) {
                var chart;
                if (view.chart != null)
                    chart = view.chart;
                else
                    chart = nv.models.lineChart();
                view.setAxis("all", chart);
                return chart;
            },
            "lineDottedChart":function (view) {
                var chart;
                if (view.chart != null)
                    chart = view.chart;
                else
                    chart = nv.models.lineDottedChart();
                view.setAxis("all", chart);
                return chart;
            },
            "lineWithFocusChart":function (view) {
                var chart;
                if (view.chart != null)
                    chart = view.chart;
                else
                    chart = nv.models.lineWithFocusChart();

                view.setAxis("all", chart);
                return chart;
            },
            "indentedTree":function (view) {
                var chart;
                if (view.chart != null)
                    chart = view.chart;
                else
                    chart = nv.models.indentedTree();
            },
            "stackedAreaChart":function (view) {
                var chart;
                if (view.chart != null)
                    chart = view.chart;
                else
                    chart = nv.models.stackedAreaChart();
                view.setAxis("all", chart);
                return chart;
            },

            "historicalBar":function (view) {
                var chart;
                if (view.chart != null)
                    chart = view.chart;
                else
                    chart = nv.models.historicalBar();
                return chart;
            },
            "multiBarHorizontalChart":function (view) {
                var chart;
                if (view.chart != null)
                    chart = view.chart;
                else
                    chart = nv.models.multiBarHorizontalChart();
                view.setAxis("all", chart);

                return chart;
            },
            "legend":function (view) {
                var chart;
                if (view.chart != null)
                    chart = view.chart;
                else
                    chart = nv.models.legend();
                return chart;
            },
            "line":function (view) {
                var chart;
                if (view.chart != null)
                    chart = view.chart;
                else
                    chart = nv.models.line();
                return chart;
            },
            "sparkline":function (view) {
                var chart;
                if (view.chart != null)
                    chart = view.chart;
                else
                    chart = nv.models.sparkline();
                return chart;
            },
            "sparklinePlus":function (view) {
                var chart;
                if (view.chart != null)
                    chart = view.chart;
                else
                    chart = nv.models.sparklinePlus();
                return chart;
            },

            "multiChart":function (view) {
                var chart;
                if (view.chart != null)
                    chart = view.chart;
                else
                    chart = nv.models.multiChart();
                return chart;
            },


            "bulletChart":function (view) {
                var chart;
                if (view.chart != null)
                    chart = view.chart;
                else
                    chart = nv.models.bulletChart();
                return chart;
            },
            "linePlusBarChart":function (view) {
                var chart;
                if (view.chart != null)
                    chart = view.chart;
                else
                    chart = nv.models.linePlusBarChart();
                view.setAxis("all", chart);
                return chart;
            },
            "cumulativeLineChart":function (view) {
                var chart;
                if (view.chart != null)
                    chart = view.chart;
                else
                    chart = nv.models.cumulativeLineChart();
                view.setAxis("all", chart);
                return chart;
            },
            "scatterChart":function (view) {
                var chart;
                if (view.chart != null)
                    chart = view.chart;
                else
                    chart = nv.models.scatterChart();
                chart.showDistX(true)
                    .showDistY(true);
                view.setAxis("all", chart);
                return chart;
            },
            "discreteBarChart":function (view) {
                var actions = view.getActionsForEvent("selection");
                var chart;
                if (view.chart != null)
                    chart = view.chart;
                else
                    chart = nv.models.discreteBarChart();
                view.setAxis("all", chart);

                if (actions.length > 0)
                    chart.discretebar.dispatch.on('elementClick', function (e) {
                        view.doActions(actions, [e.point.record]);
                    });
                return chart;
                var actions = view.getActionsForEvent("selection");
                var options = {};

                if (view.state.attributes.options) {
                    if (view.state.attributes.options("trendlines"))
                        options["trendlines"] = view.state.attributes.options("trendlines");
                    if (view.state.attributes.options("minmax"))
                        options["minmax"] = view.state.attributes.options("minmax");

                }


                if (actions.length > 0) {
                    options["callback"] = function (x) {

                        // selection is done on x axis so I need to take the record with range [min_x, max_x]
                        // is the group attribute
                        var record_min = _.min(x, function (d) {
                            return d.min.x
                        });
                        var record_max = _.max(x, function (d) {
                            return d.max.x
                        });
                        console.log("Filtering for ");
                        console.log(record_min);
                        console.log(record_max);
                        view.doActions(actions, [record_min.min.record, record_max.max.record]);

                    };
                } else
                    options["callback"] = function () {
                    };
            },
            "lineWithBrushChart":function (view) {


                var chart;
                if (view.chart != null)
                    chart = view.chart;
                else
                    chart = nv.models.lineWithBrushChart(options);
                view.setAxis("all", chart);
                return  chart
            },
            "multiBarWithBrushChart":function (view) {
                var actions = view.getActionsForEvent("selection");
                var options = {};

                if (view.state.attributes.options) {
                    if (view.state.attributes.options["trendlines"])
                        options["trendlines"] = view.state.attributes.options("trendlines");
                    if (view.state.attributes.options["minmax"])
                        options["minmax"] = view.state.attributes.options("minmax");

                }

                if (actions.length > 0) {
                    options["callback"] = function (x) {

                        // selection is done on x axis so I need to take the record with range [min_x, max_x]
                        // is the group attribute
                        /*var record_min = _.min(x, function (d) {
                            return d.min.x
                        });
                        var record_max = _.max(x, function (d) {
                            return d.max.x
                        });*/
                        var record_min = x[0][0].record;
                        var record_max = x[0][x[0].length-1].record;

                        view.doActions(actions, [record_min, record_max]);

                    };
                } else
                    options["callback"] = function () {
                    };

                var chart;
                if (view.chart != null)
                    chart = view.chart;
                else
                    chart = nv.models.multiBarWithBrushChart(options);

                return chart;
            },

            "pieChart":function (view) {
                var chart;
                if (view.chart != null)
                    chart = view.chart;
                else
                    chart = nv.models.pieChart();

                chart.values(function(d) {
                    var ret=[];
                    _.each(d.values, function(dd) {
                        ret.push({x: dd.x, y:dd.y});
                    });
                    return ret;
                });

                return chart;
            }

        },
        getGraphModel: function(self, graphType) {
        	switch(graphType) {
        		
            case "historicalBar":
        	case "multiBarChart": 
            case "multiBarWithBrushChart":
            case "multiBarHorizontalChart":
        		return self.chart.multibar;
            case "lineChart":
            case "lineDottedChart":
            case "lineWithFocusChart":
            case "linePlusBarChart":
            case "cumulativeLineChart":
            case "lineWithBrushChart":
        		return self.chart.lines;
            case "bulletChart":
        		return self.chart.bullet;
            case "scatterChart":
        		return self.chart.scatter;
            case "stackedAreaChart":
            case "pieChart":
        		return self.chart.pie;
            case "discreteBarChart":
        		return self.chart.discretebar;
        	}
        },

        doActions:function (actions, records) {

            _.each(actions, function (d) {
                d.action.doAction(records, d.mapping);
            });

        },

        getFieldLabel: function(field){
            var self=this;
            var fieldLabel = field.attributes.label;
            if (field.attributes.is_partitioned)
                fieldLabel = field.attributes.partitionValue;

            if (typeof self.state.attributes.fieldLabels != "undefined" && self.state.attributes.fieldLabels != null) {
                var fieldLabel_alternateObj = _.find(self.state.attributes.fieldLabels, function (fl) {
                    return fl.id == fieldLabel
                });
                if (typeof fieldLabel_alternateObj != "undefined" && fieldLabel_alternateObj != null)
                    fieldLabel = fieldLabel_alternateObj.label;
            }

            return fieldLabel;
        },


        createSeriesNVD3:function () {

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
            var unselectedColor = "#C0C0C0";
            if (self.state.attributes.unselectedColor)
                unselectedColor = self.state.attributes.unselectedColor;
            var selectionActive = false;
            if (self.model.queryState.isSelected())
                selectionActive = true;

            var resultType = "filtered";
            if(self.options.resultType)
                resultType = self.options.resultType;

            var records = self.model.getRecords(resultType); 

            var xfield = self.model.fields.get(self.state.attributes.group);
            if(!xfield)
                throw "View.nvd3: unable to find field [" + self.state.attributes.group + "] on model"

            if (xfield.get('type') === 'date') {
                xAxisIsDate = true;
            }

            var uniqueX = [];
            var sizeField;
            if (seriesAttr.sizeField) {
                sizeField = self.model.fields.get(seriesAttr.sizeField);

                if(!sizeField)
                    throw "View.nvd3: unable to find field [" + seriesAttr.sizeField + "] on model"
            }


            // series are calculated on data, data should be analyzed in order to create series
            if (seriesAttr.type == "byFieldValue") {
                var seriesTmp = {};
                var seriesNameField = self.model.fields.get(seriesAttr.seriesField);
                if(!seriesNameField)
                    throw "View.nvd3: unable to find field [" + seriesAttr.seriesField + "] on model"

                var fieldValue = self.model.fields.get(seriesAttr.valuesField);
                if(!fieldValue)
                    throw "View.nvd3: unable to find field [" + seriesAttr.valuesField + "] on model"

            	_.each(records, function (doc, index) {

                    // key is the field that identiy the value that "build" series
                    var key = doc.getFieldValueUnrendered(seriesNameField);
                    var tmpS;

                    // verify if the serie is already been initialized
                    if (seriesTmp[key] != null) {
                        tmpS = seriesTmp[key]
                    }
                    else {
                        tmpS = {key:key, values:[]};

                        var color = doc.getFieldColor(seriesNameField);

                        if (color != null)
                            tmpS["color"] = color;


                    }
                    var shape = doc.getFieldShapeName(seriesNameField);

                    var x = doc.getFieldValueUnrendered(xfield);
                    var y = doc.getFieldValueUnrendered(fieldValue)
                    if (y == null || typeof y == "undefined" && fillEmptyValuesWith != null)
                    	y = fillEmptyValuesWith;

                    var point = {x:x, y:y, record:doc};
                    if (sizeField)
                        point["size"] = doc.getFieldValueUnrendered(sizeField);
                    if(shape != null)
                        point["shape"] = shape;

                    tmpS.values.push(point);

                    if (fillEmptyValuesWith != null) {
                        uniqueX.push(x);

                    }

                    seriesTmp[key] = tmpS;

                });
                

                for (var j in seriesTmp) {
                    series.push(seriesTmp[j]);
                }

            }
            else if (seriesAttr.type == "byFieldName" || seriesAttr.type == "byPartitionedField") {
                var serieNames;

                // if partitions are active we need to retrieve the list of partitions
                if (seriesAttr.type == "byFieldName")
                    serieNames = seriesAttr.valuesField;
                else {
                    serieNames = [];
                    _.each(seriesAttr.aggregationFunctions, function (a) {
                        _.each(self.model.getPartitionedFieldsForAggregationFunction(a, seriesAttr.aggregatedField), function (f) {
                            serieNames.push(f.get("id"));
                        })

                    });

                }

                _.each(serieNames, function (field) {
                    var yfield = self.model.fields.get(field);

                    if(!yfield)
                        throw "View.nvd3: unable to find field [" + field + "] on model"

                    var points = [];

                    _.each(records, function (doc, index) {

                        var x = doc.getFieldValueUnrendered(xfield);

                        try {

                            var y = doc.getFieldValueUnrendered(yfield) ;
                            if (y == null || typeof y == "undefined" && fillEmptyValuesWith != null)
                            	y = fillEmptyValuesWith;

                            if (y != null) {
                                var color;

                                if (selectionActive) {
                                    if (doc.isRecordSelected())
                                        color = doc.getFieldColor(yfield);
                                    else
                                        color = unselectedColor;
                                } else
                                    color = doc.getFieldColor(yfield);

                                var shape = doc.getFieldShapeName(yfield);

                                var point = {x:x, y:y, record:doc};

                                if(color != null)
                                    point["color"] = color;
                                if(shape != null)
                                    point["shape"] = shape;

                                if (sizeField)
                                    point["size"] = doc.getFieldValueUnrendered(sizeField);

                                points.push(point);

                                if (fillEmptyValuesWith != null) {
                                    uniqueX.push(x);
                                }
                            }

                        }
                        catch (err) {
                            //console.log("Can't add field [" + field + "] to graph, filtered?")
                        }
                    });

                    if (points.length > 0)
                        series.push({values:points, key:self.getFieldLabel(yfield), color:yfield.getColorForPartition()});
                });

            } else throw "views.nvd3.graph.js: unsupported or not defined type " + seriesAttr.type;

            // foreach series fill empty values
            if (fillEmptyValuesWith != null) {
                uniqueX = _.unique(uniqueX);
                _.each(series, function (s) {
                    // foreach series obtain the unique list of x
                    var tmpValues = _.map(s.values, function (d) {
                        return d.x
                    });
                    // foreach non present field set the value
                    _.each(_.difference(uniqueX, tmpValues), function (diff) {
                        s.values.push({x:diff, y:fillEmptyValuesWith});
                    });

                });
            }
            // force sorting of values or scrambled series may generate a wrong chart  
            _.each(series, function(serie) {
            	serie.values = _.sortBy(serie.values, function(value) { return value.x }) 
            })

            if (self.extraOptions.scaleTo100Perc && series.length)
        	{
            	// perform extra steps to scale the values
            	var tot = series[0].values.length
            	var seriesTotals = []
            	for (var i = 0; i < tot; i++)
            		seriesTotals.push(_.reduce(series, function(memo, serie) { return memo + serie.values[i].y; }, 0))
            		
            	for (var i = 0; i < tot; i++)
            		_.each(series, function(serie) {
            			serie.values[i].y_orig = serie.values[i].y
            			serie.values[i].y = serie.values[i].y_orig/seriesTotals[i]*100
            		});
        	}
            return series;
        }


    });


})(jQuery, recline.View);

