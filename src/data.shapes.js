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
            if(self.attributes.dataset.dataset.records.models.length > 0) {
                self._generateFromDataset();
            }
        },


        setDataset: function(ds, field) {
            var self=this;
            self.attributes.dataset = {dataset: ds, field: field};
            if(!ds.attributes["shapeSchema"])
                ds.attributes["shapeSchema"] = [];

            ds.attributes["shapeSchema"].push({schema:self, field: field});

            ds.setShapeSchema();

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


        getShapeFor: function(fieldValue) {
            var self=this;
            if(this.schema == null)
                throw "data.shape.js: shapechema not yet initialized, datasource not fetched?"


            return  this.schema[fieldValue];
        },

        getRecordsArray: function(dataset) {
            var self=this;
            var ret = [];

            if(dataset.dataset.isFieldPartitioned(dataset.field))   {
                var fields = dataset.dataset.getPartitionedFields(dataset.field);
            _.each(dataset.dataset.records.models, function(d) {
                _.each(fields, function (field) {
                    ret.push(d.attributes[field.id]);
                });
            });
            }
            else{
                var  fields = [dataset.field];;
                _.each(dataset.dataset.records.models, function(d) {
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
}(jQuery, this.recline.Data));
