recline.Model.Query.prototype = $.extend(recline.Model.Query.prototype, {
    removeFilterByFieldNoEvent:function (field) {
        var filters = this.get('filters');
        for (var j in filters) {
            if (filters[j].field === field) {
                filters.splice(j, 1);
                this.set({filters:filters});
            }
        }
    }

});