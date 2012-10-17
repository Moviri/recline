this.recline = this.recline || {};
this.recline.Data = this.recline.Data || {};

(function(my){
	
	my.Aggregations = {};

    my.Aggregations.aggregationFunctions = {
        sum         : function (p,v) {
            if(p==null) p=0;
            return p+v;
        },
        avg         : function (p, v) {},
        max         : function (p, v) {
            if(p==null)
                return v;
            return Math.max(p, v);
        },
        min         : function (p, v) {
            if(p==null)
                return v;
            return Math.min(p, v);
        }
    };

    my.Aggregations.initFunctions = {
        sum         : function () {},
        avg         : function () {},
        max         : function () {},
        min         : function () {}
    };

    my.Aggregations.resultingDataType = {
        sum         : function (original) { return original },
        avg         : function (original) { return "float"},
        max         : function (original) { return original},
        min         : function (original) { return original}
    },

    my.Aggregations.finalizeFunctions = {
        sum         : function () {},
        avg         : function (resultData, aggregatedFields, partitionsFields) {


            resultData.avg = function(aggr, part){

                return function(){

                    var map = {};
                    for(var o=0;o<aggr.length;o++){
                        map[aggr[o]] = this.sum[aggr[o]] / this.count;
                    }
                    return map;
                }
            }(aggregatedFields, partitionsFields);

            if(partitionsFields != null && partitionsFields.length > 0) {


                resultData.partitions.avg = function(aggr, part){

                return function(){

                    var map = {};
                    for (var j=0;j<part.length;j++) {
                        if(resultData.partitions.sum[part[j]])   {
                            map[part[j]] = {
                                value: resultData.partitions.sum[part[j]].value / resultData.partitions.count[part[j]].value,
                                partition: resultData.partitions.sum[part[j]].partition
                            };
                        }
                    }
                    return map;
                }
            }(aggregatedFields, partitionsFields);

            }


        },
        max         : function () {},
        min         : function () {}
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