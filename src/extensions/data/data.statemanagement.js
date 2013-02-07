this.recline = this.recline || {};
this.recline.Data = this.recline.Data || {};

(function ($, my) {
// adapted from https://github.com/harthur/costco. heather rules

    my.StateManagement = {};


    my.StateManagement.State = Backbone.Model.extend({
        constructor:function State() {
            Backbone.Model.prototype.constructor.apply(this, arguments);
        },

        // ### initialize
        initialize:function () {
            var self = this;

            _.each(self.attributes.models, function (c) {
                c.queryState.bind("change",
                    self.setState(self.attributes.stateName))
                c.queryState.bind("selection:change",
                    self.setState(self.attributes.stateName))
            });

            var state = my.StateManagement.getState(self.attributes.stateName);

            // ig a state is present apply it to all models
            if (state) {
                _.each(self.attributes.models, function (c) {
                    _.each(state.filters, function (f) {
                        c.queryState.setFilter(f);
                    });
                    _.each(state.selections, function (s) {
                        c.queryState.setSelection(s);
                    });


                });
            }

        },


        setState:function (stateName) {
            var self = this;
            var queryString = self.attributes;
            var filters;
            var selections;


            if (this.attributes.useOnlyFields) {
                filters = _.filter(queryString.filters, function (f) {
                    return _.contains(self.attributes.useOnlyFields, f.field)
                });
                selections = _.filter(queryString.selections, function (f) {
                    return _.contains(self.attributes.useOnlyFields, f.field)
                });
            } else {
                filters = queryString.filters;
                selections = queryString.selections;
            }

            $.cookie("recline.extensions.statemanagement." + stateName, JSON.stringify({filters:filters, selections:selections}));
        }
    });


    my.StateManagement.getState = function (name) {
        var res = $.cookie("recline.extensions.statemanagement." + name);
        if(res)
         return JSON.parse(res);

        return null;
    };


}(jQuery, this.recline.Data))
