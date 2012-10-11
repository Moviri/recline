this.recline = this.recline || {};

(function($, my) {

    my.ActionUtility = {};


        my.ActionUtility.doAction =    function(actions, eventType, eventData, actionType) {

        // find all actions configured for eventType
        var targetActions = _.filter(actions, function(d) {
            var tmpFound = _.find(d["event"], function(x) {return x==eventType});
            if(tmpFound != -1)
                return true;
            else
                return false;
        });

        // foreach action prepare field
        _.each(targetActions, function(currentAction) {
            var mapping = currentAction.mapping;
            var actionParameters = [];
            //foreach mapping set destination field
            _.each(mapping, function(map) {
                if(eventData[map["srcField"]] == null) {
                    console.log( "warn: sourceField: [" + map["srcField"] + "] not present in event data" );
                } else {


                    var param = {
                        filter: map["filter"],
                        value: eventData[map["srcField"]]
                    };
                    actionParameters.push(param);
                }
            });

            if( actionParameters.length > 0)  {
                currentAction.action._internalDoAction(actionParameters, actionType);
            }
        });
    },

my.ActionUtility.getActiveFilters = function(actions) {

    var activeFilters = [];
    _.each(actions, function(currentAction) {
        _.each(currentAction.mapping, function(map) {
            var currentFilter= currentAction.action.getActiveFilters(map.filter, map.srcField);
            if(currentFilter!=null && currentFilter.length>0)
                activeFilters = _.union(activeFilters, currentFilter) ;
        })
    });

    return activeFilters;
};

// ## <a id="dataset">Action</a>
my.Action = Backbone.Model.extend({
    constructor: function Action() {
        Backbone.Model.prototype.constructor.apply(this, arguments);
    },

   initialize: function(){

   },

    // action could be add/remove
   _internalDoAction: function(data, action) {
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

                   var modified = false;

                   _.each(targetFilters, function(f) {

                       // verify if filter is associated with current model
                       if(_.find(m.filters, function(x) {return x == f.name;}) != null) {
                            // if associated add the filter
                           if(action == "add")
                           {

                            self.modelsAddFilterActions[type](m.model, f);
                               modified = true;
                           }
                             else if(action == "remove") {

                                self.modelsRemoveFilterActions[type](m.model, f);
                               modified = true;
                           }
                       }
                   });

                   if(modified) {
                       self.modelsTriggerActions[type](m.model);
                   }
               });
       });




   },

    getActiveFilters: function(filterName, srcField) {
        var self=this;
        var models = this.attributes.models;
        var type = this.attributes.type;
        var filtersProp = this.attributes.filters;

        // for each type
        // foreach dataset
        // get filter
        // push to result, if already present error
        var foundFilters = [];

        _.each(type, function(type) {
            _.each(models, function(m) {
                var usedFilters = _.filter(m.filters, function(f){ return f == filterName; });
                _.each(usedFilters, function(f) {
                    // search filter
                    var filter = filtersProp[f];
                    if(filter != null) {
                        var filterOnModel = self.modelsGetFilter[type](m.model, filter.field);
                        // substitution of fieldname with the one provided by source
                        if(filterOnModel != null) {
                            filterOnModel.field = srcField;
                            foundFilters.push(filterOnModel);
                        }
                    }
                });
             });
        });


        return foundFilters;
    },


    modelsGetFilter: {
        filter:     function(model, fieldName) {
            return model.queryState.getFilterByFieldName(fieldName)  ;
        },
        selection:  function(model, fieldName) { throw "not implemented selection for modelsGetFilterActions" }
    },

    modelsAddFilterActions: {
        filter:     function(model, filter) { model.queryState.setFilter(filter)},
        selection:  function(model, filter) { model.queryState.setSelection(filter)}
    },

    modelsRemoveFilterActions: {
        filter:     function(model, filter) { model.queryState.removeFilterByField(filter.field);  },
        selection:  function(model, filter) { throw "modelsRemoveFilterActions not implemented for selection"}
    },

    modelsTriggerActions: {
        filter:     function(model) { model.queryState.trigger("change")},
        selection:  function(model) { model.queryState.trigger("selection:change")}
    },

    filters: {
        term: function(filter, data) {

            if(data.length > 1) {
                console.log(data);
                throw "Data passed for filtertype term not valid. Data lenght should be 1 or empty but is " + data.length;
            }

            filter["term"] = data[0];
            return filter;
        },
        range: function(filter, data) {

            if(data.length != 2) {
                console.log(data);
                throw "Data passed for filtertype range not valid. Data lenght should be 2 but is " + data.length;
            }

            filter["start"] = data[0];
            filter["stop"]  = data[1];
            return filter;
        },
        list: function(filter, data) {

            if(data.length < 1) {
                
                throw "Data passed for filtertype list not valid. Data lenght should be greater than 1 but is " + data.length;
            }

            filter["list"] = data;
            
            return filter;
        }
    }




});


}(jQuery, this.recline));
