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
            lastdays: "day",
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

            self.datepicker = $('#datepicker-calendar-' + uid).DateRangesWidget(
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
            // todo must use dateranges methods

           if(!this.model) return;

            var self=this;

            var currentdate = $('.date-ranges-picker').DatePickerGetDate()[0];
            var period = [null,null,null,null];

            var f = self.model.queryState.getFilterByFieldName(self.options.fields.date)
                if(f && f.type == "range") {
                    period[0] = new Date(f.start);
                    period[1] = new Date(f.stop);

                    $('.dr1.from').val(period[0]);
                }
            var f = self.model.queryState.getFilterByFieldName(self.options.fields.type)
            if(f && f.type == "term") {
                // check custom weeks/month

            }

            if(this.options.compareModel) {
                var f = self.options.compareModel.queryState.getFilterByFieldName(self.options.compareFields.date)
                if(f && f.type == "range") {
                    period[2] = new Date(f.start);
                    period[3] = new Date(f.stop);
                }
                var f = self.model.queryState.getFilterByFieldName(self.options.fields.type)
                if(f && f.type == "term") {
                    // check custom weeks/month

                }

            }
            var values = self.datepicker.data("DateRangesWidget").options.values;
            values.daterangePreset = "custom";
            values.comparisonEnabled = true;

            if(!period[0] || !period[1]) {
                values.dr1from = "N/A";
                values.dr1from_millis = "";
                values.dr1to = "N/A";
                values.dr1to_millis = "";
            }
            else {
                values.dr1from = period[0].getDate() + '/' + (period[0].getMonth()+1) + '/' + period[0].getFullYear();
                values.dr1from_millis = new Date(period[0]);
                values.dr1to = period[1].getDate() + '/' + (period[1].getMonth()+1) + '/' + period[1].getFullYear();
                values.dr1to_millis = new Date(period[1]);
            }



            if(period[2] && period[3]) {
                values.comparisonPreset = "custom"
                values.dr2from = period[2].getDate() + '/' + (period[2].getMonth()+1) + '/' + period[2].getFullYear();
                values.dr2from_millis = new Date(period[2]);
                values.dr2to = period[3].getDate() + '/' + (period[3].getMonth()+1) + '/' + period[3].getFullYear();
                values.dr2to_millis = new Date(period[3]);
            } else
            {
                values.dr2from = "N/A";
                values.dr2from_millis = "";
                values.dr2to = "N/A";
                values.dr2to_millis = "";
            }


            $('.date-ranges-picker').DatePickerSetDate(period, true);

            if (values.dr1from && values.dr1to) {
                $('span.main', self.datepicker).text(values.dr1from + ' - ' + values.dr1to);
            }

            if (values.comparisonEnabled && values.dr2from && values.dr2to) {
                $('span.comparison', self.datepicker).text(values.dr2from + ' - ' + values.dr2to);
                $('span.comparison', self.datepicker).show();
                $('span.comparison-divider', self.datepicker).show();
            } else {
                $('span.comparison-divider', self.datepicker).hide();
                $('span.comparison', self.datepicker).hide();
            }


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