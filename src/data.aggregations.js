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
	
	var myIsEqual = function (object, other, key) {

        var spl = key.split('.'),
            val1, val2;

        if (spl.length > 0) {
            val1 = object;
            val2 = other;

            for (var k = 0; k < spl.length; k++) {
                arr = spl[k].match(/(.*)\[\'?(\d*\w*)\'?\]/i);
                if (arr && arr.length == 3) {
                    val1 = (val1[arr[1]]) ? val1[arr[1]][arr[2]] : val1[spl[k]];
                    val2 = (val2[arr[1]]) ? val2[arr[1]][arr[2]] : val2[spl[k]];
                } else {
                    val1 = val1[spl[k]];
                    val2 = val2[spl[k]];
                }
            }
        }
        return _.isEqual(val1, val2);
    };

    my.Aggregations.intersectionObjects = my.Aggregations.intersectObjects = function (key, array) {
        var slice = Array.prototype.slice;
        // added this line as a utility
        var rest = slice.call(arguments, 1);
        return _.filter(_.uniq(array), function (item) {
            return _.every(rest, function (other) {
                //return _.indexOf(other, item) >= 0;
                return _.any(other, function (element) {
                    var control = myIsEqual(element, item, key);
                    if (control) _.extend(item, element);
                    return control;
                });
            });
        });
    };
	
	
})(this.recline.Data);