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
		return function(records) {			
			var ret = {}, count;
			
			ret.axisScale = {};
			
			if (options.type === 'linear') {
				var max = d3.max(records, function(record) {
					var max=0;
					count=0;
					_.each(options.domain, function(dim) {
						max = (record.attributes[dim] > max) ? record.attributes[dim] : max;
						count++;
					});
					return max*count;
				});
				
				_.each(options.domain, function(dim, i){
					var domain;
					var range = [options.range[0],options.range[1]/count];
					
					if(i%2==1 && options.invertEven){
						domain = [max/count, 0];
					}else{
						domain=[0, max/count];
					}					
					console.log(domain);
					ret.axisScale[dim] = d3.scale.linear().domain(domain).range(range);
				});			
				
				ret.scale = d3.scale.linear().domain([0, max]).range(options.range);
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
