// # Recline Backbone Models
this.recline = this.recline || {};
this.recline.Data = this.recline.Data || {};

(function(my){
	
	my.Aggregations = {};

    var aggregationFunctions = {
        sum         : function (e) { return parseFloat(e, 10); },
        average     : function (e) { return parseFloat(e, 10); },
        max         : function (e) { return parseFloat(e, 10); },
        min         : function (e) { return parseFloat(e, 10); }
    };

	my.Aggregations.sum = function(p, v){
		
	};
	
	
})(this.recline.Data);