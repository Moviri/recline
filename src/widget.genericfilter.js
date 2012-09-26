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
      <form class="form-stacked js-add" style="display: none;"> \
        <fieldset> \
          <label>Filter type</label> \
          <select class="filterType"> \
            <option value="term">Term (text)</option> \
            <option value="range">Range</option> \
            <option value="geo_distance">Geo distance</option> \
            <option value="drop_down">Drop down</option> \
            <option value="listbox">Listbox</option> \
          </select> \
          <label>Field</label> \
          <select class="fields"> \
            {{#fields}} \
            <option value="{{id}}">{{label}}</option> \
            {{/fields}} \
          </select> \
          <button type="submit" class="btn">Add</button> \
        </fieldset> \
      </form> \
      <form class="form-stacked js-edit"> \
        {{#filters}} \
          {{{filterRender}}} \
        {{/filters}} \
        {{#filters.length}} \
        <button type="submit" class="btn">Update</button> \
        {{/filters.length}} \
      </form> \
    </div> \
  ',
  filterTemplates: {
    term: ' \
      <div class="filter-{{type}} filter"> \
        <fieldset> \
          <legend> \
            {{field}} <small>{{type}}</small> \
            <a class="js-remove-filter" href="#" title="Remove this filter">&times;</a> \
          </legend> \
          <input type="text" value="{{term}}" name="term" data-filter-field="{{field}}" data-filter-id="{{id}}" data-filter-type="{{type}}" /> \
        </fieldset> \
      </div> \
    ',
    range: ' \
      <div class="filter-{{type}} filter"> \
        <fieldset> \
          <legend> \
            {{field}} <small>{{type}}</small> \
            <a class="js-remove-filter" href="#" title="Remove this filter">&times;</a> \
          </legend> \
          <label class="control-label" for="">From</label> \
          <input type="text" value="{{start}}" name="start" data-filter-field="{{field}}" data-filter-id="{{id}}" data-filter-type="{{type}}" /> \
          <label class="control-label" for="">To</label> \
          <input type="text" value="{{stop}}" name="stop" data-filter-field="{{field}}" data-filter-id="{{id}}" data-filter-type="{{type}}" /> \
        </fieldset> \
      </div> \
    ',
    drop_down: ' \
      <div class="filter-{{type}} filter"> \
        <fieldset> \
          <legend> \
            {{field}} <small>{{type}}</small> \
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
    listbox: ' \
      <div class="filter-{{type}} filter"> \
        <fieldset> \
          <legend> \
            {{field}} <small>{{type}}</small> \
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
            {{field}} <small>{{type}}</small> \
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
    'submit form.js-edit': 'onTermFiltersUpdate',
    'submit form.js-add': 'onAddFilter'
  },
  initialize: function(args) {
    this.el = $(this.el);
    _.bindAll(this, 'render');
    this.model.fields.bind('all', this.render);
    this.model.queryState.bind('change', this.render);
    this.model.queryState.bind('change:filters:new-blank', this.render);
	this.origRecords = this.model.records.toJSON();
	this.userFilters = args.userFilters;
	if (this.userFilters && this.userFilters.length)
		for (var k in this.userFilters)
			this.model.queryState.setFilter(this.userFilters[k]);
	
    this.render();
  },
  render: function() {
    var self = this;
    var tmplData = $.extend(true, {}, this.model.queryState.toJSON());
    // we will use idx in list as there id ...
    tmplData.filters = _.map(tmplData.filters, function(filter, idx) {
      filter.id = idx;
      return filter;
    });
    tmplData.fields = this.model.fields.toJSON();
	tmplData.records = this.origRecords;
    tmplData.filterRender = function() {
	  // add value list to selected filter or templating of record values will not work
	  this.values = _.uniq(_.pluck(tmplData.records, this.field));
      return Mustache.render(self.filterTemplates[this.type], this);
    };
    var out = Mustache.render(this.template, tmplData);
    this.el.html(out);
  },
  onAddFilterShow: function(e) {
    e.preventDefault();
    var $target = $(e.target);
    $target.hide();
    this.el.find('form.js-add').show();
  },
  onAddFilter: function(e) {
    e.preventDefault();
    var $target = $(e.target);
    $target.hide();
    var filterType = $target.find('select.filterType').val();
    var field      = $target.find('select.fields').val();
    var fieldType  = this.model.fields.find(function (e) { return e.get('id') === field }).get('type');
    this.model.queryState.addFilter({type: filterType, field: field, fieldType: fieldType});
	//for(m in this.options.TargetModel) {
    //    m.queryState.addFilter({type: filterType, field: field, fieldType: fieldType});
    //}

    // trigger render explicitly as queryState change will not be triggered (as blank value for filter)
    this.render();
  },
  onRemoveFilter: function(e) {
    e.preventDefault();
    var $target = $(e.target);
    var filterId = $target.closest('.filter').attr('data-filter-id');
    this.model.queryState.removeFilter(filterId);
  },
  onTermFiltersUpdate: function(e) {
   var self = this;
    e.preventDefault();
    //var filters = self.model.queryState.get('filters');
	
    var $form = $(e.target);
    _.each($form.find('input,select'), function(input) {


      var $input = $(input);
      var filterType  = $input.attr('data-filter-type');
      var fieldId     = $input.attr('data-filter-field');
      var filterIndex = parseInt($input.attr('data-filter-id'));
      var name        = $input.attr('name');
      var value       = $input.val();
	  var values = new Array();

	  if (input.nodeName.toLowerCase() == 'select')
	  {
		if (input.multiple)
		{
			$input.find("option:selected").each(function() 
				{
					values.push(this.text());
				});
		}
		else value = $input.find("option:selected").text();
	  }

      switch (filterType) {
        case 'term':
			filter = {field: fieldId, type: filterType, term:value, fieldType: "string"};
          break;
        case 'range':
          //filters[filterIndex][name] = value;
          break;
        case 'drop_down':
			filter = {field: fieldId, type: 'term', term:value, fieldType: "string"};
          break;
        case 'listbox':
			filter = {field: fieldId, type: 'term', term:values[0], fieldType: "string"};
          break;
        case 'geo_distance':
          if(name === 'distance') {
 //           filters[filterIndex].distance = parseFloat(value);
          }
          else {
   //         filters[filterIndex].point[name] = parseFloat(value);
          }
          break;
      }
        console.log(filter);
	       console.log(self.model);
	       self.model.queryState.setFilter(filter);
	  
    });
//    self.model.queryState.set({filters: filters});
//    self.model.queryState.trigger('change');
  }
});

})(jQuery, recline.View);
