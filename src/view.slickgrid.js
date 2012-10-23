/*jshint multistr:true */

this.recline = this.recline || {};
this.recline.View = this.recline.View || {};

(function($, my) {
// ## SlickGrid Dataset View
//
// Provides a tabular view on a Dataset, based on SlickGrid.
//
// https://github.com/mleibman/SlickGrid
//
// Initialize it with a `recline.Model.Dataset`.
//
// NB: you need an explicit height on the element for slickgrid to work
my.SlickGrid = Backbone.View.extend({
  initialize: function(modelEtc) {
    var self = this;
    this.el = $(this.el);
    this.el.addClass('recline-slickgrid');
    _.bindAll(this, 'render');
    _.bindAll(this, 'onSelectionChanged');
	
    this.model.records.bind('add', this.render);
    this.model.records.bind('reset', this.render);
    this.model.records.bind('remove', this.render);

    this.model.queryState.bind('selection:done', this.render);

    var state = _.extend({
        hiddenColumns: [],
        visibleColumns: [],
        columnsOrder: [],
        columnsSort: {},
        columnsWidth: [],
        fitColumns: false
      }, modelEtc.state
    );
    this.state = new recline.Model.ObjectState(state);
  },

  events: {
  },
  render: function() {
    var self = this;
//    console.log("View.SlickGrid RENDER");

    var options = {
      enableCellNavigation: true,
      enableColumnReorder: true,
      explicitInitialization: true,
      syncColumnCellResize: true,
      forceFitColumns: this.state.get('fitColumns'),
      useInnerChart: this.state.get('useInnerChart'),
      innerChartMax: this.state.get('innerChartMax')
	};

    // We need all columns, even the hidden ones, to show on the column picker
    var columns = [];
    // custom formatter as default one escapes html
    // plus this way we distinguish between rendering/formatting and computed value (so e.g. sort still works ...)
    // row = row index, cell = cell index, value = value, columnDef = column definition, dataContext = full row values
    var formatter = function(row, cell, value, columnDef, dataContext) {
      var field = self.model.fields.get(columnDef.id);
      if (field.renderer) {
        return field.renderer(value, field, dataContext);
      } else {
        return value;
      }
    }
    _.each(this.model.fields.toJSON(),function(field){
      var column = {
        id:field['id'],
        name:field['label'],
        field:field['id'],
        sortable: true,
        minWidth: 80,
        formatter: formatter
      };

      var widthInfo = _.find(self.state.get('columnsWidth'),function(c){return c.column == field.id});
      if (widthInfo){
        column['width'] = widthInfo.width;
      }

      columns.push(column);
    });
	if (options.useInnerChart == true && self.model.records.length > 0)
	{
		columns.push({
        name: self.state.get('innerChartHeader'),
        id: 'innerChart',
        field:'innerChart',
        sortable: false,
		alignLeft: true,
        minWidth: 150,
        formatter: Slick.Formatters.TwinBarFormatter
      })
	}
	if (self.state.get('fieldLabels') && self.state.get('fieldLabels').length > 0)
	{
		_.each(self.state.get('fieldLabels'), function(newIdAndLabel) {
			for (var c in columns)
				if (columns[c].id == newIdAndLabel.id)
					columns[c].name = newIdAndLabel.label;
		});
	}
	var visibleColumns = [];
	if (self.state.get('visibleColumns').length > 0)
	{
		visibleColumns = columns.filter(function(column) {
		  return _.indexOf(self.state.get('visibleColumns'), column.id) >= 0;
		});
		if (self.state.get('useInnerChart') == true && self.model.records.length > 0)
			visibleColumns.push(columns[columns.length - 1]); // innerChart field is last one added
	}
	else
	{
		// Restrict the visible columns
		visibleColumns = columns.filter(function(column) {
		  return _.indexOf(self.state.get('hiddenColumns'), column.id) == -1;
		});
	}

    // Order them if there is ordering info on the state
    if (this.state.get('columnsOrder')){
      visibleColumns = visibleColumns.sort(function(a,b){
        return _.indexOf(self.state.get('columnsOrder'),a.id) > _.indexOf(self.state.get('columnsOrder'),b.id) ? 1 : -1;
      });
      columns = columns.sort(function(a,b){
        return _.indexOf(self.state.get('columnsOrder'),a.id) > _.indexOf(self.state.get('columnsOrder'),b.id) ? 1 : -1;
      });
    }

    // Move hidden columns to the end, so they appear at the bottom of the
    // column picker
    var tempHiddenColumns = [];
    for (var i = columns.length -1; i >= 0; i--){
      if (_.indexOf(_.pluck(visibleColumns,'id'),columns[i].id) == -1){
        tempHiddenColumns.push(columns.splice(i,1)[0]);
      }
    }
    columns = columns.concat(tempHiddenColumns);

	var max = 0;
	var adjustMax = function(val) {
		// adjust max in order to return the highest comfortable number
		var valStr = ""+parseInt(val);
		var totDigits = valStr.length;
		if (totDigits <= 1)
			return 10;
		else
		{
			var firstChar = parseInt(valStr.charAt(0));
			var secondChar = parseInt(valStr.charAt(1));
			if (secondChar < 5)
				return (firstChar+0.5)*Math.pow(10, totDigits-1)
			else return (firstChar+1)*Math.pow(10, totDigits-1)
		}
	}
	var innerChartSerie1Name = self.state.get('innerChartSerie1');
	var innerChartSerie2Name = self.state.get('innerChartSerie2');
	if (self.state.get('useInnerChart') == true && innerChartSerie1Name != null && innerChartSerie2Name != null && this.model.records.length > 0)
	{
		this.model.records.each(function(doc){
		  var row = {};
		  self.model.fields.each(function(field){
			row[field.id] = doc.getFieldValue(field);
			if (field.id == innerChartSerie1Name || field.id == innerChartSerie2Name)
			{
				var currVal = Math.abs(parseFloat(row[field.id]));
				if (currVal > max)
					max = currVal;
			}
		  });
		});
		max = adjustMax(max);
		options.innerChartMax = max;
	}
    var data = [];
	var rowsToSelect = [];
	var jj = 0;
    this.model.records.each(function(doc){
      if (doc.is_selected)
		rowsToSelect.push(jj);
		
	  var row = {schema_colors: []};

      self.model.fields.each(function(field){
        row[field.id] = doc.getFieldValue(field);
        if (innerChartSerie1Name != null && field.id == innerChartSerie1Name)
    		row.schema_colors[0] = doc.getFieldColor(field);
        
        if (innerChartSerie2Name != null && field.id == innerChartSerie2Name)
    		row.schema_colors[1] = doc.getFieldColor(field);
      });
	  
	  if (self.state.get('useInnerChart') == true && innerChartSerie1Name != null && innerChartSerie2Name != null) 
		row['innerChart'] = [ row[innerChartSerie1Name], row[innerChartSerie2Name], max ];
		
      data.push(row);
		jj++;
    });

	if (this.options.actions != null && typeof this.options.actions != "undefined")
	{
		_.each(this.options.actions, function(currAction) {
			if (_.indexOf(currAction.event, "hover") >= 0)
				options.trackMouseHover = true;
		});
	}
	
    this.grid = new Slick.Grid(this.el, data, visibleColumns, options);
	
	this.grid.addClassesToGrid(["s-table", "s-table-hover", "s-table-striped", "s-table-condensed"]);
	this.grid.removeClassesFromGrid(["ui-widget"]);
	
	this.grid.setSelectionModel(new Slick.RowSelectionModel());
	this.grid.getSelectionModel().setSelectedRows(rowsToSelect);
	
    this.grid.onSelectedRowsChanged.subscribe(function(e, args){
		self.onSelectionChanged(args.rows)
	});

    // Column sorting
    var sortInfo = this.model.queryState.get('sort');
    if (sortInfo){
      var column = sortInfo[0].field;
      var sortAsc = !(sortInfo[0].order == 'desc');
      this.grid.setSortColumn(column, sortAsc);
    }

    this.grid.onSort.subscribe(function(e, args){
      var order = (args.sortAsc) ? 'asc':'desc';
      var sort = [{
        field: args.sortCol.field,
        order: order
      }];
      self.model.query({sort: sort});
    });

    this.grid.onColumnsReordered.subscribe(function(e, args){
      self.state.set({columnsOrder: _.pluck(self.grid.getColumns(),'id')});
    });

    this.grid.onColumnsResized.subscribe(function(e, args){
        var columns = args.grid.getColumns();
        var defaultColumnWidth = args.grid.getOptions().defaultColumnWidth;
        var columnsWidth = [];
        _.each(columns,function(column){
          if (column.width != defaultColumnWidth){
            columnsWidth.push({column:column.id,width:column.width});
          }
        });
        self.state.set({columnsWidth:columnsWidth});
    });

      //
    this.grid.onRowHoverIn.subscribe(function(e, args){
		console.log("HoverIn "+args.row)
		var selectedRecords = [];
		selectedRecords.push(self.model.records.models[args.row]);
		var actions = self.options.actions;
		actions.forEach(function(currAction){				
			currAction.action.doAction(selectedRecords, currAction.mapping);
		});
    });
	
    var columnpicker = new Slick.Controls.ColumnPicker(columns, this.grid,
                                                       _.extend(options,{state:this.state}));

    if (self.visible){
      self.grid.init();
      self.rendered = true;
    } else {
      // Defer rendering until the view is visible
      self.rendered = false;
    }

    function resizeSlickGrid()
    {
    	if (self.model.records.length > 0)
    	{
    		var container = self.el.parent();
            if (typeof container != "undefined" && container != null 
            		&& container[0].style && container[0].style.height
            		&& container[0].style.height.indexOf("%") > 0) 
        	{
//        		console.log("Resizing container height from "+self.el.height()+" to "+self.el.parent().height())
	        	// force container height to element height 
	        	self.el.height(self.el.parent().height());
	        	self.grid.invalidateAllRows();
	        	self.grid.resizeCanvas();
        	}    		
    	}
    }
    //resizeSlickGrid();
    nv.utils.windowResize(resizeSlickGrid);
    
    return this;
 },
  onSelectionChanged: function(rows) {
	var self = this;
	var selectedRecords = [];
	_.each(rows, function(row) {
		selectedRecords.push(self.model.records.models[row]);
	});
	var actions = this.options.actions;
	   if(actions != null)
        actions.forEach(function(currAction){
		    currAction.action.doAction(selectedRecords, currAction.mapping);
	    });
  },
  show: function() {
    // If the div is hidden, SlickGrid will calculate wrongly some
    // sizes so we must render it explicitly when the view is visible
    if (!this.rendered){
      if (!this.grid){
        this.render();
      }
      this.grid.init();
      this.rendered = true;
    }
    this.visible = true;
  },

  hide: function() {
    this.visible = false;
  }
});

})(jQuery, recline.View);

/*
* Context menu for the column picker, adapted from
* http://mleibman.github.com/SlickGrid/examples/example-grouping
*
*/
(function ($) {
  function SlickColumnPicker(columns, grid, options) {
    var $menu;
    var columnCheckboxes;

    var defaults = {
      fadeSpeed:250
    };

    function init() {
      grid.onHeaderContextMenu.subscribe(handleHeaderContextMenu);
      options = $.extend({}, defaults, options);

      $menu = $('<ul class="dropdown-menu slick-contextmenu" style="display:none;position:absolute;z-index:20;" />').appendTo(document.body);

      $menu.bind('mouseleave', function (e) {
        $(this).fadeOut(options.fadeSpeed)
      });
      $menu.bind('click', updateColumn);

    }

    function handleHeaderContextMenu(e, args) {
      e.preventDefault();
      $menu.empty();
      columnCheckboxes = [];

      var $li, $input;
      for (var i = 0; i < columns.length; i++) {
        $li = $('<li />').appendTo($menu);
        $input = $('<input type="checkbox" />').data('column-id', columns[i].id).attr('id','slick-column-vis-'+columns[i].id);
        columnCheckboxes.push($input);

        if (grid.getColumnIndex(columns[i].id) != null) {
          $input.attr('checked', 'checked');
        }
        $input.appendTo($li);
        $('<label />')
            .text(columns[i].name)
            .attr('for','slick-column-vis-'+columns[i].id)
            .appendTo($li);
      }
      $('<li/>').addClass('divider').appendTo($menu);
      $li = $('<li />').data('option', 'autoresize').appendTo($menu);
      $input = $('<input type="checkbox" />').data('option', 'autoresize').attr('id','slick-option-autoresize');
      $input.appendTo($li);
      $('<label />')
          .text('Force fit columns')
          .attr('for','slick-option-autoresize')
          .appendTo($li);
      if (grid.getOptions().forceFitColumns) {
        $input.attr('checked', 'checked');
      }

      $menu.css('top', e.pageY - 10)
          .css('left', e.pageX - 10)
          .fadeIn(options.fadeSpeed);
    }

    function updateColumn(e) {
      if ($(e.target).data('option') == 'autoresize') {
        var checked;
        if ($(e.target).is('li')){
            var checkbox = $(e.target).find('input').first();
            checked = !checkbox.is(':checked');
            checkbox.attr('checked',checked);
        } else {
          checked = e.target.checked;
        }

        if (checked) {
          grid.setOptions({forceFitColumns:true});
          grid.autosizeColumns();
        } else {
          grid.setOptions({forceFitColumns:false});
        }
        options.state.set({fitColumns:checked});
        return;
      }

      if (($(e.target).is('li') && !$(e.target).hasClass('divider')) ||
            $(e.target).is('input')) {
        if ($(e.target).is('li')){
            var checkbox = $(e.target).find('input').first();
            checkbox.attr('checked',!checkbox.is(':checked'));
        }
        var visibleColumns = [];
        var hiddenColumnsIds = [];
        $.each(columnCheckboxes, function (i, e) {
          if ($(this).is(':checked')) {
            visibleColumns.push(columns[i]);
          } else {
            hiddenColumnsIds.push(columns[i].id);
          }
        });


        if (!visibleColumns.length) {
          $(e.target).attr('checked', 'checked');
          return;
        }

        grid.setColumns(visibleColumns);
        options.state.set({hiddenColumns:hiddenColumnsIds});
      }
    }
    init();
  }

  // Slick.Controls.ColumnPicker
  $.extend(true, window, { Slick:{ Controls:{ ColumnPicker:SlickColumnPicker }}});
})(jQuery);
