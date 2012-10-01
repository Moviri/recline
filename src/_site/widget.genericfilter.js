/*jshint multistr:true */
this.recline = this.recline || {};
this.recline.View = this.recline.View || {};

(function($, my) {
	
my.GenericFilter = Backbone.View.extend({
  className: 'recline-filter-editor well', 
  template: ' \
    <div class="filters"> \
      <h3>Filters</h3> \
      <a href="#" class="js-add-filter">Add filter</a> \
      <div class="form-stacked js-add" style="display: none;"> \
        <fieldset> \
          <label>Filter type</label> \
          <select class="filterType"> \
            <option value="term">Term (text)</option> \
            <option value="range">Range</option> \
            <option value="geo_distance">Geo distance</option> \
            <option value="drop_down">Drop down</option> \
            <option value="listbox">Listbox</option> \
            <option value="list">Value list</option> \
          </select> \
          <label>Field</label> \
          <select class="fields"> \
            {{#fields}} \
            <option value="{{id}}">{{label}}</option> \
            {{/fields}} \
          </select> \
          <input type="button" class="btn" value="Add"></input> \
        </fieldset> \
      </div> \
      <div class="form-stacked js-edit"> \
        {{#filters}} \
          {{{filterRender}}} \
        {{/filters}} \
      </div> \
    </div> \
  ',
  filterTemplates: {
    term: ' \
      <div class="filter-{{type}} filter"> \
        <fieldset> \
          <legend> \
            {{field}} <small>{{controlType}}</small> \
            <a class="js-remove-filter" href="#" title="Remove this filter">&times;</a> \
          </legend> \
          <input type="text" value="{{term}}" name="term" data-filter-field="{{field}}" data-filter-id="{{id}}" data-filter-type="{{type}}" /> \
          <input type="button" class="btn" value="Set"></input> \
        </fieldset> \
      </div> \
    ',
    range: ' \
      <div class="filter-{{type}} filter"> \
        <fieldset> \
          <legend> \
            {{field}} <small>{{controlType}}</small> \
            <a class="js-remove-filter" href="#" title="Remove this filter">&times;</a> \
          </legend> \
          <label class="control-label" for="">From</label> \
          <input type="text" value="{{start}}" name="start" data-filter-field="{{field}}" data-filter-id="{{id}}" data-filter-type="{{type}}" /> \
          <label class="control-label" for="">To</label> \
          <input type="text" value="{{stop}}" name="stop" data-filter-field="{{field}}" data-filter-id="{{id}}" data-filter-type="{{type}}" /> \
		  <br> \
          <input type="button" class="btn" value="Set"></input> \
        </fieldset> \
      </div> \
    ',
    drop_down: ' \
      <div class="filter-{{type}} filter"> \
        <fieldset> \
          <legend> \
            {{field}} <small>{{controlType}}</small> \
            <a class="js-remove-filter" href="#" title="Remove this filter">&times;</a> \
          </legend> \
			<select class="fields" data-filter-field="{{field}}" data-filter-id="{{id}}" data-filter-type="{{type}}"> \
            {{#values}} \
            <option value="{{.}}">{{.}}</option> \
            {{/values}} \
          </select> \
        </fieldset> \
      </div> \
    ',
	list: ' \
	  <style> \
		.odd \
		{ background: white } \
		.list-filter-item \
		{ background: lightgrey;cursor:pointer; } \
		.list-filter-item:hover \
		{ background: lightblue;border:1px solid grey;cursor:pointer; } \
		.selected \
		{ background: orange } \
		.selected:hover \
		{ background: red } \
	  </style> \
      <div class="filter-{{type}} filter"> \
        <fieldset> \
          <legend> \
            {{field}} <small>{{controlType}}</small> \
            <a class="js-remove-filter" href="#" title="Remove this filter">&times;</a> \
          </legend> \
			<div style="max-height:500px;width:100%;border:1px solid grey;overflow:auto;"> \
				<table style="width:100%" data-filter-field="{{field}}" data-filter-id="{{id}}" data-filter-type="{{type}}" > \
				{{#values}} \
				<tr><td class="list-filter-item{{evenOdd}}" >{{.}}</td><tr> \
				{{/values}} \
			  </table> \
		  </div> \
	    </fieldset> \
      </div> \
	',
    listbox: ' \
      <div class="filter-{{type}} filter"> \
        <fieldset> \
          <legend> \
            {{field}} <small>{{controlType}}</small> \
            <a class="js-remove-filter" href="#" title="Remove this filter">&times;</a> \
          </legend> \
			<select class="fields" data-filter-field="{{field}}" data-filter-id="{{id}}" data-filter-type="{{type}}" multiple> \
            {{#values}} \
            <option value="{{.}}">{{.}}</option> \
            {{/values}} \
          </select> \
        </fieldset> \
      </div> \
    ',
    geo_distance: ' \
      <div class="filter-{{type}} filter"> \
        <fieldset> \
          <legend> \
            {{field}} <small>{{controlType}}</small> \
            <a class="js-remove-filter" href="#" title="Remove this filter">&times;</a> \
          </legend> \
          <label class="control-label" for="">Longitude</label> \
          <input type="text" value="{{point.lon}}" name="lon" data-filter-field="{{field}}" data-filter-id="{{id}}" data-filter-type="{{type}}" /> \
          <label class="control-label" for="">Latitude</label> \
          <input type="text" value="{{point.lat}}" name="lat" data-filter-field="{{field}}" data-filter-id="{{id}}" data-filter-type="{{type}}" /> \
          <label class="control-label" for="">Distance (km)</label> \
          <input type="text" value="{{distance}}" name="distance" data-filter-field="{{field}}" data-filter-id="{{id}}" data-filter-type="{{type}}" /> \
        </fieldset> \
      </div> \
    '
  },
  events: {
    'click .js-remove-filter': 'onRemoveFilter',
    'click .js-add-filter': 'onAddFilterShow',
    'click div.js-add button': 'onAddFilter',
	'click .list-filter-item': 'onListItemClicked'
  },
  initialize: function(args) {
    this.el = $(this.el);
    _.bindAll(this, 'render');
    this.model.fields.bind('all', this.render);
    this.model.records.bind('reset', this.render);
    this.model.queryState.bind('change', this.render);
    this.model.queryState.bind('change:filters:new-blank', this.render);
	this.userFilters = args.userFilters;

    if (this.userFilters && this.userFilters.length)
		for (var k in this.userFilters)
			this.addNewFilterControl(this.userFilters[k]);

    this.render();
  },
  render: function() {
    var self = this;
	var _counter = 0;
    var tmplData = $.extend(true, {}, this.model.queryState.toJSON());
    // we will use idx in list as there id ...
    tmplData.filters = _.map(tmplData.filters, function(filter, idx) {
      filter.id = idx;
      return filter;
    });
    tmplData.fields = this.model.fields.toJSON();
	tmplData.records = _.pluck(this.model.records.models, "attributes");
	tmplData.evenOdd = function() {
		return _counter++ % 2 == 0 ? '' : ' odd';
	}
    tmplData.filterRender = function() {
	  // add value list to selected filter or templating of record values will not work
	  this.values = _.uniq(_.pluck(tmplData.records, this.field));
      return Mustache.render(self.filterTemplates[this.controlType], this);
    };
    var out = Mustache.render(this.template, tmplData);
    this.el.html(out);
  },
  onListItemClicked: function(e) {
    e.preventDefault();
    var $target = $(e.target);
	$table = $target.parent().parent().parent();
	$table.find('td').each(function() { 
						$(this).removeClass("selected");
					});
	
	$target.addClass("selected");
	var fieldId     = $table.attr('data-filter-field');
	this.model.queryState.setFilter({field: fieldId, type: 'term', controlType: 'list', term:$target.text(), fieldType: "string"});
    this.model.queryState.trigger('change');
  },
  onAddFilterShow: function(e) {
    e.preventDefault();
    var $target = $(e.target);
    $target.hide();
    this.el.find('div.js-add').show();
  },
  onAddFilter: function(e) {
    e.preventDefault();
    var $target = $(e.currentTarget);
    $target.hide();
    var controlType = $target.find('select.filterType').val();
	var filterType = controlType;
	if (controlType == "listbox" || controlType == "list" || controlType == "drop_down")
		filterType = "term";
	
    var field      = $target.find('select.fields').val();
    var fieldType  = this.model.fields.find(function (e) { 
				return e.get('id') === field 
			}).get('type');
	
	this.addNewFilterControl({type: filterType, field: field, controlType: controlType, fieldType: fieldType});
  },
  onRemoveFilter: function(e) {
    e.preventDefault();
    var $target = $(e.target);
    var filterId = $target.closest('.filter').attr('data-filter-id');
    this.model.queryState.removeFilter(filterId);
  },
  addNewFilterControl: function(newFilter)
  {
	this.model.queryState.addFilter(newFilter);
	this.render();
  },
});

})(jQuery, recline.View);
