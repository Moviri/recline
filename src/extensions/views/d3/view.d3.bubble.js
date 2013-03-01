this.recline = this.recline || {};
this.recline.View = this.recline.View || {};

(function ($, view) {

    "use strict";


    view.D3Bubble = Backbone.View.extend({
        template: '<div id="{{uid}}" style="width: {{width}}px; height: {{height}}px;"><div id="{{uid}}_legend_color"  style="width:{{legend_width}}px;height:{{legend_height}}px"></div><div id="{{uid}}_graph"></div><div id="{{uid}}_graph"></div></div>',

        brushstart: function () {
            return []; //svg.classed("selecting", true);
        },

        brushend: function (graph) {
            return function () {
                graph.trigger('zoom', {
                    xRange: graph.xRange,
                    yRange: graph.yRange
                });
                return []; //svg.classed("selecting", !d3.event.target.empty());
            };
        },

        brush: function (graph) {
            return function () {
                var e;
                e = d3.event.target.extent();

                graph.xRange = [e[0][0], e[1][0]];
                graph.yRange = [e[0][1], e[1][1]];

                return [];
                /*return svg.selectAll("circle").classed("selected", function (d) {
                return e[0][0] <= d[0] && d[0] <= e[1][0] && e[0][1] <= d[1] && d[1] <= e[1][1];
            });*/
            };
        },

        xRange: null,
        yRange: null,

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


            this.margin = {
                top: 19.5,
                right: 19.5,
                bottom: 19.5,
                left: 100.5
            };
            this.width = options.width - this.margin.right;
            this.height = options.height - this.margin.top - this.margin.bottom;

            if (this.options.state.legend) {
                this.options.state.legend.margin = this.options.state.legend.margin || [];
                this.legend_width = this.options.state.legend.width + (this.options.state.legend.margin.right || 0) + (this.options.state.legend.margin.left || this.options.state.legend.margin.right || 0);
                this.legend_height = this.options.state.legend.height + (this.options.state.legend.margin.top || 0) + (this.options.state.legend.margin.bottom || this.options.state.legend.margin.top || 0);
            }

            if (this.options.state.customTooltipTemplate) {
                this.tooltipTemplate = this.options.state.customTooltipTemplate;
            }
            //render header & svg container
            var out = Mustache.render(this.template, this);
            this.el.html(out);
        },

        render: function () {
            var self = this;
            var graphid = "#" + this.uid + "_graph";
            var legendid = "#" + this.uid + "_legend_color";

            if (self.graph) {
                jQuery(graphid).empty();
                jQuery(legendid).empty();

            }

            self.graph = d3.select(graphid);

        },

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
                state.domains = state.domains || {};
                xDomain = state.domains.xDomain || [
                Math.min(xDomain[0], record.attributes[state.xField.field]),
                Math.max(xDomain[1], record.attributes[state.xField.field])];
                yDomain = state.domains.yDomain || [
                Math.min(yDomain[0], record.attributes[state.yField.field]),
                Math.max(yDomain[1], record.attributes[state.yField.field])];
                sizeDomain = state.domains.sizeDomain || [
                Math.min(sizeDomain[0], record.attributes[state.sizeField.field]),
                Math.max(sizeDomain[1], record.attributes[state.sizeField.field])];
                colorDomain = state.domains.colorDomain || [
                Math.min(colorDomain[0], record.attributes[state.colorField.field]),
                Math.max(colorDomain[1], record.attributes[state.colorField.field])];



                return {
                    "key": record.attributes[state.keyField.field],
                    "color": record.attributes[state.colorField.field], //record.attributes[state.colorField.field],
                    "x": record.attributes[state.xField.field],
                    "size": record.attributes[state.sizeField.field],
                    "y": record.attributes[state.yField.field],
                    "color_formatted": record.getFieldValue(self.model.fields.get(state.colorField.field)),
                    "x_formatted": record.getFieldValue(self.model.fields.get(state.xField.field)),
                    "y_formatted": record.getFieldValue(self.model.fields.get(state.yField.field)),
                    "size_formatted": record.getFieldValue(self.model.fields.get(state.sizeField.field))
                }
            });

            if (sizeDomain[0] == sizeDomain[1]) sizeDomain = [sizeDomain[0] / 2, sizeDomain[0] * 2];
            if (colorDomain[0] == colorDomain[1]) colorDomain = [colorDomain[0] / 2, colorDomain[0] * 2];
            if (xDomain[0] == xDomain[1]) xDomain = [xDomain[0] / 2, xDomain[0] * 2];
            if (yDomain[0] == yDomain[1]) yDomain = [yDomain[0] / 2, yDomain[0] * 2];


            self.xScale = state.xField.scale.domain(xDomain).range([0, self.width]);
            self.yScale = state.yField.scale.domain(yDomain).range([self.height, 0]);
            self.sizeScale = state.sizeField.scale.domain(sizeDomain).range([2, 20]);
            self.colorScale = state.colorField.scale.domain(colorDomain);

            if (state.legend) {
                self.drawLegendColor(colorDomain[0], colorDomain[1]);
            }

            self.xAxisTitle = state.xAxisTitle;
            self.yAxisTitle = state.yAxisTitle;
            self.colorTitle = state.colorField['label'];
            self.sizeTitle = state.sizeField['label'];

            self.graph = d3.select("#" + self.uid + "_graph");

            this.drawD3(records);
        },

        drawLegendColor: function (minData, maxData) {

            var self = this;
            var state = self.options.state;
            var paddingAxis = 20;
            var numTick = state.legend.numElements;


            console.log(state.legend.margin);

            var legendid = "#" + this.uid + "_legend_color";
            var transX = (self.legend_width / 2 - state.legend.width / 2) || 0;
            var transY = state.legend.margin.top || 0;
            var legend = d3.select(legendid).append("svg")
                .attr("width", this.legend_width)
                .attr("height", this.legend_height);

            var data1 = d3.range(numTick);
            var dataSca = [];

            var rects = legend.selectAll("rect")
                .data(data1);
            var rectHeight = (state.legend.height - paddingAxis * 2 - numTick) / numTick;

            rects.enter()
                .append("rect")
                .attr({
                width: state.legend.width,
                height: rectHeight,
                y: function (d, i) {
                    return transY + (15) + i * (rectHeight + 1);
                },
                x: transX,
                fill: function (d, i) {
                    return self.colorScale(d * (maxData - minData) / numTick + minData);
                }
            });

            var tickValues = _.map([minData, maxData], d3.format("s"));

            legend.selectAll(".label")
                .data(tickValues).enter().append("text")
                .attr("class", "y label")
                .attr("text-anchor", "end")
                .attr("y", function (t, i) {
                return ((state.legend.height - paddingAxis) / (tickValues.length - 1)) * i + paddingAxis / 2;
            })
                .attr("x", 15 + transX)
                .text(function (t) {
                return t;
            });



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
            var xAxis = d3.svg.axis().orient("bottom").scale(self.xScale).tickFormat(d3.format("s")),
                yAxis = d3.svg.axis().scale(self.yScale).orient("left").tickFormat(d3.format("s"));

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

            //Add brush
            svg.append("g").attr("class", "brush").call(d3.svg.brush().x(self.xScale).y(self.yScale).on("brushstart", self.brushstart).on("brush", self.brush(this)).on("brushend", self.brushend(this)));




            var dot = svg.append("g")
                .attr("class", "dots")
                .selectAll(".dot")
                .data(data)
                .enter().append("circle")
                .attr("class", "dot")
                .style("fill", function (d) {
                return self.colorScale(color(d));
            })
                .call(position)
                .sort(order)
                .on("mouseover", self.handleMouseover(self))
                .on("mouseout", self.mouseout);

            // Add a title.
            /*dot.append("title")
                .text(function (d) {                	
                return key(d);
            });*/

            // Positions the dots based on data.
            function position(dot) {
                dot.attr("cx", function (d) {
                    return self.xScale(x(d));
                })
                    .attr("cy", function (d) {
                    return self.yScale(y(d));
                })
                    .attr("r", function (d) {
                    return self.sizeScale(radius(d));
                });
            }

            // Defines a sort order so that the smallest dots are drawn on top.
            function order(a, b) {
                return radius(b) - radius(a);
            }

            self.alreadyDrawed = true;


        },
        handleMouseover: function (self) {
            return function (e) {
                var mapOffset = $(self.el).position()
                var objRect = this.getBoundingClientRect();
                var docRect = document.body.getBoundingClientRect()
                var pos = {
                    left: objRect.left + objRect.width / 2,
                    top: objRect.top + objRect.height / 2 - docRect.top
                };

                var values = {
                    title: e.key,
                    dim1Label: self.xAxisTitle,
                    dim1Value: e.x_formatted,
                    dim2Label: self.yAxisTitle,
                    dim2Value: e.y_formatted,
                    dim3Label: self.colorTitle,
                    dim3Value: e.color_formatted,
                    dim4Label: self.sizeTitle,
                    dim4Value: e.size_formatted
                }
                var content = Mustache.render(self.tooltipTemplate, values);
                var $mapElem = $(self.el)
                var gravity = (pos.top < $mapElem[0].offsetTop + $mapElem.height() / 2 ? 'n' : 's');

                nv.tooltip.show([pos.left, pos.top], content, gravity, null, $mapElem[0]);
            };
        },
        mouseout: function () {
            nv.tooltip.cleanup();
        }




    });


})(jQuery, recline.View);
