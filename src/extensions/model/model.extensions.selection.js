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
    initialize:function () {
        var super_init = recline.Model.Dataset.prototype.initialize;
        return function () {
            super_init.call(this);
            _.bindAll(this, 'selection');

            this.queryState.bind('selection:change', this.selection);
        };
    }(),


    _handleQueryResult:function () {
        var super_init = recline.Model.Dataset.prototype._handleQueryResult;

        return function (queryResult) {
            var self=this;
            if (queryResult.fields && self.fields.length == 0) {

                recline.Data.FieldsUtility.setFieldsAttributes(queryResult.fields, self);
                var options = {renderer:recline.Data.Formatters.Renderers};
                self.fields.reset(queryResult.fields, options);

            }

            recline.Data.Filters.applySelectionsOnData(self.queryState.getSelections(), queryResult.hits, self.fields);

            return super_init.call(this, queryResult);

        };
    }()

})
;


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
    getSelections:function () {
        var sel = this.get('selections');
        if (sel)
            return sel;

        this.set({selections:[]});
        return this.get('selections');

    },

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
        var selections = this.getSelections();
        selections.push(myselection);
        this.trigger('change:selections');
    },


// ### removeSelection
//
// Remove a selection at index selectionIndex
    removeSelection:function (selectionIndex) {
        var selections = this.getSelections();
        selections.splice(selectionIndex, 1);
        this.set({selections:selections});
        this.trigger('change:selections');
    },
    removeSelectionByField:function (field) {
        var selections = this.getSelections();
        for (var j in selections) {
            if (selections[j].field == field) {
                this.removeSelection(j);
            }
        }
    },
    setSelection:function (filter) {
        if (filter["remove"]) {
            this.removeSelectionByField(filter.field);
        } else {
            var s = this.getSelections();
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
        return this.getSelections().length > 0;
    }

});
