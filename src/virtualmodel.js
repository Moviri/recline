// # Recline Backbone Models
this.recline = this.recline || {};
this.recline.Model = this.recline.Model || {};
this.recline.Model.VirtualDataset = this.recline.Model.VirtualDataset || {};


(function($, my) {

// ## <a id="dataset">VirtualDataset</a>
    my.VirtualDataset = Backbone.Model.extend({
        constructor: function VirtualDataset() {
            Backbone.Model.prototype.constructor.apply(this, arguments);
        },


        initialize: function() {
            _.bindAll(this, 'query');


            var self = this;
            this.backend = recline.Backend.Memory;
            this.fields = new my.FieldList();
            this.records = new my.RecordList();
            this.facets = new my.FacetList();
            this.recordCount = null;
            this.queryState = new my.Query();

            this.attributes.dataset.bind('query:done', function() { self.initializeCrossfilter(); })

            //this.attributes.dataset.records.bind('add',     function() { self.initializeCrossfilter(); });
            //this.attributes.dataset.records.bind('reset',   function() { self.initializeCrossfilter(); });

            this.queryState.bind('change',                  function() { self.query(); });
            this.queryState.bind('selection:change',        function() { self.selection(); });

            // dataset is already been fetched
            if(this.attributes.dataset.records.models.length > 0)
                self.initializeCrossfilter();

            // TODO verify if is better to use a new backend (crossfilter) to manage grouping and filtering instead of using it inside the model
            // TODO OPTIMIZATION use a structure for the reduce function that doesn't need any translation to records/arrays
            // TODO USE crossfilter as backend memory
        },
        
        getRecords: function(type) {
            var self=this;

        	if(type==='filtered'){
        		return self.records.models;
        	}else {
                if(self._store.data == null) {
                    throw "VirtualModel: unable to retrieve not filtered data, store has not been initialized";
                }

                var docs = _.map(self._store.data, function(hit) {
                    var _doc = new my.Record(hit);
                    _doc.fields = self.fields;
                    return _doc;
                });

                return docs;
        	}
        },

        initializeCrossfilter: function() {
            this.updateStore(
                this.reduce(
                    this.createDimensions(
                                crossfilter(this.attributes.dataset.records.toJSON()))));
     },

        createDimensions: function(crossfilterData) {
            var dimensions = this.attributes.aggregation.dimensions;
            var group;

            if(dimensions == null ){
                // need to evaluate aggregation function on all records
                group =  crossfilterData.groupAll();
            }
            else {
                var by_dimension = crossfilterData.dimension(function(d) {
                    var tmp = "";
                    for(i=0;i<dimensions.length;i++){
                        if(i>0) { tmp = tmp + "#"; }

                        tmp = tmp + d[dimensions[i]].valueOf();
                    }
                    return tmp;
                });
                group = by_dimension.group();
            }

            return group;
        },


        reduce: function(group) {
            var aggregatedFields = this.attributes.aggregation.aggregatedFields;
            var aggregationFunctions = this.attributes.aggregation.aggregationFunctions;

            if(this.attributes.aggregation.aggregationFunctions == null || this.attributes.aggregation.aggregationFunctions.length == 0)
                throw("Error aggregationFunctions parameters is not set for virtual dataset ");


            var partitioning = false;
            var partitions;
            var partitionFields = {};
            if(this.attributes.aggregation.partitions != null) {
                partitions = this.attributes.aggregation.partitions;
                var partitioning = true;
            }

            function addFunction(p, v) {
                p.count = p.count +1;
                for(i=0;i<aggregatedFields.length;i++){

                    // for each aggregation function evaluate results
                    for(j=0;j<aggregationFunctions.length;j++){
                        var currentAggregationFunction = this.recline.Data.Aggregations.aggregationFunctions[aggregationFunctions[j]];

                        p[aggregationFunctions[j]][aggregatedFields[i]] =
                            currentAggregationFunction(
                                p[aggregationFunctions[j]][aggregatedFields[i]],
                                v[aggregatedFields[i]]);
                    }


                    if(partitioning) {
                        // for each partition need to verify if exist a value of aggregatefield_by_partition_partitionvalue
                        for(x=0;x<partitions.length;x++){
                            var partitionName = partitions[x];
                            var partitionValue = v[partitions[x]];
                            var aggregatedField = aggregatedFields[i];
                            var fieldName = aggregatedField + "_by_" + partitionName + "_" + partitionValue;


                            // for each aggregation function evaluate results
                            for(j=0;j<aggregationFunctions.length;j++){

                                if(partitionFields[aggregationFunctions[j]] == null)
                                    partitionFields[aggregationFunctions[j]] = {};

                                var currentAggregationFunction = this.recline.Data.Aggregations.aggregationFunctions[aggregationFunctions[j]];

                                if( p.partitions[aggregationFunctions[j]][fieldName] == null)  {
                                    p.partitions[aggregationFunctions[j]][fieldName] = {
                                        value: null,
                                        partition: partitionValue,
                                        originalField: aggregatedField,
                                        aggregationFunction: currentAggregationFunction};

                                    // populate partitions description

                                    partitionFields[aggregationFunctions[j]][fieldName] = {
                                        field: partitionName,
                                        value: partitionValue,
                                        originalField: aggregatedField,
                                        aggregationFunction: currentAggregationFunction,
                                        aggregationFunctionName: aggregationFunctions[j],
                                        id: fieldName + "_" + aggregationFunctions[j]
                                    }; // i need partition name but also original field value
                                }
                                p.partitions[aggregationFunctions[j]][fieldName]["value"] =
                                    currentAggregationFunction(
                                        p.partitions[aggregationFunctions[j]][fieldName]["value"],
                                        v[aggregatedFields[i]]);
                            }

                            if(p.partitions.count[fieldName] == null) {
                                p.partitions.count[fieldName] = {
                                    value: 1,
                                    partition: partitionValue,
                                    originalField: aggregatedField,
                                    aggregationFunction: "count"
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

                var tmp = {count: 0};

                for(j=0;j<aggregationFunctions.length;j++){
                    tmp[aggregationFunctions[j]] = {};
                    this.recline.Data.Aggregations.initFunctions[aggregationFunctions[j]](tmp, aggregatedFields, partitions);
                }

                if(partitioning){
                    tmp["partitions"] = {};
                    tmp["partitions"]["count"] = {};

                    for(j=0;j<aggregationFunctions.length;j++){
                        tmp["partitions"][aggregationFunctions[j]] = {};
                    }

                    /*_.each(partitions, function(p){
                        tmp.partitions.list[p] = 0;
                    });*/
                }

                return tmp;
            }

            var reducedGroup = group.reduce(addFunction,removeFunction,initializeFunction);

            var tmpResult;

            var dimensions = this.attributes.aggregation.dimensions;

            if(dimensions == null)  {
                tmpResult =  [reducedGroup.value()];
            }
            else {
                tmpResult =  reducedGroup.all();
            }

            return {reducedResult: tmpResult,
                    partitionFields: partitionFields};

        },

        updateStore: function(results) {
            var self=this;

            var reducedResult = results.reducedResult;
            var partitionFields = results.partitionFields;

            var fields = self.buildFields(reducedResult, partitionFields);
            var result = self.buildResult(reducedResult, partitionFields);

            this._store = new recline.Backend.Memory.Store(result, fields);
            this.partitionFields = partitionFields;

            this.fields.reset(fields, {renderer: recline.Data.Renderers});
            this.query();

        },




        buildResult: function(reducedResult, partitionFields){
            var dimensions = this.attributes.aggregation.dimensions;
            var aggregationFunctions =    this.attributes.aggregation.aggregationFunctions;
            var aggregatedFields = this.attributes.aggregation.aggregatedFields;

            var partitioning = false;
            var partitions;

            if(this.attributes.aggregation.partitions != null) {
                partitions = this.attributes.aggregation.partitions;
                var partitioning = true;
            }

            var tmpField;
            if(dimensions == null)  {
                tmpField = reducedResult;
            }
            else {
                if(reducedResult.length > 0) {
                    tmpField = reducedResult[0].value;
                }
                else
                    tmpField = {count: 0};
            }

            var result = [];

            // set  results of dataset
            for(var i=0;i<reducedResult.length;i++){

                var currentField;
                var currentResult = reducedResult[i];
                var tmp;

                // if dimensions specified add dimension' fields
                if(dimensions != null) {
                    var keyField = reducedResult[i].key.split("#");

                    tmp = {dimension: currentResult.key, count: currentResult.value.count};

                    for(var j=0;j<keyField.length;j++){
                        var field = dimensions[j];
                        var originalFieldAttributes = this.attributes.dataset.fields.get(field).attributes;
                        var type = originalFieldAttributes.type;

                        var parse = recline.Data.FormattersMODA[type];
                        var value = parse(keyField[j]);

                        tmp[dimensions[j]] = value;
                    }
                    currentField = currentResult.value;

                }
                else {
                    currentField = currentResult;
                    tmp = {count: currentResult.count};
                }

                // add records foreach aggregation function
                for(var j=0;j<aggregationFunctions.length;j++){

                    // apply finalization function, was not applied since now
                    // todo verify if can be moved above
                    // note that finalization can't be applyed at init cause we don't know in advance wich partitions data can be built

                    try {
                        var tmpPartitionFields = [];
                        if(partitionFields[aggregationFunctions[j]] != null)
                            tmpPartitionFields = partitionFields[aggregationFunctions[j]];
                    recline.Data.Aggregations.finalizeFunctions[aggregationFunctions[j]](
                        currentField,
                        aggregatedFields,
                        _.keys(tmpPartitionFields));
                    }
                    catch(err) {
                        console.log(err);

                    }
                    var tempValue;



                    if(typeof currentField[aggregationFunctions[j]] == 'function')
                        tempValue = currentField[aggregationFunctions[j]]();
                    else
                        tempValue = currentField[aggregationFunctions[j]];




                    for (var x in tempValue) {

                        var tempValue2;
                        if(typeof tempValue[x] == 'function')
                            tempValue2  =  tempValue[x]();
                        else
                            tempValue2  = tempValue[x];

                        tmp[x + "_" + aggregationFunctions[j]] =  tempValue2;
                    }


                    // adding partition records
                    if(partitioning) {
                        var tempValue;
                        if(typeof currentField.partitions[aggregationFunctions[j]] == 'function')
                            tempValue =currentField.partitions[aggregationFunctions[j]]();
                        else
                            tempValue =currentField.partitions[aggregationFunctions[j]];

                        for (var x in tempValue) {
                            var tempValue2;
                            if(typeof currentField.partitions[aggregationFunctions[j]] == 'function')
                                tempValue2 =  currentField.partitions[aggregationFunctions[j]]();
                            else
                                tempValue2 = currentField.partitions[aggregationFunctions[j]];

                            var fieldName = x + "_" + aggregationFunctions[j];

                            tmp[fieldName] =  tempValue2[x].value;


                        }

                    }

                }

                // count is always calculated for each partition
                if(partitioning) {
                    for (var x in tmpField.partitions["count"]) {
                        if(currentResult.value.partitions["count"][x] == null)
                            tmp[x + "_count"] = 0;
                        else
                            tmp[x + "_count"] =  currentResult.value.partitions["count"][x].value;
                    }
                }


                result.push(tmp);
            }

            return result;
        },

        buildFields: function(reducedResult, partitionFields) {
            var self=this;
            var dimensions = this.attributes.aggregation.dimensions;
            var aggregationFunctions =    this.attributes.aggregation.aggregationFunctions;

            var fields = [];

            var tmpField;
            if(dimensions == null)  {
                tmpField = reducedResult;
            }
            else {
                if(reducedResult.length > 0) {
                    tmpField = reducedResult[0].value;
                }
                else
                    tmpField = {count: 0};
            }


            // creation of fields

            fields.push( {id: "count", type: "integer"});

            // defining fields based on aggreagtion functions
            for(var j=0;j<aggregationFunctions.length;j++){

                var tempValue;
                if(typeof tmpField[aggregationFunctions[j]] == 'function')
                    tempValue = tmpField[aggregationFunctions[j]]();
                else
                    tempValue = tmpField[aggregationFunctions[j]];

                for (var x in tempValue) {
                    var originalFieldAttributes = this.attributes.dataset.fields.get(x).attributes;
                    var newType = recline.Data.Aggregations.resultingDataType[aggregationFunctions[j]](originalFieldAttributes.type);

                    fields.push( {
                        id: x + "_" + aggregationFunctions[j],
                        type: newType,
                        is_partitioned: false,
                        colorSchema: originalFieldAttributes.colorSchema,
                        originalField: x,
                        aggregationFunction: aggregationFunctions[j]
                    });
                }

                // add partition fields
                _.each(partitionFields, function(aggrFunction)  {
                    _.each(aggrFunction, function(d) {
                    var originalFieldAttributes = self.attributes.dataset.fields.get(d.field).attributes;
                    var newType = recline.Data.Aggregations.resultingDataType[aggregationFunctions[j]](originalFieldAttributes.type);

                        var fieldId= d.id;
                    var fieldLabel = fieldId;

                    if(self.attributes.fieldLabelForPartitions) {
                        fieldLabel = self.attributes.fieldLabelForPartitions
                            .replace("{originalField}", d.originalField)
                            .replace("{partitionFieldName}", d.field)
                            .replace("{partitionFieldValue}", d.value)
                            .replace("{aggregatedFunction}", aggregationFunctions[j]);
                    }

                    fields.push( {
                            id: fieldId,
                            type: newType,
                            is_partitioned: true,
                            partitionField: d.field,
                            partitionValue: d.value,
                            colorSchema: originalFieldAttributes.colorSchema,  // the schema is the one used to specify partition
                            originalField: d.originalField,
                            aggregationFunction: aggregationFunctions[j],
                            label: fieldLabel
                        }
                    );
                })
                });

            }

            // adding all dimensions to field list
            if(dimensions != null) {
                fields.push( {id: "dimension"});
                for(var i=0;i<dimensions.length;i++){
                    var originalFieldAttributes = this.attributes.dataset.fields.get(dimensions[i]).attributes;
                    fields.push( {
                        id: dimensions[i],
                        type: originalFieldAttributes.type,
                        label: originalFieldAttributes.label,
                        format: originalFieldAttributes.format,
                        colorSchema: originalFieldAttributes.colorSchema
                    });

                }
            }



            // if labels are declared in dataset properties merge it;
            if(self.attributes.fieldLabels) {
                _.each(this.attributes.fieldLabels, function(d) {
                    var field = _.find(fields, function(f) {return d.id === f.id });
                    if(field != null)
                        field.label = d.label;
                });
            }

            // if format is declared in dataset properties merge it;
            if(self.attributes.fieldsFormat) {
                _.each(this.attributes.fieldsFormat, function(d) {
                    var field = _.find(fields, function(f) {return d.id === f.id });
                    if(field != null)
                        field.format = d.format;
                })
            }

            return fields;
        },

        query: function(queryObj) {
            /*console.log("query start");
             console.log(this.attributes.dataset.toJSON());
             console.log(self.records.toJSON() );
             */


            var self = this;
            var dfd = $.Deferred();
            this.trigger('query:start');

            if (queryObj) {
                this.queryState.set(queryObj, {silent: true});
            }
            var actualQuery = this.queryState.toJSON();
            console.log("VModel [" + self.attributes.name + "] query [" + JSON.stringify(actualQuery) + "]");

            if(this._store == null) {
                console.log("Warning query called before data has been calculated for virtual model, call fetch on source dataset");
                return;
            }


            this._store.query(actualQuery, this.toJSON())
                .done(function(queryResult) {
                    self._handleQueryResult(queryResult);
                    self.trigger('query:done');
                    dfd.resolve(self.records);
                })
                .fail(function(arguments) {
                    self.trigger('query:fail', arguments);
                    dfd.reject(arguments);
                });
            return dfd.promise();
        },

        selection: function(queryObj) {
            var self = this;

            this.trigger('selection:start');

            if (queryObj) {
                self.queryState.set(queryObj, {silent: true});
            }
            var actualQuery = self.queryState


            // apply on current records
            // needed cause memory store is not mandatory
            recline.Data.Filters.applySelectionsOnData(self.queryState.get('selections'), self.records.models, self.fields);

            self.queryState.trigger('selection:done');

        },

        _handleQueryResult: function(queryResult) {
            var self = this;
            self.recordCount = queryResult.total;
            var docs = _.map(queryResult.hits, function(hit) {
                var _doc = new my.Record(hit);
                _doc.fields = self.fields;
                return _doc;
            });

            self.records.reset(docs);

            if (queryResult.facets) {
                var facets = _.map(queryResult.facets, function(facetResult, facetId) {
                    facetResult.id = facetId;
                    var result =  new my.Facet(facetResult);

                    // todo set color to facet
                    //self.addColorsToTerms(facetId, result.attributes.terms);

                    return result;
                });
                self.facets.reset(facets);
            }


        },
        getFacetByFieldId: function(fieldId) {
      	  return _.find(this.facets.models, function(facet) {
      		  return facet.id == fieldId;
      	  });
        }, 

        toTemplateJSON: function() {
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
        getFieldsSummary: function() {
            // TODO update function in order to manage facets/filter and selection

            var self = this;
            var query = new my.Query();
            query.set({size: 0});

            var dfd = $.Deferred();
            this._store.query(query.toJSON(), this.toJSON()).done(function(queryResult) {
                if (queryResult.facets) {
                    _.each(queryResult.facets, function(facetResult, facetId) {
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
        getPartitionedFields: function(fieldName) {
            var field = this.fields.get(fieldName);

            var fields = _.filter(this.fields.models, function(d) {
               return (
                   d.attributes.aggregationFunction == field.attributes.aggregationFunction
                   && d.attributes.originalField == field.attributes.originalField
                   );
            });

            if(fields == null)
                field = [];

            fields.push(field);

            return fields;

        },

        isFieldPartitioned: function(fieldName) {
          return  this.fields.get(fieldName).attributes.aggregationFunction
              && this.attributes.aggregation.partitions;
        },

        getPartitionedFieldsForAggregationFunction: function(aggregationFunction, aggregatedFieldName) {
            var self=this;
            var fields = [];

            _.each(self.partitionFields[aggregationFunction], function(p) {
                if(p.originalField == aggregatedFieldName)
                    fields.push(self.fields.get(p.id));
            });

            return fields;
        }

});



}(jQuery, this.recline.Model));

