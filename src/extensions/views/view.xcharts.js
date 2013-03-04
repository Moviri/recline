this.recline = this.recline || {};
this.recline.View = this.recline.View || {};

(function ($, view) {

    "use strict";

    view.xCharts = Backbone.View.extend({
        template:'<figure style="clear:both; width: {{width}}px; height: {{height}}px;" id="{{uid}}"></figure><div class="xCharts-title-x" style="width:{{width}}px;text-align:center;margin-left:50px">{{xAxisTitle}}</div>',

        initialize:function (options) {

            this.el = $(this.el);
            _.bindAll(this, 'render', 'redraw');


            this.model.bind('change', this.render);
            this.model.fields.bind('reset', this.render);
            this.model.fields.bind('add', this.render);

            this.model.bind('query:done', this.redraw);
            this.model.queryState.bind('selection:done', this.redraw);

            this.uid = options.id || ("d3_" + new Date().getTime() + Math.floor(Math.random() * 10000)); // generating an unique id for the chart

            this.options = options;

            this.height= options.state.height;
            this.width = options.state.width;
            this.xAxisTitle = options.state.xAxisTitle;
            this.yAxisTitle = options.state.yAxisTitle;
            if (options.state.loader)
            	options.state.loader.bindChart(this);
           if (options.state.widths){
        	   this.widths = options.state.widths;   
           } 
        },

        render:function (width) {
//            console.log("View.xCharts: render");
            if (!isNaN(width)){
        		this.width = width;	
        	}
        	        	 
            var self = this;
            self.trigger("chart:startDrawing")

            var graphid = "#" + this.uid;
            if (false/*self.graph*/)
            {
            	self.updateGraph();
//                jQuery(graphid).empty();
//                delete self.graph;
//                console.log("View.xCharts: Deleted old graph");
            }
            else
        	{
                var out = Mustache.render(this.template, this);
                this.el.html(out);
        	}
            self.trigger("chart:endDrawing")
        },

        redraw:function () {
            var self = this;
            self.trigger("chart:startDrawing")

            //console.log("View.xCharts: redraw");

            if (false /*self.graph*/)
                self.updateGraph();
            else
                self.renderGraph();

            self.trigger("chart:endDrawing")
        },

        updateGraph:function () {
            //console.log("View.xCharts: updateGraph");
            var self = this;
            self.updateSeries();
            
            if (self.series.main && self.series.main.length && self.series.main[0].data && self.series.main[0].data.length)
        	{
            	this.el.find('figure div.noData').remove()
            	
            	this.el.find('div.xCharts-title-x').html(self.options.state.xAxisTitle)
                var state =  self.options.state;
                self.updateState(state);
                self.graph._options = state.opts;

                self.graph.setData(self.series);
                self.updateOptions();

                self.graph.setType(state.type);

                if(state.legend)
                    self.createLegend();

        	}
            else
        	{
            	// display NO DATA MSG
            	
            	//self.graph.setData(self.series);
                var graphid = "#" + this.uid;
                if (self.graph)
                {
                	// removes resize event or last chart will popup again!
                	d3.select(window).on('resize.for.' + graphid, null);
                	$(graphid).off()
                    $(graphid).empty();
                    delete self.graph;
                }
                this.el.find('figure').html("");
                this.el.find('figure').append(new recline.View.NoDataMsg().create());
                this.el.find('div.xCharts-title-x').html("")
            	self.graph = null
        	}
        },

        updateState: function(state) {
            var self=this;

            if (self.options.state.yAxisTitle)
                state.opts.paddingLeft = 90;  // accomodate space for y-axis title (original values was 60)
        },

        updateOptions: function() {
            var self=this;
            this.el.find('div.xCharts-title-x').html(self.options.state.xAxisTitle)

            // add Y-Axis title
            if (self.options.state.yAxisTitle)
            {
                var fullHeight = self.graph._height + self.graph._options.axisPaddingTop + self.graph._options.axisPaddingBottom

                self.graph._g.selectAll('g.axisY g.titleY').data([self.options.state.yAxisTitle]).enter()
                    .append('g').attr('class', 'titleY').attr('transform', 'translate(-60,'+fullHeight/2+') rotate(-90)')
                    .append('text').attr('x', -3).attr('y', 0).attr('dy', ".32em").attr('text-anchor', "middle").text(function(d) { return d; });
            }
        },

        renderGraph:function () {
            //console.log("View.xCharts: renderGraph");

            var self = this;
            var state = self.options.state;
            self.updateSeries();


            if(state.legend)
                self.createLegend();


            if (self.series.main && self.series.main.length && self.series.main[0].data && self.series.main[0].data.length)
        	{
            		self.el.find('figure div.noData').remove() // remove no data msg (if any) 
            		self.el.find('figure svg g').remove() // remove previous graph (if any)
            		
                    self.updateState(state);

                if (state.interpolation)
                    state.opts.interpolation = state.interpolation;

                    self.graph = new xChart(state.type, self.series, '#' + self.uid, state.opts);
                    if (state.timing != null && typeof state.timing != "undefined")
                    	self.graph._options.timing = state.timing;


                    self.updateOptions();

            }
            else
            {
            	// display NO DATA MSG
                var graphid = "#" + this.uid;
                if (self.graph)
                {
                	// removes resize event or last chart will popup again!
                	d3.select(window).on('resize.for.' + graphid, null);
                	$(graphid).off()
                    $(graphid).empty();
                    delete self.graph;
                }
                this.el.find('figure').html("");
            	this.el.find('figure').append(new recline.View.NoDataMsg().create());
            	this.el.find('div.xCharts-title-x').html("")
            }
        },

        createLegend: function() {
            var self=this;
            var res = $("<div/>");
            var i =0;
            _.each(self.series.main, function(d) {
            	
            	if (d.color){
                	$("<style type='text/css'> " +
                			".color"+i+"{ color:rgb("+d.color.rgb+");} " +
                			".legendcolor"+i+"{ color:rgb("+d.color.rgb+"); background-color:rgb("+d.color.rgb+"); } " +
                			".xchart .color"+i+" .fill { fill:rgba("+d.color.rgb+",0.1);} " +
        					".xchart .color"+i+" .line { stroke:rgb("+d.color.rgb+");} " +    
        					".xchart .color"+i+" rect, .xchart .color"+i+" circle { fill:rgb("+d.color.rgb+");} " +
    					"</style>").appendTo("head");
                	var legendItem = $('<div class="legend_item"/>');
                	var name = $("<span/>");
                	name.html(d.name);
                	legendItem.append(name);
                	var value = $('<div class="legend_item_value"/>');
                	value.addClass("legendcolor"+i);
                	legendItem.append(value);
                	res.append(legendItem);
            	} else {
            		console.log('d.color not defined');
            	}   
            	
                i++;
            })

            self.options.state.legend.html(res);

        },

        updateSeries: function() {
            var self = this;
            var state = self.options.state;
            var series =  recline.Data.SeriesUtility.createSeries(
                state.series,
                state.unselectedColor,
                self.model,
                self.resultType,
                state.group);

            var data = { main: [],
                xScale: state.xScale,
                yScale: state.yScale
            };

            _.each( series, function(d) {
                var serie = {color:d.color, name:d.name, data:_.map(d.data, function(c) { return {x:c.x, y:c.y, x_formatted: c.x_formatted, y_formatted: c.y_formatted} })};

                data.main.push(serie);
            });

            self.series = data;
        }




    });
})(jQuery, recline.View);