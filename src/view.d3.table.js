(function ($, view) {
	
	var rowClick = function(actions){
		
		var activeRecords = [];
		
		return function(row){
			if(actions.length && row){
				//console.log("rowClick");			
				var ctrlKey = d3.event.ctrlKey;
				var adding = !d3.select(d3.event.target.parentNode).classed("info");
				
				if(adding){
					d3.select(d3.event.target.parentNode.parentNode).selectAll(".g-tr.info").classed("info",ctrlKey);				
					d3.select(d3.event.target.parentNode).classed('info',true);			
				}else{			
					d3.select(d3.event.target.parentNode.parentNode).selectAll(".g-tr.info").classed("info",ctrlKey);
					d3.select(d3.event.target.parentNode).classed('info',false);		
				}
				
				if(adding){
					if(ctrlKey){
						activeRecords.push(row);
					}else{
						activeRecords = [row];
					}
				}else{
					if(ctrlKey){
						activeRecords = _.difference(activeRecords, [row]);
					}else{
						activeRecords = [];
					}
				}

				actions.forEach(function(action){
					
					var params = [];
					action.mapping.forEach(function(mapp){
						var values=[];
						//{srcField: "daydate", filter: "filter_daydate"}
						activeRecords.forEach(function(row){
							values.push(row[mapp.srcField]);
						});
						params.push({filter:mapp.filter, value:values});
					});
										
					action.action._internalDoAction(params, "add");
				});				
				
			}		
		};
	};
	
	var rowOver = function(actions){
		return function(row){
			if(actions.length && row){
					
			}
		};		
	};
	
	var scrollBarWidth = function(){
		  document.body.style.overflow = 'hidden'; 
		  var width = document.body.clientWidth;
		  document.body.style.overflow = 'scroll'; 
		  width -= document.body.clientWidth; 
		  if(!width) width = document.body.offsetWidth - document.body.clientWidth;
		  document.body.style.overflow = ''; 
		  return width; 
	};

		
	var fetchRecordValue = frv = function(record, dimension){
		var val = null;		
		dimension.fields.forEach(function(field, i){
			if(i==0) val = record.getFieldValue(field);
			else val+= record.getFieldValue(field);
		});
		return val;
	};

	function sort(rowHeight, tableId) {
	    return function (dimension) {
	        var dimensionName = dimension.fields[0].id,
	            descending = d3.select(this)
	                .classed("g-ascending");

	        d3.selectAll(".g-descending")
	            .classed("g-descending", false);
	        d3.selectAll(".g-ascending")
	            .classed("g-ascending", false);

	        if (!descending) {
	            d3.select(this)
	                .classed("g-ascending", true);
	            var orderQuantitative = function (a, b) {
	                return (isNaN(frv(a, dimension)) - isNaN(frv(b, dimension))) || (frv(a, dimension) - frv(b, dimension)) || (a.index - b.index);
	            };

	            var orderName = function (a, b) {
	                return b.name.localeCompare(a.name);
	            };
	        } else {
	            d3.select(this)
	                .classed("g-descending", true);

	            var orderQuantitative = function (a, b) {
	                return (isNaN(frv(b, dimension)) - isNaN(frv(a, dimension))) || (frv(b, dimension) - frv(a, dimension)) || (b.index - a.index);
	            };

	            var orderName = function (a, b) {
	                return a.name.localeCompare(b.name);
	            };
	        }

	        d3.selectAll("#"+tableId+" .g-tbody .g-tr")
	            .sort(dimensionName === "name" ? orderName : orderQuantitative)
	            .each(function (record, i) {
	            record.index = i;
	        })
	            .transition()
	            .delay(function (record, i) {
	            return (i - 1) * 10;
	        })
	            .duration(750)
	            .attr("transform", function (record, i) {
	            return "translate(0," + i * rowHeight + ")";
	        });
	    }
	}
	
	view.d3 = view.d3 || {};

    view.d3.table = Backbone.View.extend({
        className: 'recline-table-editor well',
        template: ' \
  				<div id="{{graphId}}" class="g-table g-table-hover g-table-striped"> \
  					<h2 class="g-title">{{title}}</h2> \
  					<p class="lead">{{instructions}}</p> \
  					<small>{{summary}}</small> \
  				\
  				<div> \
  				\
  			',
        templateHeader: ' \
        			<div class="g-thead"> \
  						<div class="g-tr"> \
  							{{#columns}} \
  							<div class="g-th {{#sortable}}g-sortable{{/sortable}}" style="width: {{hwidth}}"><div>{{label}}</div></div> \
  							{{/columns}} \
  						</div> \
  					</div> \
  					\
  					',
        templateBody: ' \
  					<div class="g-tbody-container" style="width:{{scrollWidth}}px; height:{{height}}px;"> \
  						<div style="width:{{width}}px;"> \
  							<svg class="g-tbody"> \
							</svg> \
						</div> \
					</div> \
					\
  					',
        templateFooter: '\
  					<div class="g-tfoot-container"> \
						<svg class="g-tfoot"> \
						</svg> \
					</div> \
					\
					',
        events: {
            'click .g-thead': 'onEvent'
        },
        initialize: function (options) {
            
            _.defaults(options.conf,{"row_height": 20, "height":200});
            options.actions = options.actions || [];
            this.el = $(this.el);
    		_.bindAll(this, 'render', 'redraw', 'refresh');
                     
            this.rowHeight = options.conf.row_height;
            
            var clickActions=[], hoverActions=[];
            //processing actions
            {
            	options.actions.forEach(function(action){
            		action.event.forEach(function(event){
            			if(event==='click') clickActions.push(action);
            			else if(event==='hover')  hoverActions(action);
            		});
            	});
            }           
            
            this.clickActions = clickActions;
            this.hoverActions = hoverActions; 
                        
            this.model.bind('change', this.render);
            this.model.fields.bind('reset', this.render);
            this.model.fields.bind('add', this.render);
            this.model.records.bind('add', this.redraw);
            this.model.records.bind('reset', this.redraw);
			this.model.queryState.bind('change:selections', this.refresh);

			//create a nuew columns array with default values 
            this.columns = _.map(options.columns, function (column) {
                return _.defaults(column, {
                    label: "",
                    type: "text",
                    sortable: false,
                    fields: {}
                });
            });
            
            //render table  				
            this.columns.forEach(function (column, i) {
            	column.width = column.width || 160;
                column.hwidth = column.width;
            }, this);
            
            this.height = options.conf.height;
            this.title = options.title;
            this.summary = options.summary;
            this.instructions = options.instructions;
            this.graphId = options.conf.id || 'd3table_'+Math.floor(Math.random()*1000);

            //render header & svg container
            var out = Mustache.render(this.template, this);
            this.el.html(out);
            this.el.find('#'+this.graphId).append(Mustache.render(this.templateHeader, this));
            
            this.width = options.conf.width;
            //this.render(); 								
        },
        refresh: function() {
			//console.log('d3Table.refresh');

        },
        reset: function () {
            //console.log('d3Table.reset');
        },
        render: function () {
            //console.log('d3Table.render');
                        
            var thead = this.el.find('.g-thead');
            
            this.width = this.width || d3.sum(this.columns, function(column, i){
            	var th = thead.find('.g-th:nth-child('+(i+1)+')');
            	column.padding_left = parseInt(th.css("padding-left").replace("px", ""));
                column.padding_right = parseInt(th.css("padding-right").replace("px", ""));
                column.computed_width = th.outerWidth(true);    
                    	
            	return column.computed_width;
            });
            
            this.scrollWidth = scrollBarWidth()+this.width;
            
            this.el.find('#'+this.graphId).append(Mustache.render(this.templateBody, this)).append(Mustache.render(this.templateFooter, this));
            
            this.model.records.forEach(function (record, i) {
                record.index = i;
            });            

            //render table  				
            this.columns.forEach(function (column, i) {
                column.fields = recline.Data.Aggregations.intersectionObjects('id', column.fields, this.model.fields.models);
                column.index = i;
            }, this);         
        },
        redraw: function () {        
            var rowHeight = this.rowHeight;
            var columns = this.columns;
            var records = this.model.records.models;
			var charts = {};
			var chartsField = {};			
            
            d3.select('#'+this.graphId+' .g-tbody-container div').style('height',(rowHeight)*records.length+'px');            
            d3.select('#'+this.graphId+' .g-tbody-container').classed('g-tbody-container-overflow',(rowHeight)*records.length>this.height);
            			
			columns.forEach(function (dimension) {
                if (dimension.scale) {
                	var scale = dimension.scale(records, dimension.computed_width, (dimension.range || 1.0));
                    dimension.scale = scale.scale;
                    dimension.axisScale = scale.axisScale;
                    dimension.fields.forEach(function (field, i) {
                        field.scale = dimension.scale;
                        field.axisScale = dimension.axisScale[field.id];
                        field.width = dimension.width;
                        field.computed_width = dimension.computed_width;
                    });
                }
            });

            var row = d3.select('#'+this.graphId+' .g-tbody')
                .selectAll(".g-tr")
                .data(records)
                .enter()
                .append("g")
                .attr("class", "g-tr")
                .attr("transform", function (record, i) {
                return "translate(0," + i * (rowHeight) + ")";
            });

            row.append("rect")
                .attr("class", "g-background")
                .attr("width", "100%")
                .attr("height", rowHeight).on('click', rowClick(this.clickActions)).on('mouseover', rowOver(this.hoverActions));
                

            row.each(function (record) {
				var translationAcc = 0;
				var translationRectAcc = 0;
								
                var cell = d3.select(this)
                    .selectAll(".g-td")
                    .data(columns)
                    .enter()
                    .append("g")
                    .attr("class", "g-td")
                    .classed("g-quantitative", function (dimension) {
                    	return dimension.scale;
                	}).classed("g-categorical", function (dimension) {
                    	return dimension.categorical;
                	}).attr("transform", function (dimension, i) {
                		var transl = translationAcc;
                		translationAcc += dimension.computed_width;
                		dimension.translation = transl;
                    	return "translate(" + (transl+dimension.padding_left) + ")";
                	});
                	
                //horizontal lines
               	d3.select(this).append('line').attr('class', 'g-row-border').attr('y1',rowHeight).attr('y2',rowHeight).attr('x2','100%');
               
                var barChartCell = cell.filter(function (dimension) {           	
                    return dimension.scale && dimension.type === 'barchart';
                });

                barChartCell.selectAll(".g-bar")
                  .data(function (dimension) {
                    	return dimension.fields;
               	  })
                  .enter()
                  .append("rect")
                    .attr("class", "g-bar")
                    .attr("width", function (field, index) {
                    	return field.scale(record.getFieldValue(field));
               		})
                    .attr("height", rowHeight-1)
                    .attr("transform", function (field, i) {
                    	
                    	charts[field.id]=this;
                    	chartsField[field.id]=field;
                    	
	                    var translation = Math.ceil((i === 0) ? ((field.computed_width) / 2) - field.scale(record.getFieldValue(field)) : i * (field.computed_width) / 2);
	
	                    if (i == 0) {
	                        return "translate(" + translation + ")";
	                    } else {
	                        return "translate(" + translation + ")";
	                    }
                	})
                    .style("fill", function (field, index) {
                    	return field.color;
                	});


                cell.filter(function (dimension) {           	
                    return !dimension.scale;
                }).append("text")
                    .attr("class", "g-value")
                    .attr("x", function (dimension) {
                    return dimension.scale ? 3 : 0;
                })
                    .attr("y", function (dimension) {
                    return dimension.categorical ? 9 : 10;
                })
                    .attr("dy", ".35em")
                    .classed("g-na", function (dimension) {
                    return record.getFieldValue({id:dimension.name}) === undefined;
                })
                    .text(function (dimension) {
                    return frv(record, dimension);
                })
                    .attr("clip-path", function (dimension) {
                    return (dimension.clipped = this.getComputedTextLength() > ((dimension.computed_width))-20) ? "url(#g-clip-cell)" : null;
                });

                cell.filter(function (dimension) {
                    return dimension.clipped;
                }).append("rect")
                    .style("fill", "url(#g-clip-gradient)")
                    .attr("x", function (dimension) {
                    	return dimension.hwidth;
                	})
                    .attr("width", 20)
                    .attr("height", rowHeight);
            });
            
            //axis management
            {
				var axisRow = d3.select('#'+this.graphId+' .g-tfoot').append("g")
	                .attr("class", "g-tfoot-row");
	            
	            var cell = axisRow.selectAll('.g-td').data(columns).enter().append('g')
	                    .attr("class", "g-td")
	                    .attr("width", function (dimension, i) {
	                    	return (dimension.computed_width);
	                	})
	                	.attr("transform", function (dimension, i) {
	                    	return "translate(" + (dimension.translation+dimension.padding_left)+ ")";
                		});
	            
	            var barChartCell = cell.filter(function (dimension) {
                    return dimension.scale && dimension.type === 'barchart';
                });
                
                var dimensionWidth;
                var fieldNum;
                var range;
                barChartCell.selectAll(".g-axis").data(function (dimension) {
                		fieldNum = dimension.fields.length;
                		range = dimension.range;
                    	return dimension.fields;
               	  })
               	  .enter()
               	  .append('g')
               	  .attr('class', function(field,i){
               	  	return 'g-axis';
               	  })
               	  .attr("transform", function (field, i) {
               	  			var trans = 0;
               	  			var w = field.computed_width/fieldNum;
               	  			            	  			
               	  			if(i==0) trans = w - w*range;
               	  			else trans = i * w;
               	  			
               	  			return "translate(" + trans + ")";
                		})
               	  .each(function(field, i){
               	  		d3.select(this).call(d3.svg.axis().scale(field.axisScale).ticks(3).orient("bottom"));
               	  	});           		
            }

			//add sorting
            d3.selectAll('#'+this.graphId+' .g-thead .g-th.g-sortable')
                .data(columns)
                .on("click", sort(rowHeight, this.graphId));    
                
            //vertical lines
            {
            	d3.select('#'+this.graphId+' .g-tbody').selectAll(".g-column-border").data(columns)
            	.enter().append("line").attr("class", "g-column-border").attr("transform", function(dimension) {
					return "translate(" + (dimension.translation) + ",0)";
				}).attr("y2", "100%");
            }            

			//axis lines
			{
				d3.select('#'+this.graphId+' .g-tbody').selectAll(".g-compare").data(columns.filter(function(dimension) {
					return dimension.scale;
				})).enter().append("line").attr("class", "g-compare").attr("transform", function(dimension) {
					return "translate(" + (dimension.translation+dimension.padding_left + dimension.computed_width/2) + ",0)";
				}).attr("y2", "100%"); 
			}

        },
        onEvent: function (e) {}
    });
})(jQuery, recline.View);