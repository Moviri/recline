/*jshint multistr:true */
this.recline = this.recline || {};
this.recline.View = this.recline.View || {};

(function ($, my) {

    my.MultiButtonDropdownFilter = Backbone.View.extend({
        template: '<div class="btn-toolbar"> \
        				<div class="btn-group data-control-id"> \
        				{{#buttonsData}} \
        					{{{buttonRender}}} \
        				{{/buttonsData}} \
        			</div> \
        		</div>',
        buttonTemplate: '<button class="btn btn-mini grouped-button {{selected}}" val="{{value}}">{{value}}</button>',
        dropdownTemplate: '<select id="dropdown{{uid}}_{{numId}}" multiple="multiple"> \
        					{{#options}} \
        						<option value="{{fullValue}}" {{#selected}}selected="selected"{{/selected}}>{{value}}</option> \
        					{{/options}} \
        					</select>',
        events:{
            'click .grouped-button':'onButtonsetClicked',
        },
        _sourceDataset:null,
        _selectedClassName:"btn-primary", // use bootstrap ready-for-use classes to highlight list item selection (avail classes are success, warning, info & error)
        hasValueChanges: false,
        initialize:function (args) {
            this.el = $(this.el);
            _.bindAll(this, 'render', 'update', 'onButtonsetClicked', 'getDropdownSelections', 'getRecordByValue', 'handleChangedSelections');

            this._sourceDataset = args.sourceDataset;
            this.uid = args.id || Math.floor(Math.random() * 100000); // unique id of the view containing all filters
            this.numId = 0; // auto-increasing id used for a single filter

            this.sourceField = args.sourceField;
            this._actions = args.actions;

            if (this._sourceDataset) {
                this._sourceDataset.bind('query:done', this.render);
                this._sourceDataset.queryState.bind('selection:done', this.update);
            }
            this.multiSelects = []
        },
        render:function () {
            var self = this;
            this.el.html("")
            console.log("Render "+this._sourceDataset.id+" ["+this._sourceDataset.getRecords().length+"]")
            
            var tmplData = {}
            //  Retain user selections
            if (self._sourceDataset) {
                _.each(self._sourceDataset.queryState.get('selections'), function (filter) {
            		if (self.sourceField.field = filter.field)
            		{
            			self.sourceField.list = filter.list
            			self.sourceField.term = filter.term
                    }
                });
            }
        
            self.buttonsData = {};
        	_.each(self._sourceDataset.getRecords(), function(record) {
                var field = self._sourceDataset.fields.get(self.sourceField.field);
                if(!field) {
                    throw "widget.genericfilter: unable to find field ["+self.sourceField.field+"] in dataset";
                }

                var fullLevelValue = record.getFieldValue(field);
                if (fullLevelValue.indexOf(self.sourceField.separator) > 0)
            	{
                	var levelValues = fullLevelValue.split(self.sourceField.separator, 2);
                	if (self.buttonsData[levelValues[0]] && self.buttonsData[levelValues[0]].options)
                		self.buttonsData[levelValues[0]].options.push({fullValue: fullLevelValue, value: levelValues[1], record: record, selected: _.contains(self.sourceField.list, fullLevelValue)})
                	else
                		self.buttonsData[levelValues[0]] = { self: self, options: [{fullValue: fullLevelValue, value: levelValues[1], record: record, selected: _.contains(self.sourceField.list, fullLevelValue)}]}
            	}
                else
            	{
                	self.buttonsData[fullLevelValue] = { value: fullLevelValue, record: record, selected: _.contains(self.sourceField.list, fullLevelValue), self: self }
            	}
        	});
            
            tmplData.buttonsData = _.map(self.buttonsData, function(obj, key){ return obj; }); // transform to array
            // ensure buttons with multiple options are moved to the end of the control toolbar to safeguard look & feel  
            tmplData.buttonsData = _.sortBy(tmplData.buttonsData, function(obj){ if (obj.options) return 1; else return -1; }); 
            tmplData.buttonRender = self.buttonRender;

            var out = Mustache.render(this.template, tmplData);
            this.el.html(out);
            
			var buttonText = function(options) {
				var $select = $(options.context);
				var totOptions = $select.find("option").length
                if (options.length == 0 || options.length == totOptions) 
                    return this.mainValue+' <b class="caret"></b>';
                else {
                    var selected = '';
                    options.each(function() {
                        selected += $(this).text() + ', ';
                    });
                    return this.mainValue+' <span style="opacity:0.5">'+selected.substr(0, selected.length -2) + '</span> <b class="caret"></b>';
                }
            }
			
			var onChange = function(element, checked){
				self.hasValueChanges =  true
        		var multiselect = element.parent();
        		var multiselectContainer = multiselect.data('multiselect').container;
				var totSelectedObjs = element.parent().find("[selected='selected']")
				if (totSelectedObjs.length)
					$('button', multiselectContainer).addClass(self._selectedClassName);
				else $('button', multiselectContainer).addClass(self._selectedClassName);
				
				if (self.dropdownTimeout)
				{
					clearTimeout(self.dropdownTimeout)
					delete self.dropdownTimeout
				}
				// will force a doAction that forces a redraw that closes the dropdown menu after 2 secs
				self.dropdownTimeout = setTimeout(function(){ self.handleChangedSelections() }, 2000);  
			}
			
			var menuHidden = function(e) {
				if (self.dropdownTimeout)
				{
					clearTimeout(self.dropdownTimeout)
					delete self.dropdownTimeout
				}
        		if (self.hasValueChanges)
        			self.handleChangedSelections();
			}
			var lastKey;
			for (var key in self.buttonsData) {
				if (self.buttonsData[key].options)
					lastKey = key
			}
			var k = 0;
            var multiSelects = []
            for (var key in self.buttonsData)
        	{
            	if (self.buttonsData[key].options)
        		{
            		var multiselect = $('#dropdown'+this.uid+'_'+k).multiselect({mainValue:key, buttonClass:'btn btn-mini'+(key == lastKey ? ' btn-last' : '')+(self.buttonsData.length == 1 ? : ' btn-first', ''), buttonText:buttonText, onChange: onChange});
            		var multiselectContainer = multiselect.data('multiselect').container;
            		$("button", multiselectContainer).parent().on("dropdown-hide", menuHidden);
    				if (_.find(self.buttonsData[key].options, function(optn) {return optn.selected}))
    					$('button', multiselectContainer).addClass(self._selectedClassName);
            			
            		self.multiSelects.push(multiselect);
                	k++;
        		}
        	}
        },
        buttonRender: function() {
        	var buttonData = this;
        	var self = buttonData.self;
        	var tmplData = {};
        	
        	if (buttonData.options)
    		{
        		tmplData.numId = self.numId;
        		tmplData.uid = self.uid;
    			tmplData.options = buttonData.options;
        		self.numId++;
                return Mustache.render(self.dropdownTemplate, tmplData);
    		}
        	else
    		{
        		tmplData.value = buttonData.value;
        		if (buttonData.selected)
        			tmplData.selected = " "+self._selectedClassName+" "; 
        				
                return Mustache.render(self.buttonTemplate, tmplData);
    		}
        },

        update:function () {
            var self = this;
            if (self.sourceField.userChanged)
        	{
            	self.sourceField.userChanged = false;
            	return;
        	}
            // retrieve selection values
            _.each(self._sourceDataset.queryState.get('selections'), function (filter) {
        		if (self.sourceField.field = filter.field)
        		{
        			self.sourceField.list = filter.list
        			self.sourceField.term = filter.term
                }
            });
            var valueList = this.computeUserChoices(self.sourceField);

            self.el.find('div.btn-toolbar button').each(function () {
            	if (!$(this).hasClass("dropdown-toggle"))
        		{
            		if (!_.contains(valueList, $(this).attr("val")))
	        		{
	            		$(this).removeClass(self._selectedClassName);
	            		valueList = _.without(valueList, $(this).attr("val")) 
	        		}
	            	else 
            		{
	            		$(this).addClass(self._selectedClassName)
	            		valueList = _.without(valueList, $(this).attr("val")) 
            		}
        		}
            });
            
        	_.each(self.multiSelects, function ($select) {
        		_.each($select.find("option"), function(opt) {
        			if (!_.contains(valueList, $(opt).val()))
        				$(opt).removeAttr("selected");
        			else 
    				{
        				$(opt).attr("selected", "selected");
        				valueList = _.without(valueList, $(opt).val())
    				}
        			// update selection of drop-down buttons
            		var multiselectContainer = $select.data('multiselect').container;
            		if ($select.find('option:selected').length)
                		$('button', multiselectContainer).addClass(self._selectedClassName);
            		else $('button', multiselectContainer).removeClass(self._selectedClassName);
        		})
        	});
        },

        computeUserChoices:function (sourceField) {
            var valueList = sourceField.list;
            if ((typeof valueList == "undefined" || valueList == null) && sourceField.term)
                valueList = [sourceField.term];

            return valueList;
        },

        onButtonsetClicked:function (e) {
        	var self = this;
            e.preventDefault();
			if (self.dropdownTimeout)
			{
				clearTimeout(self.dropdownTimeout)
				delete self.dropdownTimeout
			}
            var $target = $(e.currentTarget);
        	$target.toggleClass(self._selectedClassName);
        	this.handleChangedSelections();
        },
        
        handleChangedSelections:function() {
            var self = this;
            var listaValori = [];
            self.el.find('div.btn-toolbar button.' + self._selectedClassName).each(function () {
            	if (!$(this).hasClass("dropdown-toggle"))
            		listaValori.push($(this).attr('val').valueOf()); // in case there's a date, convert it with valueOf
            });
            listaValori = listaValori.concat(self.getDropdownSelections())
            
            var res = [];
            _.each(listaValori, function(valore) {
            	res.push(self.getRecordByValue(valore));
            });

			self.hasValueChanges =  false;
            self.sourceField.userChanged = true;
            self.sourceField.list = listaValori;
            var actions = self.options.actions;
            actions.forEach(function(currAction){
                currAction.action.doAction(res, currAction.mapping);
            });
        },
        getDropdownSelections:function() {
        	var self = this;
        	var listaValori = []
        	_.each(self.multiSelects, function ($select) {
        		_.each($select.find("option[selected='selected']"), function(opt) {
            		listaValori.push($(opt).val());
        		})
        	});
        	return listaValori;
        },
        getRecordByValue:function(val) {
        	var self = this;
        	if (self.buttonsData[val])
        		return self.buttonsData[val].record;
        	else
    		{
            	var levelValues = val.split(self.sourceField.separator, 2);
            	if (self.buttonsData[levelValues[0]])
        		{
            		var correctOpt = _.find(self.buttonsData[levelValues[0]].options, function (opt) { return opt.fullValue == val }); 
            		if (correctOpt)
            			return correctOpt.record; 
        		}
    		}
        	return null;
        }
    });

})(jQuery, recline.View);
