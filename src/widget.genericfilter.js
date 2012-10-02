/*jshint multistr:true */
this.recline = this.recline || {};
this.recline.View = this.recline.View || {};

(function($, my) {
	
my.GenericFilter = Backbone.View.extend({
  className: 'recline-filter-editor well', 
  template: ' \
    <div class="filters"> \
      <h3>{{filterLabel}}</h3> \
      <a href="#" class="js-add-filter">Add filter</a> \
	  <hr> \
      <div id="filterCreationForm" class="form-stacked js-add" style="display: none;"> \
        <fieldset> \
          <label>Filter type</label> \
          <select class="filterType"> \
            <option value="term">Term (text)</option> \
            <option value="slider">Slider</option> \
            <option value="range">Range</option> \
            <option value="range_slider">Range slider</option> \
            <option value="range_calendar">Date range</option> \
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
		  <br> \
          <input type="button" id="addFilterButton" class="btn" value="Add"></input> \
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
        <fieldset data-filter-field="{{field}}" data-filter-id="{{id}}" data-filter-type="{{type}}" data-control-type="{{controlType}}"> \
          <legend> \
            {{field}} <small>{{controlType}}</small> \
            <a class="js-remove-filter" href="#" title="Remove this filter">&times;</a> \
          </legend> \
          <input type="text" value="{{term}}" name="term" class="data-control-id" /> \
          <input type="button" class="btn" id="setFilterValueButton" value="Set"></input> \
        </fieldset> \
      </div> \
    ',
	slider : ' \
	<script> \
		$(document).ready(function(){ \
			$( "#slider-range{{ctrlId}}" ).slider({ \
				min: {{min}}, \
				max: {{max}}, \
				value: {{min}}, \
				slide: function( event, ui ) { \
					$( "#amount{{ctrlId}}" ).val(  ui.value ); \
				} \
			}); \
			$( "#amount{{ctrlId}}" ).val(  $( "#slider-range{{ctrlId}}" ).slider( "value" ) ); \
		}); \
	</script> \
      <div class="filter-{{type}} filter"> \
        <fieldset data-filter-field="{{field}}" data-filter-id="{{id}}" data-filter-type="{{type}}" data-control-type="{{controlType}}"> \
          <legend> \
            {{field}} <small>{{controlType}}</small> \
            <a class="js-remove-filter" href="#" title="Remove this filter">&times;</a> \
          </legend> \
		  <p> \
			  <label for="amount{{ctrlId}}">Value range:</label> \
			  <input type="text" id="amount{{ctrlId}}" style="border:none;" disabled="true"></input> \
		  </p> \
		  <div id="slider-range{{ctrlId}}" class="data-control-id" ></div> \
		  <br> \
          <input type="button" class="btn" id="setFilterValueButton" value="Set"></input> \
        </fieldset> \
      </div> \
    ',
    range: ' \
      <div class="filter-{{type}} filter"> \
        <fieldset data-filter-field="{{field}}" data-filter-id="{{id}}" data-filter-type="{{type}}" data-control-type="{{controlType}}"> \
          <legend> \
            {{field}} <small>{{controlType}}</small> \
            <a class="js-remove-filter" href="#" title="Remove this filter">&times;</a> \
          </legend> \
          <label class="control-label" for="">From</label> \
          <input type="text" value="{{start}}" name="start"  class="data-control-id-from" /> \
          <label class="control-label" for="">To</label> \
          <input type="text" value="{{stop}}" name="stop" class="data-control-id-to" /> \
		  <br> \
          <input type="button" class="btn" id="setFilterValueButton" value="Set"></input> \
        </fieldset> \
      </div> \
    ',
    range_slider: ' \
	<script> \
		$(document).ready(function(){ \
			$( "#slider-range{{ctrlId}}" ).slider({ \
				range: true, \
				min: {{min}}, \
				max: {{max}}, \
				values: [ {{min}}, {{max}} ], \
				slide: function( event, ui ) { \
					$( "#amount{{ctrlId}}" ).val(  ui.values[ 0 ] + " - " + ui.values[ 1 ] ); \
				} \
			}); \
			$( "#amount{{ctrlId}}" ).val(  $( "#slider-range{{ctrlId}}" ).slider( "values", 0 ) + " - " + $( "#slider-range{{ctrlId}}" ).slider( "values", 1 ) ); \
		}); \
	</script> \
      <div class="filter-{{type}} filter"> \
        <fieldset data-filter-field="{{field}}" data-filter-id="{{id}}" data-filter-type="{{type}}" data-control-type="{{controlType}}"> \
          <legend> \
            {{field}} <small>{{controlType}}</small> \
            <a class="js-remove-filter" href="#" title="Remove this filter">&times;</a> \
          </legend> \
		  <p> \
			  <label for="amount{{ctrlId}}">Value range:</label> \
			  <input type="text" id="amount{{ctrlId}}" style="border:none;" disabled="true"></input> \
		  </p> \
		  <div id="slider-range{{ctrlId}}" class="data-control-id-from data-control-id-to" ></div> \
		  <br> \
          <input type="button" class="btn" id="setFilterValueButton" value="Set"></input> \
        </fieldset> \
      </div> \
    ',
	range_calendar: ' \
	<script> \
	$(function() { \
		$( "#from{{ctrlId}}" ).datepicker({ \
			defaultDate: "{{startDate}}", \
			changeMonth: true, \
			numberOfMonths: 1, \
			onSelect: function( selectedDate ) { \
				$( "#to{{ctrlId}}" ).datepicker( "option", "minDate", selectedDate ); \
			} \
		}); \
		$( "#to{{ctrlId}}" ).datepicker({ \
			defaultDate: "{{endDate}}", \
			changeMonth: true, \
			numberOfMonths: 1, \
			onSelect: function( selectedDate ) { \
				$( "#from{{ctrlId}}" ).datepicker( "option", "maxDate", selectedDate ); \
			} \
		}); \
	}); \
	</script> \
      <div class="filter-{{type}} filter"> \
        <fieldset data-filter-field="{{field}}" data-filter-id="{{id}}" data-filter-type="{{type}}" data-control-type="{{controlType}}"> \
          <legend> \
            {{field}} <small>{{controlType}}</small> \
            <a class="js-remove-filter" href="#" title="Remove this filter">&times;</a> \
          </legend> \
			<label for="from{{ctrlId}}">From</label> \
			<input type="text" id="from{{ctrlId}}" name="from{{ctrlId}}" class="data-control-id-from" value="{{startDate}}"/> \
			<br> \
			<label for="to{{ctrlId}}">to</label> \
			<input type="text" id="to{{ctrlId}}" name="to{{ctrlId}}" class="data-control-id-to" value="{{endDate}}"/> \
 		  <br> \
          <input type="button" class="btn" id="setFilterValueButton" value="Set"></input> \
       </fieldset> \
      </div> \
	',
    drop_down: ' \
      <div class="filter-{{type}} filter"> \
        <fieldset data-filter-field="{{field}}" data-filter-id="{{id}}" data-filter-type="{{type}}" data-control-type="{{controlType}}"> \
          <legend> \
            {{field}} <small>{{controlType}}</small> \
            <a class="js-remove-filter" href="#" title="Remove this filter">&times;</a> \
          </legend> \
			<select class="drop-down fields data-control-id" > \
			<option></option> \
            {{#values}} \
            <option value="{{val}}">{{val}}</option> \
            {{/values}} \
          </select> \
        </fieldset> \
      </div> \
    ',
	list: ' \
	  <style> \
		.odd-row { background: aliceblue } \
		.even-row { background: azure } \
		.list-filter-item { cursor:pointer; } \
		.list-filter-item:hover { background: lightblue;cursor:pointer; } \
		.selected { background: orange } \
		.selected:hover { background: red } \
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
				<tr><td class="list-filter-item {{evenOdd}}" >{{val}}</td><tr> \
				{{/values}} \
			  </table> \
		  </div> \
	    </fieldset> \
      </div> \
	',
    listbox: ' \
      <div class="filter-{{type}} filter"> \
        <fieldset data-filter-field="{{field}}" data-filter-id="{{id}}" data-filter-type="{{type}}" data-control-type="{{controlType}}"> \
          <legend> \
            {{field}} <small>{{controlType}}</small> \
            <a class="js-remove-filter" href="#" title="Remove this filter">&times;</a> \
          </legend> \
			<select class="fields data-control-id"  multiple SIZE=10> \
            {{#values}} \
            <option value="{{val}}">{{val}}</option> \
            {{/values}} \
          </select> \
		  <br> \
          <input type="button" class="btn" id="setFilterValueButton" value="Set"></input> \
        </fieldset> \
      </div> \
    '
  },
  events: {
    'click .js-remove-filter': 'onRemoveFilter',
    'click .js-add-filter': 'onAddFilterShow',
    'click #addFilterButton': 'onAddFilter',
	'click .list-filter-item': 'onListItemClicked',
	'click #setFilterValueButton': 'onFilterValueChanged',
	'change .drop-down': 'onFilterValueChanged'
  },
  _ctrlId : 0,
  _sourceDataset: null,
  _targetDatasets: [],
  _activeFilters: [],
  initialize: function(args) {
    this.el = $(this.el);
    _.bindAll(this, 'render');
	_.bindAll(this, 'getFieldType');
	this._sourceDataset = args.sourceDataset;
	this._targetDatasets = args.filtersTargetDatasets;
    this._sourceDataset.fields.bind('all', this.render); 
    this._sourceDataset.records.bind('reset', this.render); 
	this.sourceFields = args.sourceFields;
	this.filterDialogLabel = args.label;
	this._activeFilters = [];

    if (this.sourceFields && this.sourceFields.length)
		for (var k in this.sourceFields)
			this.addNewFilterControl(this.sourceFields[k]);

    this.render();
  },
  render: function() {
    var self = this;
    var tmplData = $.extend(true, {}, this._targetDatasets[0].queryState.toJSON());
    // we will use idx in list as there id ...
    tmplData.filters = _.map(tmplData.filters, function(filter, idx) {
      filter.id = idx;
      return filter;
    });
	_.each(this._activeFilters , function(flt) { 
		tmplData.filters.push(flt); 
	});
    tmplData.fields = this._sourceDataset.fields.toJSON();
	tmplData.records = _.pluck(this._sourceDataset.records.models, "attributes");
	tmplData.filterLabel = this.filterDialogLabel;
	tmplData.dateConvert = self.dateConvert;
    tmplData.filterRender = function() {
	  // add value list to selected filter or templating of record values will not work
	  this.tmpValues = _.uniq(_.pluck(tmplData.records, this.field));
	  this.values = new Array();
	  if (this.start)
		this.startDate = tmplData.dateConvert(this.start);
		
	  if (this.stop)
		this.endDate = tmplData.dateConvert(this.stop);
		
	  if (this.tmpValues.length)
	  {
		  this.max = this.tmpValues[0];
		  this.min = this.tmpValues[0];
	  }
	  for (var i in this.tmpValues)
	  {
		var v = this.tmpValues[i];
		this.values.push({val: v, evenOdd: (i % 2 == 0 ? 'even-row' : 'odd-row') });
		if (v > this.max)
			this.max = v;
			
		if (v < this.min)
			this.min = v;
	  }
	  if (this.controlType.indexOf("slider") >= 0 || this.controlType.indexOf("calendar") >= 0)
		self._ctrlId++;
		
	  this.ctrlId = self._ctrlId;
      return Mustache.render(self.filterTemplates[this.controlType], this);
    };
    var out = Mustache.render(this.template, tmplData);
    this.el.html(out);
  },
  onListItemClicked: function(e) {
    e.preventDefault();
    var $target = $(e.currentTarget);
	$table = $target.parent().parent().parent();
	$table.find('td').each(function() { 
						$(this).removeClass("selected");
					});
	
	$target.addClass("selected");
	var fieldId     = $table.attr('data-filter-field');
	_.each(this._targetDatasets, function(ds) { 
		ds.queryState.setFilter({field: fieldId, type: 'term', controlType: 'list', term:$target.text(), fieldType: "number"});
	});
  },
	dateConvert : function(d) { 
		// convert 2012-01-31 00:00:00 to 01/31/2012
		try
		{
			var p = d.split(/\D/); 
			return p[1]+"/"+p[2]+"/"+p[0]; 
		}
		catch(ex) {
			return d;
		}
	},
	dateConvertBack : function(d) { 
		// convert 01/31/2012  to 2012-01-31 00:00:00
		try
		{
			var p = d.split(/\D/); 
			return p[2]+"-"+p[0]+"-"+p[1]+" 00:00:00"; 
		}
		catch(ex) {
			return d;
		}
	},
    onFilterValueChanged: function(e) {
    e.preventDefault();
    var $target = $(e.target).parent();
	var fieldId     = $target.attr('data-filter-field');
	var fieldType     = $target.attr('data-filter-type');
	var controlType     = $target.attr('data-control-type');
	var term;
	var from;
	var to;
	if (fieldType == "term")
	{
		var termObj = $target.find('.data-control-id');
		switch (controlType)
		{
			case "term": term = termObj.val();break;
			case "slider": term = termObj.slider("value");break;
			case "drop_down": term = termObj.val();break;
			case "listbox": term = termObj.val();break;
		}
	}
	else if (fieldType == "range")
	{
		var fromObj = $target.find('.data-control-id-from');
		var toObj = $target.find('.data-control-id-to');
		switch (controlType)
		{
			case "range": from = fromObj.val();to = toObj.val();break;
			case "range_slider": from = fromObj.slider("values", 0);to = toObj.slider("values", 1);break;
			case "range_calendar": from = this.dateConvertBack(fromObj.val());to = this.dateConvertBack(toObj.val());break;
		}
	}
	_.each(this._targetDatasets, function(ds) { 
		ds.queryState.setFilter({field: fieldId, type: fieldType, controlType: controlType, term:term, start: from, stop: to, fieldType: 'number'});
		//ds.queryState.trigger('change');
	});

  },
  onAddFilterShow: function(e) {
    e.preventDefault();
    var $target = $(e.target);
    $target.hide();
    this.el.find('div.js-add').show();
  },
  hidePanel: function (obj) {
	$(function() {
		obj.hide( "blind", {}, 1000, function() {});
	});
  },
  getFilterTypeFromControlType: function(controlType) {
	switch (controlType)
	{
		case "listbox":
		case "list" :
		case "drop_down" :
		case "slider" :
			return "term";
		case "range_slider" :
		case "range_calendar" :
			return "range";
	}
	return controlType;
  }
  ,
  getFieldType : function(field) {
	var fieldFound = this._sourceDataset.fields.find(function (e) { 
				return e.get('id') === field
			})
	if (typeof fieldFound != "undefined" && fieldFound != null)
		return fieldFound.get('type');
			
    return "string";
  }
  ,
  onAddFilter: function(e) {
    e.preventDefault();
    var $target = $(e.target).parent().parent();
    $target.hide();//this.hidePanel($target);
    var controlType = $target.find('select.filterType').val();
	var filterType = this.getFilterTypeFromControlType(controlType);
    var field      = $target.find('select.fields').val();
	this.addNewFilterControl({type: filterType, field: field, controlType: controlType});
  },
  addNewFilterControl: function(newFilter)
  {
	if (typeof newFilter.type == 'undefined')
		newFilter.type = this.getFilterTypeFromControlType(newFilter.controlType)

	if (typeof newFilter.fieldType == 'undefined')
		newFilter.fieldType = this.getFieldType(newFilter.field)
	
	this._activeFilters.push(newFilter);
	this.render();
  },
  onRemoveFilter: function(e) {
    e.preventDefault();
    var $target = $(e.target);
    var filterId = $target.closest('.filter').attr('data-filter-id');
	_.each(this._targetDatasets, function(ds) { 
		ds.queryState.removeFilter(filterId);
	});
  }


});

})(jQuery, recline.View);
