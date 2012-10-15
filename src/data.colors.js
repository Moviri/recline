this.recline = this.recline || {};
this.recline.Data = this.recline.Data || {};

(function(my) {
// adapted from https://github.com/harthur/costco. heather rules

my.Colors = {};

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


}(this.recline.Data))
