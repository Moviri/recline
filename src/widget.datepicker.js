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

        render:function () {
            var self = this;
            var uid = this.uid;

            var to = new Date();
            var from = new Date(to.getTime() - 1000 * 60 * 60 * 24 * 14);


            $('#datepicker-calendar-'+uid).DateRangesWidget(
                {
                    aggregations: [],
                    values: {
                        comparisonEnabled: false,
                        daterangePreset: "lastweeks",
                        comparisonPreset: "previousperiod"
                    }
                });


        },

        redraw:function () {

        }


    });
})(jQuery, recline.View);