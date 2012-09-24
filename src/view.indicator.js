/*jshint multistr:true */

this.recline = this.recline || {};
this.recline.View = this.recline.View || {};

(function($, my) {

// ## Linegraph view for a Dataset using nvd3 graphing library.
//
// Initialization arguments (in a hash in first parameter):
//
// * model: recline.Model.Dataset
// * state: (optional) configuration hash of form:
//
//        { 
//          group: {column name for x-axis},
//          series: [{column name for series A}, {column name series B}, ... ],
//          colors: ["#edc240", "#afd8f8", ...]
//        }
//
// NB: should *not* provide an el argument to the view but must let the view
// generate the element itself (you can then append view.el to the DOM.
    my.Indicator = Backbone.View.extend({

  template: '<div class="recline-graph"> \
      <div class="panel indicator_{{viewId}}"style="display: block;"> \
        <div id="indicator_{{viewId}}">N.D.</div>\
      </div> \
    </div> ',

  initialize: function(options) {
    var self = this;

    this.el = $(this.el);
    _.bindAll(this, 'render');

    this.model.records.bind('add',      function() {self.redraw();});
    this.model.records.bind('reset',    function() {self.redraw();});

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



        var htmls = Mustache.render(this.template, tmplData);
         $(this.el).html(htmls);
        this.$graph = this.el.find('.panel.indicator_' + tmplData["viewId"]);
        return this;
    },

    redraw: function() {

        var viewId = this.state.attributes["id"];

        var result = "x/A";

        if(this.model.records.length > 0)               {
            result = this.model.records.models[0].attributes[this.state.get("value")];
         }

        $('#indicator_' + viewId).html(result);


    },

    show: function() {
  }


  


});


})(jQuery, recline.View);

