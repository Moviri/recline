recline.Model.Dataset.prototype = $.extend(recline.Model.Dataset.prototype, {
    selection:function (queryObj) {
        var self = this;

        this.trigger('selection:start');

        if (queryObj) {
            self.queryState.set(queryObj, {silent:true});
        }
        var actualQuery = self.queryState

        recline.Data.Filters.applySelectionsOnData(self.queryState.get('selections'), self.records.models, self.fields);

        self.queryState.trigger('selection:done');

    },
    initialize: function () {
        var super_init = recline.Model.Dataset.prototype.initialize;
        return function(){
            super_init.call(this);
            _.bindAll(this, 'selection');

            this.queryState.bind('selection:change', this.selection);
        };
    }()

});






recline.Model.Record.prototype = $.extend(recline.Model.Record.prototype, {
    isRecordSelected:function () {
        var self = this;
        return self["is_selected"];
    },
    setRecordSelection:function (sel) {
        var self = this;
        self["is_selected"] = sel;
    }
});


recline.Model.Query.prototype = $.extend(recline.Model.Query.prototype, {


// ### addSelection
//
// Add a new selection (appended to the list of selections)
//
// @param selection an object specifying the filter - see _filterTemplates for examples. If only type is provided will generate a filter by cloning _filterTemplates
    addSelection:function (selection) {
        // crude deep copy
        var myselection = JSON.parse(JSON.stringify(selection));
        // not full specified so use template and over-write
        // 3 as for 'type', 'field' and 'fieldType'
        if (_.keys(selection).length <= 3) {
            myselection = _.extend(this._selectionTemplates[selection.type], myselection);
        }
        var selections = this.get('selections');
        selections.push(myselection);
        this.trigger('change:selections');
    },
// ### removeSelection
//
// Remove a selection at index selectionIndex
    removeSelection:function (selectionIndex) {
        var selections = this.get('selections');
        selections.splice(selectionIndex, 1);
        this.set({selections:selections});
        this.trigger('change:selections');
    },
    removeSelectionByField:function (field) {
        var selections = this.get('selections');
        for (var j in filters) {
            if (selections[j].field == field) {
                removeSelection(j);
            }
        }
    },
    setSelection:function (filter) {
        if (filter["remove"]) {
            removeSelectionByField(filter.field);
        } else {
         var s = this.get('selections');
            var found = false;
            for (var j = 0; j < s.length; j++) {
                if (s[j].field == filter.field) {
                    s[j] = filter;
                    found = true;
                }
            }
            if (!found)
                s.push(filter);
        }
    },

    isSelected:function () {
        return this.get('selections').length > 0;
    }

});
