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


        this.fields = new my.FieldList();
        this.records = new my.RecordList();
        this.recordCount = null;
        this.queryState = new my.Query();

        this.updateGroupedDataset();

        // TODO manage of change event of parent dataset
        // TODO manage of filtering on data
    },



    updateGroupedDataset: function() {

        // TODO optimization has to be done in order to limit the number of cycles on data

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

        console.log("Records"); console.log(result);
        console.log("Fields"); console.log(fields);

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

}(jQuery, this.recline.Model));

