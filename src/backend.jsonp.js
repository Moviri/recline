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
        records: _performFieldCreation(dataset.fieldCreation, results.result.data),
        fields: _handleFieldDescription(dataset.fieldCreation, results.result.description),
        useMemoryStore: true
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

  function _performFieldCreation(fieldCreation, result)
  {
	if (fieldCreation)
	{
		// for each desired added field
		for (var f in fieldCreation)
		{
			var currFieldId = fieldCreation[f].id;
			// apply calculation formula for each record
			for (var i = 0; i < result.length; i++)
				result[i][currFieldId] = fieldCreation[f].formula(result[i]);
		}
	}
	return result;
  }
  function _handleFieldDescription(fieldCreation, description) {
      var res = [];
      for (var k in description) {
          // use hasOwnProperty to filter out keys from the Object.prototype
          if (description.hasOwnProperty(k)) {
              res.push({id: k, type: description[k]});

          }
      }
		if (fieldCreation)
			for (var f in fieldCreation)
				res.push({id: fieldCreation[f].id, type: fieldCreation[f].type});

	  return res;
    }




}(jQuery, this.recline.Backend.Jsonp));