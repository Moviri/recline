/*jshint multistr:true */

this.recline = this.recline || {};
this.recline.View = this.recline.View || {};

(function ($, my) {

// ## Indicator view for a Dataset 
//
// Initialization arguments (in a hash in first parameter):
//
// * model: recline.Model.Dataset (should be a VirtualDataset that already performs the aggregation
// * state: (optional) configuration hash of form:
//
//        { 
//          series: [{column name for series A}, {column name series B}, ... ],   // only first record of dataset is used
//			format: (optional) format to use (see D3.format for reference)
//        }
//
// NB: should *not* provide an el argument to the view but must let the view
// generate the element itself (you can then append view.el to the DOM.
    my.Indicator = Backbone.View.extend({
        defaults:{
            format:'d'
        },

        compareType:{
            self:this,
            percentage:function (kpi, compare, templates) {
                var tmpField = new recline.Model.Field({type:"number", format:"percentage"});
                var unrenderedValue = kpi / compare * 100;
                var data = recline.Data.Renderers(unrenderedValue, tmpField);
                var template = templates.templatePercentageCompare;

                return {data:data, template:template, unrenderedValue: unrenderedValue};
            },
            percentageVariation:function (kpi, compare, templates) {
                var tmpField = new recline.Model.Field({type:"number", format:"percentage"});
                var unrenderedValue = (kpi-compare) / compare * 100;
                var data = recline.Data.Renderers( unrenderedValue, tmpField);
                var template = templates.templatePercentageVariation;

                return {data:data, template:template, unrenderedValue: unrenderedValue};
            },
            nocompare: function (kpi, compare, templates){
                return {data:null, template:templates.templateBase, unrenderedValue:null};
            }

        },

        templates:{
             templateBase:'<div class="indicator"> \
      <div class="panel indicator_{{viewId}}"> \
        <div id="indicator_{{viewId}}"> \
			<table> \
                <tr><td></td><td style="text-align: center;">{{label}}</td></tr>    \
                <tr><td></td><td style="text-align: center;"><small>{{description}}</small></td></tr>    \
                <tr><td><div class="shape">{{& shape}}</div><div class="compareshape">{{{compareShape}}}</div></td><td>{{value}}</td></tr>  \
             </table>  \
		</div>\
      </div> \
    </div> ',
            templatePercentageCompare:'<div class="indicator"> \
      <div class="panel indicator_{{viewId}}"> \
        <div id="indicator_{{viewId}}"> \
			 <table> \
                <tr><td></td><td>{{label}}</td></tr>    \
                <tr><td></td><td><small>{{description}}</small></td></tr>    \
                <tr><td><div class="shape">{{& shape}}</div><div class="compareshape">{{{compareShape}}}</div></td><td>{{value}}</td></tr>  \
                <tr><td></td><td>% of total: {{compareValue}} ({{compareWithValue}})</td></tr>  \
             </table>  \
		</div>\
      </div> \
    </div> ',
            templatePercentageVariation:'<div class="indicator"> \
      <div class="panel indicator_{{viewId}}"> \
        <div id="indicator_{{viewId}}"> \
			 <table> \
                <tr><td></td><td>{{label}}</td></tr>    \
                <tr><td></td><td><small>{{description}}</small></td></tr>    \
                <tr><td><div class="shape">{{& shape}}</div><div class="compareshape">{{{compareShape}}}</div></td><td>{{value}}</td></tr>  \
                <tr><td></td><td>% variation: {{compareValue}} ({{compareWithValue}})</td></tr>  \
             </table>  \
		</div>\
      </div> \
    </div> '
        },


        initialize:function (options) {
            var self = this;

            this.el = $(this.el);
            _.bindAll(this, 'render');
            this.uid = options.id || ("" + new Date().getTime() + Math.floor(Math.random() * 10000)); // generating an unique id for the chart

            this.model.bind('query:done', this.render);

        },

        render:function () {
            var self = this;
            var tmplData = {};
            tmplData["viewId"] = this.uid;
            tmplData.label = this.options.state && this.options.state["label"];

            var kpi = self.model.getRecords(self.options.state.kpi.type);


            var field;
            if (self.options.state.kpi.aggr)
                field = self.model.getField_byAggregationFunction(self.options.state.kpi.type, self.options.state.kpi.field, self.options.state.kpi.aggr);
            else
                field = self.model.getFields(self.options.state.kpi.type).get(self.options.state.kpi.field);

            if (!field)
                throw "View.Indicator: unable to find field [" + self.options.state.kpi.field + "] on model"


            var kpiValue;


            if (kpi.length > 0) {
                kpiValue = kpi[0].getFieldValueUnrendered(field);
                tmplData["value"] = kpi[0].getFieldValue(field);
                tmplData["shape"] = kpi[0].getFieldShape(field, true, false);
            }
            else tmplData["value"] = "N/A"

            var template = this.templates.templateBase;

            if (self.options.state.compareWith) {
                var compareWithRecord = self.model.getRecords(self.options.state.compareWith.type);
                var compareWithField;

                if (self.options.state.kpi.aggr)
                    compareWithField = self.model.getField_byAggregationFunction(self.options.state.compareWith.type, self.options.state.compareWith.field, self.options.state.compareWith.aggr);
                else
                    compareWithField = self.options.model.getFields(self.options.state.compareWith.type).get(self.options.state.compareWith.field);

                if (!compareWithField)
                    throw "View.Indicator: unable to find field [" + self.options.state.compareWith.field + "] on model"

                tmplData["compareWithValue"] = compareWithRecord[0].getFieldValue(compareWithField);
                var compareWithValue = compareWithRecord[0].getFieldValueUnrendered(compareWithField);

                var compareValue;

                var compareValue = self.compareType[self.options.state.compareWith.compareType](kpiValue, compareWithValue, self.templates);
                if(!compareValue)
                    throw "View.Indicator: unable to find compareType [" + self.options.state.compareWith.compareType + "]";

                tmplData["compareValue"] = compareValue.data;

                if(self.options.state.compareWith.shapes) {
                    if(compareValue.unrenderedValue == 0)
                        tmplData["compareShape"] = self.options.state.compareWith.shapes.constant;
                    else if(compareValue.unrenderedValue > 0)
                        tmplData["compareShape"] = self.options.state.compareWith.shapes.increase;
                    else if(compareValue.unrenderedValue < 0)
                        tmplData["compareShape"] = self.options.state.compareWith.shapes.decrease;
                }

                if(compareValue.template)
                    template = compareValue.template;

            }


            if (this.options.state.description)
                tmplData["description"] = this.options.state.description;

            var htmls = Mustache.render(template, tmplData);
            $(this.el).html(htmls);


            //this.$graph = this.el.find('.panel.indicator_' + tmplData["viewId"]);


            return this;
        }






    });


})(jQuery, recline.View);
