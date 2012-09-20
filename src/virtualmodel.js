// # Recline Backbone Models
this.recline = this.recline || {};
this.recline.Model = this.recline.Model || {};

(function($, my) {

// ## <a id="dataset">Dataset</a>
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

        // TODO gestione eventi di cambio del modello "padre"
    },



    updateGroupedDataset: function() {

        var dimensions = this.attributes.aggregation.dimensions;
        var aggregatedFields = this.attributes.aggregation.aggregatedFields;

        var tmpDataset = crossfilter(this.attributes.dataset.records.toJSON());

        var by_dimension = tmpDataset.dimension(function(d) {
            var tmp = "";
            for(i=0;i<dimensions.length;i++){
                if(i>0) { tmp = tmp + "_"; }

                tmp = tmp + d[dimensions[i]];
            }
            return tmp;
        });


        var group = by_dimension.group();

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

            return tmp;
        }

        var tmpResult =  group.reduce(sumAdd,sumRemove,sumInitialize).all();
        var result = [];
        var fields = [];

        if(tmpResult.length > 0) {
            fields.push( {id: "dimension"});
            fields.push( {id: "count"});

            for (var j in tmpResult[0].value.sum) {
                fields.push( {id: j});
            }

            for(i=0;i<dimensions.length;i++){
                fields.push( {id: dimensions[i]});
            }
        }


        for(i=0;i<tmpResult.length;i++){


            var keyField = tmpResult[i].key.split("_");


            var tmp = {dimension: tmpResult[i].key, count: tmpResult[i].value.count};


            for(j=0;j<keyField.length;j++){
                tmp[dimensions[j]] = keyField[j];

            }


            for (var j in tmpResult[i].value.sum) {
               tmp[j] = tmpResult[i].value.sum[j];
            }
            result.push(tmp);
        }

        self._store = new recline.Backend.Memory.Store(result, fields);
        this.fields.reset(fields);
        this.recordCount = result.length;
        this.records.reset(result);

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
    var self = this;
    var query = new my.Query();
    query.set({size: 0});
    this.fields.each(function(field) {
      query.addFacet(field.id);
    });
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

