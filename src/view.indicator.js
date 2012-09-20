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
        <div id="indicator_{{viewId}}">{{indicator_value}}</div>\
      </div> \
    </div> ',

  initialize: function(options) {
    var self = this;

    this.el = $(this.el);
    _.bindAll(this, 'render');

    this.model.bind('change', this.render);
    this.model.fields.bind('reset', this.render);
    this.model.fields.bind('add', this.render);
    var stateData = _.extend({
        series: [],
        aggregationType: "sum",
        id: 0
      },
      options.state
    );
    this.state = new recline.Model.ObjectState(stateData);


    this.editor = new my.GraphControls({
      model: this.model,
      state: this.state.toJSON()
    });
    this.editor.state.bind('change', function() {
      self.state.set(self.editor.state.toJSON());
      self.render();
    });
    this.elSidebar = this.editor.el;
  },


    render: function() {
    var self = this;

    var tmplData = this.model.toTemplateJSON();
    tmplData["viewId"] = this.state.get("id");

    var series = this.state.get('series')[0];
        switch(this.state.get("aggregationType")) {
            case 'sum':
                tmplData["indicator_value"] = this.model.records.reduce(function(memo, value) { return memo + value.get(series) }, 0);
                break;
            case 'average':
                tmp = this.model.records.reduce(function(memo, value) { return memo + value.get(series) }, 0);
                tmplData["indicator_value"] = tmp / this.model.records.count;
                break;
        }

    var htmls = Mustache.render(this.template, tmplData);
    $(this.el).html(htmls);
    this.$graph = this.el.find('.panel.indicator_' + tmplData["viewId"]);
    return this;
  },

    show: function() {
  }


  


});


})(jQuery, recline.View);

