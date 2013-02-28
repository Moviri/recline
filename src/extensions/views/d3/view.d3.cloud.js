this.recline = this.recline || {};
this.recline.View = this.recline.View || {};

(function ($, view) {

    "use strict";

    view.D3Cloud = Backbone.View.extend({
        template: '<div id="{{uid}}" style="width: {{width}}px; height: {{height}}px;"></div>',

        initialize: function (options) {

            this.el = $(this.el);
            _.bindAll(this, 'render', 'redraw');

            this.model.bind('change', this.render);
            this.model.fields.bind('reset', this.render);
            this.model.fields.bind('add', this.render);

            this.model.bind('query:done', this.redraw);
            this.model.queryState.bind('selection:done', this.redraw);

            this.uid = options.id || ("d3_" + new Date().getTime() + Math.floor(Math.random() * 10000)); // generating an unique id for the chart

            this.margin = {top: 19.5, right: 19.5, bottom: 19.5, left: 100.5};
            this.width = options.width - this.margin.right;
            this.height = options.height - this.margin.top - this.margin.bottom;


            var out = Mustache.render(this.template, this);
            this.el.html(out);
        },

        render: function () {
            var self = this;
            var graphid = "#" + this.uid;

            if (self.graph)            {
                jQuery(graphid).empty();
            }

            self.graph = d3.select(graphid);
        },


        redraw: function () {
            if(!this.visible)  { return }

            var self = this;
             var state = self.options.state;

            var type;
            if (this.options.resultType) {
                type = this.options.resultType;
            }

            var records = _.map(this.options.model.getRecords(type), function (record) {
                return { key: record.attributes[state.wordField], value: record.attributes[state.dimensionField]};
            });

            self.graph = d3.select("#" + self.uid);

            this.drawD3(records);
        },



        drawD3: function (data) {

            var self=this;
            var state = self.options.state;


            d3.layout.cloud().size([self.width, self.height])
                .words(data.map(function(d) {
                        return {text: d.key, size: d.value};
                    }))
                .rotate(function() { return ~~(Math.random() * 2) * 90; })
                .font("Impact")
                .fontSize(function(d) { return d.size; })
                .on("end", self.drawCloud(this))
                .start();

            self.alreadyDrawed = true;

        },

        drawCloud: function(graph){
           return  function(words) {
            var self=graph;
            var fill = d3.scale.category20();
            self.graph.append("svg")
                .attr("width", self.width)
                .attr("height", self.height)
                .append("g")
                .attr("transform", "translate(150,150)")
                .selectAll("text")
                .data(words)
                .enter().append("text")
                .style("font-size", function(d) { return d.size + "px"; })
                .style("font-family", "Impact")
                .style("fill", function(d, i) { return fill(i); })
                .attr("text-anchor", "middle")
                .attr("transform", function(d) {
                    return "translate(" + [d.x, d.y] + ")rotate(" + d.rotate + ")";
                })
                .text(function(d) { return d.text; });
           };
        }






    });


})(jQuery, recline.View);
