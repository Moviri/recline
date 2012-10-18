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
            <legend>{{field}}</legend>  \
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
            <legend>{{field}}</legend>  \
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
            <legend>{{field}}</legend>  \
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
            <legend>{{field}}</legend>  \
		  <label id="amount{{ctrlId}}">Value range: </label></span> \
		  <div id="slider-range{{ctrlId}}" class="data-control-id-from data-control-id-to" ></div> \
		  <br> \
          <input type="button" class="btn" id="setFilterValueButton" value="Set"></input> \
        </fieldset> \
      </div> \
    ',
	month_week_calendar: ' \
	  <style> \
		.list-filter-item { cursor:pointer; } \
		.list-filter-item:hover { background: lightblue;cursor:pointer; } \
	  </style> \
      <div class="filter-{{type}} filter"> \
        <fieldset> \
            <legend>{{field}}  \
            <a class="js-remove-filter" href="#" title="Remove this filter">&times;</a> \
			</legend> \
			Year<br> \
			<select class="drop-down2 fields data-control-id" > \
            {{#yearValues}} \
            <option value="{{val}}" {{selected}}>{{val}}</option> \
            {{/yearValues}} \
          </select> \
			<br> \
			Type<br> \
			<select class="drop-down3 fields" > \
				{{#periodValues}} \
				<option value="{{val}}" {{selected}}>{{val}}</option> \
				{{/periodValues}} \
			</select> \
			<br> \
			<div style="max-height:500px;width:100%;border:1px solid grey;overflow:auto;"> \
				<table class="table table-striped table-hover table-condensed" style="width:100%" data-filter-field="{{field}}" data-filter-id="{{id}}" data-filter-type="{{type}}" > \
				<tbody>\
				{{#values}} \
				<tr class="{{selected}}"><td class="list-filter-item " myValue="{{val}}" startDate="{{startDate}}" stopDate="{{stopDate}}">{{label}}</td></tr> \
				{{/values}} \
				</tbody> \
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
			dateFormat: "D M dd yy", \
			onSelect: function( selectedDate ) { \
				$( "#to{{ctrlId}}" ).datepicker( "option", "minDate", selectedDate ); \
			} \
		}); \
		$( "#to{{ctrlId}}" ).datepicker({ \
			defaultDate: "{{endDate}}", \
			changeMonth: true, \
			numberOfMonths: 1, \
			dateFormat: "D M dd yy", \
			onSelect: function( selectedDate ) { \
				$( "#from{{ctrlId}}" ).datepicker( "option", "maxDate", selectedDate ); \
			} \
		}); \
	}); \
	</script> \
      <div class="filter-{{type}} filter"> \
        <fieldset data-filter-field="{{field}}" data-filter-id="{{id}}" data-filter-type="{{type}}" data-control-type="{{controlType}}"> \
            <legend>{{field}}</legend>  \
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
            <legend>{{field}}</legend>  \
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
		.list-filter-item { cursor:pointer; } \
		.list-filter-item:hover { background: lightblue;cursor:pointer; } \
	  </style> \
      <div class="filter-{{type}} filter"> \
        <fieldset data-filter-field="{{field}}" data-filter-id="{{id}}" data-filter-type="{{type}}"> \
            <legend>{{field}}  \
            <a class="js-remove-filter" href="#" title="Remove this filter">&times;</a> \
			</legend> \
			<div style="max-height:500px;width:100%;border:1px solid grey;overflow:auto;"> \
				<table class="table table-striped table-hover table-condensed" style="width:100%" data-filter-field="{{field}}" data-filter-id="{{id}}" data-filter-type="{{type}}" > \
				<tbody>\
				{{#values}} \
				<tr class="{{selected}}"><td class="list-filter-item" >{{val}}</td></tr> \
				{{/values}} \
				</tbody>\
			  </table> \
		  </div> \
	    </fieldset> \
      </div> \
	',
    listbox: ' \
      <div class="filter-{{type}} filter"> \
        <fieldset data-filter-field="{{field}}" data-filter-id="{{id}}" data-filter-type="{{type}}" data-control-type="{{controlType}}"> \
            <legend>{{field}}</legend>  \
			<select class="fields data-control-id"  multiple SIZE=10> \
            {{#values}} \
            <option value="{{val}}">{{val}}</option> \
            {{/values}} \
          </select> \
		  <br> \
          <input type="button" class="btn" id="setFilterValueButton" value="Set"></input> \
        </fieldset> \
      </div> \
    ',
	legend: ' \
	  <style> \
      .legend-item { \
					border-top:2px solid black;border-left:2px solid black; \
					border-bottom:2px solid darkgrey;border-right:2px solid darkgrey; \
					width:16px;height:16px;padding:1px;margin:5px; \
					opacity: 0.85 \
					}  \
	 .legend-item.not-selected { background-color:transparent !important; } /* the idea is that the color "not-selected" overrides the original color (this way we may use a global style) */ \
	  </style> \
      <div class="filter-{{type}} filter"> \
        <fieldset data-filter-field="{{field}}" data-filter-id="{{id}}" data-filter-type="{{type}}"> \
            <legend>{{field}}</legend>  \
			<table style="width:100%;background-color:transparent">\
			{{#values}} \
				<tr> \
				<td style="width:25px"><div class="legend-item {{notSelected}}" myValue={{val}} style="background-color:{{color}}"></td> \
				<td style="vertical-align:middle"><label style="color:{{color}};text-shadow: black 1px 1px, black -1px -1px, black -1px 1px, black 1px -1px, black 0px 1px, black 0px -1px, black 1px 0px, black -1px 0px">{{val}}</label></td>\
				<td><label style="text-align:right">[{{count}}]</label></td>\
				</tr>\
			{{/values}}\
			</table> \
	    </fieldset> \
      </div> \
	'
  },
  events: {
    'click .js-remove-filter': 'onRemoveFilter',
    'click .js-add-filter': 'onAddFilterShow',
    'click #addFilterButton': 'onAddFilter',
	'click .list-filter-item': 'onListItemClicked',
	'click .legend-item': 'onLegendItemClicked',
	'click #setFilterValueButton': 'onFilterValueChanged',
	'change .drop-down': 'onFilterValueChanged',
	'change .drop-down2': 'onListItemClicked',
	'change .drop-down3': 'onPeriodChanged'
  },
  _ctrlId : 0,
  _sourceDataset: null,
  _activeFilters: [],
  _selectedClassName : "info", // use bootstrap ready-for-use classes to highlight list item selection (avail classes are success, warning, info & error)
  initialize: function(args) {
    this.el = $(this.el);
    _.bindAll(this, 'render');
	_.bindAll(this, 'getFieldType');
	_.bindAll(this, 'onRemoveFilter');
	_.bindAll(this, 'onPeriodChanged');
	_.bindAll(this, 'findActiveFilterByField');

	this._sourceDataset = args.sourceDataset;

    //this._sourceDataset.fields.bind('all', this.render);

	this.sourceFields = args.sourceFields;
	this.filterDialogLabel = args.label;
	this._activeFilters = [];

    this._actions = args.actions;

    if (this.sourceFields && this.sourceFields.length)
		for (var k in this.sourceFields)
			this.addNewFilterControl(this.sourceFields[k]);

    this._sourceDataset.bind('query:done', this.render);
    this._sourceDataset.queryState.bind('selection:done', this.render);
  },

  render: function() {
    var self = this;
	var tmplData = {filters : this._activeFilters};
	_.each(tmplData.filters , function(flt) { 
		flt.hrVisible = 'block'; 
	});

	// retrieve filters already set on the model
    //console.log("render");
      //console.log(self._sourceDataset.queryState) ;

    //  map them to the correct controlType also retaining their values (start/from/term)
     _.each(self._sourceDataset.queryState.get('selections'), function(filter) {
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
	  if (this.controlType === 'list' || this.controlType.indexOf('slider') >= 0 || this.controlType.indexOf('legend') >= 0)
	  {
	      this.facet = self._sourceDataset.getFacetByFieldId(this.field);
		  this.tmpValues = _.pluck(this.facet.attributes.terms, "term");
	  }
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
	  if (this.controlType == "legend")
	  {
		  if (typeof this.origLegend == "undefined")
		  {
			  this.origLegend = this.tmpValues;
			  this.legend = this.origLegend;
		  }
		  this.tmpValues = this.origLegend; 
		  var legendSelection = this.legend;
		  for (var i in this.tmpValues)
		  {
			var v = this.tmpValues[i];
			var notSelected = "";
			if (legendSelection.indexOf(v) < 0)
				notSelected = "not-selected";
			
// 			NEW code. Will work when facet will be returned correctly even after filtering 
//			var color;
//			var currTerm = _.find(this.facet.attributes.terms, function(currT) { return currT.term == v; });
//			if (typeof currTerm != "undefined" && currTerm != null)
//			{
//				color = currTerm.color;
//				count = currTerm.count;
//			}
//			
//			this.values.push({val: v, notSelected: notSelected, color: color, count: });
			
			// OLD code, somehow working but wrong
			this.values.push({val: v, notSelected: notSelected, color: this.facet.attributes.terms[i].color, count: this.facet.attributes.terms[i].count});
		  }		
	  }
	  else
	  {
		  for (var i in this.tmpValues)
		  {
			var v = this.tmpValues[i];
			this.values.push({val: v, selected: (this.term == v || self._sourceDataset.records.models[i].is_selected ? self._selectedClassName : "")});
			if (v > this.max)
				this.max = v;
				
			if (v < this.min)
				this.min = v;
		  }
	  }
	  if (this.controlType == "month_week_calendar")
	  {
		this.weekValues = [];
		this.periodValues = [ {val: "Months", selected: (this.period == "Months" ? "selected" : "")}, {val:"Weeks", selected: (this.period == "Weeks" ? "selected" : "")} ]
		var currYear = this.year;
		var januaryFirst = new Date(currYear,0,1);
		var januaryFirst_time = januaryFirst.getTime();
		var weekOffset = januaryFirst.getDay();
		var finished = false;
		for (var w = 0; w <= 53 && !finished; w++)
		{
			var weekStartTime = januaryFirst_time+7*86400000*(w-1)+(7-weekOffset)*86400000;
			var weekEndTime = weekStartTime+7*86400000;
			if (w == 0)
				weekStartTime = januaryFirst_time;
				
			if (new Date(weekEndTime).getFullYear() > currYear)
			{
				weekEndTime = new Date(currYear+1,0,1).getTime();
				finished = true;
			}
			this.weekValues.push({val: w+1,
									label: ""+(w+1)+ " ["+d3.time.format("%x")(new Date(weekStartTime))+" -> "+d3.time.format("%x")(new Date(weekEndTime-1000))+"]",
									startDate: new Date(weekStartTime), 
									stopDate: new Date(weekEndTime),
									selected: (this.term == w+1 ? self._selectedClassName : "")
								});
		}
		
		this.monthValues = [];
		for (m = 1; m <= 12; m++)
		{
			var endYear = currYear;
			var endMonth = m;
			if (m == 12)
			{
				endYear = currYear+1;
				endMonth = 0;
			}
			this.monthValues.push({ val: d3.format("02d")(m), 
									label: d3.time.format("%B")(new Date(m+"/01/2012"))+" "+currYear,
									startDate: new Date(currYear, m-1, 1, 0, 0, 0, 0),
									stopDate: new Date(endYear, endMonth, 1, 0, 0, 0, 0),
									selected: (this.term == m ? self._selectedClassName : "")
								});
		}
		if (this.period == "Months")
			this.values = this.monthValues;
		else if (this.period == "Weeks")
			this.values = this.weekValues;

		this.yearValues = [];
		var startYear = 2010;
		var endYear = parseInt(d3.time.format("%Y")(new Date()))
		for (var y = startYear; y <= endYear; y++)
			this.yearValues.push({val: y, selected: (this.year == y ? "selected" : "")});
			
	  }
	  if (this.controlType.indexOf("slider") >= 0 || this.controlType.indexOf("calendar") >= 0)
		self._ctrlId++;
		
	  this.ctrlId = self._ctrlId;
      return Mustache.render(self.filterTemplates[this.controlType], this);
    };

    var out = Mustache.render(this.template, tmplData);
    this.el.html(out);
  },
  onLegendItemClicked: function(e) {
    e.preventDefault();
    var $target = $(e.currentTarget);
	var $fieldSet = $target.parent().parent().parent().parent().parent();
	var type  = $fieldSet.attr('data-filter-type');
	var fieldId  = $fieldSet.attr('data-filter-field');

	$target.toggleClass("not-selected");
	var listaValori = [];
	$fieldSet.find('div.legend-item').each(function() { 
		if (!$(this).hasClass("not-selected"))
			listaValori.push($(this).attr("myValue"));
	});
		
	// make sure at least one value is selected
	if (listaValori.length > 0)
	{
		this.findActiveFilterByField(fieldId).legend = listaValori;
		this.doAction("onLegendItemClicked", fieldId, listaValori, "add");
	}
	else $target.toggleClass("not-selected"); // reselect the item and exit
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
	this.handleListItemClicked($targetTD, $table, $combo, e.ctrlKey);
  },
  handleListItemClicked: function($targetTD, $table, $combo, ctrlKey) {
	var fieldId = $table.attr('data-filter-field');
	var type = $table.attr('data-filter-type');
	if (type == "range" && typeof $targetTD == "undefined")
	{
		// case month_week_calendar
		// user clicked on year combo
		var year = parseInt($combo.val());
		// update year value in filter (so that the value is retained after re-rendering)
		this.findActiveFilterByField(fieldId).year = year;
		this.render();
	}
	if (typeof $targetTD != "undefined")
	{
		// user clicked on table
		if (!ctrlKey)
		{
			$table.find('tr').each(function() { 
				$(this).removeClass(this._selectedClassName); 
			});
		}
		$targetTD.parent().addClass(this._selectedClassName);
		var listaValori = [];
		if (type == "list")
		{
			$table.find('tr.'+this._selectedClassName+" td").each(function() {
				listaValori.push($(this).text());
			});
		}

		if (type == "range")
		{
			// case month_week_calendar 
			var year = parseInt($combo.val());
			var startDate = $targetTD.attr('startDate');
			var endDate = $targetTD.attr('stopDate');

			var currFilter = this.findActiveFilterByField(fieldId);
			currFilter.term = $targetTD.attr('myValue'); // save selected item for re-rendering later
				
			this.doAction("onListItemClicked", fieldId, [startDate, endDate], "add");
		}
		else if (type == "list")
		{
			this.doAction("onListItemClicked", fieldId, listaValori, "add");
		}
		else if (type == "term")
		{
            this.doAction("onListItemClicked", fieldId, [$targetTD.text()], "add");
		}
	}
  },

    // action could be add or remove
    doAction: function(eventType, fieldName, values, actionType) {

        var actions = this.options.actions;
        var eventData = {};
        eventData[fieldName] = values;

        recline.ActionUtility.doAction(actions, eventType, eventData, actionType);
    },

    dateConvert: function(d) {
        var dd= new Date(d);
        return dd.toDateString();
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
			case "range_calendar": from = new Date(fromObj.val());to = new Date(toObj.val());break;
		}
        this.doAction("onFilterValueChanged", fieldId, [from, to], "add");
	}
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
		case "drop_down" :
		case "slider" :
			return "term";
		case "range_slider" :
		case "range_calendar" :
			return "range";
		case "list" :
		case "listbox":
		case "legend" :
			return "list";
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
		
	if (newFilter.controlType == "month_week_calendar")
	{
		if (typeof newFilter.period == "undefined")
			newFilter.period = "Months"

		if (typeof newFilter.year == "undefined")
			newFilter.year = new Date().getFullYear();
	}
	this._activeFilters.push(newFilter);

  },
  onPeriodChanged: function(e) {
    e.preventDefault();
	var $table = $(e.target).parent().find(".table");
	//var $yearCombo = $(e.target).parent().find(".drop-down2");
	var fieldId = $table.attr('data-filter-field');
	var type = $table.attr('data-filter-type');
	this.findActiveFilterByField(fieldId).period = $(e.target).val();
	this.render();
	//this.handleListItemClicked(undefined, $table, $yearCombo);
  },
  findActiveFilterByField: function(fieldId) {
	for (var j in this._activeFilters)
	{
		if (this._activeFilters[j].field == fieldId)
			return this._activeFilters[j];
	}
	return new Object(); // to avoid "undefined" errors
  },
  onRemoveFilter: function(e) {
    e.preventDefault();
    var $target = $(e.target);
    var field = $target.parent().attr('data-filter-field');
	var currFilter = this.findActiveFilterByField(field);
	//console.log(currFilter);
	currFilter.term = "";
	currFilter.value = [];
	
	if (currFilter.controlType == "list" || currFilter.controlType == "month_week_calendar")
	{
		$table = $target.parent().find(".table")
		if (typeof $table != "undefined")
		{
			$table.find('tr').each(function() { 
							$(this).removeClass(this._selectedClassName); 
						});
		}		
	}
	


  	/*_.each(this._targetDatasets, function(ds) {
		ds.queryState.removeFilterByField(field);
	});*/
      this.doAction("onRemoveFilter", field, [], "remove");

  }


});

})(jQuery, recline.View);
