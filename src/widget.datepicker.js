this.recline = this.recline || {};
this.recline.View = this.recline.View || {};

(function ($, view) {

    "use strict";

    view.DatePicker = Backbone.View.extend({


        template:'<div style="width: 230px;" id="datepicker-calendar-{{uid}}"></div>',


        initialize:function (options) {

            this.el = $(this.el);
            _.bindAll(this, 'render', 'redraw');

            if (this.model) {
                this.model.bind('change', this.render);
                this.model.fields.bind('reset', this.render);
                this.model.fields.bind('add', this.render);

                this.model.bind('query:done', this.redraw);
                this.model.queryState.bind('selection:done', this.redraw);
            }

            $(window).resize(this.resize);
            this.uid = options.id || (new Date().getTime() + Math.floor(Math.random() * 10000)); // generating an unique id

            var out = Mustache.render(this.template, this);
            this.el.html(out);

        },

        daterange: {
            yesterday: "day",
            lastweeks: "week",
            lastdays: "month",
            lastmonths: "month",
            lastquarters: "quarter",
            lastyears: "year",
            previousyear: "year",
            custom: "day"
        },

        //previousperiod

        onChange: function(view) {
            var exec = function (data, widget) {

            var actions = view.getActionsForEvent("selection");

            if (actions.length > 0) {
                var startDate= new Date(data.dr1from_millis);
                var endDate= new Date(data.dr1to_millis);
                var rangetype = view.daterange[data.daterangePreset];

                var value =   [
                    {field: "date", value: [startDate, endDate]},
                    {field: "rangetype", value: [rangetype]}
                ];

                view.doActions(actions, value );
            }



            var actions_compare = view.getActionsForEvent("selection_compare");

            if (actions_compare.length > 0) {
                var rangetype = view.daterange[data.daterangePreset];
                if(data.comparisonPreset != "previousperiod")
                    rangetype = view.daterange[data.comparisonPreset];

                var date_compare = [{field: "date", value: [null, null]}];

                if (data.comparisonEnabled) {
                    var startDate= new Date(data.dr2from_millis);
                    var endDate= new Date(data.dr2to_millis);
                    if(startDate != null && endDate != null)
                        var date_compare =   [
                            {field: "date", value: [startDate, endDate]},
                            {field: "rangetype", value: [rangetype]}
                        ];
                }

                view.doActions(actions_compare, date_compare);
            }

        }
            return exec;
        },

        doActions:function (actions, values) {

            _.each(actions, function (d) {
                d.action.doActionWithValues(values, d.mapping);
            });

        },

        render:function () {
            var self = this;
            var uid = this.uid;

            $('#datepicker-calendar-' + uid).DateRangesWidget(
                {
                    aggregations:[],
                    values:{
                        comparisonEnabled:false,
                        daterangePreset:"lastweeks",
                        comparisonPreset:"previousperiod"
                    },
                    onChange: self.onChange(self)

                });

        },

        redraw:function () {

        },

        getActionsForEvent:function (eventType) {
            var actions = [];

            _.each(this.options.actions, function (d) {
                if (_.contains(d.event, eventType))
                    actions.push(d);
            });

            return actions;
        }


    });
})(jQuery, recline.View);