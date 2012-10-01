this.recline = this.recline || {};
this.recline.Backend = this.recline.Backend || {};
this.recline.Backend.Jsonp = this.recline.Backend.Jsonp || {};

(function($, my) {
  my.__type__ = 'Jsonp';
  // Timeout for request (after this time if no response we error)
  // Needed because use JSONP so do not receive e.g. 500 errors 
  my.timeout = 30000;

  // ## load
  //
  // Load data from a URL
  //
  // Returns array of field names and array of arrays for records

    // todo has to be merged with query (part is in common)
    my.fetch = function(dataset) {
    console.log("Fetching data structure " + dataset.url);

    var data = {onlydesc: "true"};

    var jqxhr = $.ajax({
        url: dataset.url,
        dataType: 'jsonp',
        jsonpCallback: dataset.id,
        data: data,
        cache: true
    });


    var dfd = $.Deferred();
    _wrapInTimeout(jqxhr).done(function(results) {
      if (results.error) {
        dfd.reject(results.error);
      }

      dfd.resolve({
            fields:_handleFieldDescription(results.result.description),
            useMemoryStore: false
      });
    })
    .fail(function(arguments) {
      dfd.reject(arguments);
    });
    return dfd.promise();
  };

    my.query = function(queryObj, dataset) {

        var data = buildRequestFromQuery(queryObj);

        //console.log("Querying dataset " + dataset.id.toString() +  JSON.stringify(data));

        var jqxhr = $.ajax({
            url: dataset.url,
            dataType: 'jsonp',
            jsonpCallback: dataset.id,
            data: data,
            cache: true
        });
        var dfd = $.Deferred();
        _wrapInTimeout(jqxhr).done(function(results) {
            if (results.error) {
                dfd.reject(results.error);
            }

            dfd.resolve({
                hits: results.result.data,
                fields:_handleFieldDescription(results.result.description),
                useMemoryStore: false
            });
        })
            .fail(function(arguments) {
                dfd.reject(arguments);
            });
        return dfd.promise();

    };




  function  buildRequestFromQuery(queryObj)  {
      var self=this;
      var filters = queryObj.filters;
      var data = [];
      var multivsep = "~";


      // register filters
      var filterFunctions = {
          term         : term,          // field = value
          termAdvanced : termAdvanced,  // field (operator) value
          range        : range,         // field > start and field < end
          list         : term          
      };

      var dataParsers = {
          number : function (e) { return parseFloat(e, 10); },
          string : function (e) { return e.toString() },
          date   : function (e) { return e.toString(); }     //todo parsing and verification of date
      };

      for(var i=0; i<filters.length;i++) {
          data.push(filterFunctions[filters[i].type](filters[i]));
      }


      // filters definitions

      function term(filter) {
          var parse = dataParsers[filter.fieldType];
          var value = filter.field;
          var term  = parse(filter.term);

          return (value + " eq "  + term);
      }

      function termAdvanced(filter) {
          var parse = dataParsers[filter.fieldType];
          var value =    filter.field;
          var term  =    parse(filter.term);
          var operator = filter.operator;

          return (value + " " + operator + " "  + term);
      }

      function range(filter) {
          var parse = dataParsers[filter.fieldType];
          var value = filter.field;
          var start = parse(filter.start);
          var stop  = parse(filter.stop);
          return (value + " lt " + stop + "," + value + " gt "  + start);

      }

      function list(filter) {
          var parse = dataParsers[filter.fieldType];
          var value = filter.field;
          var list = filter.list;

          var ret = value + " bw ";
          for(var i=0;i<filter.list.length;i++) {
              if(i>0)
               ret = ret + multivsep;

              ret = ret + list[i];
          }

          return ret;

      }

      return {filters: data.toString()};

  }

  // ## _wrapInTimeout
  // 
  // Convenience method providing a crude way to catch backend errors on JSONP calls.
  // Many of backends use JSONP and so will not get error messages and this is
  // a crude way to catch those errors.
  var _wrapInTimeout = function(ourFunction) {
    var dfd = $.Deferred();
    var timer = setTimeout(function() {
      dfd.reject({
        message: 'Request Error: Backend did not respond after ' + (my.timeout / 1000) + ' seconds'
      });
    }, my.timeout);
    ourFunction.done(function(arguments) {
        clearTimeout(timer);
        dfd.resolve(arguments);
      })
      .fail(function(arguments) {
        clearTimeout(timer);
        dfd.reject(arguments);
      })
      ;
    return dfd.promise();
  }

  function _handleFieldDescription(description) {

      var dataMapping = {
          STRING : "string",
          DATE   : "date",
          INTEGER: "number",
          DOUBLE : "number"
      };


      var res = [];
      for (var k in description) {

              res.push({id: k, type: dataMapping[description[k]]});
        }

      return res;
    }




}(jQuery, this.recline.Backend.Jsonp));
