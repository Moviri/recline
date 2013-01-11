this.recline = this.recline || {};
this.recline.View = this.recline.View || {};

(function ($, view) {

    "use strict";

    view.xCharts = Backbone.View.extend({
        template:'<figure style="width: {{width}}px; height: {{height}}px;" id="{{uid}}"></figure>',

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
        },

        render:function () {
            //console.log("View.xCharts: render");
            var self = this;

            var graphid = "#" + this.uid;
            if (self.graph)
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
        },

        redraw:function () {
            var self = this;

            //console.log("View.xCharts: redraw");

            if (self.graph)
                self.updateGraph();
            else
                self.renderGraph();

        },

        updateGraph:function () {
            //console.log("View.xCharts: updateGraph");
            this.el.find('figure').html("")
            var self = this;
            self.updateSeries();
            
            if (self.series.main && self.series.main.length && self.series.main[0].data && self.series.main[0].data.length)
            	self.graph.setData(self.series);
            else
        	{
            	//self.graph.setData(self.series);
                var graphid = "#" + this.uid;
                if (self.graph)
                {
                    jQuery(graphid).empty();
                    delete self.graph;
                }
            	console.log(this.el)
                this.el.find('figure').append("<div class='noData'><p>No Data Available!</p></div>");
        	}
        },

        renderGraph:function () {
            //console.log("View.xCharts: renderGraph");
            this.el.find('figure').html("")
            var self = this;
            var state = self.options.state;
            self.updateSeries();
            self.graph = new xChart(state.type, self.series, '#' + self.uid, opts);
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

            /* series is:
                [ color: , name: , data[ [record:, x:, x_formatted:, y:, y_formatted: ] ]
             */

            _.each( series, function(d) {
                var serie = {data:_.map(d.data, function(c) { return {x:c.x, y:c.y} })};

                data.main.push(serie);
            });

            self.series = data;
        }




    });
})(jQuery, recline.View);