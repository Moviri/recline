/*jshint multistr:true */
this.recline = this.recline || {};
this.recline.View = this.recline.View || {};

(function($, my) {
	
my.GenericFilter = Backbone.View.extend({
  className: 'recline-filter-editor well', 
  template: ' \
    <div class="filters"> \
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
		  <hr style="display:{{hrVisible}}"> \
        {{/filters}} \
      </div> \
    </div> \
  ',
  filterTemplates: {
    term: ' \
      <div class="filter-{{type}} filter"> \
        <fieldset data-filter-field="{{field}}" data-filter-id="{{id}}" data-filter-type="{{type}}" data-control-type="{{controlType}}"> \
            <b>{{field}}</b>  \
			<br> \
          <input type="text" value="{{term}}" name="term" class="data-control-id" /> \
          <input type="button" class="btn" id="setFilterValueButton" value="Set"></input> \
        </fieldset> \
      </div> \
    ',
	slider : ' \
	<script> \
		$(document).ready(function(){ \
			$( "#slider{{ctrlId}}" ).slider({ \
				min: {{min}}, \
				max: {{max}}, \
				value: {{min}}, \
				slide: function( event, ui ) { \
					$( "#amount{{ctrlId}}" ).html( "Value: "+ ui.value ); \
				} \
			}); \
			$( "#amount{{ctrlId}}" ).html( "Value: "+ $( "#slider{{ctrlId}}" ).slider( "value" ) ); \
		}); \
	</script> \
      <div class="filter-{{type}} filter"> \
        <fieldset data-filter-field="{{field}}" data-filter-id="{{id}}" data-filter-type="{{type}}" data-control-type="{{controlType}}"> \
            <b>{{field}}</b>  \
			<br> \
		  <label id="amount{{ctrlId}}">Value: </label></span> \
		  <div id="slider{{ctrlId}}" class="data-control-id" ></div> \
		  <br> \
          <input type="button" class="btn" id="setFilterValueButton" value="Set"></input> \
        </fieldset> \
      </div> \
    ',
    range: ' \
      <div class="filter-{{type}} filter"> \
        <fieldset data-filter-field="{{field}}" data-filter-id="{{id}}" data-filter-type="{{type}}" data-control-type="{{controlType}}"> \
            <b>{{field}}</b>  \
			<br> \
          <label class="control-label" for="">From</label> \
          <input type="text" value="{{start}}" name="start"  class="data-control-id-from" style="width:auto"/> \
          <label class="control-label" for="">To</label> \
          <input type="text" value="{{stop}}" name="stop" class="data-control-id-to"  style="width:auto"/> \
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
					$( "#amount{{ctrlId}}" ).html(  "Value range: " + ui.values[ 0 ] + " - " + ui.values[ 1 ] ); \
				} \
			}); \
			$( "#amount{{ctrlId}}" ).html(  "Value range: " + $( "#slider-range{{ctrlId}}" ).slider( "values", 0 ) + " - " + $( "#slider-range{{ctrlId}}" ).slider( "values", 1 ) ); \
		}); \
	</script> \
      <div class="filter-{{type}} filter"> \
        <fieldset data-filter-field="{{field}}" data-filter-id="{{id}}" data-filter-type="{{type}}" data-control-type="{{controlType}}"> \
            <b>{{field}}</b>  \
			<br> \
		  <label id="amount{{ctrlId}}">Value range: </label></span> \
		  <div id="slider-range{{ctrlId}}" class="data-control-id-from data-control-id-to" ></div> \
		  <br> \
          <input type="button" class="btn" id="setFilterValueButton" value="Set"></input> \
        </fieldset> \
      </div> \
    ',
	month_calendar: ' \
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
            <b>{{field}}</b>  \
            <a class="js-remove-filter" href="#" title="Remove this filter">&times;</a> \
			<br> \
			<select class="drop-down2 fields data-control-id" > \
            {{#yearValues}} \
            <option value="{{.}}">{{.}}</option> \
            {{/yearValues}} \
          </select> \
			<br> \
			<div style="max-height:500px;width:100%;border:1px solid grey;overflow:auto;"> \
				<table class="table" style="width:100%" data-filter-field="{{field}}" data-filter-id="{{id}}" data-filter-type="{{type}}" > \
				{{#monthValues}} \
				<tr><td class="list-filter-item {{evenOdd}}" myValue="{{val}}">{{label}}</td><tr> \
				{{/monthValues}} \
			  </table> \
		  </div> \
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
            <b>{{field}}</b>  \
			<br> \
			<label for="from{{ctrlId}}">From</label> \
			<input type="text" id="from{{ctrlId}}" name="from{{ctrlId}}" class="data-control-id-from" value="{{startDate}}" style="width:auto"/> \
			<br> \
			<label for="to{{ctrlId}}">to</label> \
			<input type="text" id="to{{ctrlId}}" name="to{{ctrlId}}" class="data-control-id-to" value="{{endDate}}" style="width:auto"/> \
 		  <br> \
          <input type="button" class="btn" id="setFilterValueButton" value="Set"></input> \
       </fieldset> \
      </div> \
	',
    drop_down: ' \
      <div class="filter-{{type}} filter"> \
        <fieldset data-filter-field="{{field}}" data-filter-id="{{id}}" data-filter-type="{{type}}" data-control-type="{{controlType}}"> \
            <b>{{field}}</b>  \
			<br> \
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
        <fieldset data-filter-field="{{field}}" data-filter-id="{{id}}" data-filter-type="{{type}}"> \
            <b>{{field}}</b>  \
            <a class="js-remove-filter" href="#" title="Remove this filter">&times;</a> \
			<br> \
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
            <b>{{field}}</b>  \
			<br> \
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
	'change .drop-down': 'onFilterValueChanged',
	'change .drop-down2': 'onListItemClicked'
  },
  _ctrlId : 0,
  _sourceDataset: null,
  _activeFilters: [],
  initialize: function(args) {
    this.el = $(this.el);
    _.bindAll(this, 'render');
	_.bindAll(this, 'getFieldType');
	_.bindAll(this, 'onRemoveFilter');
	this._sourceDataset = args.sourceDataset;

    //this._sourceDataset.fields.bind('all', this.render);

	this.sourceFields = args.sourceFields;
	this.filterDialogLabel = args.label;
	this._activeFilters = [];

    this._actions = args.actions;

    if (this.sourceFields && this.sourceFields.length)
		for (var k in this.sourceFields)
			this.addNewFilterControl(this.sourceFields[k]);

    this._sourceDataset.records.bind('reset', this.render);
  },

  render: function() {
    var self = this;
	var tmplData = {filters : this._activeFilters};
	_.each(tmplData.filters , function(flt) { 
		flt.hrVisible = 'block'; 
	});

	// retrieve filters already set on the model

      var activeFilters = [];
      _.each(this._actions, function(currentAction) {
        _.each(currentAction.mapping, function(map) {
            var currentFilter= currentAction.action.getActiveFilters(map.filter, map.srcField);
            if(currentFilter!=null && currentFilter.length>0)
                activeFilters = _.union(activeFilters, currentFilter) ;
        })
      });


      //  map them to the correct controlType also retaining their values (start/from/term)
      _.each(activeFilters, function(filter) {
              for (var j in tmplData.filters)
              {
                  if (tmplData.filters[j].field == filter.field)
                  {
                      $.extend(tmplData.filters[j], filter);
                      break;
                  }
              }
      });


      if (tmplData.filters.length > 0)
		tmplData.filters[tmplData.filters.length -1].hrVisible = 'none'
	
    tmplData.fields = this._sourceDataset.fields.toJSON();
	tmplData.records = _.pluck(this._sourceDataset.records.models, "attributes");
	tmplData.filterLabel = this.filterDialogLabel;
	tmplData.dateConvert = self.dateConvert;
    tmplData.filterRender = function() {
		
	  this.tmpValues = [];
	  // add value list to selected filter or templating of record values will not work
	  if (this.controlType === 'list' || this.controlType.indexOf('slider') >= 0)
		this.tmpValues = _.uniq(_.pluck(tmplData.records, this.field));
		
	  this.values = new Array();
	  if (this.start)
		this.startDate = tmplData.dateConvert(this.start);
		
	  if (this.stop)
		this.endDate = tmplData.dateConvert(this.stop);
		
	  if (this.tmpValues.length && typeof this.tmpValues[0] != "undefined")
	  {
		  this.max = this.tmpValues[0];
		  this.min = this.tmpValues[0];
	  }
	  else
	  {
		  this.max = 100;
		  this.min = 0;
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
	  if (this.controlType == "month_calendar")
	  {
		this.monthValues = [];
		for (m = 1; m <= 12; m++)
			this.monthValues.push({ val: d3.format("02d")(m), 
									label: d3.time.format("%B")(new Date(m+"/01/2012")), 
									evenOdd: (m % 2 == 0 ? 'even-row' : 'odd-row' )
								});
		
		this.yearValues = [];
		var startYear = 2012;
		var endYear = parseInt(d3.time.format("%Y")(new Date()))
		for (var y = startYear; y <= endYear; y++)
			this.yearValues.push(y);
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
	// let's check if user clicked on combobox or table and behave consequently
    var $target = $(e.currentTarget);
	var $table;
	var $targetTD;
	var $targetOption;
	var $combo;
	if ($target.is('td'))
	{
		$targetTD = $target;
		$table = $target.parent().parent().parent();
		var type  = $table.attr('data-filter-type');
		if (type == "range")
			$combo = $table.parent().parent().find(".drop-down2");
	}
	else if ($target.is('select'))
	{
		$combo = $target;
		$table = $combo.parent().find(".table");
	}
	this.handleListItemClicked($targetTD, $table, $combo);
  },

  handleListItemClicked: function($targetTD, $table, $combo) {


	if (typeof $targetTD != "undefined")
	{

		// user clicked on table
		$table.find('td').each(function() { 
							$(this).removeClass("selected");
						});
		
		$targetTD.addClass("selected");
		var fieldId = $table.attr('data-filter-field');
		var type = $table.attr('data-filter-type');



        if (type == "range")
		{
			// case month_calendar 
			var month = $targetTD.attr('myValue');
			var year = $combo.val();
			var startDate =  new Date(year, month-1, 1, 0, 0, 0, 0);
            var endDate;
            if(month=="12")
                endDate = new Date(year+1, 0, 1, 0, 0, 0, 0);
            else
                endDate = new Date(year, month, 1, 0, 0, 0, 0);

            this.doAction("onListItemClicked", fieldId, [startDate, endDate], "add");

			/*_.each(this._targetDatasets, function(ds) {
				ds.queryState.setFilter({field: fieldId, type: 'range', start:startDate, stop:endDate, fieldType: "date"});
			});*/

		}
		else
		{
            this.doAction("onListItemClicked", fieldId, [$targetTD.text()], "add");

			// case normal list
			/*_.each(this._targetDatasets, function(ds) {
				ds.queryState.setFilter({field: fieldId, type: 'term', term:$targetTD.text(), fieldType: "number"});
			});*/
		}
	}
  },
    // todo doAction should be moved to action class
    // action could be add or remove
    doAction: function(eventType, fieldName, values, actionType) {

        var actions = this.options.actions;
        var eventData = {};
        eventData[fieldName] = values;

        // find all actions configured for eventType
        var targetActions = _.filter(actions, function(d) {
            var tmpFound = _.find(d["event"], function(x) {return x==eventType});
            if(tmpFound != -1)
                return true;
            else
                return false;
        });

        // foreach action prepare field
        _.each(targetActions, function(currentAction) {
            var mapping = currentAction.mapping;
            var actionParameters = [];
            //foreach mapping set destination field
            _.each(mapping, function(map) {
                if(eventData[map["srcField"]] == null) {
                    console.log( "warn: sourceField: [" + map["srcField"] + "] not present in event data" );
                } else {


                    var param = {
                        filter: map["filter"],
                        value: eventData[map["srcField"]]
                    };
                    actionParameters.push(param);
                }
            });

            if( actionParameters.length > 0)  {
                currentAction.action.doAction(actionParameters, actionType);
            }
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


	if (fieldType == "term")
	{
        var term;
		var termObj = $target.find('.data-control-id');
		switch (controlType)
		{
			case "term": term = termObj.val();break;
			case "slider": term = termObj.slider("value");break;
			case "drop_down": term = termObj.val();break;
			case "listbox": term = termObj.val();break;
		}
        this.doAction("onFilterValueChanged", fieldId, [term], "add");
	}
	else if (fieldType == "range")
	{
        var from;
        var to;
		var fromObj = $target.find('.data-control-id-from');
		var toObj = $target.find('.data-control-id-to');
		switch (controlType)
		{
			case "range": from = fromObj.val();to = toObj.val();break;
			case "range_slider": from = fromObj.slider("values", 0);to = toObj.slider("values", 1);break;
			case "range_calendar": from = this.dateConvertBack(fromObj.val());to = this.dateConvertBack(toObj.val());break;
		}
        this.doAction("onFilterValueChanged", fieldId, [from, to], "add");
	}

		/*var ds = this._targetDatasets[j];
		ds.queryState.setFilter({field: fieldId, type: fieldType, term:term, start: from, stop: to, fieldType: this.getFieldType(fieldId)});
		*/

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
    $target.hide();
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

  },
  onRemoveFilter: function(e) {
    e.preventDefault();
    var $target = $(e.target);
    var field = $target.parent().attr('data-filter-field');

  	/*_.each(this._targetDatasets, function(ds) {
		ds.queryState.removeFilterByField(field);
	});*/
      this.doAction("onRemoveFilter", field, [], "remove");

  }


});

})(jQuery, recline.View);
