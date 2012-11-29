this.recline = this.recline || {};
this.recline.View = this.recline.View || {};

(function ($, view) {
	
	"use strict";	


    view.Composed = Backbone.View.extend({
        template: '<div id="{{uid}}"> ' +
            '<div class="composedview_table">' +
                '<div class="c_group c_header">' +
                    '<div class="c_row">' +
                        '<div class="cell cell_empty"></div>' +
                        '{{#measures}}' +
                            '<div class="cell cell_title">{{title}}</div>' +
                        '{{/measures}}' +
                    '</div>' +
                '</div>' +
                '<div class="c_group c_body">' +
                    '{{#dimensions}}' +
                        '<div class="c_row">' +
                            '<div class="cell cell_name">{{term}}</div>' +
                            '{{#measures}}' +
                                      '<div class="cell cell_graph" id="{{id}}"></div>' +
                            '{{/measures}}' +
                        '</div>' +
                    '{{/dimensions}}' +
                '</div>' +
                '<div class="c_group c_footer"></div>' +
            '</div>' +
        '<div> ',

        initialize: function (options) {

            this.el = $(this.el);
    		_.bindAll(this, 'render', 'redraw');
                     

            this.model.bind('change', this.render);
            this.model.fields.bind('reset', this.render);
            this.model.fields.bind('add', this.render);

            this.model.bind('query:done', this.redraw);
            this.model.queryState.bind('selection:done', this.redraw);


			this.uid = options.id || ("composed_" + new Date().getTime() + Math.floor(Math.random() * 10000)); // generating an unique id for the chart


            //contains the array of views contained in the composed view
            this.views = [];

            //if(this.options.template)
            //    this.template = this.options.template;

        },
        
        resize: function(){

        },

        render: function () {
            var self=this;
            var graphid="#" + this.uid;

            if(self.graph)
                jQuery(graphid).empty();

            //self.graph =
        },

        redraw: function () {
            var self=this;

            self.dimensions= [ ];

            // if a dimension is defined I need a facet to identify all possibile values
            if(self.options.groupBy) {
                var facets = this.model.getFacetByFieldId(self.options.groupBy);
                var field = this.model.fields.get(self.options.groupBy);

                if (!facets) {
                    throw "ComposedView: no facet present for dimension [" + this.attributes.dimension + "]. Define a facet on the model before view render";
                }

                _.each(facets.attributes.terms, function(t) {
                    if(t.count > 0)  {
                        var uid = (new Date().getTime() + Math.floor(Math.random() * 10000)); // generating an unique id for the chart
                        self.dimensions.push(self.addFilteredMeasuresToDimension({term:t.term, id: uid}, field));
                    }
                })

            } else
            {
                var field = this.model.fields.get(self.options.dimension);

                _.each(self.model.getRecords(self.options.resultType), function(r) {
                    var uid = (new Date().getTime() + Math.floor(Math.random() * 10000)); // generating an unique id for the chart
                    self.dimensions.push( self.addMeasuresToDimension({term: r.getFieldValue(field), id: uid}, field, r));
                });

            }
            this.measures=this.options.measures;

            var tmpl = this.template;
            //if(this.options.template)
            //    tmpl = this.options.template;

            var out = Mustache.render(tmpl, self);
            this.el.html(out);

            this.attachViews();

            //var field = this.model.getFields();
            //var records = _.map(this.options.model.getRecords(this.options.resultType.type), function(record) {
            //    return record.getFieldValueUnrendered(field);
            //});



            //this.drawD3(records, "#" + this.uid);
        },

        attachViews: function() {
            var self=this;
            _.each(self.dimensions, function(dim) {
                _.each(dim.measures, function(m) {
                    var $el = $('#' + m.id);
                    m.props["el"] = $el;
                    m.props["model"] = m.dataset;
                    var view =  new recline.View[m.view](m.props);
                    self.views.push(view);

                    if(typeof(view.render) != 'undefined'){ view.render(); }
                    if(typeof(view.redraw) != 'undefined'){ view.redraw(); }

                })
            })
        },



        addFilteredMeasuresToDimension: function(currentRow, dimensionField) {
            var self=this;

            // dimension["data"] = [view]
            // a filtered dataset should be created on the original data and must be associated to the view
            var filtereddataset = new recline.Model.FilteredDataset({dataset: self.model});

            var filter = {field: dimensionField.get("id"), type: "term", term: currentRow.term, fieldType: dimensionField.get("type") };
            filtereddataset.queryState.addFilter(filter);
            filtereddataset.query();
            // foreach measure we need to add a view do the dimension

            var data = [];
            _.each(self.options.measures, function(d) {
                var uid = (new Date().getTime() + Math.floor(Math.random() * 10000)); // generating an unique id for the chart
                var val = {view: d.view, id: uid, props:d.props, dataset: filtereddataset, title:d.title};
                data.push(val);
            });

            currentRow["measures"] = data;
            return currentRow;

        },

        addMeasuresToDimension: function(currentRow, dimensionField, record) {
            var self=this;

            var ds = new recline.Model.Dataset({
                     records: [record.toJSON()],
                    fields: self.model.fields.toJSON()
                });


            var data = [];
            _.each(self.options.measures, function(d) {
                var uid = (new Date().getTime() + Math.floor(Math.random() * 10000)); // generating an unique id for the chart
                var val = {view: d.view, id: uid, props:d.props, dataset: ds, title:d.title};
                data.push(val);
            });

            currentRow["measures"] = data;
            return currentRow;

        }


    });
})(jQuery, recline.View);