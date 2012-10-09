this.recline = this.recline || {};
this.recline.Data = this.recline.Data || {};

(function(my){

	my.Format = {};

    // formatters define how data is rapresented in internal dataset
    my.FormattersMODA = {
        number : function (e) { return parseFloat(e, 10); },
        string : function (e) { return e.toString() },
        date   : function (e) { return new Date(e)},
        float  : function (e) { return parseFloat(e, 10); }
    };
    
    my.Format.decimal = d3.format(".00f");
	
	my.Format.scale = function(options) {
		var calculateRange = function(rangePerc, dimwidth){			
			return [0, rangePerc*dimwidth];
		};
		
		return function(records, width, range) {			
			var ret = {}, count;
			
			ret.axisScale = {};
			
			var calcRange = calculateRange(range, width);
			
			if (options.type === 'linear') {
				var max = d3.max(records, function(record) {
					var max=0;
					count=0;
					_.each(options.domain, function(field) {
						max = (record.attributes[field] > max) ? record.attributes[field] : max;
						count++;
					});
					return max*count;
				});
				
				_.each(options.domain, function(field, i){
					var domain;
					var frange = [calcRange[0],calcRange[1]/count];
					
					if(i%2==1 && options.invertEven){
						domain = [max/count, 0];
					}else{
						domain=[0, max/count];
					}					

					ret.axisScale[field] = d3.scale.linear().domain(domain).range(frange);
				});			
				
				ret.scale = d3.scale.linear().domain([0, max]).range(calcRange);
			}
			
			return ret;
		};
	};
    

    // renderers use fieldtype and fieldformat to generate output for getFieldValue
    my.Renderers = {
        object: function(val, field, doc) {
            return JSON.stringify(val);
        },
        data: function(val, field, doc) {
            var format = field.get('format');
            if(format == null || format == "date")
                return val;

            return val.toLocaleDateString();
        },
        geo_point: function(val, field, doc) {
            return JSON.stringify(val);
        },
        'float': function(val, field, doc) {
            var format = field.get('format');
            if (format === 'percentage') {
                return val + '%';
            }
            return val;
        },
        'string': function(val, field, doc) {
            var format = field.get('format');
            if (format === 'markdown') {
                if (typeof Showdown !== 'undefined') {
                    var showdown = new Showdown.converter();
                    out = showdown.makeHtml(val);
                    return out;
                } else {
                    return val;
                }
            } else if (format == 'plain') {
                return val;
            } else {
                // as this is the default and default type is string may get things
                // here that are not actually strings
                if (val && typeof val === 'string') {
                    val = val.replace(/(https?:\/\/[^ ]+)/g, '<a href="$1">$1</a>');
                }
                return val
            }
        }
    }

})(this.recline.Data);
