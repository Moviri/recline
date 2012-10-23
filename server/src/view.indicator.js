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
		format: 'd',
	  },

  template: '<div class="recline-graph"> \
      <div class="panel indicator_{{viewId}}"style="display: block;"> \
        <div id="indicator_{{viewId}}">{{value}}</div>\
      </div> \
    </div> ',

  initialize: function(options) {
    var self = this;

    this.el = $(this.el);
    _.bindAll(this, 'render');

    this.model.records.bind('add',      function() {self.render();});
    this.model.records.bind('reset',    function() {self.render();});
    this.model.records.bind('change',      function() {self.render();});

    var stateData = _.extend({
        id: 0
      },
      options.state
    );
    this.state = new recline.Model.ObjectState(stateData);

  },

    render: function() {
        var self = this;
        var tmplData = this.model.toTemplateJSON();
        tmplData["viewId"] = this.state.attributes["id"];
		var format = this.state.attributes.format || this.defaults.format;
		var applyFormatFunction = d3.format(format)
		
        if (this.model.records && this.model.records.length > 0)
			tmplData["value"] = applyFormatFunction(this.model.records.models[0].attributes[this.state.attributes["series"]]);
		else tmplData["value"] = "N/A"

        var htmls = Mustache.render(this.template, tmplData);
         $(this.el).html(htmls);
        this.$graph = this.el.find('.panel.indicator_' + tmplData["viewId"]);
        return this;
    },

    show: function() {
  }


  


});


})(jQuery, recline.View);
