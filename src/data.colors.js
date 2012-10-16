// # Recline Backbone Models
this.recline = this.recline || {};
this.recline.Data = this.recline.Data || {};
this.recline.Data.ColorSchema = this.recline.Data.ColorSchema || {};

(function($, my) {
    my.ColorSchema = Backbone.Model.extend({
        constructor: function ColorSchema() {
            Backbone.Model.prototype.constructor.apply(this, arguments);
        },

        // ### initialize
        initialize: function() {
            var self=this;


            if(this.attributes.data) {
                var data = this.attributes.data;
                self._generateLimits(data);
            } else if(this.attributes.dataset != null) {

            }
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
            if(!ds.attributes["colorSchema"])
                ds.attributes["colorSchema"] = [];

            ds.attributes["colorSchema"].push({schema:self, field: field});

            ds.setColorSchema();

            self.bindToDataset();
        },

        _generateFromDataset: function() {
            var self=this;
            var data =  this.getRecordsArray();
            self._generateLimits(data);
            console.log("generated");
            console.log(self);
        },

        _generateLimits: function(data) {
            var self=this;
            switch(this.attributes.type) {
                case "scaleWithDataMinMax":
                    self.schema =  new chroma.ColorScale({
                        colors: this.attributes.colors,
                        limits: this.limits["minMax"](data)
                    });
                    break;
                case "scaleWithDistinctData":
                    self.schema =  new chroma.ColorScale({
                        colors: this.attributes.colors,
                        limits: this.limits["distinct"](data)
                    });
                    break;
                default:
                    throw "data.colors.js: unknown or not defined properties type " + this.attributes.type;
            }
        },

        getColorFor: function(value) {

            if(this.schema == null)
                throw "data.colors.js: colorschema not yet initialized, datasource not fetched?"

            var self=this;
            return this.schema.getColor(self.getFieldValue(value)) ;
        },

        getRecordsArray: function() {
            var self=this;
            var selfds = self.attributes.dataset;
            var ret = []
            _.each(selfds.dataset.records.models, function(d) {
                ret.push(self.getFieldValue(d.attributes[selfds.field]));
            });
            return ret;
        },

        getFieldValue: function(value) {
            var self=this;
            if(isNaN(value))
               return  self.hashCode(value);
            else
                return Number(value);
        },

        limits: {
            minMax: function(data) {
                var limit = [null, null];
                _.each(data, function(d) {
                    if(limit[0] == null)    limit[0] = d;
                    else                    limit[0] = Math.min(limit[0], d);

                    if(limit[1] == null)    limit[1] = d;
                    else                    limit[1] = Math.max(limit[1], d);
                });

                return limit;
            },
            distinct: function(data) { return _.uniq(data); }

        },

        hashCode: function(data){
        var hash = 0, i, char;
        if (data.length == 0) return hash;
        for (i = 0; i < data.length; i++) {
            char = data.charCodeAt(i);
            hash = ((hash<<5)-hash)+char;
            hash = hash & hash; // Convert to 32bit integer
        }
        return hash;
        }



    })
}(jQuery, this.recline.Data));
