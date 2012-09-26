// # Recline Backbone Models
this.recline = this.recline || {};
this.recline.Model = this.recline.Model || {};

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

        this.attributes.dataset.records.bind('reset',       function() {
            //console.log("VModel - received records.reset");
            self.initializeCrossfilter(); });
        this.attributes.dataset.records.bind('change',       function() {
            //console.log("VModel - received records.change");
            self.initializeCrossfilter(); });
        //this.queryState.bind('change',                      function() { self.updateCrossfilter(); });

        //this.queryState.bind('change',                      function() { self.query(); });
        this.queryState.bind('change:filters:new-blank',    function() {
            //console.log("VModel - received change:filters:new-blank");
            self.query(); });

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
        this.crossfilterData = crossfilter(this.attributes.dataset.records.toJSON());

        var end = new Date().getTime();
        var time = end - start;

        console.log("initializeCrossfilter - exec time: " + time);

        this.updateCrossfilter();
    },

    createDimensions: function() {
        var dimensions = this.attributes.aggregation.dimensions;

        if(dimensions == null ){
            // need to evaluate aggregation function on all records
            this.group =  this.crossfilterData.groupAll();
        }
        else {
            var by_dimension = this.crossfilterData.dimension(function(d) {
                var tmp = "";
                for(i=0;i<dimensions.length;i++){
                    if(i>0) { tmp = tmp + "_"; }

                    tmp = tmp + d[dimensions[i]];
                }
                return tmp;
            });
          this.group = by_dimension.group();
        }
    },

    updateCrossfilter: function() {
        // TODO optimization has to be done in order to limit the number of cycles on data
        // TODO has sense to recreate dimension if nothing is changed?, and in general, is better to use a new dimension if added instead of recreate all
        // TODO verify if saving crossfilter data is useful (perhaps no unless we use crossfilterstore to make aggregaation and filtering)


        var start = new Date().getTime();


        this.createDimensions();
        this.reduce();
        this.updateStore();

        var end = new Date().getTime();
        var time = end - start;

        console.log("updateCrossfilter - exec time: " + time);
    },

    reduce: function() {
        var aggregatedFields = this.attributes.aggregation.aggregatedFields;

        var partitioning = false;
        var partitions;
        if(this.attributes.aggregation.partitions != null) {
            partitions = this.attributes.aggregation.partitions;
            var partitioning = true;
        }

        function sumAdd(p, v) {
            p.count = p.count +1;
            for(i=0;i<aggregatedFields.length;i++){
                p.sum[aggregatedFields[i]] = p.sum[aggregatedFields[i]] + v[aggregatedFields[i]];

                if(partitioning) {
                    // for each partition need to verify if exist a value of aggregatefield_by_partition_partitionvalue_sum
                    for(x=0;x<partitions.length;x++){
                        var fieldName = aggregatedFields[i] + "_by_" + partitions[x] + "_" + v[partitions[x]];

                        if(p.sum[fieldName] == null)
                            p.sum[fieldName] = 0;

                        p.sum[fieldName] = p.sum[fieldName] + v[aggregatedFields[i]];
                    }
                }

            }
            return p;
        }

        function sumRemove(p, v) {
            p.count = p.count - 1;

            for(i=0;i<aggregatedFields.length;i++){
                p.sum[aggregatedFields[i]] = p.sum[aggregatedFields[i]] - v[aggregatedFields[i]];


            }

            return p;
        }

        function sumInitialize() {


            tmp = {count: 0, sum: {}};

            for(i=0;i<aggregatedFields.length;i++){
                tmp.sum[aggregatedFields[i]] = 0;


            }

            tmp.avg = function(aggr){
                return function(){
                    var map = {};
                    for(var o=0;o<aggr.length;o++){
                        map[aggr[o]] = this.sum[aggr[o]] / this.count;
                    }

                    return map;
                }
            }(aggregatedFields);

            return tmp;
        }


        this.reducedGroup  =  this.group.reduce(sumAdd,sumRemove,sumInitialize);
    },

    updateStore: function() {
        var dimensions = this.attributes.aggregation.dimensions;

        var tmpResult;
        var result = [];
        var fields = [];

        var tmpField;

        if(dimensions == null)  {
            tmpResult =  this.reducedGroup.value();
            tmpField = tmpResult;
        }
        else {
            tmpResult =  this.reducedGroup.all();
            tmpField = tmpResult[0].value;
        }

        // set of fields array


        fields.push( {id: "count"});

        for (var j in tmpField.sum) {
            fields.push( {id: j + "_sum"});
        }

        var tempAvg =   tmpField.avg() ;
        for (var j in tempAvg) {
            fields.push( {id: j + "_avg"});
        }

        if(dimensions != null) {
            fields.push( {id: "dimension"});
            for(i=0;i<dimensions.length;i++){
                fields.push( {id: dimensions[i]});
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

