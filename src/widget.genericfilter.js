/*jshint multistr:true */
this.recline = this.recline || {};
this.recline.View = this.recline.View || {};

(function($, my) {
	
my.GenericFilter = Backbone.View.extend({
  className: 'recline-filter-editor well', 
  template: ' \
    <div class="filters"> \
      <div class="form-stacked js-edit"> \
	  	<div class="btn btn-info" style="display:{{titlePresent}};cursor:default"> \
		  	<h4>{{filterDialogTitle}}</h4> \
		  	<small>{{filterDialogDescription}}</small> \
	  	</div> \
        {{#filters}} \
          {{{filterRender}}} \
		  <hr style="display:{{hrVisible}}"> \
        {{/filters}} \
      </div> \
    </div> \
  ',
  templateHoriz: ' \
	<style> \
		.separated-item { padding-left:20px;padding-right:20px; } \
	</style> \
    <div class="filters"> \
      <table > \
	  	<tbody> \
	  		<tr>\
	  			<td class="separated-item" style="display:{{titlePresent}}">\
				  	<div class="btn btn-info" style="cursor:default"> \
					  	<h4>{{filterDialogTitle}}</h4> \
					  	<small>{{filterDialogDescription}}</small> \
				  	</div> \
				</td>\
			  	{{#filters}} \
			  	<td class="separated-item">\
          			{{{filterRender}}} \
          		</td>\
  				{{/filters}} \
        	</tr>\
  		</tbody>\
  	   </table class="js-edit"> \
    </div> \
  ',
  filterTemplates: {
    term: ' \
      <div class="filter-{{type}} filter"> \
        <fieldset data-filter-field="{{field}}" data-filter-id="{{id}}" data-filter-type="{{type}}" data-control-type="{{controlType}}"> \
            <legend style="display:{{useLegend}}">{{label}}</legend>  \
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
				value: {{term}}, \
				slide: function( event, ui ) { \
					$( "#amount{{ctrlId}}" ).html( "Value: "+ ui.value ); \
				} \
			}); \
			$( "#amount{{ctrlId}}" ).html( "Value: "+ $( "#slider{{ctrlId}}" ).slider( "value" ) ); \
		}); \
	</script> \
      <div class="filter-{{type}} filter"> \
        <fieldset data-filter-field="{{field}}" data-filter-id="{{id}}" data-filter-type="{{type}}" data-control-type="{{controlType}}"> \
            <legend style="display:{{useLegend}}">{{label}} \
			<a class="js-remove-filter" href="#" title="Remove this filter">&times;</a> \
		</legend>  \
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
            <legend style="display:{{useLegend}}">{{label}}</legend>  \
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
				values: [ {{from}}, {{to}} ], \
				slide: function( event, ui ) { \
					$( "#amount{{ctrlId}}" ).html(  "Value range: " + ui.values[ 0 ] + " - " + ui.values[ 1 ] ); \
				} \
			}); \
			$( "#amount{{ctrlId}}" ).html(  "Value range: " + $( "#slider-range{{ctrlId}}" ).slider( "values", 0 ) + " - " + $( "#slider-range{{ctrlId}}" ).slider( "values", 1 ) ); \
		}); \
	</script> \
      <div class="filter-{{type}} filter"> \
        <fieldset data-filter-field="{{field}}" data-filter-id="{{id}}" data-filter-type="{{type}}" data-control-type="{{controlType}}"> \
            <legend style="display:{{useLegend}}">{{label}}</legend>  \
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
        <fieldset data-filter-field="{{field}}" data-filter-id="{{id}}" data-filter-type="{{type}}" data-control-type="{{controlType}}"> \
            <legend style="display:{{useLegend}}">{{label}}  \
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
				<table class="table table-striped table-hover table-condensed" style="width:100%" data-filter-field="{{field}}" data-filter-id="{{id}}" data-filter-type="{{type}}" data-control-type="{{controlType}}"> \
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
            <legend style="display:{{useLegend}}">{{label}}</legend>  \
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
    dropdown: ' \
      <div class="filter-{{type}} filter"> \
        <fieldset data-filter-field="{{field}}" data-filter-id="{{id}}" data-filter-type="{{type}}" data-control-type="{{controlType}}"> \
            <legend style="display:{{useLegend}}">{{label}} \
    		</legend>  \
			<select class="drop-down fields data-control-id" > \
			<option></option> \
            {{#values}} \
            <option value="{{val}}" {{selected}}>{{val}}</option> \
            {{/values}} \
          </select> \
        </fieldset> \
      </div> \
    ',
    dropdown_styled: ' \
    	<script> \
    	$(function() { \
    		$(".chzn-select-deselect").chosen({allow_single_deselect:true}); \
    	}); \
    	</script> \
      <div class="filter-{{type}} filter"> \
        <fieldset data-filter-field="{{field}}" data-filter-id="{{id}}" data-filter-type="{{type}}" data-control-type="{{controlType}}"> \
            <legend style="display:{{useLegend}}">{{label}} \
    		</legend>  \
			<select class="chzn-select-deselect data-control-id" data-placeholder="Select desired {{label}}"> \
    		<option></option> \
            {{#values}} \
            <option value="{{val}}" {{selected}}>{{val}}</option> \
            {{/values}} \
          </select> \
        </fieldset> \
      </div> \
    ',
    dropdown_date_range: ' \
      <div class="filter-{{type}} filter"> \
        <fieldset data-filter-field="{{field}}" data-filter-id="{{id}}" data-filter-type="{{type}}" data-control-type="{{controlType}}"> \
            <legend style="display:{{useLegend}}">{{label}} \
    		</legend>  \
			<select class="drop-down fields data-control-id" > \
			<option></option> \
            {{#date_values}} \
            <option startDate="{{startDate}}" stopDate="{{stopDate}}" {{selected}}>{{val}}</option> \
            {{/date_values}} \
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
        <fieldset data-filter-field="{{field}}" data-filter-id="{{id}}" data-filter-type="{{type}}" data-control-type="{{controlType}}"> \
            <legend style="display:{{useLegend}}">{{label}}  \
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
            <legend style="display:{{useLegend}}">{{label}}</legend>  \
			<select class="fields data-control-id"  multiple SIZE=10> \
            {{#values}} \
            <option value="{{val}}" {{selected}}>{{val}}</option> \
            {{/values}} \
          </select> \
		  <br> \
          <input type="button" class="btn" id="setFilterValueButton" value="Set"></input> \
        </fieldset> \
      </div> \
    ',
    listbox_styled: ' \
    	<script> \
    	$(function() { \
    		$(".chzn-select-deselect").chosen({allow_single_deselect:true}); \
    	}); \
    	</script> \
      <div class="filter-{{type}} filter"> \
        <fieldset data-filter-field="{{field}}" data-filter-id="{{id}}" data-filter-type="{{type}}" data-control-type="{{controlType}}"> \
            <legend style="display:{{useLegend}}">{{label}} \
    		</legend>  \
			<select class="chzn-select-deselect data-control-id" multiple data-placeholder="Select desired {{label}}"> \
            {{#values}} \
            <option value="{{val}}" {{selected}}>{{val}}</option> \
            {{/values}} \
          </select> \
        </fieldset> \
      </div> \
    ',
    radiobuttons : 
    	' \
        <div class="filter-{{type}} filter"> \
            <fieldset data-filter-field="{{field}}" data-filter-id="{{id}}" data-filter-type="{{type}}" data-control-type="{{controlType}}"> \
                <legend style="display:{{useLegend}}">{{label}}</legend>  \
        		<div class="btn-group" > \
    	            {{#values}} \
    	    		<button class="btn grouped-button {{selected}}">{{val}}</button> \
    	            {{/values}} \
              </div> \
            </fieldset> \
        </div> \
        ',
    multibutton : 
    	' \
    <div class="filter-{{type}} filter"> \
        <fieldset data-filter-field="{{field}}" data-filter-id="{{id}}" data-filter-type="{{type}}" data-control-type="{{controlType}}"> \
            <legend style="display:{{useLegend}}">{{label}}</legend>  \
    		<div class="btn-group" > \
	            {{#values}} \
	    		<button class="btn grouped-button {{selected}}">{{val}}</button> \
	            {{/values}} \
          </div> \
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
        <fieldset data-filter-field="{{field}}" data-filter-id="{{id}}" data-filter-type="{{type}}" data-control-type="{{controlType}}"> \
            <legend style="display:{{useLegend}}">{{label}}</legend>  \
			<table style="width:100%;background-color:transparent">\
			{{#values}} \
				<tr> \
				<td style="width:25px"><div class="legend-item {{notSelected}}" myValue="{{val}}" style="background-color:{{color}}"></td> \
				<td style="vertical-align:middle"><label style="color:{{color}};text-shadow: black 1px 1px, black -1px -1px, black -1px 1px, black 1px -1px, black 0px 1px, black 0px -1px, black 1px 0px, black -1px 0px">{{val}}</label></td>\
				<td><label style="text-align:right">[{{count}}]</label></td>\
				</tr>\
			{{/values}}\
			</table> \
	    </fieldset> \
      </div> \
	',
	color_legend: ' \
	<div class="filter-{{type}} filter"> \
        <fieldset data-filter-field="{{field}}" data-filter-id="{{id}}" data-filter-type="{{type}}"> \
            <legend style="display:{{useLegend}}">{{label}}</legend>  \
				<div style="max-width:250px;height:{{totHeight}}px"> \
					<svg height="{{totHeight}}" xmlns="http://www.w3.org/2000/svg"> \
					{{#colorValues}} \
				    	<rect width="{{width}}" height=50 fill="{{color}}" x="{{x}}" y={{y}}/> \
						<text width="{{width}}" fill="{{textColor}}" x="{{x}}" y="{{yplus30}}">{{val}}</text> \
					{{/colorValues}}\
					</svg>		\
				</div> \
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
	'change .chzn-select-deselect': 'onFilterValueChanged',
	'change .drop-down2': 'onListItemClicked',
	'change .drop-down3': 'onPeriodChanged',
	'click .grouped-button' : 'onButtonsetClicked'
  },
  activeFilters : new Array(),
  _sourceDataset: null,
  _selectedClassName : "info", // use bootstrap ready-for-use classes to highlight list item selection (avail classes are success, warning, info & error)
  initialize: function(args) {
    this.el = $(this.el);
    _.bindAll(this, 'render');
	_.bindAll(this, 'getFieldType');
	_.bindAll(this, 'onRemoveFilter');
	_.bindAll(this, 'onPeriodChanged');
	_.bindAll(this, 'findActiveFilterByField');

	this._sourceDataset = args.sourceDataset;
	this.uid = Math.floor(Math.random()*100000);

    //this._sourceDataset.fields.bind('all', this.render);

	this.sourceFields = args.sourceFields;
	if (args.state)
	{
		this.filterDialogTitle = args.state.title;
		this.filterDialogDescription = args.state.description;
		this.useHorizontalLayout = args.state.useHorizontalLayout;
	}
	this.activeFilters = new Array();

    this._actions = args.actions;

    if (this.sourceFields && this.sourceFields.length)
		for (var k in this.sourceFields)
			this.addNewFilterControl(this.sourceFields[k]);

    this._sourceDataset.bind('query:done', this.render);
    this._sourceDataset.queryState.bind('selection:done', this.render);
  },
  areValuesEqual: function(a,b)
  {
	  // this also handles date equalities.
	  // For instance comparing a Date obj with its corresponding timer value now returns true
	  if (typeof a == "undefined" || typeof b == "undefined")
		  return false;
	  
	  if (a == b)
		  return true;
	  if (a && a.valueOf() == b)
		  return true;
	  if (b && a == b.valueOf())
		  return true;
	  if (a && b && a.valueOf == b.valueOf())
		  return true;
	  
	  return false;
  },
  render: function() {
    var self = this;
	var tmplData = {filters : this.activeFilters}; 
	_.each(tmplData.filters , function(flt) { 
		flt.hrVisible = 'block'; 
	});

    //  map them to the correct controlType and retain their values (start/from/term/...)
     _.each(self._sourceDataset.queryState.get('selections'), function(filter) {
          for (var j in tmplData.filters)
          {
              if (tmplData.filters[j].field == filter.field)
              {
            	  if (typeof filter.list != "undefined" && filter.list != null)
            		  tmplData.filters[j].list = filter.list
            		  
            	  if (typeof filter.term != "undefined" && filter.term != null)
            		  tmplData.filters[j].term = filter.term
            		  
            	  if (typeof filter.start != "undefined" && filter.start != null)
            		  tmplData.filters[j].start = filter.start
            		  
            	  if (typeof filter.stop != "undefined" && filter.stop != null)
            		  tmplData.filters[j].stop = filter.stop
              }
          }
      });

      if (tmplData.filters.length > 0)
		tmplData.filters[tmplData.filters.length -1].hrVisible = 'none'
	
	var resultType = "filtered";
	if(self.options.useFilteredData !== null && self.options.useFilteredData === false)
		resultType = "original";

    tmplData.fields = this._sourceDataset.fields.toJSON();
	tmplData.records = _.pluck(this._sourceDataset.getRecords(resultType), "attributes");
	tmplData.filterDialogTitle = this.filterDialogTitle;
	tmplData.filterDialogDescription = this.filterDialogDescription;
	if (this.filterDialogTitle || this.filterDialogDescription)
		tmplData.titlePresent = "block";
	else tmplData.titlePresent = "none"; 
	tmplData.dateConvert = self.dateConvert;
    tmplData.filterRender = function() {
    	
  	  this.useLegend = "block";
      if (this.useFieldLabel == false)
    	  this.useLegend = "none";
		
  	  this.values = new Array();

  	  if (typeof this.label == "undefined" || this.label == null)
  		  this.label = this.field;
  	  
	  // add value list to selected filter or templating of record values will not work
	  if (this.controlType.indexOf('calendar') >= 0)
	  {
		  if (this.start)
			this.startDate = tmplData.dateConvert(this.start);
				
		  if (this.stop)
			this.endDate = tmplData.dateConvert(this.stop);
	  }
	  if (this.controlType.indexOf('slider') >= 0)
	  {
		  if (tmplData.records.length && typeof tmplData.records[0] != "undefined")
		  {
			  this.max = tmplData.records[0][this.field];
			  this.min = tmplData.records[0][this.field];
		  }
		  else
		  {
			  this.max = 100;
			  this.min = 0;
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
	  else if (this.controlType == "dropdown_date_range")
	  {
		  var currDate = new Date();
		  var currDate0h = new Date(currDate.getFullYear(), currDate.getMonth(), currDate.getDate(), 0, 0, 0, 0);
		  var currDate24h = new Date(currDate.getFullYear(), currDate.getMonth(), currDate.getDate(), 23, 59, 59, 999)+1;
		  var currYear = currDate.getFullYear();
		  var currMonth = currDate.getMonth();
			
		  var weekOffset = currDate0h.getDay();
		  var weekStartTime = currDate0h-weekOffset*86400000;
		  var weekEndTime = weekStartTime+7*86400000;

		  this.date_values = [];
		  
		  this.date_values.push({ val: "This week", 
				startDate: new Date(weekStartTime),
				stopDate: new Date(weekEndTime)
			});
		  
		  var endMonth = (currMonth + 1) % 12;
		  var endYear = currYear + (endMonth < currMonth ? 1 : 0); 
		  this.date_values.push({ val: "This Month", 
				startDate: new Date(currYear, currMonth, 1, 0, 0, 0, 0),
				stopDate: new Date(endYear, endMonth, 1, 0, 0, 0, 0)
		  });
		  
		  this.date_values.push({ val: "This year", 
				startDate: new Date(currYear, 0, 1, 0, 0, 0, 0),
				stopDate: new Date(currYear+1, 0, 1, 0, 0, 0, 0)
			});
		  
		  this.date_values.push({ val: "Past week", 
				startDate: new Date(weekStartTime-7*86400000),
				stopDate: new Date(weekStartTime)
			});
		  
		  var startMonth = currMonth - 1;
		  if (startMonth < 0)
			  startMonth -= 12;
		  
		  var startYear = currYear - (startMonth > currMonth ? 1 : 0); 
		  this.date_values.push({ val: "Past month", 
				startDate: new Date(startYear, startMonth, 1, 0, 0, 0, 0),
				stopDate: new Date(currYear, currMonth, 1, 0, 0, 0, 0)
			});
		  
		  startMonth = currMonth - 2;
		  if (startMonth < 0)
			  startMonth -= 12;
		  
		  startYear = currYear - (startMonth > currMonth ? 1 : 0); 
		  this.date_values.push({ val: "Past 2 months", 
				startDate: new Date(startYear, startMonth, 1, 0, 0, 0, 0),
				stopDate: new Date(currYear, currMonth, 1, 0, 0, 0, 0)
			});
		  
		  startMonth = currMonth - 3;
		  if (startMonth < 0)
			  startMonth -= 12;
		  
		  startYear = currYear - (startMonth > currMonth ? 1 : 0); 
		  this.date_values.push({ val: "Past 3 month", 
				startDate: new Date(startYear, startMonth, 1, 0, 0, 0, 0),
				stopDate: new Date(currYear, currMonth, 1, 0, 0, 0, 0)
			});
		  
		  startMonth = currMonth - 6;
		  if (startMonth < 0)
			  startMonth -= 12;
		  
		  startYear = currYear - (startMonth > currMonth ? 1 : 0); 
		  this.date_values.push({ val: "Past 6 months", 
				startDate: new Date(startYear, startMonth, 1, 0, 0, 0, 0),
				stopDate: new Date(currYear, currMonth, 1, 0, 0, 0, 0)
			});
		  
		  this.date_values.push({ val: "Past year", 
				startDate: new Date(currYear-1, 0, 1, 0, 0, 0, 0),
				stopDate: new Date(currYear, 0, 1, 0, 0, 0, 0)
			});
		  this.date_values.push({ val: "Last 7 days", 
				startDate: new Date(currDate0h.getTime()-6*86400000),
				stopDate: currDate24h
			});
		  this.date_values.push({ val: "Last 30 days", 
				startDate: new Date(currDate0h.getTime()-29*86400000),
				stopDate: currDate24h
			});
		  this.date_values.push({ val: "Last 90 days", 
				startDate: new Date(currDate0h.getTime()-89*86400000),
				stopDate: currDate24h
			});
		  this.date_values.push({ val: "Last 365 days", 
				startDate: new Date(currDate0h.getTime()-364*86400000),
				stopDate: currDate24h
			});
		  
		  for (var j in this.date_values)
			  if (this.date_values[j].val == this.term)
			  {
				  this.date_values[j].selected = self._selectedClassName;
				  break;
			  }
	  }
	  else if (this.controlType == "legend")
	  {
		  // OLD code, somehow working but wrong
	      this.facet = self._sourceDataset.getFacetByFieldId(this.field);
          if(this.facet == null ) {
              throw "GenericFilter: no facet present for field [" + this.field + "]. Define a facet before filter render";
          }
		  this.tmpValues = _.pluck(this.facet.attributes.terms, "term");

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
			if ((this.fieldType != "date" && legendSelection.indexOf(v) < 0) 
				|| (this.fieldType == "date" && legendSelection.indexOf(v) < 0 && legendSelection.indexOf(new Date(v).valueOf()) < 0))
				notSelected = "not-selected";
			
			this.values.push({val: v, notSelected: notSelected, color: this.facet.attributes.terms[i].color, count: this.facet.attributes.terms[i].count});
		  }		
			
// 			NEW code. Will work when facet will be returned correctly even after filtering
//		  this.facet = self._sourceDataset.getFacetByFieldId(this.field);
//		  this.tmpValues = _.pluck(this.facet.attributes.terms, "term");
//		  for (var v in this.tmpValues)
//		  {
//				var color;
//				var currTerm = _.find(this.facet.attributes.terms, function(currT) { return currT.term == v; });
//				if (typeof currTerm != "undefined" && currTerm != null)
//				{
//					color = currTerm.color;
//					count = currTerm.count;
//				}
//				var notSelected = "";
//				var legendSelection = this.legend;
//				if (typeof legendSelection == "undefined" || legendSelection == null || legendSelection.indexOf(v) < 0)
//					notSelected = "not-selected";
//				
//				this.values.push({val: v, notSelected: notSelected, color: color, count: count});
//		  }		  
	  }
	  else if (this.controlType == "color_legend")
	  {
		  var ruler = document.getElementById("my_string_width_calculation_ruler");
		  if (typeof ruler == "undefined" || ruler == null)
		  {
			  ruler = document.createElement("span");
			  ruler.setAttribute('id', "my_string_width_calculation_ruler");
			  ruler.style.visibility = "hidden";
			  ruler.style.width = "auto";
			  document.body.appendChild(ruler);
		  }
		  var maxWidth = 250;
		  this.colorValues = [];
		  
	      this.facet = self._sourceDataset.getFacetByFieldId(this.field);
          if(typeof this.facet == "undefined" || this.facet == null ) {
//        	  this.tmpValues = [15,20,25,30,35,40,45,50,55,60,65,70,75,80,85,90,95,100,105,110,115,120];
              throw "GenericFilter: no facet present for field [" + this.field + "]. Define a facet before filter render";
          }
          else this.tmpValues = _.pluck(this.facet.attributes.terms, "term");
          
		  var pixelW = 0;
		  // calculate needed pixel width for every string
		  for (var i in this.tmpValues)
		  {
			  var v = this.tmpValues[i];
			  ruler.innerHTML = v;
			  var w = ruler.offsetWidth
			  if (w > pixelW)
				  pixelW = w;
		  }
		  pixelW += 2;
		  
		  var riga = 0;
		  var colonna = 0;  
		  
		  for (var i in this.tmpValues)
		  {
			var v = this.tmpValues[i];
			var color = /*(typeof this.facet == "undefined" ? new chroma.Color(0,0,v*2,'rgb') :*/ this.facet.attributes.terms[i].color/*)*/;
			if (pixelW*colonna > maxWidth)
			{
				riga++;
				colonna = 0;
			}
			this.colorValues.push({width: pixelW, color: color, textColor: self.complementColor(color), 
									val: v, x:pixelW*colonna, y:riga*50, yplus30:riga*50+30  });
			
			colonna++;
	  	  }
		  this.totHeight = (riga+1)*50;
	  }
	  else
	  {
		  for (var i in tmplData.records)
		  {
			  var selected = "";
			  var v = tmplData.records[i][this.field];
			  if (this.controlType == "list")
			  {
				  // scan all filtered model records and look for the same records (may not have the same index)
				  for (var  j in self._sourceDataset.records.models)
					  if (self.areValuesEqual(self._sourceDataset.records.models[j].attributes[this.field], v))
					  {
						  if (self._sourceDataset.records.models[j].is_selected)
							  selected = self._selectedClassName; 
						  
						  break;
					  }
			  }
			  else if (this.controlType == "radiobuttons")
			  {
				  if (self.areValuesEqual(this.term, v) || (typeof this.list != "undefined" && this.list && this.list.length == 1 && self.areValuesEqual(this.list[0], v)))
				  	selected = 'btn-primary'
			  }
			  else if (this.controlType == "multibutton")
			  {
				  if (self.areValuesEqual(this.term, v)) 
					  selected = 'btn-info'
				  else if (typeof this.list != "undefined" && this.list != null)
				  {
					  for (var j in this.list)
						  if (self.areValuesEqual(this.list[j], v))
							  selected = 'btn-info'
				  }
			  }
			  else if (this.controlType == "dropdown" || this.controlType == "dropdown_styled")
			  {
				  if (self.areValuesEqual(this.term, v) || (typeof this.list != "undefined" && this.list && this.list.length == 1 && self.areValuesEqual(this.list[0], v)))
				  	selected = "selected"
			  }
			  else if (this.controlType == "listbox" || this.controlType == "listbox_styled") 
			  {
				  if (self.areValuesEqual(this.term, v)) 
					  selected = "selected"
				  else if (typeof this.list != "undefined" && this.list != null)
				  {
					  for (var j in this.list)
						  if (self.areValuesEqual(this.list[j], v))
							  selected = "selected"
				  }
			  }
			  
			this.values.push({val: v, selected: selected });
			if (this.controlType.indexOf('slider') >= 0)
			{
				if (v > this.max)
					this.max = v;
					
				if (v < this.min)
					this.min = v;
			}
		  }
		  if (this.controlType.indexOf('slider') >= 0)
		  {
			  if (typeof this.from == "undefined")
				  this.from = this.min; 
	
			  if (typeof this.to == "undefined")
				  this.to = this.max; 
			  
			  if (typeof this.term == "undefined")
				  this.term = this.min; 

		  }
	  }
	  this.ctrlId = self.uid;
		  return Mustache.render(self.filterTemplates[this.controlType], this);
    };
    var currTemplate = this.template;
    if (this.useHorizontalLayout)
    	currTemplate = this.templateHoriz

    var out = Mustache.render(currTemplate, tmplData);
    this.el.html(out);
  },
  complementColor: function(c)
  {
	  // calculates a readable color to use over a given color
	  // usually returns black for light colors and white for dark colors.
//	  var c1 = c.hsv();
//	  if (c1[2] >= 0.5)
//		  return chroma.hsv(c1[0],c1[1],0);
//	  else return chroma.hsv(c1[0],c1[1],1);
	  var c1 = c.rgb;
	  if (c1[0]+c1[1]+c1[2] < 255*3/2)
		  return "white";
	  else return "black";
  },
  onButtonsetClicked: function(e) {
	    e.preventDefault();
	    var $target = $(e.currentTarget);
		var $fieldSet = $target.parent().parent();
		var type  = $fieldSet.attr('data-filter-type');
		var fieldId = $fieldSet.attr('data-filter-field');
		var controlType = $fieldSet.attr('data-control-type');
		if (controlType == "multibutton")
		{
			$target.toggleClass("btn-info");
		}
		else if (controlType == "radiobuttons")
		{
			// ensure one and only one selection is performed
			$fieldSet.find('div.btn-group button.btn-info').each(function() { 
				$(this).removeClass("btn-info"); 
			});
			$target.addClass("btn-info");
		}
		var listaValori = [];
		$fieldSet.find('div.btn-group button.btn-info').each(function() { 
			listaValori.push($(this).html().valueOf()); // in case there's a date, convert it with valueOf
		});
		if (controlType == "multibutton")
			this.findActiveFilterByField(fieldId, controlType).list = listaValori;
		else if (controlType == "radiobuttons")
			this.findActiveFilterByField(fieldId, controlType).term = $target.html().valueOf();
		
		this.doAction("onButtonsetClicked", fieldId, listaValori, "add");
	  },
  onLegendItemClicked: function(e) {
    e.preventDefault();
    var $target = $(e.currentTarget);
	var $fieldSet = $target.parent().parent().parent().parent().parent();
	var type  = $fieldSet.attr('data-filter-type');
	var fieldId = $fieldSet.attr('data-filter-field');
	var controlType = $fieldSet.attr('data-control-type');

	$target.toggleClass("not-selected");
	var listaValori = [];
	$fieldSet.find('div.legend-item').each(function() { 
		if (!$(this).hasClass("not-selected"))
			listaValori.push($(this).attr("myValue").valueOf()); // in case there's a date, convert it with valueOf
	});
		
	// make sure at least one value is selected
	if (listaValori.length > 0)
	{
		this.findActiveFilterByField(fieldId, controlType).legend = listaValori;
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
	var controlType = $table.attr('data-control-type');
	var type = $table.attr('data-filter-type');
	if (type == "range" && typeof $targetTD == "undefined")
	{
		// case month_week_calendar
		// user clicked on year combo
		var year = parseInt($combo.val());
		// update year value in filter (so that the value is retained after re-rendering)
		this.findActiveFilterByField(fieldId, controlType).year = year;
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

			var currFilter = this.findActiveFilterByField(fieldId, controlType);
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
			case "dropdown":
			case "dropdown_styled":
				term = termObj.val();break;
			case "listbox": term = termObj.val();break;
		}
		this.findActiveFilterByField(fieldId, controlType).term = term;
		this.findActiveFilterByField(fieldId, controlType).list = [term];
        this.doAction("onFilterValueChanged", fieldId, [term], "add");
	}
	else if (fieldType == "list")
	{
		var list = new Array();
		var listObj = $target.find('.data-control-id')[0]; //return a plain HTML select obj
		for (var i in listObj.options) 
			if (listObj.options[i].selected) 
				list.push(listObj.options[i].value);
		
		this.findActiveFilterByField(fieldId, controlType).list = list;
        this.doAction("onFilterValueChanged", fieldId, list, "add");
	}
	else if (fieldType == "range")
	{
        var from;
        var to;
		var fromObj = $target.find('.data-control-id-from');
		var toObj = $target.find('.data-control-id-to');
		var dropdownObj = $target.find('.data-control-id');
		var activeFilter = this.findActiveFilterByField(fieldId, controlType); 
		switch (controlType)
		{
			case "range": from = fromObj.val();to = toObj.val();break;
			case "range_slider": from = fromObj.slider("values", 0);to = toObj.slider("values", 1);break;
			case "range_calendar": from = new Date(fromObj.val());to = new Date(toObj.val());break;
			case "dropdown_date_range": from = dropdownObj.find(":selected").attr("startDate");to = dropdownObj.find(":selected").attr("stopDate");activeFilter.term = dropdownObj.val();break;
		}
		activeFilter.from = from;
		activeFilter.to = to;
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
		case "dropdown" :
		case "dropdown_styled" :
		case "slider" :
		case "radiobuttons" :
			return "term";
		case "range_slider" :
		case "range_calendar" :
		case "month_week_calendar" :
		case "dropdown_date_range" :
			return "range";
		case "list" :
		case "listbox":
		case "listbox_styled":
		case "legend" :
		case "multibutton" :
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
	this.activeFilters.push(newFilter);

  },
  onPeriodChanged: function(e) {
    e.preventDefault();
	var $table = $(e.target).parent().find(".table");
	//var $yearCombo = $(e.target).parent().find(".drop-down2");
	var fieldId = $table.attr('data-filter-field');
	var controlType = $table.attr('data-control-type');

	var type = $table.attr('data-filter-type');
	var currFilter = this.findActiveFilterByField(fieldId, controlType); 
	currFilter.period = $(e.target).val();
	currFilter.term = null;
	this.render();
  },
  findActiveFilterByField: function(fieldId, controlType) {
	for (var j in this.activeFilters)
	{
		if (this.activeFilters[j].field == fieldId && this.activeFilters[j].controlType == controlType)
			return this.activeFilters[j];
	}
	return new Object(); // to avoid "undefined" errors
  },
  onRemoveFilter: function(e) {
    e.preventDefault();
    var $target = $(e.target);
    var field = $target.parent().parent().attr('data-filter-field');
    var controlType = $target.parent().parent().attr('data-control-type');
	var currFilter = this.findActiveFilterByField(field, controlType);
	//console.log(currFilter);
	currFilter.term = undefined;
	currFilter.value = [];
	
	if (currFilter.controlType == "list" || currFilter.controlType == "month_week_calendar")
	{
		$table = $target.parent().parent().find(".table")
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
