this.recline = this.recline || {};

(function($, my) {

// ## <a id="dataset">Action</a>
my.Action = Backbone.Model.extend({
    constructor: function Action() {
        Backbone.Model.prototype.constructor.apply(this, arguments);
    },

   initialize: function(){

   },

   doAction: function(data) {
        console.log("Received doAction for");
       console.log(data);

       var self=this;

       var filters = this.attributes.filters;
       var models = this.attributes.models;
       var type = this.attributes.type;

       var targetFilters = [];

       //populate all filters with data received from event
       //foreach filter defined in data
       _.each(data, function(f) {
           // filter creation
           var currentFilter = filters[f.filter];
           if(currentFilter == null){
               throw "Filter " + f.filter + " defined in actions data not configured for action ";
           }
           currentFilter["name"] = f.filter;
           if(self.filters[currentFilter.type] == null)
                throw "Filter not implemented for type " + currentFilter.type;

           targetFilters.push(self.filters[currentFilter.type](currentFilter, f.value));

       });


       // foreach type and dataset add all filters and trigger events
       _.each(type, function(type) {
               _.each(models, function(m) {

                   // todo check if models contains filter
                   _.each(targetFilters, function(f) {

                       // verify if filter is associated with current model
                       if(_.find(models.filters, function(x) {x == f.name;}) != -1) {
                            // if associated add the filter
                           self.modelsAddFilterActions[type](m.model, f);

                       }
                   });

                   self.modelsTriggerActions[type](m.model);

               });
       });




   },

    modelsAddFilterActions: {
        filter:     function(model, filter) { model.queryState.addFilter(filter)},
        selection:  function(model, filter) { model.queryState.addSelection(filter)}
    },

    modelsTriggerActions: {
        filter:     function(model) { model.queryState.trigger("change")},
        selection:  function(model) { model.queryState.trigger("selection:change")}
    },

    filters: {
        term: function(filter, data) {

            if(data.length != 1)
                throw "Data passed for filtertype term not valid. Data lenght should be 1 but is " + data.length;

            filter["term"] = data[0];
            return filter;
        }
    }




});


}(jQuery, this.recline));
