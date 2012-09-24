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
        var self = this;
        this.backend = recline.Backend.Memory;
        this.fields = new my.FieldList();
        this.records = new my.RecordList();
        this.recordCount = null;
        this.queryState = new my.Query();


        // this.updateGroupedDataset();

        this.attributes.dataset.records.bind('reset', function() {
            console.log(self);
            self.updateGroupedDataset();
        });

        // TODO manage filtering on data
    },

    // ### fetch
    //
    // Retrieve dataset and (some) records from the backend.
    fetch: function() {
        this.attributes.dataset.fetch();

    },

    modifyGrouping: function(dimensions, aggregationField)
    {
        this.attributes.aggregation.aggregatedFields = aggregationField;
        this.attributes.aggregation.dimensions = dimensions;
        updateGroupedDataset(this);
    },
    addDimension: function(dimension)
    {
        this.attributes.aggregation.dimensions.push = dimension;
        updateGroupedDataset(this);
    },
    addAggregationField: function(field) {
        this.attributes.aggregation.aggregatedFields.push(field);
        updateGroupedDataset(this);
    },


    updateGroupedDataset: function() {
        console.log("Starting grouping");
        var start = new Date().getTime();


        // TODO optimization has to be done in order to limit the number of cycles on data
        // TODO use crossfilter to save grouped data in order to add/remove dimensions


        var dimensions = this.attributes.aggregation.dimensions;
        var aggregatedFields = this.attributes.aggregation.aggregatedFields;

        var tmpDataset = crossfilter(this.attributes.dataset.records.toJSON());
        var group;

         if(dimensions == null ){
             // need to evaluate aggregation function on all records
             group =  tmpDataset.groupAll();
         }
        else {
            var by_dimension = tmpDataset.dimension(function(d) {
                var tmp = "";
                for(i=0;i<dimensions.length;i++){
                    if(i>0) { tmp = tmp + "_"; }

                    tmp = tmp + d[dimensions[i]];
                }
                return tmp;
            });
            group = by_dimension.group();

         }




        function sumAdd(p, v) {
            p.count = p.count +1;
            for(i=0;i<aggregatedFields.length;i++){
                p.sum[aggregatedFields[i]+"_sum"] = p.sum[aggregatedFields[i]+"_sum"] + v[aggregatedFields[i]];
            }
            return p;
        }

        function sumRemove(p, v) {
            p.count = p.count - 1;

            for(i=0;i<aggregatedFields.length;i++){
                p.sum[aggregatedFields[i]+"_sum"] = p.sum[aggregatedFields[i]+"_sum"] - v[aggregatedFields[i]];
            }

            return p;
        }

        function sumInitialize() {
            tmp = {count: 0, sum: {}};

              for(i=0;i<aggregatedFields.length;i++){
                tmp.sum[aggregatedFields[i] + "_sum"] = 0;
            }

            tmp.avg = function(aggr){
               return function(){
                    var map = {};
                    for(var o=0;o<aggr.length;o++){
                        map[aggr[o] + "_avg"] = this.sum[aggr[o] + "_sum"] / this.count;
                    }

                    return map;
                }
            }(aggregatedFields);

            return tmp;
        }

        var tmpResult;
        var reducedGroup  =  group.reduce(sumAdd,sumRemove,sumInitialize);
          if(dimensions == null)
            tmpResult = reducedGroup.value();
        else
              tmpResult = reducedGroup.all();

        console.log(tmpResult);

        var result = [];
        var fields = [];

        var tmpField;
        if(dimensions == null)
            tmpField =  tmpResult;
        else
            tmpField = tmpResult[0].value;

        // set of fields array


            fields.push( {id: "count"});

            for (var j in tmpField.sum) {
                fields.push( {id: j});
            }

            var tempAvg =   tmpField.avg() ;
            for (var j in tempAvg) {
                fields.push( {id: j});
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
               tmp[j] = tmpResult[i].value.sum[j];
            }

            var tempAvg =   tmpResult[i].value.avg();

            for (var j in tempAvg) {
                tmp[j] = tempAvg[j];
            }
            result.push(tmp);
        }
        }
        else
        {
            var tmp = { count: tmpField.count};

            for (var j in tmpField.sum) {
                tmp[j] = tmpField.sum[j];
            }

            var tempAvg =   tmpField.avg();

            for (var j in tempAvg) {
                tmp[j] = tempAvg[j];
            }
            result.push(tmp);

        }


        self._store = new recline.Backend.Memory.Store(result, fields);
        this.fields.reset(fields);
        this.recordCount = result.length;
        this.records.reset(result);

        var end = new Date().getTime();
        var time = end - start;

        console.log("Grouping - exec time: " + time);
    },



  toTemplateJSON: function() {
    var data = this.toJSON();
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

    // ## <a id="query">Query</a>
    my.Grouping = Backbone.Model.extend({
        constructor: function Grouping() {
            Backbone.Model.prototype.constructor.apply(this, arguments);
        },

        _groupingTemplates: {
            groupAll: {
                type: 'groupAll'
            },
            groupByDimension: {
                type: "groupByDimension",
                dimensions: [],
                aggregatedFields: []
            }
        },

        addDimension: function(dimension) {

            var ourfilter = JSON.parse(JSON.stringify(dimension));
            var group = this.get('filters');
            filters.push(ourfilter);
            this.trigger('change:grouping');
        },
        updateFilter: function(index, value) {
        },
        // ### removeFilter
        //
        // Remove a filter from filters at index filterIndex
        removeFilter: function(filterIndex) {
            var filters = this.get('filters');
            filters.splice(filterIndex, 1);
            this.set({filters: filters});
            this.trigger('change:grouping');
        },

        // ### addSelection
        //
        // Add a new selection (appended to the list of selections)
        //
        // @param selection an object specifying the filter - see _filterTemplates for examples. If only type is provided will generate a filter by cloning _filterTemplates
        addSelection: function(selection) {
            // crude deep copy
            var myselection = JSON.parse(JSON.stringify(selection));
            // not full specified so use template and over-write
            // 3 as for 'type', 'field' and 'fieldType'
            if (_.keys(selection).length <= 3) {
                myselection = _.extend(this._selectionTemplates[selection.type], myselection);
            }
            var filters = this.get('selections');
            filters.push(myselection);
            this.trigger('change:grouping');
        },
        // ### removeSelection
        //
        // Remove a selection at index selectionIndex
        removeSelection: function(selectionIndex) {
            var selections = this.get('selections');
            selections.splice(selectionIndex, 1);
            this.set({selections: selections});
            this.trigger('change:grouping');
        },
        isFieldSelected: function(fieldName, fieldVale) {
            // todo check if field is selected
            return false;
        },


        // ### addFacet
        //
        // Add a Facet to this query
        //
        // See <http://www.elasticsearch.org/guide/reference/api/search/facets/>
        addFacet: function(fieldId) {
            var facets = this.get('facets');
            // Assume id and fieldId should be the same (TODO: this need not be true if we want to add two different type of facets on same field)
            if (_.contains(_.keys(facets), fieldId)) {
                return;
            }
            facets[fieldId] = {
                terms: { field: fieldId }
            };
            this.set({facets: facets}, {silent: true});
            this.trigger('facet:add', this);
        },
        addHistogramFacet: function(fieldId) {
            var facets = this.get('facets');
            facets[fieldId] = {
                date_histogram: {
                    field: fieldId,
                    interval: 'day'
                }
            };
            this.set({facets: facets}, {silent: true});
            this.trigger('facet:add', this);
        }
    });

}(jQuery, this.recline.Model));

