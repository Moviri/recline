// # Recline Backbone Models
this.recline = this.recline || {};
this.recline.Model = this.recline.Model || {};
this.recline.Model.SocketDataset = this.recline.Model.SocketDataset || {};


(function ($, my) {


    my.SocketDataset = Backbone.Model.extend({
        constructor:function FilteredDataset() {
            Backbone.Model.prototype.constructor.apply(this, arguments);
        },


        initialize:function () {
            var self = this;


            this.records = new my.RecordList();
            this.fields =  new my.FieldList()

            self.fields.reset(this.get("fields"));

            this.recordCount = 0;

            this.queryState = new my.Query();




        },


        attach:function () {
            var self=this;
            this.trigger('attach:start');

            var queryObj = self.queryState.toJSON();


            var socket = io.connect(self.attributes.url, { port: self.attributes.port, resource: self.attributes.resource});

            socket.on(self.attributes.queue, function (data) {
                console.log(data);

                //var results = recline.Data.Filters.applyFiltersOnData(queryObj.filters, data, self.fields);

                var numRows = queryObj.size || self.recordCount;
                var start = queryObj.from || 0;

                /*
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
                */

                //results = results.slice(start, start + numRows);
                //self.recordCount = results.length;

                self.records.add(data);

/*                var docs = _.map(data, function (hit) {
                    var tmp = {};

                    var _doc = new my.Record(tmp);
                    _doc.fields = dataset.fields;
                    return _doc;
                });

                self.records.add(docs);
*/

                self.recordCount = self.records.length;
            });


            self.trigger('attach:done');
            // GET DATA
            // AAAAAAAAAAAAAAAAAAAA

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

        },
        toFullJSON:function (resultType) {
            var self = this;
            return _.map(self.records.models, function (r) {
                var res = {};

                _.each(self.fields.models, function (f) {
                    res[f.id] = r.getFieldValueUnrendered(f);
                });

                return res;

            });
        }



    })


}(jQuery, this.recline.Model));

