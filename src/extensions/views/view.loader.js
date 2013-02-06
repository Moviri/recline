this.recline = this.recline || {};
this.recline.View = this.recline.View || {};

(function ($, view) {
    "use strict";

    view.Loader = Backbone.View.extend({
    	divOver:  null,
    	loaderCount : 0,
        initialize:function (args) {
            _.bindAll(this, 'render', 'incLoaderCount', 'decLoaderCount', 'bindDatasets', 'bindDataset', 'bindCharts', 'bindChart');
        	this.divOver = $('<div/>');
        	this.divOver.attr('style','display:none;opacity:0.7;background:#f9f9f9;position:absolute;top:0;z-index:100;width:100%;height:100%');
        	this.datasets = args.datasets;
        	this.charts = args.charts;
        	this.baseurl = "/"
        	if (args.baseurl)
        		this.baseurl = args.baseurl;
        	$(document.body).append(this.divOver);    
        },
        render:function () {
        	$(document.body).append(this.htmlLoader.replace("{{baseurl}}", this.baseurl));
        	this.bindDatasets(this.datasets);
        	this.bindCharts(this.charts);
        },
    	htmlLoader : 
    		'<div id="loadingImage" style="display:block"> \
    			<div style="position:absolute;top:45%;left:45%;width:150px;height:80px;z-index:100"> \
    				<p class="centered"> \
    					<img src="{{baseurl}}images/ajax-loader-blue.gif" > \
    				</p> \
    			</div> \
    		</div>',
    	incLoaderCount : function() {
    		this.loaderCount++;
    		//console.log("Start task - loaderCount = "+this.loaderCount)
    		this.divOver.show();
    		document.getElementById("loadingImage").style.display = "block"; 
    	},
    	decLoaderCount : function() { 
    		var self = this;
    		this.loaderCount--;
    		//console.log("End task - loaderCount = "+this.loaderCount)
    		if (this.loaderCount <= 0) {
    			//setTimeout(function() {
    				document.getElementById("loadingImage").style.display = "none";
    				self.divOver.hide();
    			//}, 100)
    			this.loaderCount = 0;
    		}
    	},
    	bindDatasets: function(datasets) {
    		var self = this;
    		_.each(datasets, function (dataset) {
    			dataset.bind('query:start', self.incLoaderCount);
    			dataset.bind('query:done query:fail', self.decLoaderCount);
    		});
    	},
    	
    	bindDataset: function(dataset) {
    		dataset.bind('query:start', this.incLoaderCount);
    		dataset.bind('query:done query:fail', this.decLoaderCount);
    	},
    	bindCharts:function(charts) {
    		var self = this;
    		_.each(charts, function (chart) {
    			chart.bind('chart:startDrawing', self.incLoaderCount);
    			chart.bind('chart:endDrawing', self.decLoaderCount);
    		});
    	},
    	bindChart:function(chart) {
    		chart.bind('chart:startDrawing', this.incLoaderCount);
    		chart.bind('chart:endDrawing', this.decLoaderCount);
    	}    
    });
})(jQuery, recline.View);
