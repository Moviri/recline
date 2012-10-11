this.recline = this.recline || {};
this.recline.Data = this.recline.Data || {};

(function(my) {
// adapted from https://github.com/harthur/costco. heather rules

my.Filters = {};

    // in place filtering
    my.Filters.applyFiltersOnData = function(filters, records, fields) {
        // filter records
        return _.filter(records, function (record) {
            var passes = _.map(filters, function (filter) {
            	return recline.Data.Filters._isNullFilter[filter.type](filter) || recline.Data.Filters._filterFunctions[filter.type](record, filter, fields);
            });

            // return only these records that pass all filters
            return _.all(passes, _.identity);
        });
    };

    // data should be {records:[model], fields:[model]}
    my.Filters.applySelectionsOnData = function(selections, records, fields) {
        _.each(records, function(currentRecord) {
            currentRecord.setRecordSelection(false);

            _.each(selections, function(sel) {
                if(!recline.Data.Filters._isNullFilter[sel.type](sel) &&
                	recline.Data.Filters._filterFunctions[sel.type](currentRecord.attributes, sel, fields)) {
                    currentRecord.setRecordSelection(true);
                }
            });
        });


    },

    my.Filters._getDataParser =  function(filter, fields) {

        var keyedFields = {};
        var tmpFields;
        if(fields.models)
            tmpFields = fields.models;
        else
            tmpFields = fields;

        _.each(tmpFields, function(field) {
            keyedFields[field.id] = field;
        });


        var field = keyedFields[filter.field];
        var fieldType = 'string';

        if(field == null) {
            console.log("Warning could not find field " + filter.field + " for dataset " );
            console.log(fields);
        }
        else {
            if(field.attributes)
                fieldType = field.attributes.type;
            else
                fieldType = field.type;
        }
        return recline.Data.Filters._dataParsers[fieldType];
    },
    
    my.Filters._isNullFilter = {
    	term: function(filter){
    		return !filter["term"];
    	},
    	
    	range: function(filter){
    		return !(filter["start"] && filter["stop"]);
    		
    	},
    	
    	list: function(filter){
    		return !filter["list"];
    		
    	}
    },

    my.Filters._filterFunctions = {
        term: function(record, filter, fields) {
			var parse = recline.Data.Filters._getDataParser(filter, fields);
            var value = parse(record[filter.field]);
            var term  = parse(filter.term);

            return (value === term);
        },

        range: function (record, filter, fields) {

            var parse =  recline.Data.Filters._getDataParser(filter, fields);
            var value = parse(record[filter.field]);
            var start = parse(filter.start);
            var stop  = parse(filter.stop);

            return (value >= start && value <= stop);
        },

        list: function (record, filter, fields) {

            var parse =  recline.Data.Filters._getDataParser(filter, fields);
            var value = parse(record[filter.field]);
            var list  = filter.list;
            _.each(list, function(data, index) {
                list[index] = parse(data);
            });

            return (_.contains(list, value));
        }


    },

    my.Filters._dataParsers = {
            integer: function (e) { return parseFloat(e, 10); },
            'float': function (e) { return parseFloat(e, 10); },
            string : function (e) { return e.toString() },
            date   : function (e) { return new Date(e).valueOf() },
            datetime   : function (e) { return new Date(e).valueOf() }
        };
}(this.recline.Data))
