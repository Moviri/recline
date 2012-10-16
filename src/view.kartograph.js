/*jshint multistr:true */

this.recline = this.recline || {};
this.recline.View = this.recline.View || {};

(function ($, my) {


    my.KartoGraph = Backbone.View.extend({

        template:'<div id="cartograph_{{viewId}}"></div> ',

        initialize:function (options) {
            var self = this;

            this.el = $(this.el);
            _.bindAll(this, 'render', 'redraw');

            this.model.bind('change', self.render);
            this.model.fields.bind('reset', self.render);
            this.model.fields.bind('add', self.render);
            this.model.records.bind('add', self.redraw);
            this.model.records.bind('reset', self.redraw);

        },

        render:function () {
            var self = this;
            var viewId = this.options.state["id"];

            var tmplData = {};
            tmplData["viewId"] = viewId;
            var htmls = Mustache.render(this.template, tmplData);
            $(this.el).html(htmls);


            return this;
        },

        redraw:function () {
            var self = this;

            var viewId = this.options.state["id"];
            var map_url = this.options.state["svgURI"];

            this.map = $K.map('#cartograph_' + viewId);
            this.map.loadMap(map_url, function (map) {
                self._onMapLoaded();
            });
        },

        _onMapLoaded:function (map) {
            var self = this;
            var layers = this.options.state["layers"];
            var map = this.map;

            _.each(layers, function (d) {
                map.addLayer(d);
            });

            // todo verify if it is possibile to divide render and redraw
            // it seams that context is lost after initial load

            var colors = this.options.state["colors"];
            var mapping = this.options.state["mapping"];



            _.each(mapping, function (currentMapping) {
                //build an object that contains all possibile srcShape
                var layer = map.getLayer(currentMapping.destLayer);

                var paths = [];
               _.each(layer.paths, function(currentPath) {
                    paths.push(currentPath.data[currentMapping["destAttribute"]]);
                });

                var filteredResults = self._getDataFor(
                    paths,
                    currentMapping["srcShapeField"],
                    currentMapping["srcValueField"]);

                layer.style(
                    "fill", function (d) {
                        var value = filteredResults[d[currentMapping["destAttribute"]]];

                         if(value != null)
                            return colors.getColor(value);
                    });
            });


        },


        // todo this is not efficient, a list of data should be built before and used as a filter
        // to avoid arrayscan
        _getDataFor:function (paths, srcShapeField, srcValueField) {
            var self=this;
            var resultType = "filtered";
            if (self.options.useFilteredData !== null && self.options.useFilteredData === false)
                resultType = "original";

            var records = self.model.getRecords(resultType);  //self.model.records.models;
            var srcShapef = self.model.fields.get(srcShapeField);
            var srcValuef = self.model.fields.get(srcValueField);

            var res = {};
            _.each(records, function (d) {
                //console.log(d.getFieldValueUnrendered(srcShapef) + " == " + attributeValue);
                if(_.contains(paths, d.getFieldValueUnrendered(srcShapef)))
                  res[d.getFieldValueUnrendered(srcShapef)] =  d.getFieldValueUnrendered(srcValuef);
            });

            return res;
        },


        doActions:function (actions, records) {

            _.each(actions, function (d) {
                d.action.doAction(records, d.mapping);
            });

        },

        getActionsForEvent:function (eventType) {
            var self = this;
            var actions = [];

            _.each(self.options.actions, function (d) {
                if (_.contains(d.event, eventType))
                    actions.push(d);
            });

            return actions;
        }


    });


})(jQuery, recline.View);

