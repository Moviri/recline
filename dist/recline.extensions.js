// # Recline Backbone Models
this.recline = this.recline || {};
this.recline.Model = this.recline.Model || {};
this.recline.Model.FilteredDataset = this.recline.Model.FilteredDataset || {};


(function ($, my) {

// ## <a id="dataset">VirtualDataset</a>
    my.FilteredDataset = Backbone.Model.extend({
        constructor:function FilteredDataset() {
            Backbone.Model.prototype.constructor.apply(this, arguments);
        },


        initialize:function () {
            var self = this;


            this.records = new my.RecordList();

            this.fields =  this.attributes.dataset.fields;


            //todo
            //this.facets = new my.FacetList();
            this.recordCount = null;

            this.queryState = new my.Query();

            if (this.get('initialState')) {
                this.get('initialState').setState(this);
            }

            this.attributes.dataset.fields.bind('reset', function () {
                self.fieldsReset();
            })

            this.attributes.dataset.bind('query:done', function () {
                self.query();
            })

            this.queryState.bind('change', function () {
                self.query();
            });

        },

        fieldsReset: function() {
            this.fields = this.attributes.dataset.fields;

        },

        query:function (queryObj) {
            var self=this;
            this.trigger('query:start');

            if (queryObj) {
                this.queryState.set(queryObj, {silent:true});
            }

            var queryObj = this.queryState.toJSON();

            _.each(self.attributes.customFilterLogic, function (f) {
                f(queryObj);
            });


            console.log("Query on model query [" + JSON.stringify(queryObj) + "]");

            var dataset = self.attributes.dataset;
            var numRows = queryObj.size || dataset.recordCount;
            var start = queryObj.from || 0;

            //todo use records fitlering in order to inherit all record properties
            //todo perhaps need a new applyfiltersondata
            var results = recline.Data.Filters.applyFiltersOnData(queryObj.filters, dataset.records.toJSON(), dataset.fields.toJSON());

            _.each(queryObj.sort, function (sortObj) {
                var fieldName = sortObj.field;
                results = _.sortBy(results, function (doc) {
                    var _out = doc[fieldName];
                    return _out;
                });
                if (sortObj.order == 'desc') {
                    results.reverse();
                }
            });

            results = results.slice(start, start + numRows);
            self.recordCount = results.length;

            var docs = _.map(results, function (hit) {
                var _doc = new my.Record(hit);
                _doc.fields = dataset.fields;
                _doc.bind('change', function (doc) {
                    self._changes.updates.push(doc.toJSON());
                });
                _doc.bind('destroy', function (doc) {
                    self._changes.deletes.push(doc.toJSON());
                });
                return _doc;
            });

            self.records.reset(docs);

            self.trigger('query:done');
        },

        getRecords:function () {
            return this.records.models;
        },

        getFields:function (type) {
            return this.attributes.dataset.fields;
        },

        toTemplateJSON:function () {
            var data = this.records.toJSON();
            data.recordCount = this.recordCount;
            data.fields = this.fields.toJSON();
            return data;
        },

        getFieldsSummary:function () {
            return this.attributes.dataset.getFieldsSummary();
        },

        addCustomFilterLogic: function(f) {
            if(this.attributes.customFilterLogic)
                this.attributes.customFilterLogic.push(f);
            else
                this.attributes.customFilterLogic = [f];
        },
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




    })


}(jQuery, this.recline.Model));

// # Recline Backbone Models
this.recline = this.recline || {};
this.recline.Model = this.recline.Model || {};
this.recline.Model.JoinedDataset = this.recline.Model.JoinedDataset || {};


(function ($, my) {

// ## <a id="dataset">VirtualDataset</a>
    my.JoinedDataset = Backbone.Model.extend({
        constructor:function JoinedDataset() {
            Backbone.Model.prototype.constructor.apply(this, arguments);
        },


        initialize:function () {
            var self = this;
            _.bindAll(this, 'generatefields');

            self.ds_fetched = [];

            this.fields = new my.FieldList();


            this.records = new my.RecordList();

            this.facets = new my.FacetList();
            this.recordCount = null;

            this.queryState = new my.Query();

            if (this.get('initialState')) {
                this.get('initialState').setState(this);
            }

            this.attributes.model.fields.bind('reset', this.generatefields);
            this.attributes.model.fields.bind('add', this.generatefields);

            _.each(this.attributes.join, function(p) {
                p.model.fields.bind('reset', self.generatefields);
                p.model.fields.bind('add', self.generatefields);

            });

            this.generatefields();

            this.attributes.model.bind('query:done', function () {
                self.ds_fetched.push("model");

                if (self.allDsFetched())
                    self.query();
            })

            _.each(this.attributes.join, function(p) {

                p.model.bind('query:done', function () {
                    self.ds_fetched.push(p.id);

                    if (self.allDsFetched())
                        self.query();
                });

                p.model.queryState.bind('change', function () {
                    if (self.allDsFetched())
                        self.query();
                });

            });

        },

        allDsFetched: function() {
            var self=this;
            var ret= true;

            if(!_.contains(self.ds_fetched, "model"))
                return false;

             _.each(self.attributes.join, function(p) {
                 if(!_.contains(self.ds_fetched, p.id)) {
                     ret = false;
                 }
             });

             return ret;
        },

        generatefields:function () {
            var tmpFields = [];
            _.each(this.attributes.model.fields.models, function (f) {
                var c = f.toJSON();
                c.id = c.id;
                tmpFields.push(c);
            });

            _.each(this.attributes.join, function(p) {
                _.each(p.model.fields.models, function (f) {
                    var c = f.toJSON();
                    c.id = p.id + "_" + c.id;
                    tmpFields.push(c);
                });
            });



            var options = {renderer:recline.Data.Formatters.Renderers};

            this.fields.reset(tmpFields, options);
            this.setColorSchema();
            this.setShapeSchema();


        },

        query:function (queryObj) {
            var self = this;
            this.trigger('query:start');

            if (queryObj) {
                this.queryState.set(queryObj, {silent:true});
            }

            var queryObj = this.queryState.toJSON();

            console.log("Query on model query [" + JSON.stringify(queryObj) + "]");

            var results = self.join();

            var numRows = queryObj.size || results.length;
            var start = queryObj.from || 0;

            _.each(queryObj.sort, function (sortObj) {
                var fieldName = sortObj.field;
                results = _.sortBy(results, function (doc) {
                    var _out = doc[fieldName];
                    return _out;
                });
                if (sortObj.order == 'desc') {
                    results.reverse();
                }
            });

            results = results.slice(start, start + numRows);
            facets = recline.Data.Faceting.computeFacets(results, queryObj);

            self.recordCount = results.length;

            var docs = _.map(results, function (hit) {
                var _doc = new my.Record(hit);
                _doc.fields = self.fields;
                _doc.bind('change', function (doc) {
                    self._changes.updates.push(doc.toJSON());
                });
                _doc.bind('destroy', function (doc) {
                    self._changes.deletes.push(doc.toJSON());
                });
                return _doc;
            });


            self.records.reset(docs);

            if (facets) {
                var facets = _.map(facets, function (facetResult, facetId) {
                    facetResult.id = facetId;
                    var result = new my.Facet(facetResult);
                    recline.Data.ColorSchema.addColorsToTerms(facetId, result.attributes.terms, self.attributes.colorSchema);
                    recline.Data.ShapeSchema.addShapesToTerms(facetId, result.attributes.terms, self.attributes.shapeSchema);

                    return result;
                });
                self.facets.reset(facets);
            }

            self.trigger('query:done');
        },

        join:function () {
            var joinon = this.attributes.joinon;
            var joinType = this.attributes.joinType;
            var model = this.attributes.model;
            var joinModel = this.attributes.join;


            var results = [];

            _.each(model.getRecords(), function (r) {
                var filters = [];
                // creation of a filter on dataset2 based on dataset1 field value of joinon field


                var recordMustBeAdded = true;

                // define the record with all data from model
                var record = {};
                _.each(r.toJSON(), function (f, index) {
                    record[index] = f;
                });

                _.each(joinModel, function(p) {
                    // retrieve records from secondary model
                    _.each(p.joinon, function (f) {
                        var field = p.model.fields.get(f);
                        filters.push({field:field.id, type:"term", term:r.getFieldValueUnrendered(field), fieldType:field.attributes.type });
                    })

                    var resultsFromDataset2 = recline.Data.Filters.applyFiltersOnData(filters, p.model.records.toJSON(), p.model.fields.toJSON());

                    if(resultsFromDataset2.length == 0)
                        recordMustBeAdded = false;

                    _.each(resultsFromDataset2, function (res) {
                        _.each(res, function (field_value, index) {
                            record[p.id + "_" + index] = field_value;
                        })
                    })

                });

               if(joinType=="left" || recordMustBeAdded)
                    results.push(record);

            })


            return results;
        },

        getRecords:function () {
            return this.records.models;
        },

        getFields:function (type) {
            return this.fields;
        },

        toTemplateJSON:function () {
            var data = this.records.toJSON();
            data.recordCount = this.recordCount;
            data.fields = this.fields.toJSON();
            return data;
        },


        getFacetByFieldId:function (fieldId) {
            return _.find(this.facets.models, function (facet) {
                return facet.id == fieldId;
            });
        },

        setColorSchema:function () {
            var self = this;
            _.each(self.attributes.colorSchema, function (d) {
                var field = _.find(self.fields.models, function (f) {
                    return d.field === f.id
                });
                if (field != null)
                    field.attributes.colorSchema = d.schema;
            })
        },

        setShapeSchema:function () {
            var self = this;
            _.each(self.attributes.shapeSchema, function (d) {
                var field = _.find(self.fields.models, function (f) {
                    return d.field === f.id
                });
                if (field != null)
                    field.attributes.shapeSchema = d.schema;
            })
        },
        isFieldPartitioned:function (field) {
            return false
        }

    })


}(jQuery, this.recline.Model));

recline.Model.Query.prototype = $.extend(recline.Model.Query.prototype, {
    removeFilterByFieldNoEvent:function (field) {
        var filters = this.get('filters');
        for (var j in filters) {
            if (filters[j].field === field) {
                filters.splice(j, 1);
                this.set({filters:filters});
            }
        }
    }

});(function ($) {

    recline.Model.Dataset.prototype = $.extend(recline.Model.Dataset.prototype, {
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


    recline.Model.Record.prototype = $.extend(recline.Model.Record.prototype, {
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


    recline.Model.Field.prototype = $.extend(recline.Model.Field.prototype, {

        getColorForPartition:function () {

            if (!this.attributes.colorSchema)
                return null;

            if (this.attributes.is_partitioned)
                return this.attributes.colorSchema.getColorFor(this.attributes.partitionValue);

            return this.attributes.colorSchema.getColorFor(this.attributes.id);
        }
    });


}(jQuery));(function ($) {

    recline.Model.Dataset.prototype = $.extend(recline.Model.Dataset.prototype, {
            addCustomFilterLogic: function(f) {
            if(this.attributes.customFilterLogic)
                this.attributes.customFilterLogic.push(f);
            else
                this.attributes.customFilterLogic = [f];
        }
    });


}(jQuery));(function ($) {

    recline.Model.Dataset.prototype = $.extend(recline.Model.Dataset.prototype, {
        setShapeSchema:function () {
            var self = this;
            _.each(self.attributes.shapeSchema, function (d) {
                var field = _.find(self.fields.models, function (f) {
                    return d.field === f.id
                });
                if (field != null)
                    field.attributes.shapeSchema = d.schema;
            })
        }
    });


    recline.Model.Record.prototype = $.extend(recline.Model.Record.prototype, {
        getFieldShapeName:function (field) {
            if (!field.attributes.shapeSchema)
                return null;

            if (field.attributes.is_partitioned) {
                return field.attributes.shapeSchema.getShapeNameFor(field.attributes.partitionValue);
            }
            else
                return field.attributes.shapeSchema.getShapeNameFor(this.getFieldValueUnrendered(field));

        },

        getFieldShape:function (field, isSVG, isNode) {
            if (!field.attributes.shapeSchema)
                return recline.Template.Shapes["empty"](null, isNode, isSVG);

            var fieldValue;
            var fieldColor = this.getFieldColor(field);

            if (field.attributes.is_partitioned) {
                fieldValue = field.attributes.partitionValue;
            }
            else
                fieldValue = this.getFieldValueUnrendered(field);


            return field.attributes.shapeSchema.getShapeFor(fieldValue, fieldColor, isSVG, isNode);
        }
    });


}(jQuery));// # Recline Backbone Models
this.recline = this.recline || {};
this.recline.Model = this.recline.Model || {};
this.recline.Model.VirtualDataset = this.recline.Model.VirtualDataset || {};


(function ($, my) {

// ## <a id="dataset">VirtualDataset</a>
    my.VirtualDataset = Backbone.Model.extend({
        constructor:function VirtualDataset() {
            Backbone.Model.prototype.constructor.apply(this, arguments);
        },


        initialize:function () {
            _.bindAll(this, 'query');


            var self = this;
            this.backend = recline.Backend.Memory;
            this.fields = new my.FieldList();
            this.records = new my.RecordList();
            this.facets = new my.FacetList();
            this.recordCount = null;
            this.queryState = new my.Query();

            if (this.get('initialState')) {
                this.get('initialState').setState(this);
            }

            this.attributes.dataset.bind('query:done', function () {
                self.initializeCrossfilter();
            })

            //this.attributes.dataset.records.bind('add',     function() { self.initializeCrossfilter(); });
            //this.attributes.dataset.records.bind('reset',   function() { self.initializeCrossfilter(); });

            this.queryState.bind('change', function () {
                self.query();
            });
            this.queryState.bind('selection:change', function () {
                self.selection();
            });

            // dataset is already been fetched
            if (this.attributes.dataset.records.models.length > 0)
                self.initializeCrossfilter();

            // TODO verify if is better to use a new backend (crossfilter) to manage grouping and filtering instead of using it inside the model
            // TODO OPTIMIZATION use a structure for the reduce function that doesn't need any translation to records/arrays
            // TODO USE crossfilter as backend memory
        },

        getRecords:function (type) {
            var self = this;
            if(self.needsTableCalculation && self.totals == null)
                self.rebuildTotals();

            if (type === 'filtered' || type == null) {

                return self.records.models;
            } else if (type === 'totals') {

                return self.totals.records.models;
            } else if (type === 'totals_unfiltered') {
                if(self.totals_unfiltered == null)
                    self.rebuildUnfilteredTotals();

                return self.totals_unfiltered.records.models;
            } else {
                if (self._store.data == null) {
                    throw "VirtualModel: unable to retrieve not filtered data, store can't provide data. Use a backend that use memory store";
                }

                var docs = _.map(self._store.data, function (hit) {
                    var _doc = new my.Record(hit);
                    _doc.fields = self.fields;
                    return _doc;
                });

                return docs;
            }
        },

        getField_byAggregationFunction: function(resultType, fieldName, aggr) {
            var fields = this.getFields(resultType);
            return fields.get(fieldName + "_" + aggr);
        },


        getFields:function (type) {
            var self = this;

            if (type === 'filtered' || type == null) {
                return self.fields;
            } else if (type === 'totals') {
                if(self.totals == null)
                    self.rebuildTotals();

                return self.totals.fields;
            } else if (type === 'totals_unfiltered') {
                if(self.totals == null)
                    self.rebuildUnfilteredTotals();

                return self.totals_unfiltered.fields;
            } else {
                return self.fields;
            }
        },

        fetch: function() {
            this.initializeCrossfilter();
        },

        initializeCrossfilter:function () {
            var aggregatedFields = this.attributes.aggregation.measures;
            var aggregationFunctions = this.attributes.aggregation.aggregationFunctions;
            var originalFields = this.attributes.dataset.fields;
            var dimensions =  this.attributes.aggregation.dimensions;
            var partitions =this.attributes.aggregation.partitions;

            var crossfilterData = crossfilter(this.attributes.dataset.toFullJSON());
            var group = this.createDimensions(crossfilterData, dimensions);
            var results = this.reduce(group,dimensions,aggregatedFields,aggregationFunctions,partitions);



            this.updateStore(results, originalFields,dimensions,aggregationFunctions,aggregatedFields,partitions);
        },

        setDimensions:function (dimensions) {
            this.attributes.aggregation.dimensions = dimensions;
            this.trigger('dimensions:change');
        },

        setMeasures:function (measures) {
            this.attributes.aggregation.measures = measures;
            this.trigger('measures:change');
        },

        setTotalsMeasures: function(measures) {
            this.attributes.totals.measures = measures;
            this.trigger('totals:change');
        },

        getDimensions:function () {
            return this.attributes.aggregation.dimensions;
        },

        createDimensions:function (crossfilterData, dimensions) {
            var group;

            if (dimensions == null) {
                // need to evaluate aggregation function on all records
                group = crossfilterData.groupAll();
            }
            else {
                var by_dimension = crossfilterData.dimension(function (d) {
                    var tmp = "";
                    for (i = 0; i < dimensions.length; i++) {
                        if (i > 0) {
                            tmp = tmp + "#";
                        }

                        tmp = tmp + d[dimensions[i]].valueOf();
                    }
                    return tmp;
                });
                group = by_dimension.group();
            }

            return group;
        },

        reduce:function (group, dimensions, aggregatedFields, aggregationFunctions, partitions) {

            if (aggregationFunctions == null || aggregationFunctions.length == 0)
                throw("Error aggregationFunctions parameters is not set for virtual dataset ");


            var partitioning = false;
            var partitionFields = {};
            if (partitions != null) {
                var partitioning = true;
            }

            function addFunction(p, v) {
                p.count = p.count + 1;
                for (i = 0; i < aggregatedFields.length; i++) {

                    // for each aggregation function evaluate results
                    for (j = 0; j < aggregationFunctions.length; j++) {
                        var currentAggregationFunction = this.recline.Data.Aggregations.aggregationFunctions[aggregationFunctions[j]];

                        p[aggregationFunctions[j]][aggregatedFields[i]] =
                            currentAggregationFunction(
                                p[aggregationFunctions[j]][aggregatedFields[i]],
                                v[aggregatedFields[i]]);
                    }


                    if (partitioning) {
                        // for each partition need to verify if exist a value of aggregatefield_by_partition_partitionvalue
                        for (x = 0; x < partitions.length; x++) {
                            var partitionName = partitions[x];
                            var partitionValue = v[partitions[x]];
                            var aggregatedField = aggregatedFields[i];
                            var fieldName = aggregatedField + "_by_" + partitionName + "_" + partitionValue;


                            // for each aggregation function evaluate results
                            for (j = 0; j < aggregationFunctions.length; j++) {

                                if (partitionFields[aggregationFunctions[j]] == null)
                                    partitionFields[aggregationFunctions[j]] = {};

                                var currentAggregationFunction = this.recline.Data.Aggregations.aggregationFunctions[aggregationFunctions[j]];

                                if (p.partitions[aggregationFunctions[j]][fieldName] == null) {
                                    p.partitions[aggregationFunctions[j]][fieldName] = {
                                        value:null,
                                        partition:partitionValue,
                                        originalField:aggregatedField,
                                        aggregationFunction:currentAggregationFunction};

                                    // populate partitions description

                                    partitionFields[aggregationFunctions[j]][fieldName] = {
                                        field:partitionName,
                                        value:partitionValue,
                                        originalField:aggregatedField,
                                        aggregationFunction:currentAggregationFunction,
                                        aggregationFunctionName:aggregationFunctions[j],
                                        id:fieldName + "_" + aggregationFunctions[j]
                                    }; // i need partition name but also original field value
                                }
                                p.partitions[aggregationFunctions[j]][fieldName]["value"] =
                                    currentAggregationFunction(
                                        p.partitions[aggregationFunctions[j]][fieldName]["value"],
                                        v[aggregatedFields[i]]);
                            }

                            if (p.partitions.count[fieldName] == null) {
                                p.partitions.count[fieldName] = {
                                    value:1,
                                    partition:partitionValue,
                                    originalField:aggregatedField,
                                    aggregationFunction:"count"
                                };
                            }
                            else
                                p.partitions.count[fieldName]["value"] += 1;
                        }
                    }


                }
                return p;
            }

            function removeFunction(p, v) {
                throw "crossfilter reduce remove function not implemented";
            }

            function initializeFunction() {

                var tmp = {count:0};

                for (j = 0; j < aggregationFunctions.length; j++) {
                    tmp[aggregationFunctions[j]] = {};
                    this.recline.Data.Aggregations.initFunctions[aggregationFunctions[j]](tmp, aggregatedFields, partitions);
                }

                if (partitioning) {
                    tmp["partitions"] = {};
                    tmp["partitions"]["count"] = {};

                    for (j = 0; j < aggregationFunctions.length; j++) {
                        tmp["partitions"][aggregationFunctions[j]] = {};
                    }

                    /*_.each(partitions, function(p){
                     tmp.partitions.list[p] = 0;
                     });*/
                }

                return tmp;
            }

            var reducedGroup = group.reduce(addFunction, removeFunction, initializeFunction);

            var tmpResult;

            if (dimensions == null) {
                tmpResult = [reducedGroup.value()];
            }
            else {
                tmpResult = reducedGroup.all();
            }

            return {reducedResult:tmpResult,
                partitionFields:partitionFields};

        },

        updateStore:function (results, originalFields, dimensions, aggregationFunctions, aggregatedFields, partitions) {
            var self = this;

            var reducedResult = results.reducedResult;
            var partitionFields = results.partitionFields;
            this.partitionFields = partitionFields;

            var fields = self.buildFields(reducedResult, originalFields, partitionFields, dimensions, aggregationFunctions);
            var result = self.buildResult(reducedResult, originalFields, partitionFields, dimensions, aggregationFunctions, aggregatedFields, partitions);

            this._store = new recline.Backend.Memory.Store(result, fields);

            recline.Data.FieldsUtility.setFieldsAttributes(fields, self);
            this.fields.reset(fields, {renderer:recline.Data.Formatters.Renderers});
            this.clearUnfilteredTotals();

            this.query();

        },

        rebuildTotals: function() {
            this._rebuildTotals(this.records, this.fields, true);

        },
        rebuildUnfilteredTotals: function() {
            this._rebuildTotals(this._store.data, this.fields, false);
        },
        clearUnfilteredTotals: function() {
            this.totals_unfiltered = null;
           this.clearFilteredTotals();
        },
        clearFilteredTotals: function() {
            this.totals = null;
       },

        _rebuildTotals: function(records, originalFields, filtered) {
            /*
                totals: {
                    aggregationFunctions:["sum"],
                    aggregatedFields: ["fielda"]
                    }
            */
            var self=this;

            if(!self.attributes.totals)
                return;

            var aggregatedFields = self.attributes.totals.measures;
            var aggregationFunctions =  self.attributes.totals.aggregationFunctions;

            var rectmp;

            if(records.constructor == Array)
                rectmp = records;
            else
                rectmp = _.map(records.models, function(d) { return d.attributes;}) ;

            var crossfilterData =  crossfilter(rectmp);

            var group = this.createDimensions(crossfilterData, null);
            var results = this.reduce(group, null,aggregatedFields, aggregationFunctions, null);

            var fields = self.buildFields(results.reducedResult, originalFields, {}, null, aggregationFunctions);
            var result = self.buildResult(results.reducedResult, originalFields, {}, null, aggregationFunctions, aggregatedFields, null);

            // I need to apply table calculations
            var tableCalc = recline.Data.Aggregations.checkTableCalculation(self.attributes.aggregation.aggregationFunctions, self.attributes.totals);

                _.each(tableCalc, function(f) {
                    var p;
                    _.each(rectmp, function(r) {
                        p = recline.Data.Aggregations.tableCalculations[f](self.attributes.aggregation.measures, p, r, result[0]);
                    });
                });

            recline.Data.FieldsUtility.setFieldsAttributes(fields, self);

            if(filtered) {
                if(this.totals == null) { this.totals = {records: new my.RecordList(), fields: new my.FieldList() }}

                    this.totals.fields.reset(fields, {renderer:recline.Data.Formatters.Renderers}) ;
                    this.totals.records.reset(result);
            }   else   {
                if(this.totals_unfiltered == null) { this.totals_unfiltered = {records: new my.RecordList(), fields: new my.FieldList() }}

                    this.totals_unfiltered.fields.reset(fields, {renderer:recline.Data.Formatters.Renderers}) ;
                    this.totals_unfiltered.records.reset(result);
            }


        },

        needsTableCalculation: function() {
            if(recline.Data.Aggregations.checkTableCalculation(self.attributes.aggregation.aggregationFunctions, self.attributes.totals).length > 0)
                return true;
            else
                return false;
        },

        buildResult:function (reducedResult, originalFields, partitionFields, dimensions, aggregationFunctions, aggregatedFields, partitions) {

            var partitioning = false;

            if (partitions != null) {
                var partitioning = true;
            }

            var tmpField;
            if (dimensions == null) {
                tmpField = reducedResult;
            }
            else {
                if (reducedResult.length > 0) {
                    tmpField = reducedResult[0].value;
                }
                else
                    tmpField = {count:0};
            }

            var result = [];

            // set  results of dataset
            for (var i = 0; i < reducedResult.length; i++) {

                var currentField;
                var currentResult = reducedResult[i];
                var tmp;

                // if dimensions specified add dimension' fields
                if (dimensions != null) {
                    var keyField = reducedResult[i].key.split("#");

                    tmp = {dimension:currentResult.key, count:currentResult.value.count};

                    for (var j = 0; j < keyField.length; j++) {
                        var field = dimensions[j];
                        var originalFieldAttributes = originalFields.get(field).attributes;
                        var type = originalFieldAttributes.type;

                        var parse = recline.Data.FormattersMODA[type];
                        var value = parse(keyField[j]);

                        tmp[dimensions[j]] = value;
                    }
                    currentField = currentResult.value;

                }
                else {
                    currentField = currentResult;
                    tmp = {count:currentResult.count};
                }

                // add records foreach aggregation function
                for (var j = 0; j < aggregationFunctions.length; j++) {

                    // apply finalization function, was not applied since now
                    // todo verify if can be moved above
                    // note that finalization can't be applyed at init cause we don't know in advance wich partitions data are present


                    var tmpPartitionFields = [];
                    if (partitionFields[aggregationFunctions[j]] != null)
                        tmpPartitionFields = partitionFields[aggregationFunctions[j]];
                    recline.Data.Aggregations.finalizeFunctions[aggregationFunctions[j]](
                        currentField,
                        aggregatedFields,
                        _.keys(tmpPartitionFields));

                    var tempValue;


                    if (typeof currentField[aggregationFunctions[j]] == 'function')
                        tempValue = currentField[aggregationFunctions[j]]();
                    else
                        tempValue = currentField[aggregationFunctions[j]];


                    for (var x in tempValue) {

                        var tempValue2;
                        if (typeof tempValue[x] == 'function')
                            tempValue2 = tempValue[x]();
                        else
                            tempValue2 = tempValue[x];

                        tmp[x + "_" + aggregationFunctions[j]] = tempValue2;
                    }


                    // adding partition records
                    if (partitioning) {
                        var tempValue;
                        if (typeof currentField.partitions[aggregationFunctions[j]] == 'function')
                            tempValue = currentField.partitions[aggregationFunctions[j]]();
                        else
                            tempValue = currentField.partitions[aggregationFunctions[j]];

                        for (var x in tempValue) {
                            var tempValue2;
                            if (typeof currentField.partitions[aggregationFunctions[j]] == 'function')
                                tempValue2 = currentField.partitions[aggregationFunctions[j]]();
                            else
                                tempValue2 = currentField.partitions[aggregationFunctions[j]];

                            var fieldName = x + "_" + aggregationFunctions[j];

                            tmp[fieldName] = tempValue2[x].value;


                        }

                    }

                }

                // count is always calculated for each partition
                if (partitioning) {
                    for (var x in tmpField.partitions["count"]) {
                        if (currentResult.value.partitions["count"][x] == null)
                            tmp[x + "_count"] = 0;
                        else
                            tmp[x + "_count"] = currentResult.value.partitions["count"][x].value;
                    }
                }


                result.push(tmp);
            }

            return result;
        },

        buildFields:function (reducedResult, originalFields, partitionFields, dimensions, aggregationFunctions) {
            var self = this;

            var fields = [];

            var tmpField;
            if (dimensions == null ) {
                if(reducedResult.constructor != Array)
                    tmpField = reducedResult;
                else
                if (reducedResult.length > 0) {
                    tmpField = reducedResult[0];
                }
                else
                    tmpField = {count:0};
            }
            else {
                if (reducedResult.length > 0) {
                    tmpField = reducedResult[0].value;
                }
                else
                    tmpField = {count:0};
            }


            // creation of fields

            fields.push({id:"count", type:"integer"});

            // defining fields based on aggreagtion functions
            for (var j = 0; j < aggregationFunctions.length; j++) {

                var tempValue;
                if (typeof tmpField[aggregationFunctions[j]] == 'function')
                    tempValue = tmpField[aggregationFunctions[j]]();
                else
                    tempValue = tmpField[aggregationFunctions[j]];

                for (var x in tempValue) {

                    var originalFieldAttributes = originalFields.get(x).attributes;


                    var newType = recline.Data.Aggregations.resultingDataType[aggregationFunctions[j]](originalFieldAttributes.type);

                    fields.push({
                        id:x + "_" + aggregationFunctions[j],
                        type:newType,
                        is_partitioned:false,
                        colorSchema:originalFieldAttributes.colorSchema,
                        shapeSchema:originalFieldAttributes.shapeSchema,
                        originalField:x,
                        aggregationFunction:aggregationFunctions[j]
                    });
                }

                // add partition fields
                _.each(partitionFields, function (aggrFunction) {
                    _.each(aggrFunction, function (d) {
                        var originalFieldAttributes = originalFields.get(d.field).attributes;
                        var newType = recline.Data.Aggregations.resultingDataType[aggregationFunctions[j]](originalFieldAttributes.type);

                        var fieldId = d.id;
                        var fieldLabel = fieldId;

                        if (self.attributes.fieldLabelForPartitions) {
                            fieldLabel = self.attributes.fieldLabelForPartitions
                                .replace("{originalField}", d.originalField)
                                .replace("{partitionFieldName}", d.field)
                                .replace("{partitionFieldValue}", d.value)
                                .replace("{aggregatedFunction}", aggregationFunctions[j]);
                        }

                        fields.push({
                                id:fieldId,
                                type:newType,
                                is_partitioned:true,
                                partitionField:d.field,
                                partitionValue:d.value,
                                colorSchema:originalFieldAttributes.colorSchema, // the schema is the one used to specify partition
                                shapeSchema:originalFieldAttributes.shapeSchema,
                                originalField:d.originalField,
                                aggregationFunction:aggregationFunctions[j],
                                label:fieldLabel
                            }
                        );
                    })
                });

            }

            // adding all dimensions to field list
            if (dimensions != null) {
                fields.push({id:"dimension"});
                for (var i = 0; i < dimensions.length; i++) {
                    var originalFieldAttributes = originalFields.get(dimensions[i]).attributes;
                    fields.push({
                        id:dimensions[i],
                        type:originalFieldAttributes.type,
                        label:originalFieldAttributes.label,
                        format:originalFieldAttributes.format,
                        colorSchema:originalFieldAttributes.colorSchema,
                        shapeSchema:originalFieldAttributes.shapeSchema
                    });

                }
            }


            return fields;
        },

        query:function (queryObj) {

            var self = this;
            var dfd = $.Deferred();
            this.trigger('query:start');

            if (queryObj) {
                this.queryState.set(queryObj, {silent:true});
            }
            var actualQuery = this.queryState.toJSON();
            console.log("VModel [" + self.attributes.name + "] query [" + JSON.stringify(actualQuery) + "]");

            if (this._store == null) {
                console.log("Warning query called before data has been calculated for virtual model, call fetch on source dataset");
                return;
            }

            self.clearFilteredTotals();

            this._store.query(actualQuery, this.toJSON())
                .done(function (queryResult) {
                    self._handleQueryResult(queryResult);
                    self.trigger('query:done');
                    dfd.resolve(self.records);
                })
                .fail(function (arguments) {
                    self.trigger('query:fail', arguments);
                    dfd.reject(arguments);
                });
            return dfd.promise();
        },

        selection:function (queryObj) {
            var self = this;

            this.trigger('selection:start');

            if (queryObj) {
                self.queryState.set(queryObj, {silent:true});
            }
            var actualQuery = self.queryState


            // apply on current records
            // needed cause memory store is not mandatory
            recline.Data.Filters.applySelectionsOnData(self.queryState.get('selections'), self.records.models, self.fields);

            self.queryState.trigger('selection:done');

        },

        _handleQueryResult:function (queryResult) {
            var self = this;
            self.recordCount = queryResult.total;
            var docs = _.map(queryResult.hits, function (hit) {
                var _doc = new my.Record(hit);
                _doc.fields = self.fields;
                return _doc;
            });

                self.clearFilteredTotals();
                self.records.reset(docs);


            if (queryResult.facets) {
                var facets = _.map(queryResult.facets, function (facetResult, facetId) {
                    facetResult.id = facetId;
                    var result = new my.Facet(facetResult);

                    self.addColorsToTerms(facetId, result.attributes.terms);

                    return result;
                });
                self.facets.reset(facets);
            }


        },


        setColorSchema:function (type) {
            var self = this;
            _.each(self.attributes.colorSchema, function (d) {
                var field = _.find(self.getFields(type).models, function (f) {
                    return d.field === f.id
                });
                if (field != null)
                    field.attributes.colorSchema = d.schema;
            })
        },

        setShapeSchema:function (type) {
            var self = this;
            _.each(self.attributes.shapeSchema, function (d) {
                var field = _.find(self.getFields(type).models, function (f) {
                    return d.field === f.id
                });
                if (field != null)
                    field.attributes.shapeSchema = d.schema;
            })
        },

        addColorsToTerms:function (field, terms) {
            var self = this;
            _.each(terms, function (t) {

                // assignment of color schema to fields
                if (self.attributes.colorSchema) {
                    _.each(self.attributes.colorSchema, function (d) {
                        if (d.field === field)
                            t.color = d.schema.getColorFor(t.term);
                    })
                }
            });
        },

        getFacetByFieldId:function (fieldId) {
            return _.find(this.facets.models, function (facet) {
                return facet.id == fieldId;
            });
        },

        toTemplateJSON:function () {
            var data = this.records.toJSON();
            data.recordCount = this.recordCount;
            data.fields = this.fields.toJSON();
            return data;
        },

        // ### getFieldsSummary
        //
        // Get a summary for each field in the form of a `Facet`.
        //
        // @return null as this is async function. Provides deferred/promise interface.
        getFieldsSummary:function () {
            // TODO update function in order to manage facets/filter and selection

            var self = this;
            var query = new my.Query();
            query.set({size:0});

            var dfd = $.Deferred();
            this._store.query(query.toJSON(), this.toJSON()).done(function (queryResult) {
                if (queryResult.facets) {
                    _.each(queryResult.facets, function (facetResult, facetId) {
                        facetResult.id = facetId;
                        var facet = new my.Facet(facetResult);
                        // TODO: probably want replace rather than reset (i.e. just replace the facet with this id)
                        self.fields.get(facetId).facets.reset(facet);
                    });
                }
                dfd.resolve(queryResult);
            });
            return dfd.promise();
        },

        // Retrieve the list of partitioned field for the specified aggregated field
        getPartitionedFields:function (partitionedField, measureField) {
            //var field = this.fields.get(fieldName);

            var fields = _.filter(this.fields.models, function (d) {
                return (
                    d.attributes.partitionField == partitionedField
                        && d.attributes.originalField == measureField
                    );
            });

            if (fields == null)
                field = [];

            //fields.push(field);

            return fields;

        },

        isFieldPartitioned:function (fieldName, type) {
            return  this.getFields(type).get(fieldName).attributes.aggregationFunction
                && this.attributes.aggregation.partitions;
        },

        getPartitionedFieldsForAggregationFunction:function (aggregationFunction, aggregatedFieldName) {
            var self = this;
            var fields = [];

            _.each(self.partitionFields[aggregationFunction], function (p) {
                if (p.originalField == aggregatedFieldName)
                    fields.push(self.fields.get(p.id));
            });

            return fields;
        }

    });


}(jQuery, this.recline.Model));

this.recline = this.recline || {};

(function ($, my) {

    my.ActionUtility = {};


    my.ActionUtility.doAction = function (actions, eventType, eventData) {

        // find all actions configured for eventType
        var targetActions = _.filter(actions, function (d) {
            var tmpFound = _.find(d["event"], function (x) {
                return x == eventType
            });
            if (tmpFound != -1)
                return true;
            else
                return false;
        });

        // foreach action prepare field
        _.each(targetActions, function (currentAction) {
            var mapping = currentAction.mapping;
            var actionParameters = [];
            //foreach mapping set destination field
            _.each(mapping, function (map) {
                if (eventData[map["srcField"]] == null) {
                    console.log("warn: sourceField: [" + map["srcField"] + "] not present in event data");
                } else {


                    var param = {
                        filter:map["filter"],
                        value:eventData[map["srcField"]]
                    };
                    actionParameters.push(param);
                }
            });

            if (actionParameters.length > 0) {
                currentAction.action._internalDoAction(actionParameters);
            }
        });
    },

        my.ActionUtility.getActiveFilters = function (actions) {

            var activeFilters = [];
            _.each(actions, function (currentAction) {
                _.each(currentAction.mapping, function (map) {
                    var currentFilter = currentAction.action.getActiveFilters(map.filter, map.srcField);
                    if (currentFilter != null && currentFilter.length > 0)
                        activeFilters = _.union(activeFilters, currentFilter);
                })
            });

            return activeFilters;
        },

// ## <a id="dataset">Action</a>
        my.Action = Backbone.Model.extend({
            constructor:function Action() {
                Backbone.Model.prototype.constructor.apply(this, arguments);
            },

            initialize:function () {

            },

            doAction:function (records, mapping) {
                var params = [];
                mapping.forEach(function (mapp) {
                    var values = [];
                    //{srcField: "daydate", filter: "filter_daydate"}
                    records.forEach(function (row) {
                        values.push(row.getFieldValueUnrendered({id:mapp.srcField}));
                    });
                    params.push({
                        filter:mapp.filter,
                        value:values
                    });
                });
                this._internalDoAction(params);
            },

            doActionWithValues:function (valuesarray, mapping) {
                var params = [];
                mapping.forEach(function (mapp) {
                    var values = [];
                    //{srcField: "daydate", filter: "filter_daydate"}
                    _.each(valuesarray, function (row) {
                        if (row.field === mapp.srcField)
                            params.push({
                                filter:mapp.filter,
                                value:row.value
                            });
                    });

                });
                    this._internalDoAction(params);
            },


            // action could be add/remove
            _internalDoAction:function (data) {
                var self = this;

                var filters = this.attributes.filters;
                var models = this.attributes.models;
                var type = this.attributes.type;

                var targetFilters = [];

                //populate all filters with data received from event
                //foreach filter defined in data
                _.each(data, function (f) {
                    // filter creation
                    var currentFilter = filters[f.filter];
                    if (currentFilter == null) {
                        throw "Filter " + f.filter + " defined in actions data not configured for action ";
                    }
                    currentFilter["name"] = f.filter;
                    if (self.filters[currentFilter.type] == null)
                        throw "Filter not implemented for type " + currentFilter.type;

                    targetFilters.push(self.filters[currentFilter.type](currentFilter, f.value));

                });

                // foreach type and dataset add all filters and trigger events
                _.each(type, function (type) {
                    _.each(models, function (m) {

                        var modified = false;

                        _.each(targetFilters, function (f) {

                            // verify if filter is associated with current model
                            if (_.find(m.filters, function (x) {
                                return x == f.name;
                            }) != null) {
                                // if associated add the filter

                                self.modelsAddFilterActions[type](m.model, f);
                                modified = true;

                            }
                        });

                        if (modified) {
                            self.modelsTriggerActions[type](m.model);
                        }
                    });
                });


            },

            getActiveFilters:function (filterName, srcField) {
                var self = this;
                var models = this.attributes.models;
                var type = this.attributes.type;
                var filtersProp = this.attributes.filters;

                // for each type
                // foreach dataset
                // get filter
                // push to result, if already present error
                var foundFilters = [];

                _.each(type, function (type) {
                    _.each(models, function (m) {
                        var usedFilters = _.filter(m.filters, function (f) {
                            return f == filterName;
                        });
                        _.each(usedFilters, function (f) {
                            // search filter
                            var filter = filtersProp[f];
                            if (filter != null) {
                                var filterOnModel = self.modelsGetFilter[type](m.model, filter.field);
                                // substitution of fieldname with the one provided by source
                                if (filterOnModel != null) {
                                    filterOnModel.field = srcField;
                                    foundFilters.push(filterOnModel);
                                }
                            }
                        });
                    });
                });


                return foundFilters;
            },


            modelsGetFilter:{
                filter:function (model, fieldName) {
                    return model.queryState.getFilterByFieldName(fieldName);
                },
                selection:function (model, fieldName) {
                    throw "Action.js selection not implemented selection for modelsGetFilterActions"
                },
                sort:function (model, fieldName) {
                    throw "Action.js sort not implemented selection for modelsGetFilterActions"
                }
            },

            modelsAddFilterActions:{
                filter:function (model, filter) {
                    model.queryState.setFilter(filter)
                },
                selection:function (model, filter) {
                    model.queryState.setSelection(filter)
                },
                sort:function (model, filter) {
                    model.queryState.clearSortCondition();
                    model.queryState.setSortCondition(filter)
                }
            },


            modelsTriggerActions:{
                filter:function (model) {
                    model.queryState.trigger("change")
                },
                selection:function (model) {
                    model.queryState.trigger("selection:change")
                },
                sort:function (model) {
                    model.queryState.trigger("change")
                }
            },

            filters:{
                term:function (filter, data) {

                    if (data.length === 0) {
                        //empty list
                        filter["term"] = null;
                    } else if (data === null) {
                        //null list
                        filter["remove"] = true;
                    } else if (data.length === 1) {
                        filter["term"] = data[0];
                    } else {
                        throw "Data passed for filtertype term not valid. Data lenght should be 1 or empty but is " + data.length;
                    }

                    return filter;
                },
                range:function (filter, data) {

                    if (data.length === 0) {
                        //empty list
                        filter["start"] = null;
                        filter["stop"] = null;
                    } else if (data[0] === null || data[1] === null) {
                        //null list
                        filter["remove"] = true;
                    } else if (data.length === 2) {
                        filter["start"] = data[0];
                        filter["stop"] = data[1];
                    } else {
                        throw "Data passed for filtertype range not valid. Data lenght should be 2 but is " + data.length;
                    }

                    return filter;
                },
                list:function (filter, data) {

                    if (data.length === 0) {
                        //empty list
                        filter["list"] = null;
                    } else if (data === null) {
                        //null list
                        filter["remove"] = true;
                    } else {
                        filter["list"] = data;
                    }

                    return filter;
                },
                sort:function (sort, data) {

                    if (data.length === 0) {
                        sort = null;
                    } else if (data.length == 2) {
                        sort["field"] = data[0];
                        sort["order"] = data[1];
                    } else {
                        throw "Actions.js: invalid data length [" + data + "]";
                    }

                    return sort;
                }
            }




        })


}(jQuery, this.recline));
// # Recline Backbone Models
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

            if (dataset.dataset.isFieldPartitioned && dataset.dataset.isFieldPartitioned(dataset.field)) {
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
this.recline.Data = this.recline.Data || {};

(function(my) {
// adapted from https://github.com/harthur/costco. heather rules

my.Filters = {};

    // in place filtering (records.toJSON must be passed)
    my.Filters.applyFiltersOnData = function(filters, records, fields) {
        // filter records
        return _.filter(records, function (record) {
            var passes = _.map(filters, function (filter) {
            	return recline.Data.Filters._isNullFilter[filter.type](filter) || recline.Data.Filters._filterFunctions[filter.type](record, filter, fields);
            });

            // return only these records that pass all filters
            return _.all(passes, _.identity);
        });
    };

    // in place filtering  (records model must be used)
    my.Filters.applyFiltersOnRecords = function(filters, records, fields) {
        // filter records
        return _.filter(records.models, function (record) {
            var passes = _.map(filters, function (filter) {
                return recline.Data.Filters._isNullFilter[filter.type](filter) || recline.Data.Filters._filterFunctions[filter.type](record.toJSON(), filter, fields.toJSON());
            });

            // return only these records that pass all filters
            return _.all(passes, _.identity);
        });
    };

    // data should be {records:[model], fields:[model]}
    my.Filters.applySelectionsOnData = function(selections, records, fields) {
        _.each(records, function(currentRecord) {
            currentRecord.setRecordSelection(false);

            _.each(selections, function(sel) {
                if(!recline.Data.Filters._isNullFilter[sel.type](sel) &&
                	recline.Data.Filters._filterFunctions[sel.type](currentRecord.attributes, sel, fields)) {
                    currentRecord.setRecordSelection(true);
                }
            });
        });


    },

    my.Filters._getDataParser =  function(filter, fields) {

        var keyedFields = {};
        var tmpFields;
        if(fields.models)
            tmpFields = fields.models;
        else
            tmpFields = fields;

        _.each(tmpFields, function(field) {
            keyedFields[field.id] = field;
        });


        var field = keyedFields[filter.field];
        var fieldType = 'string';

        if(field == null) {
            throw "data.filters.js: Warning could not find field " + filter.field + " for dataset " ;
        }
        else {
            if(field.attributes)
                fieldType = field.attributes.type;
            else
                fieldType = field.type;
        }
        return recline.Data.Filters._dataParsers[fieldType];
    },
    
    my.Filters._isNullFilter = {
    	term: function(filter){
    		return filter["term"] == null;
    	},
    	
    	range: function(filter){
    		return (filter["start"]==null || filter["stop"] == null);
    		
    	},
    	
    	list: function(filter){
    		return filter["list"] == null;
    		
    	},
        termAdvanced: function(filter){
            return filter["term"] == null;
        }
    },

        // in place filtering
        this._applyFilters = function(results, queryObj) {
            var filters = queryObj.filters;
            // register filters
            var filterFunctions = {
                term         : term,
                range        : range,
                geo_distance : geo_distance
            };
            var dataParsers = {
                integer: function (e) { return parseFloat(e, 10); },
                'float': function (e) { return parseFloat(e, 10); },
                string : function (e) { return e.toString() },
                date   : function (e) { return new Date(e).valueOf() },
                datetime   : function (e) { return new Date(e).valueOf() }
            };
            var keyedFields = {};
            _.each(self.fields, function(field) {
                keyedFields[field.id] = field;
            });
            function getDataParser(filter) {
                var fieldType = keyedFields[filter.field].type || 'string';
                return dataParsers[fieldType];
            }

            // filter records
            return _.filter(results, function (record) {
                var passes = _.map(filters, function (filter) {
                    return filterFunctions[filter.type](record, filter);
                });

                // return only these records that pass all filters
                return _.all(passes, _.identity);
            });


        };

    my.Filters._filterFunctions = {
        term: function(record, filter, fields) {
			var parse = recline.Data.Filters._getDataParser(filter, fields);
            var value = parse(record[filter.field]);
            var term  = parse(filter.term);

            return (value === term);
        },

        range: function (record, filter, fields) {
            var startnull = (filter.start == null || filter.start === '');
            var stopnull = (filter.stop == null || filter.stop === '');
            var parse = recline.Data.Filters._getDataParser(filter, fields);
            var value = parse(record[filter.field]);
            var start = parse(filter.start);
            var stop  = parse(filter.stop);

            // if at least one end of range is set do not allow '' to get through
            // note that for strings '' <= {any-character} e.g. '' <= 'a'
            if ((!startnull || !stopnull) && value === '') {
                return false;
            }
            return ((startnull || value >= start) && (stopnull || value <= stop));

        },

        list: function (record, filter, fields) {

            var parse =  recline.Data.Filters._getDataParser(filter, fields);
            var value = parse(record[filter.field]);
            var list  = filter.list;
            _.each(list, function(data, index) {
                list[index] = parse(data);
            });

            return (_.contains(list, value));
        },

        termAdvanced: function(record, filter, fields) {
            var parse =  recline.Data.Filters._getDataParser(filter, fields);
            var value = parse(record[filter.field]);
            var term  = parse(filter.term);

            var operator = filter.operator;

            var operation = {
                ne: function(value, term) { return value !== term },
                eq: function(value, term) { return value === term },
                lt: function(value, term) { return value < term },
                lte: function(value, term) { return value <= term },
                gt: function(value, term) { return value > term },
                gte: function(value, term) { return value >= term },
                bw: function(value, term) { return _.contains(term, value) }
            };

            return operation[operator](value, term);
        }
    },

    my.Filters._dataParsers = {
            integer: function (e) { return parseFloat(e, 10); },
            float: function (e) { return parseFloat(e, 10); },
            string : function (e) { if(!e) return null; else return e.toString(); },
            date   : function (e) { return new Date(e).valueOf() },
            datetime   : function (e) { return new Date(e).valueOf()},
            number: function (e) { return parseFloat(e, 10); }
        };
}(this.recline.Data))
// # Recline Backbone Models
this.recline = this.recline || {};
this.recline.Data = this.recline.Data || {};
this.recline.Data.ShapeSchema = this.recline.Data.ShapeSchema || {};

(function($, my) {



    my.ShapeSchema = Backbone.Model.extend({
        constructor: function ShapeSchema() {
            Backbone.Model.prototype.constructor.apply(this, arguments);
        },

        // ### initialize
        initialize: function() {
            var self=this;


            if(this.attributes.data) {
                var data = this.attributes.data;
                self._generateLimits(data);
            } else if(this.attributes.dataset)
                { this.bindToDataset();}

        },

        bindToDataset: function() {
           var self=this;
            self.attributes.dataset.dataset.records.bind('reset',   function() { self._generateFromDataset(); });
            self.attributes.dataset.dataset.fields.bind('reset', function () {
                self.attributes.dataset.dataset.setShapeSchema(self.attributes.dataset.type);
            });

            if(self.attributes.dataset.dataset.records.models.length > 0) {
                self._generateFromDataset();
            }
        },


        setDataset: function(ds, field, type) {
            var self=this;
            self.attributes.dataset = {dataset: ds, field: field, type: type};
            if(!ds.attributes["shapeSchema"])
                ds.attributes["shapeSchema"] = [];

            ds.attributes["shapeSchema"].push({schema:self, field: field});

            ds.setShapeSchema(type);

            self.bindToDataset();
        },


        _generateFromDataset: function() {
            var self=this;
            var data =  this.getRecordsArray(self.attributes.dataset);
            self._generateLimits(data);

        },

        _generateLimits: function(data) {
            var self=this;
            var res = this.limits["distinct"](data);
            this.schema = {};
            for(var i=0;i<res.length;i++){
                this.schema[res[i]] = self.attributes.shapes[i];
            }
        },


        getShapeNameFor: function(fieldValue) {
            var self=this;
            if(this.schema == null)
                throw "data.shape.js: shape schema not yet initialized, datasource not fetched?"


            return  self._shapeName(fieldValue);
        },


        getShapeFor: function(fieldValue, fieldColor, isSVG, isNode) {
            var self=this;
            if(this.schema == null)
                throw "data.shape.js: shape schema not yet initialized, datasource not fetched?"

            if(!self.attributes.shapeType || self.attributes.shapeType == "svg") {
                var shape = recline.Template.Shapes[this._shapeName(fieldValue)];
                if(shape == null)
                    throw "data.shape.js: shape [" +  this._shapeName(fieldValue) + "] not defined in template.shapes";
                return  shape(fieldColor, isNode, isSVG);
            } else if( self.attributes.shapeType == "text") {
                return this._shapeName(this._shapeName(fieldValue));
            } else if( self.attributes.shapeType == "image") {
                return '<img src="' + this._shapeName(fieldValue) + '" class="shape_image">';
            } else {
                throw "data.shape.js: unsupported shapeType ["+ self.attributes.shapeType  +"]";
            }

        },

        _shapeName: function(fieldValue) {
            var self=this;

            // find the correct shape, limits must be ordered
            if(self.attributes.limitType && this.attributes.limitType == "fixedLimits") {
                var shape = self.attributes.shapes[0];


                for(var i=1;i<this.attributes.limits.length;i++) {
                    if(fieldValue >= this.attributes.limits[i-1]
                        && fieldValue < this.attributes.limits[i]) {
                        shape = self.attributes.shapes[i];
                        break;
                    }
                }

                return shape;
            } else
                return self.schema[recline.Data.Transform.getFieldHash(fieldValue)];
        },


        getRecordsArray: function(dataset) {
            var self=this;
            var ret = [];

            if(dataset.dataset.isFieldPartitioned && dataset.dataset.isFieldPartitioned(dataset.field, dataset.type))   {
                var fields = dataset.dataset.getPartitionedFields(dataset.field);
            _.each(dataset.dataset.getRecords(dataset.type), function(d) {
                _.each(fields, function (field) {
                    ret.push(d.attributes[field.id]);
                });
            });
            }
            else{
                var  fields = [dataset.field];;
                _.each(dataset.dataset.getRecords(dataset.type), function(d) {
                    _.each(fields, function (field) {
                        ret.push(d.attributes[field]);
                    });
                });
            }



            return ret;
        },



        limits: {
            distinct: function(data) {
                _.each(_.uniq(data), function(d, index) {
                    data[index]=recline.Data.Transform.getFieldHash(d);
                });
                return data;
            }

        }

    })

    my.ShapeSchema.addShapesToTerms = function (field, terms, shapeSchema) {
        _.each(terms, function (t) {

            // assignment of color schema to fields
            if (shapeSchema) {
                _.each(shapeSchema, function (d) {
                    if (d.field === field)
                        t.shape = d.schema.getShapeFor(t.term, t.color, false, false);
                })
            }
        });
    };

}(jQuery, this.recline.Data));
this.recline = this.recline || {};
this.recline.Backend = this.recline.Backend || {};
this.recline.Backend.Jsonp = this.recline.Backend.Jsonp || {};

(function ($, my) {
    my.__type__ = 'Jsonp';
    // Timeout for request (after this time if no response we error)
    // Needed because use JSONP so do not receive e.g. 500 errors
    my.timeout = 30000;

    // ## load
    //
    // Load data from a URL
    //
    // Returns array of field names and array of arrays for records

    //my.queryStateInMemory = new recline.Model.Query();
    //my.queryStateOnBackend = new recline.Model.Query();

    // todo has to be merged with query (part is in common)
    my.fetch = function (dataset) {

        console.log("Fetching data structure " + dataset.url);

        var data = {onlydesc:"true"};
        return requestJson(dataset, data);

    };

    my.query = function (queryObj, dataset) {

        //var tmpQueryStateInMemory = new recline.Model.Query();
        //var tmpQueryStateOnBackend = new recline.Model.Query();


        //if (dataset.inMemoryQueryFields == null && !queryObj.facets && !dataset.useMemoryStore) {
        //    dataset.useMemoryStore = [];
        //} else
        //    self.useMemoryStore = true;

        /*var filters = queryObj.filters;
         for (var i = 0; i < filters.length; i++) {
         // verify if filter is specified in inmemoryfields

         if (_.indexOf(dataset.inMemoryQueryFields, filters[i].field) == -1) {
         //console.log("filtering " + filters[i].field + " on backend");
         tmpQueryStateOnBackend.addFilter(filters[i]);
         }
         else {
         //console.log("filtering " + filters[i].field + " on memory");
         tmpQueryStateInMemory.addFilter(filters[i]);
         }
         }
         tmpQueryStateOnBackend.set({sort: queryObj.sort});
         tmpQueryStateInMemory.set({sort: queryObj.sort});

         var changedOnBackend = false;
         var changedOnMemory = false;
         var changedFacets = false;

         // verify if filters on backend are changed since last query
         if (self.firstFetchExecuted == null ||
         !_.isEqual(self.queryStateOnBackend.attributes.filters, tmpQueryStateOnBackend.attributes.filters) ||
         !_.isEqual(self.queryStateOnBackend.attributes.sort, tmpQueryStateOnBackend.attributes.sort)
         ) {
         self.queryStateOnBackend = tmpQueryStateOnBackend;
         changedOnBackend = true;
         self.firstFetchExecuted = true;
         }

         // verify if filters on memory are changed since last query
         if (dataset.inMemoryQueryFields && dataset.inMemoryQueryFields.length > 0
         && !_.isEqual(self.queryStateInMemory.attributes.filters, tmpQueryStateInMemory.attributes.filters)
         && !_.isEqual(self.queryStateInMemory.attributes.sort, tmpQueryStateInMemory.attributes.sort)
         ) {
         self.queryStateInMemory = tmpQueryStateInMemory;
         changedOnMemory = true;
         }

         // verify if facets are changed
         if (queryObj.facets && !_.isEqual(self.queryStateInMemory.attributes.facets, queryObj.facets)) {
         self.queryStateInMemory.attributes.facets = queryObj.facets;
         changedFacets = true;
         }
         */

        //if (changedOnBackend) {
        var data = buildRequestFromQuery(queryObj);
        console.log("Querying backend for ");
        console.log(data);
        return requestJson(dataset, data, queryObj);
        //}

        /*if (self.inMemoryStore == null) {
         throw "No memory store available for in memory query, execute initial load"
         }*/

        /*var dfd = $.Deferred();
         dfd.resolve(applyInMemoryFilters());
         return dfd.promise();
         */

    };

    function isArrayEquals(a, b) {
        return !(a < b || b < a);
    }

    ;


    function requestJson(dataset, data, queryObj) {
        var dfd = $.Deferred();

        var jqxhr = $.ajax({
            url:dataset.url,
            dataType:'jsonp',
            jsonpCallback:dataset.id,
            data:data,
            cache:true
        });

        _wrapInTimeout(jqxhr).done(function (results) {

            // verify if returned data is not an error
            if (results.results.length != 1 || results.results[0].status.code != 0) {
                console.log("Error in fetching data: " + results.results[0].status.message + " Statuscode:[" + results.results[0].status.code + "] AdditionalInfo:["+results.results[0].status.additionalInfo+"]");

                dfd.reject(results.results[0].status);
            } else
                dfd.resolve(_handleJsonResult(results.results[0].result, queryObj));

        })
            .fail(function (arguments) {
                dfd.reject(arguments);
            });

        return dfd.promise();

    }

    ;

    function _handleJsonResult(data, queryObj) {
            if (data.data == null) {
                return {
                    fields:_handleFieldDescription(data.description),
                    useMemoryStore:false
                }
            }
            else {
                var fields = _handleFieldDescription(data.description);
                var facets = recline.Data.Faceting.computeFacets(data.data, queryObj);

                return {
                    hits:_normalizeRecords(data.data, fields),
                    fields: fields,
                    facets: facets,
                    useMemoryStore:false,
                    total: data.data.length
                }
            }
        /*
         var self = this;
         var fields;
         if (data.description) {
         fields = _handleFieldDescription(data.description);
         //my.memoryFields = _handleFieldDescription(data.description);
         }

         // Im fetching only record description
         if (data.data == null) {
         return prepareReturnedData(data);
         }

         var result = data;
         */

        /*if (my.useMemoryStore) {
         // check if is the first time I use the memory store
         my.inMemoryStore = new recline.Backend.Memory.Store(result.data, _handleFieldDescription(result.description));
         my.data = my.inMemoryStore.data;
         return applyInMemoryFilters();

         }
         else {
         // no need to query on memory, return json data
         return prepareReturnedData(result);
         } */
        //return prepareReturnedData(result);
    }

    ;

    /*
     function applyInMemoryFilters() {
     var self=this;
     var tmpValue;

     my.inMemoryStore.query(my.queryStateInMemory.toJSON())
     .done(function (value) {
     tmpValue = value;
     tmpValue["fields"] = my.memoryFields;
     });


     return tmpValue;
     };
     */

    /*function prepareReturnedData(data) {

        if (data.hits == null)


            if (data.data == null) {

                return {
                    fields:my.memoryFields,
                    useMemoryStore:false
                }
            }
            else {

                return {
                    hits:_normalizeRecords(data.data, my.memoryFields),
                    fields:my.memoryFields,
                    useMemoryStore:false
                }
            }

        return data;
    }

    ;*/

    // convert each record in native format
    // todo verify if could cause performance problems
    function _normalizeRecords(records, fields) {

        _.each(fields, function (f) {
            if (f != "string")
                _.each(records, function (r) {
                    r[f.id] = recline.Data.FormattersMODA[f.type](r[f.id]);
                })
        });

        return records;

    }

    ;


    // todo should be in backend
    function getDate(temp) {
        var tmp = new Date();

        var dateStr = padStr(temp.getFullYear()) + "-" +
            padStr(1 + temp.getMonth()) + "-" +
            padStr(temp.getDate()) + " " +
            padStr(temp.getHours()) + ":" +
            padStr(temp.getMinutes()) + ":" +
            padStr(temp.getSeconds());
        return dateStr;
    }

    function padStr(i) {
        return (i < 10) ? "0" + i : "" + i;
    }


    function buildRequestFromQuery(queryObj) {

        var filters = queryObj.filters;
        var data = [];
        var multivsep = "~";


        // register filters
        var filterFunctions = {
            term:function term(filter) {
                var parse = dataParsers[filter.fieldType];
                var value = filter.field;
                var term = parse(filter.term);

                return (value + " eq " + term);
            }, // field = value
            termAdvanced:function termAdvanced(filter) {
                var parse = dataParsers[filter.fieldType];
                var value = filter.field;
                var term = parse(filter.term);
                var operator = filter.operator;

                return (value + " " + operator + " " + term);
            }, // field (operator) value
            range:function range(filter) {
                var parse = dataParsers[filter.fieldType];
                var value = filter.field;
                var start = parse(filter.start);
                var stop = parse(filter.stop);
                return (value + " lte " + stop + "," + value + " gte " + start);

            }, // field > start and field < end
            list:function list(filter) {
                var parse = dataParsers[filter.fieldType];
                var value = filter.field;
                var list = filter.list;

                var ret = value + " bw ";
                for (var i = 0; i < filter.list.length; i++) {
                    if (i > 0)
                        ret = ret + multivsep;

                    ret = ret + list[i];
                }

                return ret;

            }
        };

        var dataParsers = {
            number:function (e) {
                return parseFloat(e, 10);
            },
            string:function (e) {
                return e.toString()
            },
            date:function (e) {
                var tmp = new Date(e);
                //console.log("---> " + e  + " ---> "+ getDate(tmp)) ;
                return getDate(tmp);

                // return new Date(e).valueOf()
            },
            integer:function (e) {
                return parseInt(e);
            }
        };

        for (var i = 0; i < filters.length; i++) {
            data.push(filterFunctions[filters[i].type](filters[i]));
        }

        // build sort options
        var res = "";

        _.each(queryObj.sort, function (sortObj) {
            if (res.length > 0)
                res += ";"

            var fieldName = sortObj.field;
            res += fieldName;
            if (sortObj.order) {
                res += ":" + sortObj.order;
            }

        });


        // filters definitions


        var outdata = {};
        if (data.length > 0)
            outdata["filters"] = data.toString();

        if (res.length > 0)
            outdata["orderby"] = res;

        return outdata;

    }


    // ## _wrapInTimeout
    //
    // Convenience method providing a crude way to catch backend errors on JSONP calls.
    // Many of backends use JSONP and so will not get error messages and this is
    // a crude way to catch those errors.
    var _wrapInTimeout = function (ourFunction) {
        var dfd = $.Deferred();
        var timer = setTimeout(function () {
            dfd.reject({
                message:'Request Error: Backend did not respond after ' + (my.timeout / 1000) + ' seconds'
            });
        }, my.timeout);
        ourFunction.done(function (arguments) {
            clearTimeout(timer);
            dfd.resolve(arguments);
        })
            .fail(function (arguments) {
                clearTimeout(timer);
                dfd.reject(arguments);
            })
        ;
        return dfd.promise();
    }

    function _handleFieldDescription(description) {

        var dataMapping = {
            STRING:"string",
            DATE:"date",
            INTEGER:"integer",
            DOUBLE:"number"
        };


        var res = [];
        for (var k in description) {

            res.push({id:k, type:dataMapping[description[k]]});
        }

        return res;
    }


}(jQuery, this.recline.Backend.Jsonp));
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
                    throw "ComposedView: no facet present for groupby field [" + self.options.groupBy + "]. Define a facet on the model before view render";
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
                	template = templates.templateCondensed2;
                
                return {data:data, template:template, unrenderedValue: unrenderedValue, percentageMsg: "% of total: "};
            },
            percentageVariation:function (kpi, compare, templates, condensed) {
                var tmpField = new recline.Model.Field({type:"number", format:"percentage"});
                var unrenderedValue = (kpi-compare) / compare * 100;
                var data = recline.Data.Formatters.Renderers( unrenderedValue, tmpField);
                var template = templates.templatePercentage;
                if (condensed == true)
                	template = templates.templateCondensed2;

                return {data:data, template:template, unrenderedValue: unrenderedValue, percentageMsg: "% variation: "};
            },
            nocompare: function (kpi, compare, templates, condensed){
                var template = templates.templateBase;
                if (condensed == true)
                	template = templates.templateCondensed2;
            	
                return {data:null, template:template, unrenderedValue:null};
            }


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
	'<div class="indicator " style="width:100%;"> \
	    <div class="panel indicator_{{viewId}}" style="width:100%;"> \
    		<div id="indicator_{{viewId}}" class="indicator-container well" style="width:85%;"> \
    			<div style="width:100%;"> \
	                <div class="value-cell" style="float:left">{{value}}</div> \
					<div class="compareshape" style="float:right">{{{compareShape}}}</div> \
	                <div class="shape" style="float:right">{{{shape}}}</div> \
				</div> \
    			<div style="width:100%;padding-top:10px"><hr></div> \
                <div style="text-align:justify;width:100%;" class="title">{{{label}}}</div>\
			</div> \
	    </div> \
    </div>',
    templateCondensed2:
        '<style> \
        .round-border { \
    	    border: 1px solid #DDDDDD; \
    	    border-radius: 4px 4px 4px 4px; \
    		background-color: lightcyan; \
        } \
        .round-border-dark { \
    	    border: 1px solid #808080; \
    	    border-radius: 4px 4px 4px 4px; \
    		margin:3px; \
    		height: 30px; \
        } \
    	</style> \
        	<div class="indicator round-border-dark" > \
    	    <div class="panel indicator_{{viewId}}" > \
        		<div id="indicator_{{viewId}}" class="indicator-container" > \
        			<div class="round-border" style="float:left"> \
    					<div class="compareshape" style="float:left">{{{compareShape}}}</div> \
    	                <div class="shape" style="float:left">{{{shape}}}</div> \
        				<div class="value-cell" style="float:left">{{value}}</div> \
    				</div> \
                    <div style="text-align:justify;float:left" class="title">&nbsp;&nbsp;{{{label}}}</div>\
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
    </div> '
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
            	template = self.templates.templateCondensed2;            

            if (self.options.state.compareWith) {
                var compareWithRecord = self.model.getRecords(self.options.state.compareWith.type);

                if(compareWithRecord.length > 0) {
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
            }

            if (this.options.state.description)
                tmplData["description"] = this.options.state.description;
            
            if (compareValue && compareValue.percentageMsg)
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
        <div id="nvd3chart_{{viewId}}"><svg class="bstrap"></svg></div>\
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


            var stateData = _.extend({
                    group:null,
                    seriesNameField:[],
                    seriesValues:[],
                    colors:["#edc240", "#afd8f8", "#cb4b4b", "#4da74d", "#9440ed"],
                    graphType:"lineChart",
                    xLabel:"",
                    id:0



                },
                options.state
            );
            this.state = new recline.Model.ObjectState(stateData);


        },

        changeDimensions: function() {
            var self=this;
            self.state.attributes.group = self.model.getDimensions();
        },

        render:function () {
            var self = this;

            var tmplData = this.model.toTemplateJSON();
            tmplData["viewId"] = this.uid;

            delete this.chart;


            var htmls = Mustache.render(this.template, tmplData);
            $(this.el).html(htmls);
            this.$graph = this.el.find('.panel.nvd3graph_' + tmplData["viewId"]);
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

            var state = this.state;
            var seriesNVD3 = this.createSeriesNVD3();

            var graphType = this.state.get("graphType");

            var viewId = this.uid;

            var model = this.model;
            var state = this.state;
            var xLabel = this.state.get("xLabel");
            var yLabel = this.state.get("yLabel");


            nv.addGraph(function () {
                self.chart = self.getGraph[graphType](self);

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
                    .duration(500)
                    .call(self.chart);

                nv.utils.windowResize(self.graphResize);
                nv.utils.windowResize(self.graphResize);
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
            self.chart.update(); // calls original 'update' function
        },


        setAxis:function (axis, chart) {
            var self = this;

            var xLabel = self.state.get("xLabel");

            if (axis == "all" || axis == "x") {
                var xfield = self.model.fields.get(self.state.attributes.group);

                // set label
                if (xLabel == null || xLabel == "" || typeof xLabel == 'undefined')
                    xLabel = xfield.get('label');

                // set data format
                chart.xAxis
                    .axisLabel(xLabel)
                    .tickFormat(self.getFormatter[xfield.get('type')]);

            } else if (axis == "all" || axis == "y") {
                var yLabel = self.state.get("yLabel");

                if (yLabel == null || yLabel == "" || typeof yLabel == 'undefined')
                    yLabel = self.state.attributes.seriesValues.join("/");

                // todo yaxis format must be passed as prop
                chart.yAxis
                    .axisLabel(yLabel)
                    .tickFormat(d3.format('s'));
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
            "minmax":function () {
            },
            "trendlines":function () {
            }

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
            "multiBarHorizontalChart2":function (view) {
                var chart;
                if (view.chart != null)
                    chart = view.chart;
                else
                    chart = nv.models.multiBarHorizontalChart();
                
                // remove ticks on Y axis (NOTE Y axis ticks are on xAxis for this chart type)
                chart.xAxis.tickFormat(function (d) { return ''; });

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

                        view.doActions(actions, [record_min.min.record, record_max.max.record]);

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
            if(self.options.resultType !== null)
                resultType = self.options.resultType;

            var records = self.model.getRecords(resultType);  //self.model.records.models;

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
                    var y = doc.getFieldValueUnrendered(fieldValue);


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

                            var y = doc.getFieldValueUnrendered(yfield);
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

            return series;
        }


    });


})(jQuery, recline.View);

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

            this.options =options;


        },

        render:function () {
            console.log("View.Rickshaw: render");
            var self = this;

            var out = Mustache.render(this.template, this);
            this.el.html(out);


        },

        redraw:function () {
            var self = this;

            console.log("View.Rickshaw: redraw");

            if(self.graph)
                self.updateGraph();
            else
                self.renderGraph();

        },

        updateGraph: function() {
            var self=this;
            //self.graphOptions.series = this.createSeries();
            self.createSeries();

            self.graph.update();
            //self.graph.render();
        },

        renderGraph: function() {
            var self=this;
            this.graphOptions = {
                element: document.querySelector('#' + this.uid)
            };

            self.graphOptions = _.extend(self.graphOptions, self.options.state.options);
            self.createSeries();

            self.graphOptions.series = self.series;

            self.graph = new Rickshaw.Graph(self.graphOptions);

            if(self.options.state.unstack) {
                self.graph .renderer.unstack = true;
            }


            self.graph.render();

            var hoverDetailOpt = { graph: self.graph };
            hoverDetailOpt = _.extend(hoverDetailOpt, self.options.state.hoverDetailOpt);



            var hoverDetail = new Rickshaw.Graph.HoverDetail(hoverDetailOpt);

            var xAxisOpt = { graph: self.graph };
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
                    if(endField)
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

        createSeries:function () {

            var self = this;
            if(!self.series)
                self.series = [];
            else
                self.series.length = 0; // keep reference to old serie

            var series = self.series;

            //  {type: "byFieldName", fieldvaluesField: ["y", "z"]}
            var seriesAttr = this.options.state.series;

            var fillEmptyValuesWith = seriesAttr.fillEmptyValuesWith;

            var unselectedColor = "#C0C0C0";
            if (self.options.state.unselectedColor)
                unselectedColor = self.options.state.unselectedColor;
            var selectionActive = false;
            if (self.model.queryState.isSelected())
                selectionActive = true;

            var resultType = "filtered";
            if (self.options.resultType !== null)
                resultType = self.options.resultType;

            var records = self.model.getRecords(resultType);  //self.model.records.models;

            var xfield = self.model.fields.get(self.options.state.group);


            var uniqueX = [];
            var sizeField;
            if (seriesAttr.sizeField) {
                sizeField = self.model.fields.get(seriesAttr.sizeField);
            }


            // series are calculated on data, data should be analyzed in order to create series
            if (seriesAttr.type == "byFieldValue") {
                var seriesTmp = {};
                var seriesNameField = self.model.fields.get(seriesAttr.seriesField);
                var fieldValue = self.model.fields.get(seriesAttr.valuesField);


                if(!fieldValue) {
                    throw "view.rickshaw: unable to find field ["+seriesAttr.valuesField+"] in model"
                }


                _.each(records, function (doc, index) {

                    // key is the field that identiy the value that "build" series
                    var key = doc.getFieldValueUnrendered(seriesNameField);
                    var tmpS;

                    // verify if the serie is already been initialized
                    if (seriesTmp[key] != null) {
                        tmpS = seriesTmp[key]
                    }
                    else {
                        tmpS = {name:key, data:[], field: fieldValue};

                        var color = doc.getFieldColor(seriesNameField);


                        if (color != null)
                            tmpS["color"] = color;


                    }
                    var shape = doc.getFieldShapeName(seriesNameField);

                    var x =  Math.floor(doc.getFieldValueUnrendered(xfield) / 1000); // rickshaw don't use millis
                    var x_formatted = doc.getFieldValue(xfield);
                    var y = doc.getFieldValueUnrendered(fieldValue);
                    var y_formatted = doc.getFieldValue(fieldValue);


                    var point = {x:x, y:y, record:doc, y_formatted: y_formatted, x_formatted: x_formatted};
                    if (sizeField)
                        point["size"] = doc.getFieldValueUnrendered(sizeField);
                    if (shape != null)
                        point["shape"] = shape;

                    tmpS.data.push(point);

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
                if (seriesAttr.type == "byFieldName") {
                    serieNames = seriesAttr.valuesField;
                }
                else {
                    serieNames = [];
                    _.each(seriesAttr.aggregationFunctions, function (a) {
                        _.each(self.model.getPartitionedFieldsForAggregationFunction(a, seriesAttr.aggregatedField), function (f) {
                            serieNames.push(f.get("id"));
                        })

                    });

                }

                _.each(serieNames, function (field) {

                    var yfield;
                    if(seriesAttr.type == "byFieldName")
                        yfield = self.model.fields.get(field.fieldName);
                    else
                        yfield = self.model.fields.get(field);

                    var fixedColor;
                    if(field.fieldColor)
                        fixedColor =field.fieldColor;

                    var points = [];

                    _.each(records, function (doc, index) {
                        var x           =  Math.floor(doc.getFieldValueUnrendered(xfield) / 1000); // rickshaw don't use millis
                        var x_formatted =  doc.getFieldValue(xfield); // rickshaw don't use millis


                        try {

                            var y = doc.getFieldValueUnrendered(yfield);
                            var y_formatted = doc.getFieldValue(yfield);

                            if (y != null) {
                                var color;

                                var calculatedColor = doc.getFieldColor(yfield);

                                if (selectionActive) {
                                    if (doc.isRecordSelected())
                                        color =calculatedColor;
                                    else
                                        color = unselectedColor;
                                } else
                                    color = calculatedColor;

                                var shape = doc.getFieldShapeName(yfield);

                                var point = {x:x, y:y, record:doc, y_formatted: y_formatted, x_formatted: x_formatted};

                                if (color != null)
                                    point["color"] = color;
                                if (shape != null)
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

                    if (points.length > 0)  {
                        var color;
                            if(fixedColor)
                                color = fixedColor;
                        else
                                color = yfield.getColorForPartition();
                        var ret = {data:points, name:self.getFieldLabel(yfield)};
                        if(color)
                            ret["color"] = color;
                        series.push(ret);
                    }

                });

            } else throw "views.rickshaw.graph.js: unsupported or not defined type " + seriesAttr.type;

            // foreach series fill empty values
            if (fillEmptyValuesWith != null) {
                uniqueX = _.unique(uniqueX);
                _.each(series, function (s) {
                    // foreach series obtain the unique list of x
                    var tmpValues = _.map(s.data, function (d) {
                        return d.x
                    });
                    // foreach non present field set the value
                    _.each(_.difference(uniqueX, tmpValues), function (diff) {
                        s.data.push({x:diff, y:fillEmptyValuesWith});
                    });

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
})(jQuery, recline.View);this.recline = this.recline || {};
this.recline.View = this.recline.View || {};

(function ($, view) {

    "use strict";

    view.D3Bullet = Backbone.View.extend({
        template: '<div id="{{uid}}" style="width: {{width}}px; height: {{height}}px;"> <div> ',
        firstResizeDone: false,
        initialize:function (options) {

            this.el = $(this.el);
            _.bindAll(this, 'render', 'redraw', 'resize');

            this.model.bind('change', this.render);
            this.model.fields.bind('reset', this.render);
            this.model.fields.bind('add', this.render);

            this.model.bind('query:done', this.redraw);
            this.model.queryState.bind('selection:done', this.redraw);

        	$(window).resize(this.resize);
            this.uid = options.id || ("d3_" + new Date().getTime() + Math.floor(Math.random() * 10000)); // generating an unique id for the chart
            if (options.width)
            	this.width = options.width;
            else this.width = "100"
            if (options.height)
            	this.height = options.height;
            else this.height = "100"
            	
            if (!this.options.animation) {
                this.options.animation = {
                    duration:2000,
                    delay:200
                }
            }

            //render header & svg container
            var out = Mustache.render(this.template, this);
            this.el.html(out);
        },

        resize:function () {
        	this.firstResizeDone = true;
//        	console.log($("#"+this.uid))
        	var currH = $("#"+this.uid).height()
        	var currW = $("#"+this.uid).width()
        	var $parent = this.el
        	var newH = $parent.height()
        	var newW = $parent.width()
//        	console.log("Resize from W"+currW+" H"+currH+" to W"+newW+" H"+newH)
        	if (typeof this.options.width == "undefined")
    		{
            	$("#"+this.uid).width(newW)
            	this.width = newW
    		}
        	if (typeof this.options.height == "undefined")
    		{
	        	$("#"+this.uid).height(newH)
	        	this.height = newH
    		}
        	this.redraw();
        },

        render:function () {
            var self = this;
            var graphid = "#" + this.uid;

            if (self.graph)
                jQuery(graphid).empty();

            self.graph = d3.select(graphid);
            
            if (!self.firstResizeDone)
        	{
            	// bruttissimo! ogni resize avvicina alla dimensione desiderata
            	self.resize();
            	self.resize();
	        	self.resize();
	        	self.resize();
	        	self.resize();
        	}
        },

        redraw:function () {
                var self = this;
            var field = this.model.fields.get(this.options.fieldRanges);
            var fieldMeasure = this.model.fields.get(this.options.fieldMeasures);

            var type;
            if(this.options.resultType) {
                type = this.options.resultType;
            }

            var records = _.map(this.options.model.getRecords(type), function (record) {
                var ranges = [];
                _.each(self.options.fieldRanges, function (f) {
                    var field = self.model.fields.get(f);
                    ranges.push(record.getFieldValueUnrendered(field));
                });
                var measures = [];
                _.each(self.options.fieldMeasures, function (f) {
                    var field = self.model.fields.get(f);
                    measures.push(record.getFieldValueUnrendered(field));
                });
                var markers = [];
                _.each(self.options.fieldMarkers, function (f) {
                    var field = self.model.fields.get(f);
                    markers.push(record.getFieldValueUnrendered(field));
                });
                return {ranges:ranges, measures:measures, markers: markers};
            });

            var margin = {top: 5, right: 40, bottom: 40, left: 40};
            var width = self.width - margin.left - margin.right;
            var height = self.height - margin.top - margin.bottom;

            self.plugin();

            this.chart = d3.bullet()
                .width(width)
                .height(height);

            this.drawD3(records, width, height, margin);
        },

        drawD3:function (data, width, height, margin) {
            var self = this;

            self.graph
                .selectAll(".bullet")
                .remove();

            self.graph.selectAll(".bullet")
                .data(data)
                .enter().append("svg")
                .attr("class", "bullet")
                .attr("width", width + margin.left + margin.right)
                .attr("height", height + margin.top + margin.bottom)
                .append("g")
                .attr("transform", "translate(" + margin.left + "," + margin.top + ")")
                .call(self.chart);

            self.alreadyDrawed = true

            /*var title = svg.append("g")
             .style("text-anchor", "end")
             .attr("transform", "translate(-6," + height / 2 + ")");

             title.append("text")
             .attr("class", "title")
             .text(function(d) { return d.title; });

             title.append("text")
             .attr("class", "subtitle")
             .attr("dy", "1em")
             .text(function(d) { return d.subtitle; });
              */
        },
        plugin:function () {
            d3.bullet = function () {
                var orient = "left", // TODO top & bottom
                    reverse = false,
                    duration = 0,
                    ranges = bulletRanges,
                    markers = bulletMarkers,
                    measures = bulletMeasures,
                    width = 380,
                    height = 30,
                    tickFormat = null;

                // For each small multiple…
                function bullet(g) {
                    g.each(function (d, i) {
                        var rangez = ranges.call(this, d, i).slice().sort(d3.descending),
                            markerz = markers.call(this, d, i).slice().sort(d3.descending),
                            measurez = measures.call(this, d, i).slice().sort(d3.descending),
                            g = d3.select(this);

                        // Compute the new x-scale.
                        var x1 = d3.scale.linear()
                            .domain([0, Math.max(rangez[0], markerz[0], measurez[0])])
                            .range(reverse ? [width, 0] : [0, width]);

                        // Retrieve the old x-scale, if this is an update.
                        var x0 = this.__chart__ || d3.scale.linear()
                            .domain([0, Infinity])
                            .range(x1.range());

                        // Stash the new scale.
                        this.__chart__ = x1;

                        // Derive width-scales from the x-scales.
                        var w0 = bulletWidth(x0),
                            w1 = bulletWidth(x1);

                        // Update the range rects.
                        var range = g.selectAll("rect.range")
                            .data(rangez);

                        range.enter().append("rect")
                            .attr("class", function (d, i) {
                                return "range s" + i;
                            })
                            .attr("width", w0)
                            .attr("height", height)
                            .attr("x", reverse ? x0 : 0)
                            .transition()
                            .duration(duration)
                            .attr("width", w1)
                            .attr("x", reverse ? x1 : 0);

                        range.transition()
                            .duration(duration)
                            .attr("x", reverse ? x1 : 0)
                            .attr("width", w1)
                            .attr("height", height);

                        // Update the measure rects.
                        var measure = g.selectAll("rect.measure")
                            .data(measurez);

                        measure.enter().append("rect")
                            .attr("class", function (d, i) {
                                return "measure s" + i;
                            })
                            .attr("width", w0)
                            .attr("height", height / 3)
                            .attr("x", reverse ? x0 : 0)
                            .attr("y", height / 3)
                            .transition()
                            .duration(duration)
                            .attr("width", w1)
                            .attr("x", reverse ? x1 : 0);

                        measure.transition()
                            .duration(duration)
                            .attr("width", w1)
                            .attr("height", height / 3)
                            .attr("x", reverse ? x1 : 0)
                            .attr("y", height / 3);

                        // Update the marker lines.
                        var marker = g.selectAll("line.marker")
                            .data(markerz);

                        marker.enter().append("line")
                            .attr("class", "marker")
                            .attr("x1", x0)
                            .attr("x2", x0)
                            .attr("y1", height / 6)
                            .attr("y2", height * 5 / 6)
                            .transition()
                            .duration(duration)
                            .attr("x1", x1)
                            .attr("x2", x1);

                        marker.transition()
                            .duration(duration)
                            .attr("x1", x1)
                            .attr("x2", x1)
                            .attr("y1", height / 6)
                            .attr("y2", height * 5 / 6);

                        // Compute the tick format.
                        var format = tickFormat || x1.tickFormat(8);

                        // Update the tick groups.
                        var tick = g.selectAll("g.tick")
                            .data(x1.ticks(8), function (d) {
                                return this.textContent || format(d);
                            });

                        // Initialize the ticks with the old scale, x0.
                        var tickEnter = tick.enter().append("g")
                            .attr("class", "tick")
                            .attr("transform", bulletTranslate(x0))
                            .style("opacity", 1e-6);

                        tickEnter.append("line")
                            .attr("y1", height)
                            .attr("y2", height * 7 / 6);

                        tickEnter.append("text")
                            .attr("text-anchor", "middle")
                            .attr("dy", "1em")
                            .attr("y", height * 7 / 6)
                            .text(format);

                        // Transition the entering ticks to the new scale, x1.
                        tickEnter.transition()
                            .duration(duration)
                            .attr("transform", bulletTranslate(x1))
                            .style("opacity", 1);

                        // Transition the updating ticks to the new scale, x1.
                        var tickUpdate = tick.transition()
                            .duration(duration)
                            .attr("transform", bulletTranslate(x1))
                            .style("opacity", 1);

                        tickUpdate.select("line")
                            .attr("y1", height)
                            .attr("y2", height * 7 / 6);

                        tickUpdate.select("text")
                            .attr("y", height * 7 / 6);

                        // Transition the exiting ticks to the new scale, x1.
                        tick.exit().transition()
                            .duration(duration)
                            .attr("transform", bulletTranslate(x1))
                            .style("opacity", 1e-6)
                            .remove();
                    });
                    d3.timer.flush();
                }

                // left, right, top, bottom
                bullet.orient = function (x) {
                    if (!arguments.length) return orient;
                    orient = x;
                    reverse = orient == "right" || orient == "bottom";
                    return bullet;
                };

                // ranges (bad, satisfactory, good)
                bullet.ranges = function (x) {
                    if (!arguments.length) return ranges;
                    ranges = x;
                    return bullet;
                };

                // markers (previous, goal)
                bullet.markers = function (x) {
                    if (!arguments.length) return markers;
                    markers = x;
                    return bullet;
                };

                // measures (actual, forecast)
                bullet.measures = function (x) {
                    if (!arguments.length) return measures;
                    measures = x;
                    return bullet;
                };

                bullet.width = function (x) {
                    if (!arguments.length) return width;
                    width = x;
                    return bullet;
                };

                bullet.height = function (x) {
                    if (!arguments.length) return height;
                    height = x;
                    return bullet;
                };

                bullet.tickFormat = function (x) {
                    if (!arguments.length) return tickFormat;
                    tickFormat = x;
                    return bullet;
                };

                bullet.duration = function (x) {
                    if (!arguments.length) return duration;
                    duration = x;
                    return bullet;
                };

                return bullet;
            };

            function bulletRanges(d) {
                return d.ranges;
            }

            function bulletMarkers(d) {
                return d.markers;
            }

            function bulletMeasures(d) {
                return d.measures;
            }

            function bulletTranslate(x) {
                return function (d) {
                    return "translate(" + x(d) + ",0)";
                };
            }

            function bulletWidth(x) {
                var x0 = x(0);
                return function (d) {
                    return Math.abs(x(d) - x0);
                };
            }
        }




    });


})(jQuery, recline.View);this.recline = this.recline || {};
this.recline.View = this.recline.View || {};

(function ($, view) {
	
	"use strict";

    view.D3Sparkline = Backbone.View.extend({
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
            this.width = options.width;
            this.height = options.height;

            if(!this.options.animation) {
                this.options.animation = {
                    duration: 2000,
                    delay: 200
                }
            }

            //render header & svg container
            var out = Mustache.render(this.template, this);
            this.el.html(out);

        },
        
        resize: function(){

        },

        render: function () {
            var self=this;
            var graphid="#" + this.uid;

            if(self.graph)
                jQuery(graphid).empty();

            self.graph = d3.select(graphid)
                .append("svg:svg")
                .attr("width", "100%")
                .attr("height", "100%")
                .style("stroke", function() { return self.options.color || "steelblue"; })
                .style("stroke-width", 1)
                .style("fill", "none");
        },

        redraw: function () {     
            console.log("redraw");
            var field = this.model.fields.get(this.options.field);
            var records = _.map(this.options.model.getRecords(this.options.resultType.type), function(record) {
                return record.getFieldValueUnrendered(field);
            });



            this.drawD3(records, "#" + this.uid);
        },
        drawD3: function(data, graphid) {
            var self=this;


                // X scale will fit values from 0-10 within pixels 0-100
            var x = d3.scale.linear().domain([0, data.length]).range([0, this.width]);
            // Y scale will fit values from 0-10 within pixels 0-100
            var y = d3.scale.linear().domain([_.min(data), _.max(data)]).range([0, this.height]);

            // create a line object that represents the SVN line we're creating
            var line = d3.svg.line()
                // assign the X function to plot our line as we wish
                .x(function(d,i) {
                    // verbose logging to show what's actually being done
                    //console.log('Plotting X value for data point: ' + d + ' using index: ' + i + ' to be at: ' + x(i) + ' using our xScale.');
                    // return the X coordinate where we want to plot this datapoint
                    return x(i);
                })
                .y(function(d) {
                    // verbose logging to show what's actually being done
                    //console.log('Plotting Y value for data point: ' + d + ' to be at: ' + y(d) + " using our yScale.");
                    // return the Y coordinate where we want to plot this datapoint
                    return y(d);
                })


            // display the line by appending an svg:path element with the data line we created above
            if(self.alreadyDrawed)
                self.graph.select("path").transition().duration(self.options.animation.duration).delay(self.options.animation.delay).attr("d", line(data));
            else
                self.graph.append("svg:path").attr("d", line(data));

            self.alreadyDrawed = true;
        }

    });
})(jQuery, recline.View);this.recline = this.recline || {};
this.recline.View = this.recline.View || {};

(function ($, view) {
	
	"use strict";	

	var fetchRecordValue = function(record, dimension){
		var val = null;		
		dimension.fields.forEach(function(field, i){
			if(i==0) val = record.getFieldValue(field);
			else val+= record.getFieldValue(field);
		});
		return val;
	};

	var frv = fetchRecordValue;
	
	var rowClick = function(actions, activeRecords){
				
		return function(row){
			if(actions.length && row){
				//console.log("rowClick");	
						
				var ctrlKey = d3.event.ctrlKey;
				var adding = !d3.select(d3.event.target.parentNode).classed("info");

				if(adding){
					if(ctrlKey){
						activeRecords.push(row);
					}else{
						activeRecords = [row];
					}
				}else{
					if(ctrlKey){
						activeRecords = _.difference(activeRecords, [row]);
					}else{
						activeRecords = [];
					}
				}
				
				actions.forEach(function(actioncontainer){				
					actioncontainer.action.doAction(activeRecords, actioncontainer.mapping);
				});
								
				
			}		
		};
	};
	
	var rowOver = function(actions,activeRecords){
		return function(row){
			if(actions.length && row){
                activeRecords = [];
                activeRecords.push(row);

                actions.forEach(function(actioncontainer){
                    actioncontainer.action.doAction(activeRecords, actioncontainer.mapping);
                });
			}
		};		
	};
	
	var scrollBarWidth = function(){
		  document.body.style.overflow = 'hidden'; 
		  var width = document.body.clientWidth;
		  document.body.style.overflow = 'scroll'; 
		  width -= document.body.clientWidth; 
		  if(!width) width = document.body.offsetWidth - document.body.clientWidth;
		  document.body.style.overflow = ''; 
		  return width; 
	};

	var sort=function(rowHeight, tableId) {
	    return function (dimension) {
	        var dimensionName = dimension.fields[0].id,
	            descending = d3.select(this)
	                .classed("g-ascending");

	        d3.selectAll(".g-descending")
	            .classed("g-descending", false);
	        d3.selectAll(".g-ascending")
	            .classed("g-ascending", false);

	        if (!descending) {
	            d3.select(this)
	                .classed("g-ascending", true);
	            var orderQuantitative = function (a, b) {
	                return (isNaN(frv(a, dimension)) - isNaN(frv(b, dimension))) || (frv(a, dimension) - frv(b, dimension)) || (a.index - b.index);
	            };

	            var orderName = function (a, b) {
	                return b.name.localeCompare(a.name);
	            };
	        } else {
	            d3.select(this)
	                .classed("g-descending", true);

	            var orderQuantitative = function (a, b) {
	                return (isNaN(frv(b, dimension)) - isNaN(frv(a, dimension))) || (frv(b, dimension) - frv(a, dimension)) || (b.index - a.index);
	            };

	            var orderName = function (a, b) {
	                return a.name.localeCompare(b.name);
	            };
	        }

	        d3.selectAll("#"+tableId+" .g-tbody .g-tr")
	            .sort(dimensionName === "name" ? orderName : orderQuantitative)
	            .each(function (record, i) {
	            record.index = i;
	        })
	            .transition()
	            .delay(function (record, i) {
	            return (i - 1) * 10;
	        })
	            .duration(750)
	            .attr("transform", function (record, i) {
	            return "translate(0," + i * rowHeight + ")";
	        });
	    }
	};
	
	var computeWidth=function(view){		
		var tbodycontainer =  d3.select('#'+view.graphId+' .g-tbody-container');
		var thead = view.el.find('.g-thead');
		var tbody = d3.select('#'+view.graphId +' .g-tbody');
		var tfoot = d3.select('#'+view.graphId +' .g-tfoot');
		
		var translationAcc = 0;
		var translationRectAcc = 0;
		
		return d3.sum(view.columns, function(column, i){
            	var th = thead.find('.g-th:nth-child('+(i+1)+')');
            	column.padding_left = parseInt(th.css("padding-left").replace("px", ""));
                column.padding_right = parseInt(th.css("padding-right").replace("px", ""));
                column.computed_width = th.outerWidth(true);               

				column.fields.forEach(function (field, fieldI) {
					field.width = column.width;
					field.computed_width = column.computed_width;					
				});
	           
				var transl = translationAcc;
				translationAcc += column.computed_width;
				column.translation = transl;
				
				if (column.scale) {
                	var scale = column.scale(view.model.records.models, column.computed_width, (column.range || 1.0));
                    //dimension.scale = scale.scale; //mantain the orginal function
                    column.d3scale = scale.scale;
                    column.axisScale = scale.axisScale;
                    column.fields.forEach(function (field, i) {
                        field.scale = column.d3scale;
                        field.axisScale = column.axisScale[field.id];
                    });
                }
						
            	return column.computed_width;
            });
	};


    view.D3table = Backbone.View.extend({
        className: 'recline-table-editor',
        template: ' \
  				<div id="{{graphId}}" class="g-table g-table-hover g-table-striped g-table-bordered"> \
  					<h2 class="g-title">{{title}}</h2> \
  					<p class="lead">{{instructions}}</p> \
  					<small>{{summary}}</small> \
  				\
  				<div> \
  				\
  			',
        templateHeader: ' \
        			<div class="g-thead"> \
  						<div class="g-tr"> \
  							{{#columns}} \
  							<div class="g-th {{#sortable}}g-sortable{{/sortable}}" style="width: {{hwidth}}"><div>{{label}}</div></div> \
  							{{/columns}} \
  						</div> \
  					</div> \
  					\
  					',
        templateBody: ' \
  					<div class="g-tbody-container" style="width:{{scrollWidth}}px; height:{{height}}px;"> \
  						<div style="width:{{width}}px;"> \
  							<svg class="g-tbody"> \
							</svg> \
						</div> \
					</div> \
					\
  					',
        templateFooter: '\
  					<div class="g-tfoot-container"> \
						<svg class="g-tfoot"> \
						</svg> \
					</div> \
					\
					',
        events: {
            'click .g-thead': 'onEvent'
        },
        initialize: function (options) {
            
            _.defaults(options.conf,{"row_height": 20, "height":200});
            options.actions = options.actions || [];
            this.el = $(this.el);
    		_.bindAll(this, 'render', 'redraw', 'refresh', 'resize');
                     
            this.rowHeight = options.conf.row_height;
            
            var clickActions=[], hoverActions=[];
            //processing actions
            {
            	options.actions.forEach(function(action){
            		action.event.forEach(function(event){
            			if(event==='selection') clickActions.push(action);
            			else if(event==='hover')  hoverActions.push(action);
            		});
            	});
            }           
            
            this.clickActions = clickActions;
            this.hoverActions = hoverActions; 

            this.model.bind('change', this.render);
            this.model.fields.bind('reset', this.render);
            this.model.fields.bind('add', this.render);

            this.model.bind('query:done', this.redraw);
            this.model.queryState.bind('selection:done', this.redraw);


			$(window).resize(this.resize);

			//create a nuew columns array with default values 
            this.columns = _.map(options.columns, function (column) {
                return _.defaults(column, {
                    label: "",
                    type: "text",
                    sortable: false,
                    fields: {}
                });
            });
            
            //render table  				
            this.columns.forEach(function (column, i) {
            	column.width = column.width || 160;
                column.hwidth = column.width;
            }, this);
            
            this.height = options.conf.height;
            this.title = options.title;
            this.summary = options.summary;
            this.instructions = options.instructions;
            this.graphId = options.id || 'd3table_'+Math.floor(Math.random()*1000);

            //render header & svg container
            var out = Mustache.render(this.template, this);
            this.el.html(out);
            this.el.find('#'+this.graphId).append(Mustache.render(this.templateHeader, this));
            
            this.width = options.conf.width;
            //this.render(); 								
        },
        
        resize: function(){
        	console.log('resize');
        	var tbodycontainer =  d3.select('#'+this.graphId+' .g-tbody-container');
        	var tbody = d3.select('#'+this.graphId +' .g-tbody');
        	var tfoot = d3.select('#'+this.graphId +' .g-tfoot');
        	        	
        	this.width = computeWidth(this);            
            this.scrollWidth = scrollBarWidth()+this.width;            
            
            this.el.find('.g-tbody-container').css('width',this.scrollWidth);
            this.el.find('.g-tbody-container > div').css('width',this.width);
            
            var row = tbodycontainer.select('.g-tbody')
                .selectAll(".g-tr");
                
            row.each(function (record) {
            	 var cell = d3.select(this)
                    .selectAll(".g-td").attr("transform", function (dimension, i) {
                    	return "translate(" + (dimension.translation+dimension.padding_left) + ")";
                	});
                	
                
            	//move and resize barchart
            					//barchart               
                var barChartCell = cell.filter(function (dimension) {           	
                    return dimension.scale && dimension.type === 'barchart';
                });
                barChartCell.selectAll(".g-bar").attr("width", function (field, index) {
                    	return field.scale(record.getFieldValue(field));
               		})
                    .attr("transform", function (field, i) {
                    	                    	
	                    var translation = Math.ceil((i === 0) ? ((field.computed_width) / 2) - field.scale(record.getFieldValue(field)) : i * (field.computed_width) / 2);
	
	                    if (i == 0) {
	                        return "translate(" + translation + ")";
	                    } else {
	                        return "translate(" + translation + ")";
	                    }
                	});            	
            });   
                 
            //move vertical lines
            {
            	tbodycontainer.select('.g-tbody').selectAll(".g-column-border").attr("class", "g-column-border").attr("transform", function(dimension) {
					return "translate(" + (dimension.translation) + ",0)";
				}).attr("y2", "100%");
            }     
            
            //move compare lines
            tbodycontainer.select('.g-tbody').selectAll(".g-compare").data(this.columns.filter(function(column) {
				return column.scale;
			})).attr("transform", function(column) {
				return "translate(" + (column.translation+column.padding_left+column.computed_width/2) + ",0)";
			}).attr("y2", "100%");        
            
            //move axis
            {
            	var axisRow = d3.select('#'+this.graphId+' .g-tfoot');
	            
	            var cell = axisRow.selectAll('.g-td')
	                    .attr("width", function (dimension, i) {
	                    	return (dimension.computed_width);
	                	})
	                	.attr("transform", function (dimension, i) {
	                    	return "translate(" + (dimension.translation+dimension.padding_left)+ ")";
                		});
	            
	            var barChartCell = cell.filter(function (dimension) {
                    return dimension.scale && dimension.type === 'barchart';
                });
                
				barChartCell.selectAll(".g-axis").remove();
                
				var fieldNum;
                var range;	
				barChartCell.selectAll(".g-axis").data(function (dimension) {
                		fieldNum = dimension.fields.length;
                		range = dimension.range;
                    	return dimension.fields;
               	  })
               	  .enter()
               	  .append('g')
               	  .attr('class', function(field,i){
               	  	return 'g-axis';
               	  })
               	  .attr("transform", function (field, i) {
               	  			var trans = 0;
               	  			var w = field.computed_width/fieldNum;
               	  			            	  			
               	  			if(i==0) trans = w - w*range;
               	  			else trans = i * w;
               	  			
               	  			return "translate(" + trans + ")";
                		})
               	  .each(function(field, i){
               	  		var axis = d3.svg.axis().scale(field.axisScale).ticks(Math.abs(field.axisScale.range()[1] - field.axisScale.range()[0]) / 80).orient("bottom");
               	  		d3.select(this).call(axis);
               	  	});
                             	  	
           }          		    
           
            
        },
        refresh: function() {
			console.log('d3Table.refresh');

        },
        reset: function () {
            console.log('d3Table.reset');
        },
        render: function () {
            console.log('d3Table.render');
            
            //render table divs            
            //manage width and scrolling
			this.width = computeWidth(this);
            this.scrollWidth = scrollBarWidth()+this.width;
            
            //compile mustache templates
            this.el.find('#'+this.graphId).append(Mustache.render(this.templateBody, this)).append(Mustache.render(this.templateFooter, this));
            
			//merge columns with dimensions
            this.columns.forEach(function (column, i) {
                column.fields = recline.Data.Aggregations.intersectionObjects('id', column.fields, this.model.fields.models);
                column.index = i;
            }, this);
        },
        redraw: function () {     
            console.log('d3Table.redraw');   
            
            var rowHeight = this.rowHeight;
            var columns = this.columns;
            var records = this.model.records.models;
            var activeRecords = []; 
            
			records.forEach(function (record, i) {
                record.index = i;
                if(record.isRecordSelected()) activeRecords.push(record);
            });
            
            //manage width and scrolling
			this.width = computeWidth(this); //this function compute width for each cells and adjust scales
            this.scrollWidth = scrollBarWidth()+this.width;
            
            var tbodycontainer = d3.select('#'+this.graphId+' .g-tbody-container');
            
            tbodycontainer.select('div').style('height',(rowHeight)*records.length+'px');            
            tbodycontainer.classed('g-tbody-container-overflow',(rowHeight)*records.length>this.height);
            
            tbodycontainer.selectAll('.g-tbody .g-tr').remove();            			
            var row = tbodycontainer.select('.g-tbody')
              .selectAll(".g-tr")
              .data(records)
              .enter()
              .append("g")
                .attr("class", "g-tr")
                .attr("transform", function (record, i) {
                	return "translate(0," + i * (rowHeight) + ")";
            	}).classed('info',function(record, i){
            		return record.isRecordSelected();
            	});

            row.append("rect")
                .attr("class", "g-background")
                .attr("width", "100%")
                .attr("height", rowHeight)
                .on('click', rowClick(this.clickActions, activeRecords))
                .on('mouseover', rowOver(this.hoverActions, activeRecords));

            row.each(function (record) {
								
                var cell = d3.select(this)
                  .selectAll(".g-td")
                  .data(columns)
                  .enter()
                  .append("g")
                    .attr("class", "g-td")
                    .classed("g-quantitative", function (dimension) {
                    	return dimension.scale;
                	}).classed("g-categorical", function (dimension) {
                    	return dimension.categorical;
                	}).attr("transform", function (dimension, i) {
                    	return "translate(" + (dimension.translation+dimension.padding_left) + ")";
                	});
                	
                //horizontal lines
               	d3.select(this).append('line').attr('class', 'g-row-border').attr('y1',rowHeight).attr('y2',rowHeight).attr('x2','100%');
               
				//barchart               
                var barChartCell = cell.filter(function (dimension) {           	
                    return dimension.scale && dimension.type === 'barchart';
                });
                barChartCell.selectAll(".g-bar")
                  .data(function (dimension) {
                    	return dimension.fields;
               	  })
                  .enter()
                  .append("rect")
                    .attr("class", "g-bar")
                    .attr("width", function (field, index) {
                    	return field.scale(record.getFieldValue(field));
               		})
                    .attr("height", rowHeight-1)
                    .attr("transform", function (field, i) {
                    	                    	
	                    var translation = Math.ceil((i === 0) ? ((field.computed_width) / 2) - field.scale(record.getFieldValue(field)) : i * (field.computed_width) / 2);
												
	                    if (i == 0) {
	                        return "translate(" + translation + ")";
	                    } else {
	                        return "translate(" + translation + ")";
	                    }
                	})
                    .style("fill", function (field, index) {
                    	return field.color;
                	});


                cell.filter(function (dimension) {           	
                    return !dimension.scale;
                }).append("text")
                    .attr("class", "g-value")
                    .attr("x", function (dimension) {
                    return dimension.scale ? 3 : 0;
                })
                    .attr("y", function (dimension) {
                    return dimension.categorical ? 9 : 10;
                })
                    .attr("dy", ".35em")
                    .classed("g-na", function (dimension) { //null values
                    return frv(record, dimension) === undefined;
                })
                    .text(function (dimension) {
                    return frv(record, dimension);
                })
                    .attr("clip-path", function (dimension) {
                    return (dimension.clipped = this.getComputedTextLength() > ((dimension.computed_width))-20) ? "url(#g-clip-cell)" : null;
                });

                cell.filter(function (dimension) {
                    return dimension.clipped;
                }).append("rect")
                    .style("fill", "url(#g-clip-gradient)")
                    .attr("x", function (dimension) {
                    	return dimension.hwidth;
                	})
                    .attr("width", 20)
                    .attr("height", rowHeight);
            });
            
            //axis management
            {
				var tfoot = d3.select('#'+this.graphId+' .g-tfoot');
				tfoot.selectAll('.axisRow').remove();						
				var axisRow = tfoot.append("g")
	                .attr("class", "axisRow");
	                	            
	            var cell = axisRow.selectAll('.g-td').data(columns).enter().append('g')
	                    .attr("class", "g-td")
	                    .attr("width", function (dimension, i) {
	                    	return (dimension.computed_width);
	                	})
	                	.attr("transform", function (dimension, i) {
	                    	return "translate(" + (dimension.translation+dimension.padding_left)+ ")";
                		});
	            
	            var barChartCell = cell.filter(function (dimension) {
                    return dimension.scale && dimension.type === 'barchart';
                });
                
                var fieldNum;
                var range;
                barChartCell.selectAll(".g-axis").data(function (dimension) {
                		fieldNum = dimension.fields.length;
                		range = dimension.range;
                    	return dimension.fields;
               	  })
               	  .enter()
               	  .append('g')
               	  .attr('class', function(field,i){
               	  	return 'g-axis';
               	  })
               	  .attr("transform", function (field, i) {
               	  			var trans = 0;
               	  			var w = field.computed_width/fieldNum;
               	  			            	  			
               	  			if(i==0) trans = w - w*range;
               	  			else trans = i * w;
               	  			
               	  			return "translate(" + trans + ")";
                		})
               	  .each(function(field, i){
               	  		var axis = d3.svg.axis().scale(field.axisScale).ticks(Math.abs(field.axisScale.range()[1] - field.axisScale.range()[0]) / 80).orient("bottom");
               	  		d3.select(this).call(axis);
               	  	});        
               	  	
            }

			//add sorting
            d3.selectAll('#'+this.graphId+' .g-thead .g-th.g-sortable')
                .data(columns)
                .on("click", sort(rowHeight, this.graphId));    
                
            //vertical lines
            {
            	tbodycontainer.select('.g-tbody').selectAll(".g-column-border").remove();
            	tbodycontainer.select('.g-tbody').selectAll(".g-column-border").data(columns)
            	.enter().append("line").attr("class", "g-column-border").attr("transform", function(dimension) {
					return "translate(" + (dimension.translation) + ",0)";
				}).attr("y2", "100%");
            }            

			//axis lines
			{
				tbodycontainer.select('.g-tbody').selectAll(".g-compare").remove();
				tbodycontainer.select('.g-tbody').selectAll(".g-compare").data(columns.filter(function(dimension) {
					return dimension.scale;
				})).enter().append("line").attr("class", "g-compare").attr("transform", function(dimension) {
					return "translate(" + (dimension.translation+dimension.padding_left + dimension.computed_width/2) + ",0)";
				}).attr("y2", "100%"); 
			}
			
        },
        onEvent: function (e) {}
    });
})(jQuery, recline.View);this.recline = this.recline || {};
this.recline.View = this.recline.View || {};

(function ($, view) {
	
	"use strict";

    view.D3Treemap = Backbone.View.extend({
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
            this.width = options.width;
            this.height = options.height;

            if(!this.options.animation) {
                this.options.animation = {
                    duration: 2000,
                    delay: 200
                }
            }

            //render header & svg container
            var out = Mustache.render(this.template, this);
            this.el.html(out);

        },
        
        resize: function(){

        },

        render: function () {
            var self=this;
            var graphid="#" + this.uid;

            if(self.graph)
                jQuery(graphid).empty();


            self.treemap = d3.layout.treemap()
                 .size([this.width, this.height])
                 .sticky(false)
                 .value(function(d) {
                    console.log(d);
                    return d.size; });

            self.color = d3.scale.category20c();



            self.div = d3.select(graphid).append("div")
                .style("position", "relative")
                .style("width", this.width + "px")
                .style("height", this.height + "px");
        },

        redraw: function () {     
            console.log("redraw");
            var fieldValue = this.model.fields.get(this.options.fieldValue);
            var fieldName = this.model.fields.get(this.options.fieldName);

            var records = _.map(this.options.model.getRecords(this.options.resultType.type), function(record) {
                return {name: record.getFieldValue(fieldName), size: record.getFieldValueUnrendered(fieldValue) };
            });



            this.drawD3(records, "#" + this.uid);
        },
        drawD3: function(data, graphid) {
            var self=this;

            function cell() {
                this
                    .style("left", function(d) { return d.x + "px"; })
                    .style("top", function(d) { return d.y + "px"; })
                    .style("width", function(d) { return Math.max(0, d.dx - 1) + "px"; })
                    .style("height", function(d) { return Math.max(0, d.dy - 1) + "px"; });
            }

            var leaves = self.treemap(data);


            _.each(data, function(x) {
                self.div.data([x]).selectAll("div")
                    .data(self.treemap.nodes)
                    .enter().append("div")
                    .attr("class", "cell")
                    .style("background", function(d) { self.color(d.name); })
                    .call(cell)
                    .text(function(d) {
                        console.log(d);
                        return d.name; });

            });






            // display the line by appending an svg:path element with the data line we created above
            /*if(self.alreadyDrawed)
                self.graph.select("path").transition().duration(self.options.animation.duration).delay(self.options.animation.delay).attr("d", line(data));
            else
                self.graph.append("svg:path").attr("d", line(data));
            */
            self.alreadyDrawed = true;
        }

    });
})(jQuery, recline.View);