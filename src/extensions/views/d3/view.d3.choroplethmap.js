/*jshint multistr:true */

this.recline = this.recline || {};
this.recline.View = this.recline.View || {};

(function ($, my) {


    my.D3ChoroplethMap = Backbone.View.extend({
    	rendered: false,
        initialize:function (options) {
            var self = this;

            _.bindAll(this, 'render', 'redraw', 'getRecordByValue', 'getActionsForEvent');

            this.model.bind('change', self.render);
            this.model.fields.bind('reset', self.render);
            this.model.fields.bind('add', self.render);

            this.model.bind('query:done', this.redraw);
            this.model.queryState.bind('selection:done', this.redraw);

            this.uid = "" + new Date().getTime() + Math.floor(Math.random() * 10000); // generating an unique id for the map
            this.el = options.el;

            this.mapWidth = options.state.width // optional. May be undefined
            this.mapHeight = options.state.height // optional. May be undefined

            this.unselectedColor = "#C0C0C0";
            if (this.options.state.unselectedColor)
                this.unselectedColor = this.options.state.unselectedColor;

            this.svg = d3v3.select(this.el).append("svg")

            if (this.mapWidth == null || typeof this.mapWidth == "undefined")
            	this.mapWidth = $(this.el).width()
            	
            if (this.mapHeight == null || typeof this.mapHeight == "undefined")
            	this.mapHeight = $(this.el).height()

           	this.svg.attr("width", this.mapWidth)
            this.svg.attr("height", this.mapHeight)
        },

        render:function () {
            var self = this;

            var mapJson = this.options.state["mapJson"];
            var layer = this.options.state["layer"];
            var showRegionNames = this.options.state["showRegionNames"]
            var showCities = this.options.state["showCities"]
            var randomColors = this.options.state["randomColors"]
            
            var rotation = self.options.state["rotation"]
            if (rotation == null || rotation == "undefined")
            	rotation = [0,0]
            
            var clickFunction = function() {
        		$(self.el+" svg path.region").each( function() {
        			$(this).attr("class", $(this).attr("class").replace(" selected", ""))
        		});
        		$(this).attr("class", $(this).attr("class")+" selected")
        		
        		d3v3.event.preventDefault();
        	}
            var hoverFunction = function() {/*console.log("HOVERING "+this.attributes.regionName.nodeValue)*/}
            
            // find all fields of this layer
            //  mapping: [{srcShapeField: "state", srcValueField: "value", destAttribute: "name", destLayer: "usa"}],
            var fields = _.filter(this.options.state["mapping"], function(m) {
                return m.destLayer == layer;
            });

            if(fields.length > 1)
                throw "view.D3.ChoroplethMap.js: more than one field associated with layer, impossible to link with actions"

            if(fields.length == 1)
        	{
                // find all actions for selection and hover
                var clickEvents = self.getActionsForEvent("selection");
                var hoverEvents = self.getActionsForEvent("hover");

                // filter actions that doesn't contain fields
                var clickActions = _.filter(clickEvents, function(d) {
                    return d.mapping.srcField == fields.srcShapeField;
                });
                var hoverActions = _.filter(hoverEvents, function(d) {
                    return d.mapping.srcField == fields.srcShapeField;
                });
                if (clickActions.length)
            	{
                	clickFunction = function() {
    					var region = this.attributes.regionName.nodeValue
    					var mappings = self.options.state.mapping
    					mappings.forEach(function(m) {
        		            var selectedRecord = self.getRecordByValue(m.srcShapeField, region);
    		            	clickActions.forEach(function (currAction) {
    		                    currAction.action.doAction([selectedRecord], currAction.mapping);
    		                });
    					})
            		}
            	}
                if (hoverActions.length)
            	{
                    hoverFunction = function() {
    					var region = this.attributes.regionName.nodeValue
    					var mappings = self.options.state.mapping
    					mappings.forEach(function(m) {
        		            var selectedRecord = self.getRecordByValue(m.srcShapeField, region);
        		            hoverActions.forEach(function (currAction) {
    		                    currAction.action.doAction([selectedRecord], currAction.mapping);
    		                });
    					})
            		}
            	}
        	}
            
	        d3v3.json(mapJson, function(error, map) {
	        	self.mapObj = map
	        	self.regionNames = _.pluck(self.mapObj.objects[layer].geometries, 'id')   // build list of names for later use
	        	
	        	var regions = topojson.object(map, map.objects[layer]);
	
	        	var projection = d3v3.geo.mercator()
	        		.center(self.options.state["center"])
	        		.rotate(rotation)
	        		.scale(self.options.state["scale"])
	        		.translate([self.mapWidth / 2, self.mapHeight / 2]);
	        	
	        	var path = d3v3.geo.path().projection(projection);
	        	
	        	var assignColors = function() {
	        		return self.unselectedColor;
	        	}
	        	if (randomColors)
	        		assignColors = function() {
		        		var c = Math.floor(Math.random()*4+6)
		        		var h = Math.floor(Math.random()*2)*8
		        		return "#"+c+h+c+h+c+h; 
	        	}
	        	// draw regions
	        	self.svg.selectAll(".region")
		            .data(regions.geometries)
		        	.enter().append("path")
		        	.on("click", clickFunction)
		        	.on("mouseover", hoverFunction)
		            .attr("class", function(d) { return "region " + toAscii(d.id); })
		            .attr("regionName", function(d) { return d.id; })
		        	.attr("fill", assignColors)
		            .attr("d", path)
	
	        	// draw region names
	            if (showRegionNames)
            	{
	            	var minArea = self.options.state["minRegionArea"] || 6 
	            	var onlyBigRegions = {
	            							geometries: _.filter(map.objects[layer].geometries, function(r) { return r.properties.Shape_Area > minArea}),
	            							type: "GeometryCollection"
	            						}
		        	self.svg.selectAll(".region-label")
			            .data(topojson.object(map, onlyBigRegions).geometries)
			            .enter().append("text")
			            .attr("class", function(d) { return "region-label " + toAscii(d.id); })
			            .attr("transform", function(d) { return "translate(" + path.centroid(d) + ")"; })
			            .attr("regionName", function(d) { return d.id; })
			            .attr("dy", ".35em")
			        	.on("click", clickFunction)
			        	.on("mouseover", hoverFunction)
			            .text(function(d) { return d.id; });
            	}
	        	
	        	if (map.objects.cities && showCities)
	        	{
	        		// draw circles for cities
	        		self.svg.append("path")
		        	    .datum(topojson.object(map, map.objects.cities))
		        	    .attr("d", path)
		        	    .attr("class", "place");
	        		
	        		// draw city names
	        		self.svg.selectAll(".place-label")
		        	    .data(topojson.object(map, map.objects.cities).geometries)
		        		.enter().append("text")
		        	    .attr("class", "place-label")
		        	    .attr("transform", function(d) { return "translate(" + projection(d.coordinates) + ")"; })
		        	    .attr("dy", ".35em")
		        	    .attr("dx", ".8em")
		        	    .text(function(d) { return d.properties.name; });
	        	}
	        	if (randomColors == null || typeof randomColors == "undefined")
	        		self.redraw(); // apply color schema colors if present
	        });
	        this.rendered = true;
            return this;
        },

        redraw:function () {
        	console.log("redraw called")
            var self = this;
        	
            var resultType = "filtered";
            if (self.options.useFilteredData !== null && self.options.useFilteredData === false)
                resultType = "original";

            var records = self.model.getRecords(resultType);  //self.model.records.models;
            console.log("Tot records in model: "+records.length)
            
            if(!self.rendered || !self.mapObj)
                return;
            
            var layer = this.options.state["layer"];
            var mapping = this.options.state["mapping"];

            _.each(mapping, function (currentMapping) {
                var filteredResults = self._getDataFor(
                    self.regionNames,
                    currentMapping["srcShapeField"],
                    currentMapping["srcValueField"]);

	            self.svg.selectAll("path.region")
					.attr("fill", function () {
						var region = this.attributes.regionName.nodeValue 
						//console.log(region)
                        var res = filteredResults[region];

                        // check if current shape is present into results
                           if(res != null)
                                return res.color;
                            else
                                return self.unselectedColor;
                    });
            });


        },


        // todo this is not efficient, a list of data should be built before and used as a filter
        // to avoid arrayscan
        _getDataFor:function (paths, srcShapeField, srcValueField) {
            var self=this;
            var resultType = "filtered";
            if (self.options.useFilteredData !== null && self.options.useFilteredData === false)
                resultType = "original";

            var records = self.model.getRecords(resultType);  //self.model.records.models;
            var srcShapef = self.model.fields.get(srcShapeField);
            var srcValuef = self.model.fields.get(srcValueField);

            var selectionActive = false;
            if (self.model.queryState.isSelected())
                selectionActive = true;

            var res = {};
            if (srcShapef && srcValuef)
        	{
	            _.each(records, function (d) {
	
	                if(_.contains(paths, d.getFieldValueUnrendered(srcShapef))) {
	                    var color = self.unselectedColor;
	                    if(selectionActive) {
	                        if(d.isRecordSelected())
	                            color = d.getFieldColor(srcValuef);
	                    } else {
	                            color = d.getFieldColor(srcValuef);
	                    }
	
	
	                    res[d.getFieldValueUnrendered(srcShapef)] =  {record: d, field: srcValuef, color: color, value:d.getFieldValueUnrendered(srcValuef) };
	
	                }
	            });
        	}
            //else throw "Invalid model for map! Missing "+srcShapeField+" and/or "+srcValueField
            return res;
        },
        getRecordByValue:function (srcShapeField, value) {
            var self=this;
            var resultType = "filtered";
            if (self.options.useFilteredData !== null && self.options.useFilteredData === false)
                resultType = "original";

            var records = self.model.getRecords(resultType);  //self.model.records.models;
            var srcShapef = self.model.fields.get(srcShapeField);

            return _.find(records, function(d) { return d.getFieldValueUnrendered(srcShapef) == value; });
        },        

        getActionsForEvent:function (eventType) {
            var self = this;
            var actions = [];

            _.each(self.options.actions, function (d) {
                if (_.contains(d.event, eventType))
                    actions.push(d);
            });

            return actions;
        }


    });


})(jQuery, recline.View);

