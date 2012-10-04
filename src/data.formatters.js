this.recline = this.recline || {};
this.recline.Data = this.recline.Data || {};

(function(my){

    // formatters define how data is rapresented in internal dataset
    my.FormattersMODA = {
        number : function (e) { return parseFloat(e, 10); },
        string : function (e) { return e.toString() },
        date   : function (e) { return new Date(e)},
        float  : function (e) { return parseFloat(e, 10); }
    };

    // renderers use fieldtype and fieldformat to generate output for getFieldValue
    my.Renderers = {
        object: function(val, field, doc) {
            return JSON.stringify(val);
        },
        data: function(val, field, doc) {
            return val;
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