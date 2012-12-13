(function ($) {

    recline.Model.Dataset = recline.Model.Dataset.extend({
        setColorSchema:function () {
            var self = this;
            _.each(self.attributes.colorSchema, function (d) {
                var field = _.find(self.fields.models, function (f) {
                    return d.field === f.id
                });
                if (field != null)
                    field.attributes.colorSchema = d.schema;
            })

        }
    });


    recline.Model.Record = recline.Model.Record.extend({
        getFieldColor:function (field) {
            if (!field.attributes.colorSchema)
                return null;

            if (field.attributes.is_partitioned) {
                return field.attributes.colorSchema.getTwoDimensionalColor(field.attributes.partitionValue, this.getFieldValueUnrendered(field));
            }
            else
                return field.attributes.colorSchema.getColorFor(this.getFieldValueUnrendered(field));

        }
    });

    recline.Model.Field = recline.Model.Field.extend({
    getColorForPartition:function () {

        if (!this.attributes.colorSchema)
            return null;

        if (this.attributes.is_partitioned)
            return this.attributes.colorSchema.getColorFor(this.attributes.partitionValue);

        return this.attributes.colorSchema.getColorFor(this.attributes.id);
    }
    });


}(jQuery));// # Recline Backbone Models
this.recline = this.recline || {};
this.recline.Data = this.recline.Data || {};
this.recline.Data.ColorSchema = this.recline.Data.ColorSchema || {};

(function ($, my) {

    my.ColorSchema = Backbone.Model.extend({
        constructor:function ColorSchema() {
            Backbone.Model.prototype.constructor.apply(this, arguments);
        },

        // ### initialize
        initialize:function () {
            var self = this;


            if (this.attributes.data) {
                var data = this.attributes.data;
                self._generateLimits(data);
            } else if (this.attributes.dataset) {
                this.bindToDataset();
            } else if (this.attributes.fields) {
                var data = this.attributes.fields;
                this.attributes.type = "scaleWithDistinctData";
                self._generateLimits(data);
            }


            if (this.attributes.twoDimensionalVariation) {
                if (this.attributes.twoDimensionalVariation.data) {
                    var data = this.attributes.twoDimensionalVariation.data;
                    self._generateVariationLimits(data);
                } else if (this.attributes.twoDimensionalVariation.dataset) {
                    this.bindToVariationDataset();
                }
            }
        },

        // generate limits from dataset values
        bindToDataset:function () {
            var self = this;
            self.attributes.dataset.dataset.records.bind('reset', function () {
                self._generateFromDataset();
            });
            self.attributes.dataset.dataset.fields.bind('reset', function () {
                self.attributes.dataset.dataset.setColorSchema(self.attributes.dataset.type);
            });

            if (self.attributes.dataset.dataset.records.models.length > 0) {
                self._generateFromDataset();
            }
        },

        bindToVariationDataset:function () {
            var self = this;
            self.attributes.twoDimensionalVariation.dataset.dataset.records.bind('reset', function () {
                self._generateFromVariationDataset();
            });


            if (self.attributes.twoDimensionalVariation.dataset.dataset.records.models.length > 0) {
                self._generateFromVariationDataset();
            }
        },

        setDataset:function (ds, field, type) {
            var self = this;

            if (!ds.attributes["colorSchema"])
                ds.attributes["colorSchema"] = [];

            // if I'm bounded to a fields name I don't need to refresh upon model update and I don't need to calculate limits on data
            if (self.attributes.fields) {
                _.each(self.attributes.fields, function (s) {
                    ds.attributes["colorSchema"].push({schema:self, field:s});
                });
            } else {
                self.attributes.dataset = {dataset:ds, field:field, type:type};


                ds.attributes["colorSchema"].push({schema:self, field:field});
                self.bindToDataset();
            }

            ds.setColorSchema(type);


        },

        setVariationDataset:function (ds, field) {
            var self = this;
            self.attributes["twoDimensionalVariation"] = {dataset:{dataset:ds, field:field} };

            self.bindToVariationDataset();
        },

        _generateFromDataset:function () {
            var self = this;
            var data = this.getRecordsArray(self.attributes.dataset);
            self._generateLimits(data);

        },

        _generateFromVariationDataset:function () {
            var self = this;
            var data = this.getRecordsArray(self.attributes.twoDimensionalVariation.dataset);
            self._generateVariationLimits(data);
        },

        _generateLimits:function (data) {
            var self = this;
            switch (this.attributes.type) {
                case "scaleWithDataMinMax":
                    self.schema = new chroma.ColorScale({
                        colors:this.attributes.colors,
                        limits:this.limits["minMax"](data)
                    });
                    break;
                case "scaleWithDistinctData":
                    self.schema = new chroma.ColorScale({
                        colors:this.attributes.colors,
                        limits:this.limits["distinct"](data)
                    });
                    break;
                case "fixedLimits":
                    self.schema = new chroma.ColorScale({
                        colors:this.attributes.colors,
                        limits:this.attributes.limits
                    });
                    break;
                default:
                    throw "data.colors.js: unknown or not defined properties type [" + this.attributes.type + "] possible values are [scaleWithDataMinMax,scaleWithDistinctData,fixedLimits]";
            }
        },

        getScaleType:function () {
            return this.attributes.type;
        },

        getScaleLimits:function () {
            return this.schema.limits;
        },

        _generateVariationLimits:function (data) {
            var self = this;
            self.variationLimits = this.limits["minMax"](data);
        },

        getColorFor:function (fieldValue) {
            var self = this;
            if (this.schema == null)
                throw "data.colors.js: colorschema not yet initialized, datasource not fetched?"


            return this.schema.getColor(recline.Data.Transform.getFieldHash(fieldValue));
        },

        getTwoDimensionalColor:function (startingvalue, variation) {
            if (this.schema == null)
                throw "data.colors.js: colorschema not yet initialized, datasource not fetched?"

            if (this.attributes.twoDimensionalVariation == null)
                return this.getColorFor(startingvalue);

            var endColor = '#000000';
            if (this.attributes.twoDimensionalVariation.type == "toLight")
                endColor = '#ffffff';


            var self = this;

            var tempSchema = new chroma.ColorScale({
                colors:[self.getColorFor(startingvalue), endColor],
                limits:self.variationLimits,
                mode:'hsl'
            });

            return tempSchema.getColor(variation);

        },

        getRecordsArray:function (dataset) {
            var self = this;
            var ret = [];

            if (dataset.dataset.isFieldPartitioned(dataset.field)) {
                var fields = dataset.dataset.getPartitionedFields(dataset.field);
                _.each(dataset.dataset.getRecords(dataset.type), function (d) {
                    _.each(fields, function (field) {
                        ret.push(d.attributes[field.id]);
                    });
                });
            }
            else {
                var fields = [dataset.field];

                _.each(dataset.dataset.getRecords(dataset.type), function (d) {
                    _.each(fields, function (field) {
                        ret.push(d.attributes[field]);
                    });
                });
            }


            return ret;
        },


        limits:{
            minMax:function (data) {
                var limit = [null, null];
                _.each(data, function (d) {
                    if (limit[0] == null)    limit[0] = d;
                    else                    limit[0] = Math.min(limit[0], d);

                    if (limit[1] == null)    limit[1] = d;
                    else                    limit[1] = Math.max(limit[1], d);
                });

                return limit;
            },
            distinct:function (data) {
                var tmp = [];
                _.each(_.uniq(data), function (d) {
                    tmp.push(recline.Data.Transform.getFieldHash(d));

                });
                return tmp;
            }

        }








    });

    my.ColorSchema.addColorsToTerms = function (field, terms, colorSchema) {
        _.each(terms, function (t) {

            // assignment of color schema to fields
            if (colorSchema) {
                _.each(colorSchema, function (d) {
                    if (d.field === field)
                        t.color = d.schema.getColorFor(t.term);
                })
            }
        });
    };
}(jQuery, this.recline.Data));
this.recline = this.recline || {};
this.recline.View = this.recline.View || {};

(function ($, view) {

    "use strict";

    view.Composed = Backbone.View.extend({
        templates:{
            vertical:'<div id="{{uid}}"> ' +
                '<div class="composedview_table">' +
                '<div class="c_group c_header">' +
                '<div class="c_row">' +
                '<div class="cell cell_empty"></div>' +
                '{{#dimensions}}' +
                '<div class="cell cell_name"><div class="title" style="float:left">{{term}}</div><div class="shape" style="float:left">{{{shape}}}</div></div>' +
                '{{/dimensions}}' +
                '</div>' +
                '</div>' +
                '<div class="c_group c_body">' +
                '{{#measures}}' +
                '<div class="c_row">' +
                '<div class="cell cell_title"><div><div class="rawhtml" style="vertical-align:middle;float:left">{{{rawhtml}}}</div><div style="vertical-align:middle;float:left"><div class="title">{{title}}</div><div class="subtitle">{{{subtitle}}}</div></div><div class="shape" style="vertical-align:middle;float:left">{{shape}}</div></div></div>' +
                '{{#dimensions}}' +
                '<div class="cell cell_graph" id="{{#getDimensionIDbyMeasureID}}{{measure_id}}{{/getDimensionIDbyMeasureID}}" term="{{measure_id}}"></div>' +
                '{{/dimensions}}' +
                '</div>' +
                '{{/measures}}' +
                '</div>' +
                '<div class="c_group c_footer"></div>' +
                '</div>' +
                '</div> ',

            horizontal:'<div id="{{uid}}"> ' +
                '<div class="composedview_table">' +
                '<div class="c_group c_header">' +
                '<div class="c_row">' +
                '<div class="cell cell_empty"></div>' +
                '{{#measures}}' +
                '<div class="cell cell_title"><div><div class="rawhtml" style="vertical-align:middle;float:left">{{{rawhtml}}}</div><div style="float:left;vertical-align:middle"><div class="title">{{title}}</div><div class="subtitle">{{{subtitle}}}</div></div><div class="shape" style="float:left;vertical-align:middle">{{shape}}</div></div></div>' +
                '{{/measures}}' +
                '</div>' +
                '</div>' +
                '<div class="c_group c_body">' +
                '{{#dimensions}}' +
                '<div class="c_row">' +
                '<div class="cell cell_name"><div class="title" style="float:left">{{term}}</div><div class="shape" style="float:left">{{{shape}}}</div></div>' +
                '{{#measures}}' +
                '<div class="cell cell_graph" id="{{viewid}}"></div>' +
                '{{/measures}}' +
                '</div>' +
                '{{/dimensions}}' +
                '</div>' +
                '<div class="c_group c_footer"></div>' +
                '</div>' +
                '</div> '
        },

        initialize:function (options) {
            var self = this;
            this.el = $(this.el);
            _.bindAll(this, 'render', 'redraw');


            this.model.bind('change', this.render);
            this.model.fields.bind('reset', this.render);
            this.model.fields.bind('add', this.render);

            this.model.bind('query:done', this.redraw);
            this.model.queryState.bind('selection:done', this.redraw);


            this.uid = options.id || ("composed_" + new Date().getTime() + Math.floor(Math.random() * 10000)); // generating an unique id for the chart

            _.each(this.options.measures, function (m, index) {
                self.options.measures[index]["measure_id"] = new Date().getTime() + Math.floor(Math.random() * 10000);
            });

            //contains the array of views contained in the composed view
            this.views = [];

            //if(this.options.template)
            //    this.template = this.options.template;

        },

        render:function () {
            console.log("View.Composed: render");
            var self = this;
            var graphid = "#" + this.uid;

            if (self.graph)
                jQuery(graphid).empty();

        },

        redraw:function () {
            var self = this;

            self.dimensions = [ ];

            // if a dimension is defined I need a facet to identify all possibile values
            if (self.options.groupBy) {
                var facets = this.model.getFacetByFieldId(self.options.groupBy);
                var field = this.model.fields.get(self.options.groupBy);

                if (!facets) {
                    throw "ComposedView: no facet present for groupby field [" + this.attributes.dimension + "]. Define a facet on the model before view render";
                }

                _.each(facets.attributes.terms, function (t) {
                    if (t.count > 0) {
                        var uid = (new Date().getTime() + Math.floor(Math.random() * 10000)); // generating an unique id for the chart
                        var dim = {term:t.term, id_dimension:uid, shape:t.shape};

                        dim["getDimensionIDbyMeasureID"] = function () {
                            return function (measureID) {
                                var measure = _.find(this.measures, function (f) {
                                    return f.measure_id == measureID;
                                });
                                return measure.viewid;
                            }
                        };

                        self.dimensions.push(self.addFilteredMeasuresToDimension(dim, field));
                    }
                })

            } else {
                /*var field = this.model.fields.get(self.options.dimension);
                 if(!field)
                 throw("View.Composed: unable to find dimension field [" + self.options.dimension + "] on dataset")

                 _.each(self.model.getRecords(self.options.resultType), function(r) {
                 var uid = (new Date().getTime() + Math.floor(Math.random() * 10000)); // generating an unique id for the chart
                 self.dimensions.push( self.addMeasuresToDimension({term: r.getFieldValue(field), id: uid}, field, r));
                 });*/
                var uid = (new Date().getTime() + Math.floor(Math.random() * 10000)); // generating an unique id for the chart
                var dim;

                if (self.options.type == "groupByRecord")
                    dim = self.addMeasuresToDimension({id_dimension:uid});
                else
                    dim = self.addMeasuresToDimensionAllModel({id_dimension:uid});

                var getViewFunction = function () {
                    return function (measureID) {
                        var measure = _.find(this.measures, function (f) {
                            return f.measure_id == measureID;
                        });
                        return measure.viewid;
                    }
                };
                _.each(dim, function(f, index) {
                    f["getDimensionIDbyMeasureID"] = getViewFunction;
                    dim[index] = f;
                })

                self.dimensions = dim;

            }


            this.measures = this.options.measures;

            var tmpl = this.templates.vertical;
            if (this.options.template)
                tmpl = this.templates[this.options.template];
            if (this.options.customTemplate)
                tmpl = this.options.customTemplate;

            var out = Mustache.render(tmpl, self);
            this.el.html(out);

            this.attachViews();

            //var field = this.model.getFields();
            //var records = _.map(this.options.model.getRecords(this.options.resultType.type), function(record) {
            //    return record.getFieldValueUnrendered(field);
            //});


            //this.drawD3(records, "#" + this.uid);
        },

        attachViews:function () {
            var self = this;
            _.each(self.dimensions, function (dim) {
                _.each(dim.measures, function (m) {
                    var $el = $('#' + m.viewid);
                    m.props["el"] = $el;
                    m.props["model"] = m.dataset;
                    var view = new recline.View[m.view](m.props);
                    self.views.push(view);

                    if (typeof(view.render) != 'undefined') {
                        view.render();
                    }
                    if (typeof(view.redraw) != 'undefined') {
                        view.redraw();
                    }

                })
            })
        },


        addFilteredMeasuresToDimension:function (currentRow, dimensionField) {
            var self = this;

            // dimension["data"] = [view]
            // a filtered dataset should be created on the original data and must be associated to the view
            var filtereddataset = new recline.Model.FilteredDataset({dataset:self.model});

            var filter = {field:dimensionField.get("id"), type:"term", term:currentRow.term, fieldType:dimensionField.get("type") };
            filtereddataset.queryState.addFilter(filter);
            filtereddataset.query();
            // foreach measure we need to add a view do the dimension

            var data = [];
            _.each(self.options.measures, function (d) {
                var val = {
                    view:d.view,
                    viewid:new Date().getTime() + Math.floor(Math.random() * 10000),
                    measure_id:d.measure_id,
                    props:d.props,
                    dataset:filtereddataset,
                    title:d.title,
                    subtitle:d.subtitle,
                    rawhtml:d.rawhtml
                };

                data.push(val);
            });

            currentRow["measures"] = data;
            return currentRow;

        },
        addMeasuresToDimension:function (currentRow) {
            var self = this;
            var ret = [];


            _.each(self.model.records.models, function (r) {
                var data = [];
                _.each(self.options.measures, function (d) {


                    var model = new recline.Model.Dataset({ records:[r.toJSON()], fields:r.fields.toJSON() });

                    var val = {
                        view:d.view,
                        viewid:new Date().getTime() + Math.floor(Math.random() * 10000),
                        measure_id:d.measure_id,
                        props:d.props,
                        dataset:model,
                        title:d.title,
                        subtitle:d.subtitle,
                        rawhtml:d.rawhtml};
                    data.push(val);

                });
                var currentRec = {measures: data, id_dimension: currentRow.id_dimension};
                ret.push(currentRec);
            });

            return ret;

        },
        addMeasuresToDimensionAllModel:function (currentRow) {
            var self = this;

            var data = [];

            _.each(self.options.measures, function (d) {

                var val = {
                    view:d.view,
                    viewid:new Date().getTime() + Math.floor(Math.random() * 10000),
                    measure_id:d.measure_id,
                    props:d.props,
                    dataset:self.model,
                    title:d.title,
                    subtitle:d.subtitle,
                    rawhtml:d.rawhtml};
                data.push(val);
            });


            currentRow["measures"] = data;
            return [currentRow];

        }


    });
})(jQuery, recline.View);/*jshint multistr:true */

this.recline = this.recline || {};
this.recline.View = this.recline.View || {};

(function ($, my) {

// ## Indicator view for a Dataset 
//
// Initialization arguments (in a hash in first parameter):
//
// * model: recline.Model.Dataset (should be a VirtualDataset that already performs the aggregation
// * state: (optional) configuration hash of form:
//
//        { 
//          series: [{column name for series A}, {column name series B}, ... ],   // only first record of dataset is used
//			format: (optional) format to use (see D3.format for reference)
//        }
//
// NB: should *not* provide an el argument to the view but must let the view
// generate the element itself (you can then append view.el to the DOM.
    my.Indicator = Backbone.View.extend({
        defaults:{
            format:'d'
        },

        compareType:{
            self:this,
            percentage:function (kpi, compare, templates, condensed) {
                var tmpField = new recline.Model.Field({type:"number", format:"percentage"});
                var unrenderedValue = kpi / compare * 100;
                var data = recline.Data.Formatters.Renderers(unrenderedValue, tmpField);
                var template = templates.templatePercentage;
                if (condensed == true)
                	template = templates.templatePercentageCondensed;
                
                return {data:data, template:template, unrenderedValue: unrenderedValue, percentageMsg: "% of total: "};
            },
            percentageVariation:function (kpi, compare, templates, condensed) {
                var tmpField = new recline.Model.Field({type:"number", format:"percentage"});
                var unrenderedValue = (kpi-compare) / compare * 100;
                var data = recline.Data.Formatters.Renderers( unrenderedValue, tmpField);
                var template = templates.templatePercentage;
                if (condensed == true)
                	template = templates.templatePercentageCondensed;

                return {data:data, template:template, unrenderedValue: unrenderedValue, percentageMsg: "% variation: "};
            },
            nocompare: function (kpi, compare, templates, condensed){
                var template = templates.templateBase;
                if (condensed == true)
                	template = templates.templateBaseCondensed;
            	
                return {data:null, template:template, unrenderedValue:null};
            },


        },

        templates:{
   templateBase:
   '<div class="indicator"> \
      <div class="panel indicator_{{viewId}}"> \
        <div id="indicator_{{viewId}}"> \
			<table class="indicator-table"> \
                <tr class="titlerow"><td></td><td style="text-align: center;" class="title">{{{label}}}</td></tr>    \
                <tr class="descriptionrow"><td></td><td style="text-align: center;" class="description"><small>{{description}}</small></td></tr>    \
                <tr class="shaperow"><td><div class="shape">{{{shape}}}</div><div class="compareshape">{{{compareShape}}}</div></td><td class="value-cell">{{value}}</td></tr>  \
             </table>  \
		</div>\
      </div> \
    </div> ',
    templateBaseCondensed:
   '<div class="indicator" style="width:100%;"> \
	    <div class="panel indicator_{{viewId}}" style="width:100%;"> \
	      <div id="indicator_{{viewId}}" class="indicator-container well" style="width:85%;"> \
			<fieldset style="width:100%;"> \
				<legend style="width:100%;"> \
                <div class="value-cell" style="float:left">{{value}}</div> \
				<div class="compareshape" style="float:right">{{{compareShape}}}</div> \
                <div class="shape" style="float:right">{{{shape}}}</div> \
				</legend> \
                <div style="text-align:justify;width:100%;" class="title">{{{label}}}</div>\
			</fieldset> \
			</div> \
	    </div> \
    </div>'
,
   templatePercentage:
   '<div class="indicator"> \
      <div class="panel indicator_{{viewId}}"> \
        <div id="indicator_{{viewId}}"> \
			 <table class="indicator-table"> \
                <tr class="titlerow"><td></td><td class="title">{{{label}}}</td></tr>    \
                <tr class="descriptionrow"><td></td><td class="description"><small>{{description}}</small></td></tr>    \
                <tr class="shaperow"><td><div class="shape">{{{shape}}}</div><div class="compareshape">{{{compareShape}}}</div></td><td class="value-cell">{{value}}</td></tr>  \
                <tr class="comparerow"><td></td><td class="comparelabel">{{percentageMsg}}<b>{{compareValue}}</b> (<b>{{compareWithValue}}</b>)</td></tr>  \
             </table>  \
		</div>\
      </div> \
    </div> ',
    templatePercentageCondensed:
    	   '<div class="indicator" style="width:100%;"> \
	    <div class="panel indicator_{{viewId}}" style="width:100%;"> \
	      <div id="indicator_{{viewId}}" class="indicator-container well" style="width:85%;"> \
			<fieldset style="width:100%;"> \
				<legend style="width:100%;"> \
                <div class="value-cell" style="float:left">{{value}}</div> \
    			<div class="compareshape" style="float:right">{{{compareShape}}}</div> \
                <div class="shape" style="float:right">{{{shape}}}</div> \
				</legend> \
                <div style="text-align:justify;width:100%;" class="title">{{{label}}}</div>\
    			</fieldset> \
    		</div> \
	    </div> \
    </div>'
        },
        initialize:function (options) {
            var self = this;

            this.el = $(this.el);
            _.bindAll(this, 'render');
            this.uid = options.id || ("" + new Date().getTime() + Math.floor(Math.random() * 10000)); // generating an unique id for the chart

            this.model.bind('query:done', this.render);

        },

        render:function () {
            console.log("View.Indicator: render");

            var self = this;
            var tmplData = {};
            tmplData["viewId"] = this.uid;
            tmplData.label = this.options.state && this.options.state["label"];

            var kpi = self.model.getRecords(self.options.state.kpi.type);

            var field;
            if (self.options.state.kpi.aggr)
                field = self.model.getField_byAggregationFunction(self.options.state.kpi.type, self.options.state.kpi.field, self.options.state.kpi.aggr);
            else
                field = self.model.getFields(self.options.state.kpi.type).get(self.options.state.kpi.field);

            if (!field)
                throw "View.Indicator: unable to find field [" + self.options.state.kpi.field + "] on model"
                
            var textField = null;
            if (self.options.state.condensed == true && self.options.state.kpi.textField)
        	{
                if (self.options.state.kpi.aggr)
                	textField = self.model.getField_byAggregationFunction(self.options.state.kpi.type, self.options.state.kpi.textField, self.options.state.kpi.aggr);
                else
                	textField = self.model.getFields(self.options.state.kpi.type).get(self.options.state.kpi.textField);

                if (!textField)
                    throw "View.Indicator: unable to find field [" + self.options.state.kpi.textField + "] on model"
        	}

            var kpiValue;


            if (kpi.length > 0) {
                kpiValue = kpi[0].getFieldValueUnrendered(field);
                tmplData["value"] = kpi[0].getFieldValue(field);
                tmplData["shape"] = kpi[0].getFieldShape(field, true, false);
                if (self.options.state.condensed == true && textField)
                	tmplData["label"] = kpi[0].getFieldValue(textField);
            }
            else tmplData["value"] = "N/A"

            var template = this.templates.templateBase;
            if (self.options.state.condensed == true)
            	template = self.templates.templateBaseCondensed;            

            if (self.options.state.compareWith) {
                var compareWithRecord = self.model.getRecords(self.options.state.compareWith.type);
                var compareWithField;

                if (self.options.state.kpi.aggr)
                    compareWithField = self.model.getField_byAggregationFunction(self.options.state.compareWith.type, self.options.state.compareWith.field, self.options.state.compareWith.aggr);
                else
                    compareWithField = self.options.model.getFields(self.options.state.compareWith.type).get(self.options.state.compareWith.field);

                if (!compareWithField)
                    throw "View.Indicator: unable to find field [" + self.options.state.compareWith.field + "] on model"

                tmplData["compareWithValue"] = compareWithRecord[0].getFieldValue(compareWithField);
                var compareWithValue = compareWithRecord[0].getFieldValueUnrendered(compareWithField);

                var compareValue;

                var compareValue = self.compareType[self.options.state.compareWith.compareType](kpiValue, compareWithValue, self.templates, self.options.state.condensed);
                if(!compareValue)
                    throw "View.Indicator: unable to find compareType [" + self.options.state.compareWith.compareType + "]";

                tmplData["compareValue"] = compareValue.data;

                if(self.options.state.compareWith.shapes) {
                    if(compareValue.unrenderedValue == 0)
                        tmplData["compareShape"] = self.options.state.compareWith.shapes.constant;
                    else if(compareValue.unrenderedValue > 0)
                        tmplData["compareShape"] = self.options.state.compareWith.shapes.increase;
                    else if(compareValue.unrenderedValue < 0)
                        tmplData["compareShape"] = self.options.state.compareWith.shapes.decrease;
                }

                if(compareValue.template)
                    template = compareValue.template;
            }

            if (this.options.state.description)
                tmplData["description"] = this.options.state.description;
            
            if (compareValue.percentageMsg)
            	tmplData["percentageMsg"] = compareValue.percentageMsg; 

            var htmls = Mustache.render(template, tmplData);
            $(this.el).html(htmls);


            //this.$graph = this.el.find('.panel.indicator_' + tmplData["viewId"]);


            return this;
        }






    });


})(jQuery, recline.View);
/*jshint multistr:true */

this.recline = this.recline || {};
this.recline.View = this.recline.View || {};

(function ($, my) {


    my.KartoGraph = Backbone.View.extend({

        template:'<div id="cartograph_{{viewId}}"></div> ',

        rendered: false,

        initialize:function (options) {
            var self = this;

            this.el = $(this.el);
            _.bindAll(this, 'render', 'redraw');

            this.model.bind('change', self.render);
            this.model.fields.bind('reset', self.render);
            this.model.fields.bind('add', self.render);

            this.model.bind('query:done', this.redraw);
            this.model.queryState.bind('selection:done', this.redraw);

            this.uid = "" + new Date().getTime() + Math.floor(Math.random() * 10000); // generating an unique id for the chart

            this.unselectedColor = "#C0C0C0";
            if (this.options.state.unselectedColor)
                this.unselectedColor = this.options.state.unselectedColor;

        },

        render:function () {
            var self = this;
            var tmplData = {};
            tmplData["viewId"] = this.uid;
            var htmls = Mustache.render(this.template, tmplData);
            $(this.el).html(htmls);

            var map_url = this.options.state["svgURI"];
            var layers = this.options.state["layers"];

            self.map = $K.map('#cartograph_' + this.uid);
            self.map.loadMap(map_url, function (m) {
                _.each(layers, function (d) {
                    m.addLayer(d, self.getEventsForLayer(d));
                });
                self.rendered = true;
                self.updateMap();


            });

            return this;
        },

        redraw:function () {
            var self = this;

            self.updateMap();
        },

        updateMap:function () {
            var self = this;

            if(!self.rendered)
                return;

            var map = self.map;


            // todo verify if it is possibile to divide render and redraw
            // it seams that context is lost after initial load

            var colors = this.options.state["colors"];
            var mapping = this.options.state["mapping"];



            _.each(mapping, function (currentMapping) {
                //build an object that contains all possibile srcShape
                var layer = map.getLayer(currentMapping.destLayer);

                var paths = [];
               _.each(layer.paths, function(currentPath) {
                    paths.push(currentPath.data[currentMapping["destAttribute"]]);
                });

                var filteredResults = self._getDataFor(
                    paths,
                    currentMapping["srcShapeField"],
                    currentMapping["srcValueField"]);

                layer.style(
                    "fill", function (d) {
                        var res = filteredResults[d[currentMapping["destAttribute"]]];

                        // check if current shape is present into results
                           if(res != null)
                                return res.color;
                            else
                                return self.unselectedColor;
                    });
            });


        },


        // todo this is not efficient, a list of data should be built before and used as a filter
        // to avoid arrayscan
        _getDataFor:function (paths, srcShapeField, srcValueField) {
            var self=this;
            var resultType = "filtered";
            if (self.options.useFilteredData !== null && self.options.useFilteredData === false)
                resultType = "original";

            var records = self.model.getRecords(resultType);  //self.model.records.models;
            var srcShapef = self.model.fields.get(srcShapeField);
            var srcValuef = self.model.fields.get(srcValueField);

            var selectionActive = false;
            if (self.model.queryState.isSelected())
                selectionActive = true;

            var res = {};
            _.each(records, function (d) {

                if(_.contains(paths, d.getFieldValueUnrendered(srcShapef))) {
                    var color = self.unselectedColor;
                    if(selectionActive) {
                        if(d.isRecordSelected())
                            color = d.getFieldColor(srcValuef);
                    } else {
                            color = d.getFieldColor(srcValuef);
                    }


                    res[d.getFieldValueUnrendered(srcShapef)] =  {record: d, field: srcValuef, color: color, value:d.getFieldValueUnrendered(srcValuef) };

                }
            });

            return res;
        },

        getEventsForLayer: function(layer) {
            var self=this;
            var ret = {};

            // fiend all fields of this layer
            //  mapping: [{srcShapeField: "state", srcValueField: "value", destAttribute: "name", destLayer: "usa"}],

            var fields = _.filter(this.options.state["mapping"], function(m) {
                return m.destLayer == layer;
            });

            if(fields.length == 0)
                return {};
            if(fields.length > 1)
                throw "view.Kartograph.js: more than one field associated with layer, impossible to link with actions"

            //fields = _.map(fields, function(d) {return d.srcShapeField});

            // find all actions for selection
            var clickEvents = self.getActionsForEvent("selection");

            // filter actions that doesn't contain fields

            var clickActions = _.filter(clickEvents, function(d) {
                return d.mapping.srcField == fields.srcShapeField;
            });


            if(clickActions.length > 0)
            ret["click"] = function(data, path, event) {

                console.log(data);
                _.each(clickActions, function(a) {
                    var params = [];
                    _.each(a.mapping, function(m) {
                       params.push({filter:m.filter,  value: [data[fields[0].destAttribute]]});
                    });

                    a.action._internalDoAction(params, "add");
                });

            };

            return ret;
        },


        getMapping: function(srcField) {
            var self=this;
            var mapping = this.options.state["mapping"];
            return _.filter(mapping, function(d) {
                return d.srcShapeField == srcField
            });

        },

        /*bindEvents: function() {
            var self=this;
            var actions = self.getActionsForEvent("selection");

            map.addLayer('mylayer', {
                click: function(data, path, event) {
                    // handle mouse clicks
                    // *data* holds the data dictionary of the clicked path
                    // *path* is the raphael object
                    // *event* is the original JavaScript event
                }
            });

            if (actions.length > 0) {
                //

                options["callback"] = function (x) {

                    // selection is done on x axis so I need to take the record with range [min_x, max_x]
                    // is the group attribute
                    var record_min = _.min(x, function (d) {
                        return d.min.x
                    });
                    var record_max = _.max(x, function (d) {
                        return d.max.x
                    });

                    view.doActions(actions, [record_min.min.record, record_max.max.record]);

                };
            } else
                options["callback"] = function () {
                };
        },*/


        doActions:function (actions, data) {

            _.each(actions, function (d) {
                d.action._internalDoAction([data]);
            });

            params.push({
                filter : mapp.filter,
                value : values
            });

        },

        getActionsForEvent:function (eventType) {
            var self = this;
            var actions = [];

            _.each(self.options.actions, function (d) {
                if (_.contains(d.event, eventType))
                    actions.push(d);
            });

            return actions;
        }


    });


})(jQuery, recline.View);

