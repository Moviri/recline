this.recline = this.recline || {};
this.recline.View = this.recline.View || {};

(function ($, view) {
    "use strict";

    view.NoDataMsg = Backbone.View.extend({
    	template:"<div class='noData' style='display:table;width:100%;height:100%;border:1px dotted lightgrey;font-size:18px;'><p style='display:table-cell;height:100%;margin-left: auto;margin-right: auto;text-align: center;margin-bottom: auto;margin-top: auto;vertical-align: middle;'>No Data Available!</p></div>",
        initialize:function() {
        },
        create:function() {
        	return this.template;
        }
    });
})(jQuery, recline.View);
