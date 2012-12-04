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


            this.fields = new my.FieldList();

            var tmpFields = [];
            _.each(this.attributes.dataset1.fields.models, function(f) {
                var c = f.toJSON();
                c.id = "DS1." + c.id;
                tmpFields.push(c);
            });

            _.each(this.attributes.dataset2.fields.models, function(f) {
                var c = f.toJSON();
                c.id = "DS2." + c.id;
                tmpFields.push(c);
            });

            this.fields.reset(tmpFields);

            this.records = new my.RecordList();
            //todo
            //this.facets = new my.FacetList();
            this.recordCount = null;

            this.queryState = new my.Query();

            if (this.get('initialState')) {
                this.get('initialState').setState(this);
            }

            this.attributes.dataset1.bind('query:done', function () {
                self.query();
            })
            this.attributes.dataset2.bind('query:done', function () {
                self.query();
            })

            this.queryState.bind('change', function () {
                self.query();
            });

        },

        query:function (queryObj) {
            var self=this;
            this.trigger('query:start');

            if (queryObj) {
                this.queryState.set(queryObj, {silent:true});
            }

            var queryObj = this.queryState.toJSON();

            console.log("Query on model query [" + JSON.stringify(queryObj) + "]");

            var dataset1 = self.attributes.dataset1;
            var dataset2 = self.attributes.dataset2;

            var results = self.join();

            var numRows = queryObj.size || results.length;
            var start = queryObj.from || 0;

            //todo use records filtering in order to inherit all record properties
            //todo perhaps need a new applyfiltersondata

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

            self.trigger('query:done');
        },

        join: function() {
            var joinon      = this.attributes.joinon;
            var dataset1    = this.attributes.dataset1;
            var dataset2    = this.attributes.dataset2;


            var results = [];

            _.each(dataset1.getRecords(), function(r) {
                var filters = [];
                // creation of a filter on dataset2 based on dataset1 field value of joinon field
                _.each(joinon, function(f) {
                    var field = dataset1.fields.get(f);
                    filters.push({field: field.id, type: "term", term:r.getFieldValueUnrendered(field), fieldType:field.attributes.type });
                })

                var resultsFromDataset2 = recline.Data.Filters.applyFiltersOnData(filters, dataset2.records.toJSON(), dataset2.fields.toJSON());
                var record = {};
                _.each(r.toJSON(), function(f, index) {
                   record["DS1." + index] = f;
                });

                _.each(resultsFromDataset2, function(res) {
                    _.each(res, function(field_value, index) {
                        record["DS2." + index] = field_value;
                    })
                    results.push(record);
                })

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
        }


    })


}(jQuery, this.recline.Model));

