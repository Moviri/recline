/*jshint multistr:true */

this.recline = this.recline || {};
this.recline.View = this.recline.View || {};

(function($, my) {

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
	  defaults: {
		format: 'd'
	  },

  templateBase: '<div class="recline-indicator"> \
      <div class="panel indicator_{{viewId}}" style="display: block;"> \
        <div id="indicator_{{viewId}}"> \
			<table class="condensed-table border-free-table"> \
                <tr><td></td><td style="text-align: center;">{{label}}</td></tr>    \
                <tr><td></td><td style="text-align: center;"><small>{{description}}</small></td></tr>    \
                <tr><td><div>{{& shape}}</div></td><td style="text-align: center;"><strong>{{value}}</strong></td></tr>  \
             </table>  \
		</div>\
      </div> \
    </div> ',
  templatePercentageCompare: '<div class="recline-indicator"> \
      <div class="panel indicator_{{viewId}}" style="display: block;"> \
        <div id="indicator_{{viewId}}"> \
			 <table class="condensed-table border-free-table"> \
                <tr><td></td><td style="text-align: center;">{{label}}</td></tr>    \
                <tr><td></td><td style="text-align: center;"><small>{{description}}</small></td></tr>    \
                <tr><td><div>{{& shape}}</div></td><td style="text-align: center;"><strong>{{value}}</strong></td></tr>  \
                <tr><td></td><td style="text-align: center;"><small>% of total: {{comparePercentage}} ({{compareWithValue}})</small></td></tr>  \
             </table>  \
		</div>\
      </div> \
    </div> ',




  initialize: function(options) {
    var self = this;

    this.el = $(this.el);
    _.bindAll(this, 'render');
      this.uid = options.id || ("" + new Date().getTime() + Math.floor(Math.random() * 10000)); // generating an unique id for the chart

      this.options.state.kpi.dataset.bind('query:done', this.render);
      if(this.options.state.compareWith)
          this.options.state.compareWith.dataset.bind('query:done', this.render);

  },

    render: function() {
        var self = this;
        var tmplData = {};
        tmplData["viewId"] = this.uid;
		tmplData.label = this.options.state && this.options.state["label"];

        var kpi     = self.options.state.kpi.dataset.getRecords(self.options.state.kpi.type);
        //var field   = self.options.state.kpi.dataset.getFields(self.options.state.kpi.type).get(self.options.state.kpi.field);
        var field;
        if(self.options.state.kpi.aggr)
            field = self.options.state.kpi.dataset.getField_byAggregationFunction(self.options.state.kpi.type, self.options.state.kpi.field, self.options.state.kpi.aggr);
        else
            field = self.options.state.kpi.dataset.getFields(self.options.state.kpi.type).get(self.options.state.kpi.field);

        var kpiValue;




        if(kpi.length > 0) {
            kpiValue = kpi[0].getFieldValueUnrendered(field);
            tmplData["value"] = kpi[0].getFieldValue(field);
            tmplData["shape"] = kpi[0].getFieldShape(field, true, false);
        }
        else tmplData["value"] = "N/A"

        var template = this.templateBase;

        if(self.options.state.compareWith) {
            var compareWithRecord  = self.options.state.compareWith.dataset.getRecords(self.options.state.compareWith.type);
            var compareWithField;

            if(self.options.state.kpi.aggr)
                compareWithField= self.options.state.compareWith.dataset.getField_byAggregationFunction(self.options.state.compareWith.type, self.options.state.compareWith.field, self.options.state.compareWith.aggr);
            else
                compareWithField= self.options.state.compareWith.dataset.getFields(self.options.state.compareWith.type).get(self.options.state.compareWith.field);

            tmplData["compareWithValue"]  = compareWithRecord[0].getFieldValue(compareWithField);
            var compareWithValue =  compareWithRecord[0].getFieldValueUnrendered(compareWithField);

            var compareValue;
            if(self.options.state.compareWith.compareType == "percentage") {
                var tmpField = new recline.Model.Field({type: "number", format: "percentage"});

                tmplData["comparePercentage"]  =  recline.Data.Renderers(kpiValue / compareWithValue * 100, tmpField);
                template = this.templatePercentageCompare;
            }
        }


        if(this.options.state.description)
            tmplData["description"] = this.options.state.description;

        if(this.options.state.labelColor)
            tmplData["labelColor"] = this.options.state.labelColor;
        if(this.options.state.descriptionColor)
            tmplData["descriptionColor"] = this.options.state.descriptionColor;
        if(this.options.state.textColor)
            tmplData["textColor"] = this.options.state.textColor;

        var htmls = Mustache.render(template, tmplData);
        $(this.el).html(htmls);


        //this.$graph = this.el.find('.panel.indicator_' + tmplData["viewId"]);


        return this;
    }



});


})(jQuery, recline.View);
