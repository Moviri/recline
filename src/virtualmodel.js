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
        this.recordCount = null;
        this.queryState = new my.Query();

        this.attributes.dataset.records.bind('add',     function() { self.initializeCrossfilter(); });
        this.attributes.dataset.records.bind('reset',   function() { self.initializeCrossfilter(); });

        this.queryState.bind('change',                  function() { self.query(); });

        // TODO verify if is better to use a new backend (crossfilter) to manage grouping and filtering instead of using it inside the model
    },

    modifyGrouping: function(dimensions, aggregationField)
    {
        this.attributes.aggregation.aggregatedFields = aggregationField;
        this.attributes.aggregation.dimensions = dimensions;
        updateCrossfilter(this);
    },
    addDimension: function(dimension)
    {
        this.attributes.aggregation.dimensions.push = dimension;
        updateCrossfilter(this);
    },
    addAggregationField: function(field) {
        this.attributes.aggregation.aggregatedFields.push(field);
        updateCrossfilter(this);
    },

    initializeCrossfilter: function() {

        var start = new Date().getTime();

        var end = new Date().getTime();
        var time = end - start;

        console.log("initializeCrossfilter - exec time: " + time);

        this.updateCrossfilter(crossfilter(this.attributes.dataset.records.toJSON()));
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
                    if(i>0) { tmp = tmp + "_"; }

                    tmp = tmp + d[dimensions[i]];
                }
                return tmp;
            });
          group = by_dimension.group();
        }

        return group;
    },

    updateCrossfilter: function(crossfilterData) {
        // TODO optimization has to be done in order to limit the number of cycles on data
        // TODO has sense to recreate dimension if nothing is changed?, and in general, is better to use a new dimension if added instead of recreate all
        // TODO verify if saving crossfilter data is useful (perhaps no unless we use crossfilterstore to make aggregaation and filtering)


        var start = new Date().getTime();


        this.updateStore(this.reduce(this.createDimensions(crossfilterData)));

        var end = new Date().getTime();
        var time = end - start;

        console.log("updateCrossfilter - exec time: " + time);
    },

    reduce: function(group) {
        var aggregatedFields = this.attributes.aggregation.aggregatedFields;
        var aggregationFunctions = this.attributes.aggregation.aggregationFunctions;

        var partitioning = false;
        var partitions;
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

                    p[aggregationFunctions[j] = currentAggregationFunction( p[aggregationFunctions[j], v[aggregatedFields[i]);
                }

                p.sum[aggregatedFields[i]] = p.sum[aggregatedFields[i]] + v[aggregatedFields[i]];

                if(partitioning) {
                    // for each partition need to verify if exist a value of aggregatefield_by_partition_partitionvalue_sum
                    for(x=0;x<partitions.length;x++){
                        var fieldName = aggregatedFields[i] + "_by_" + partitions[x] + "_" + v[partitions[x]];

                        // for each aggregation function evaluate results
                        for(j=0;j<aggregationFunctions.length;j++){
                            var currentAggregationFunction = this.recline.Data.Aggregations.aggregationFunctions[aggregationFunctions[j]];

                            p.partitions[aggregationFunctions[j] = currentAggregationFunction(p.partitions[aggregationFunctions[j], v[aggregatedFields[i]);
                        }

                        if(p.partitionsum[fieldName] == null) {
                            p.partitionsum[fieldName] = 0;
                            p.partitioncount[fieldName] = 0;
                        }

                        p.partitionsum[fieldName] = p.partitionsum[fieldName] + v[aggregatedFields[i]];
                        p.partitioncount[fieldName] = p.partitioncount[fieldName] + 1;
                    }
                }

            }
            return p;
        }

        function removeFunction(p, v) {
            throw "crossfilter reduce remove function not implemented";
        }

        function initializeFunction() {


            tmp = {count: 0, sum: {}, partitioncount: {}, partitionsum: {}};

            for(i=0;i<aggregatedFields.length;i++){
                tmp.sum[aggregatedFields[i]] = 0;
            }

            tmp.avg = function(aggr){
                return function(){
                    var map = {};
                    for(var o=0;o<aggr.length;o++){
                        map[aggr[o]] = this.sum[aggr[o]] / this.count;
                     }
                    for (var j in this.partitioncount) {
                        map[j] = this.partitionsum[j] / this.partitioncount[j];
                    }


                    return map;
                }
            }(aggregatedFields);

            return tmp;
        }


        return reducedGroup  =  group.reduce(sumAdd,sumRemove,sumInitialize);
    },

    updateStore: function(reducedGroup) {
        var dimensions = this.attributes.aggregation.dimensions;

        var tmpResult;
        var result = [];
        var fields = [];

        var tmpField;

        if(dimensions == null)  {
            tmpResult =  reducedGroup.value();
            tmpField = tmpResult;
        }
        else {
            tmpResult =  reducedGroup.all();
            if(tmpResult.length > 0)
                tmpField = tmpResult[0].value;
            else
                tmpField = {count: 0, sum: {}, partitioncount: {}, partitionsum: {}, avg: function() { return; }};
        }




        // set of fields array


        fields.push( {id: "count", type: "number"});

        for (var j in tmpField.sum) {
            fields.push( {id: j + "_sum", type: "number"});
        }

        for (var j in tmpField.partitionsum) {
            fields.push( {id: j + "_sum", type: "number"});
        }

        for (var j in tmpField.partitioncount) {
            fields.push( {id: j + "_count", type: "number"});
        }

        var tempAvg =   tmpField.avg() ;
        for (var j in tempAvg) {
            fields.push( {id: j + "_avg", type: "number"});
        }


        if(dimensions != null) {
            fields.push( {id: "dimension"});
            for(i=0;i<dimensions.length;i++){


                var originalFieldAttributes = this.attributes.dataset.fields.get(dimensions[i]).attributes;;
                fields.push( {id: dimensions[i], type: originalFieldAttributes.type, label: originalFieldAttributes.label, format: originalFieldAttributes.format});

            }
        }

        if(dimensions != null) {
            // set of results dataset
            for(i=0;i<tmpResult.length;i++){


                var keyField = tmpResult[i].key.split("_");

                var tmp = {dimension: tmpResult[i].key, count: tmpResult[i].value.count};


                for(j=0;j<keyField.length;j++){
                    tmp[dimensions[j]] = keyField[j];

                }


                for (var j in tmpResult[i].value.sum) {
                    tmp[j + "_sum"] = tmpResult[i].value.sum[j];
                }

                for (var j in tmpResult[i].value.partitionsum) {
                    tmp[j + "_sum"] = tmpResult[i].value.partitionsum[j];
                }


                for (var j in tmpResult[i].value.partitioncount) {
                    tmp[j + "_count"] = tmpResult[i].value.partitioncount[j];
                }

                var tempAvg =   tmpResult[i].value.avg();

                for (var j in tempAvg) {
                    tmp[j + "_avg"] = tempAvg[j];
                }
                result.push(tmp);
            }
        }
        else
        {
            var tmp = { count: tmpField.count};

            for (var j in tmpField.sum) {
                tmp[j + "_sum"] = tmpField.sum[j];
            }

            for (var j in tmpField.partitionCount) {
                tmp[j + "_sum"] = tmpField.partitionCount[j];
            }

            var tempAvg =   tmpField.avg();

            for (var j in tempAvg) {
                tmp[j + "_avg"] = tempAvg[j];

            }
            result.push(tmp);

        }


        this._store = new recline.Backend.Memory.Store(result, fields);
        this.fields.reset(fields);
        this.recordCount = result.length;
        this.records.reset(result);

        //console.log("VModel fields");
        //console.log(fields);

    },

    query: function(queryObj) {
        /*console.log("query start");
        console.log(this.attributes.dataset.toJSON());
        console.log(self.records.toJSON() );
        */

        console.log("VModel - query for " + JSON.stringify(queryObj));

        var self = this;
        var dfd = $.Deferred();
        this.trigger('query:start');

        if (queryObj) {
            this.queryState.set(queryObj, {silent: true});
        }
        var actualQuery = this.queryState.toJSON();

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

    _handleQueryResult: function(queryResult) {
        console.log("handlequeryresult virtual");

        var self = this;
        self.recordCount = queryResult.total;
        var docs = _.map(queryResult.hits, function(hit) {
            var _doc = new my.Record(hit);
            _doc.fields = self.fields;
            return _doc;
        });
        self.records.reset(docs);
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
  }
});



}(jQuery, this.recline.Model));

