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

