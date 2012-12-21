this.recline = this.recline || {};
this.recline.View = this.recline.View || {};

(function ($, view) {

    "use strict";

    view.Rickshaw = Backbone.View.extend({
        template:'<div id="{{uid}}"> <div> ',

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


        },

        render:function () {
            console.log("View.Rickshaw: render");
            var self = this;

            var graphid = "#" + this.uid;

            if (self.graph) {
                jQuery(graphid).empty();
                delete self.graph;
            }

            var out = Mustache.render(this.template, this);
            this.el.html(out);


        },

        redraw:function () {
            var self = this;

            console.log("View.Rickshaw: redraw");


            if (self.graph)
                self.updateGraph();
            else
                self.renderGraph();

        },

        updateGraph:function () {
            var self = this;
            //self.graphOptions.series = this.createSeries();
            self.createSeries();

            self.graph.update();
            //self.graph.render();
        },

        renderGraph:function () {
            var self = this;
            this.graphOptions = {
                element:document.querySelector('#' + this.uid)
            };

            self.graphOptions = _.extend(self.graphOptions, self.options.state.options);
            self.createSeries();

            self.graphOptions.series = self.series;

            self.graph = new Rickshaw.Graph(self.graphOptions);

            if (self.options.state.unstack) {
                self.graph.renderer.unstack = true;
            }


            self.graph.render();

            var hoverDetailOpt = { graph:self.graph };
            hoverDetailOpt = _.extend(hoverDetailOpt, self.options.state.hoverDetailOpt);


            var hoverDetail = new Rickshaw.Graph.HoverDetail(hoverDetailOpt);

            var xAxisOpt = { graph:self.graph };
            xAxisOpt = _.extend(xAxisOpt, self.options.state.xAxisOptions);


            var xAxis = new Rickshaw.Graph.Axis.Time(xAxisOpt);


            xAxis.render();

            var yAxis = new Rickshaw.Graph.Axis.Y({
                graph:self.graph
            });


            yAxis.render();

            if (self.options.state.events) {

                self.annotator = new Rickshaw.Graph.Annotate({
                    graph:self.graph,
                    element:document.getElementById('timeline')
                });

                var timeField = self.options.state.events.timeField;
                var valueField = self.options.state.events.valueField;
                var endField = self.options.state.events.endField;


                _.each(self.options.state.events.dataset.getRecords(self.options.state.events.resultType), function (d) {
                    if (endField)
                        self.annotator.add(d.attributes[timeField], d.attributes[valueField], d.attributes[endField]);
                    else
                        self.annotator.add(d.attributes[timeField], d.attributes[valueField]);

                })

                self.annotator.update()

            }

            if (self.options.state.legend) {
                var legend = new Rickshaw.Graph.Legend({
                    graph:self.graph,
                    element:document.querySelector('#' + self.options.state.legend)
                });

                var shelving = new Rickshaw.Graph.Behavior.Series.Toggle({
                    graph:self.graph,
                    legend:legend
                });

                var order = new Rickshaw.Graph.Behavior.Series.Order({
                    graph:self.graph,
                    legend:legend
                });

                var highlighter = new Rickshaw.Graph.Behavior.Series.Highlight({
                    graph:self.graph,
                    legend:legend
                });
            }

        },


        getFieldLabel:function (field) {
            var self = this;
            var fieldLabel = field.attributes.label;
            if (field.attributes.is_partitioned)
                fieldLabel = field.attributes.partitionValue;

            if (typeof self.options.state.fieldLabels != "undefined" && self.options.state.fieldLabels != null) {
                var fieldLabel_alternateObj = _.find(self.state.attributes.fieldLabels, function (fl) {
                    return fl.id == fieldLabel
                });
                if (typeof fieldLabel_alternateObj != "undefined" && fieldLabel_alternateObj != null)
                    fieldLabel = fieldLabel_alternateObj.label;
            }

            return fieldLabel;
        }


    });
})(jQuery, recline.View);