this.recline = this.recline || {};
this.recline.View = this.recline.View || {};

(function ($, view) {

    "use strict";

    view.D3Bubble = Backbone.View.extend({
        template: '<div id="{{uid}}" style="width: {{width}}px; height: {{height}}px;"> <div> ',

        initialize: function (options) {

            this.el = $(this.el);
            _.bindAll(this, 'render', 'redraw');

            this.model.bind('change', this.render);
            this.model.fields.bind('reset', this.render);
            this.model.fields.bind('add', this.render);

            this.model.bind('query:done', this.redraw);
            this.model.queryState.bind('selection:done', this.redraw);

            $(window).resize(this.resize);
            this.uid = options.id || ("d3_" + new Date().getTime() + Math.floor(Math.random() * 10000)); // generating an unique id for the chart


            this.margin = {top: 19.5, right: 19.5, bottom: 19.5, left: 100.5};
            this.width = options.width - this.margin.right;
            this.height = options.height - this.margin.top - this.margin.bottom;

            //render header & svg container
            var out = Mustache.render(this.template, this);
            this.el.html(out);
        },

        render: function () {
            var self = this;
            var graphid = "#" + this.uid;

            if (self.graph)
                jQuery(graphid).empty();

            self.graph = d3.select(graphid);

        },

        // OPTIONS
        //width height
        // STATE
        //     xAxisTitle
        //     yAxisTitle
        //
        //      sizeField: xField yField colorField keyField
        // sizeField: { field,  scale }

        redraw: function () {
            var self = this;
             var state = self.options.state;

            var type;
            if (this.options.resultType) {
                type = this.options.resultType;
            }

            var xDomain = [Infinity, -Infinity];
            var yDomain = [Infinity, -Infinity];
            var sizeDomain = [Infinity, -Infinity];
            var colorDomain = [Infinity, -Infinity];

            var records = _.map(this.options.model.getRecords(type), function (record) {
                xDomain = [
                    Math.min(xDomain[0], record.attributes[state.xField.field]),
                    Math.max(xDomain[1], record.attributes[state.xField.field])
                ];
                yDomain = [
                    Math.min(yDomain[0], record.attributes[state.yField.field]),
                    Math.max(yDomain[1], record.attributes[state.yField.field])
                ];
                sizeDomain = [
                    Math.min(sizeDomain[0], record.attributes[state.sizeField.field]),
                    Math.max(sizeDomain[1], record.attributes[state.sizeField.field])
                ];
                colorDomain = [
                    Math.min(colorDomain[0], record.attributes[state.colorField.field]),
                    Math.max(colorDomain[1], record.attributes[state.colorField.field])
                ];

                return {
                    "key": record.attributes[state.keyField.field],
                    "color": record.attributes[state.colorField.field],//record.attributes[state.colorField.field],
                    "x": record.attributes[state.xField.field],
                    "size": record.attributes[state.sizeField.field],
                    "y": record.attributes[state.yField.field]
                }
            });

            if(sizeDomain[0] == sizeDomain[1])
                sizeDomain = [sizeDomain[0]/2,sizeDomain[0]*2];
            if(colorDomain[0] == colorDomain[1])
                colorDomain = [colorDomain[0]/2, colorDomain[0]*2];
            if(xDomain[0] == xDomain[1])
                xDomain = [xDomain[0]/2, xDomain[0]*2];
            if(yDomain[0] == yDomain[1])
                yDomain = [yDomain[0]/2, yDomain[0]*2];

            // Various scales. These domains make assumptions of data, naturally.
            self.xScale = state.xField.scale.domain(xDomain).range([0, self.width]);
            self.yScale = state.yField.scale.domain(yDomain).range([self.height, 0]);
            self.sizeScale = state.sizeField.scale.domain(sizeDomain).range([0, 10]);
            self.colorScale = state.colorField.scale.domain(colorDomain);

            self.xAxisTitle = state.xAxisTitle;
            self.yAxisTitle = state.yAxisTitle;

            self.graph = d3.select("#" + self.uid);

            this.drawD3(records);
        },

        drawD3: function (data) {
            var self = this;

            function x(d) {
                return d.x;
            }

            function y(d) {
                return d.y;
            }

            function radius(d) {
                return d.size;
            }

            function color(d) {
                return d.color;
            }

            function key(d) {
                return d.key;
            }


// The x & y axes.
            var xAxis = d3.svg.axis().orient("bottom").scale(self.xScale).ticks(12, d3.format(",d")),
                yAxis = d3.svg.axis().scale(self.yScale).orient("left");

// Create the SVG container and set the origin.
            var svg = self.graph.append("svg")
                .attr("width", self.width + self.margin.left + self.margin.right)
                .attr("height", self.height + self.margin.top + self.margin.bottom)
                .append("g")
                .attr("transform", "translate(" + self.margin.left + "," + self.margin.top + ")");

// Add the x-axis.
            svg.append("g")
                .attr("class", "x axis")
                .attr("transform", "translate(0," + self.height + ")")
                .call(xAxis);

// Add the y-axis.
            svg.append("g")
                .attr("class", "y axis")
                .call(yAxis);

// Add an x-axis label.
            svg.append("text")
                .attr("class", "x label")
                .attr("text-anchor", "end")
                .attr("x", self.width)
                .attr("y", self.height - 6)
                .text(self.xAxisTitle);

// Add a y-axis label.
            svg.append("text")
                .attr("class", "y label")
                .attr("text-anchor", "end")
                .attr("y", 6)
                .attr("dy", ".75em")
                .attr("transform", "rotate(-90)")
                .text(self.yAxisTitle);

// Add the year label; the value is set on transition.
            /*var label = svg.append("text")
                .attr("class", "year label")
                .attr("text-anchor", "end")
                .attr("y", self.height - 24)
                .attr("x", width)
                .text(1800);
             */


            var dot = svg.append("g")
                .attr("class", "dots")
                .selectAll(".dot")
                .data(data)
                .enter().append("circle")
                .attr("class", "dot")
                .style("fill", function(d) {
                    return self.colorScale(color(d));
                })
                .call(position)
                .sort(order);

            // Add a title.
            dot.append("title")
                .text(function(d) { return key(d); });

            // Positions the dots based on data.
            function position(dot) {
                dot .attr("cx", function(d) {
                    return self.xScale(x(d)); })
                    .attr("cy", function(d) {
                        return self.yScale(y(d)); })
                    .attr("r", function(d) {
                        return self.sizeScale(radius(d)); });
            }

            // Defines a sort order so that the smallest dots are drawn on top.
            function order(a, b) {
                return radius(b) - radius(a);
            }

            self.alreadyDrawed = true;


        }




    });


})(jQuery, recline.View);
