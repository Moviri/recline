this.recline = this.recline || {};
this.recline.Data = this.recline.Data || {}; 


(function(my) {

	my.Format = {};

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
	
}(this.recline.Data));
