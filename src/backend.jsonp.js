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
  my.fetch = function(dataset) {

      console.log(dataset);

    console.log("Warning requested full records fetch for " + dataset.url);
    var jqxhr = $.ajax({
      url: dataset.url,
      dataType: 'jsonp',
      cache: 'true'
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

    my.query = function(queryObj, dataset) {
        console.log(queryObj);
        console.log(dataset);

        console.log("Query for " + dataset.url);

        var jqxhr = $.ajax({
            url: dataset.url,
            dataType: 'jsonp',
            cache: 'true'
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
      var res = [];
      for (var k in description) {
          // use hasOwnProperty to filter out keys from the Object.prototype
          if (description.hasOwnProperty(k)) {
              res.push({id: k, type: description[k]});

          }
      }
      return res;
    }



}(jQuery, this.recline.Backend.Jsonp));
