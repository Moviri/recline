this.recline = this.recline || {};

(function($, my) {

    my.ActionUtility = {};


        my.ActionUtility.doAction =    function(actions, eventType, eventData) {

        // find all actions configured for eventType
        var targetActions = _.filter(actions, function(d) {
            var tmpFound = _.find(d["event"], function(x) {return x==eventType});
            if(tmpFound != -1)
                return true;
            else
                return false;
        });

        // foreach action prepare field
        _.each(targetActions, function(currentAction) {
            var mapping = currentAction.mapping;
            var actionParameters = [];
            //foreach mapping set destination field
            _.each(mapping, function(map) {
                if(eventData[map["srcField"]] == null) {
                    console.log( "warn: sourceField: [" + map["srcField"] + "] not present in event data" );
                } else {


                    var param = {
                        filter: map["filter"],
                        value: eventData[map["srcField"]]
                    };
                    actionParameters.push(param);
                }
            });

            if( actionParameters.length > 0)  {
                currentAction.action._internalDoAction(actionParameters, actionType);
            }
        });
    },

my.ActionUtility.getActiveFilters = function(actions) {

    var activeFilters = [];
    _.each(actions, function(currentAction) {
        _.each(currentAction.mapping, function(map) {
            var currentFilter= currentAction.action.getActiveFilters(map.filter, map.srcField);
            if(currentFilter!=null && currentFilter.length>0)
                activeFilters = _.union(activeFilters, currentFilter) ;
        })
    });

    return activeFilters;
};

// ## <a id="dataset">Action</a>
my.Action = Backbone.Model.extend({
    constructor: function Action() {
        Backbone.Model.prototype.constructor.apply(this, arguments);
    },

   initialize: function(){

   },

	doAction: function(records, mapping) {
		var params = [];
		mapping.forEach(function(mapp) {
			var values = [];
			//{srcField: "daydate", filter: "filter_daydate"}
			records.forEach(function(row) {
				values.push(row.getFieldValueUnrendered({id:mapp.srcField}));
			});
			params.push({
				filter : mapp.filter,
				value : values
			});
		});
		this._internalDoAction(params, "add");
	},

    doActionWithValues: function(valuesarray, mapping) {
        var params = [];
        mapping.forEach(function(mapp) {
            var values = [];
            //{srcField: "daydate", filter: "filter_daydate"}
            _.each(valuesarray, function(row) {
                values.push(row);
            });
            params.push({
                filter : mapp.filter,
                value : values
            });
        });
        this._internalDoAction(params, "add");
    },


    // action could be add/remove
   _internalDoAction: function(data) {
       var self=this;

       var filters = this.attributes.filters;
       var models = this.attributes.models;
       var type = this.attributes.type;

       var targetFilters = [];

       //populate all filters with data received from event
       //foreach filter defined in data
       _.each(data, function(f) {
           // filter creation
           var currentFilter = filters[f.filter];
           if(currentFilter == null){
               throw "Filter " + f.filter + " defined in actions data not configured for action ";
           }
           currentFilter["name"] = f.filter;
           if(self.filters[currentFilter.type] == null)
                throw "Filter not implemented for type " + currentFilter.type;

           targetFilters.push(self.filters[currentFilter.type](currentFilter, f.value));

       });

       // foreach type and dataset add all filters and trigger events
       _.each(type, function(type) {
               _.each(models, function(m) {

                   var modified = false;

                   _.each(targetFilters, function(f) {

                       // verify if filter is associated with current model
                       if(_.find(m.filters, function(x) {return x == f.name;}) != null) {
                            // if associated add the filter

                            self.modelsAddFilterActions[type](m.model, f);
                               modified = true;
                           
                       }
                   });

                   if(modified) {
                       self.modelsTriggerActions[type](m.model);
                   }
               });
       });




   },

    getActiveFilters: function(filterName, srcField) {
        var self=this;
        var models = this.attributes.models;
        var type = this.attributes.type;
        var filtersProp = this.attributes.filters;

        // for each type
        // foreach dataset
        // get filter
        // push to result, if already present error
        var foundFilters = [];

        _.each(type, function(type) {
            _.each(models, function(m) {
                var usedFilters = _.filter(m.filters, function(f){ return f == filterName; });
                _.each(usedFilters, function(f) {
                    // search filter
                    var filter = filtersProp[f];
                    if(filter != null) {
                        var filterOnModel = self.modelsGetFilter[type](m.model, filter.field);
                        // substitution of fieldname with the one provided by source
                        if(filterOnModel != null) {
                            filterOnModel.field = srcField;
                            foundFilters.push(filterOnModel);
                        }
                    }
                });
             });
        });


        return foundFilters;
    },


    modelsGetFilter: {
        filter:     function(model, fieldName) {
            return model.queryState.getFilterByFieldName(fieldName)  ;
        },
        selection:  function(model, fieldName) { throw "not implemented selection for modelsGetFilterActions" }
    },

    modelsAddFilterActions: {
        filter:     function(model, filter) { model.queryState.setFilter(filter)},
        selection:  function(model, filter) { model.queryState.setSelection(filter)}
    },

 
    modelsTriggerActions: {
        filter:     function(model) { model.queryState.trigger("change")},
        selection:  function(model) { model.queryState.trigger("selection:change")}
    },

    filters: {
        term: function(filter, data) {

			if(data.length===0){
				//empty list
				filter["term"] = null;
			} else if(data===null){
				//null list
				filter["remove"] = true;
			} else if(data.length===1){
				filter["term"] = data[0];
			} else {
                throw "Data passed for filtertype term not valid. Data lenght should be 1 or empty but is " + data.length;
			}            
            
            return filter;
        },
        range: function(filter, data) {

           if(data.length===0){
				//empty list
            	filter["start"] = null;
            	filter["stop"]  = null;			
			} else if(data[0]===null || data[1]===null){
				//null list
				filter["remove"] = true;
			} else if(data.length===2){
           		filter["start"] = data[0];
            	filter["stop"]  = data[1];
			} else {
				throw "Data passed for filtertype range not valid. Data lenght should be 2 but is " + data.length;
			}

            return filter;
        },
        list: function(filter, data) {

           if(data.length===0){
				//empty list
            	filter["list"] = null;		
			} else if(data===null){
				//null list
				filter["remove"] = true;
			} else {
           		filter["list"] = data;
			}
            
            return filter;
        }
    }




});


}(jQuery, this.recline));
this.recline = this.recline || {};
this.recline.Backend = this.recline.Backend || {};
this.recline.Backend.Ckan = this.recline.Backend.Ckan || {};

(function($, my) {
  // ## CKAN Backend
  //
  // This provides connection to the CKAN DataStore (v2)
  //
  // General notes
  // 
  // We need 2 things to make most requests:
  //
  // 1. CKAN API endpoint
  // 2. ID of resource for which request is being made
  //
  // There are 2 ways to specify this information.
  //
  // EITHER (checked in order): 
  //
  // * Every dataset must have an id equal to its resource id on the CKAN instance
  // * The dataset has an endpoint attribute pointing to the CKAN API endpoint
  //
  // OR:
  // 
  // Set the url attribute of the dataset to point to the Resource on the CKAN instance. The endpoint and id will then be automatically computed.

  my.__type__ = 'ckan';

  // Default CKAN API endpoint used for requests (you can change this but it will affect every request!)
  //
  // DEPRECATION: this will be removed in v0.7. Please set endpoint attribute on dataset instead
  my.API_ENDPOINT = 'http://datahub.io/api';

  // ### fetch
  my.fetch = function(dataset) {
    if (dataset.endpoint) {
      var wrapper = my.DataStore(dataset.endpoint);
    } else {
      var out = my._parseCkanResourceUrl(dataset.url);
      dataset.id = out.resource_id;
      var wrapper = my.DataStore(out.endpoint);
    }
    var dfd = $.Deferred();
    var jqxhr = wrapper.search({resource_id: dataset.id, limit: 0});
    jqxhr.done(function(results) {
      // map ckan types to our usual types ...
      var fields = _.map(results.result.fields, function(field) {
        field.type = field.type in CKAN_TYPES_MAP ? CKAN_TYPES_MAP[field.type] : field.type;
        return field;
      });
      var out = {
        fields: fields,
        useMemoryStore: false
      };
      dfd.resolve(out);  
    });
    return dfd.promise();
  };

  // only put in the module namespace so we can access for tests!
  my._normalizeQuery = function(queryObj, dataset) {
    var actualQuery = {
      resource_id: dataset.id,
      q: queryObj.q,
      limit: queryObj.size || 10,
      offset: queryObj.from || 0
    };
    if (queryObj.sort && queryObj.sort.length > 0) {
      var _tmp = _.map(queryObj.sort, function(sortObj) {
        return sortObj.field + ' ' + (sortObj.order || '');
      });
      actualQuery.sort = _tmp.join(',');
    }
    return actualQuery;
  }

  my.query = function(queryObj, dataset) {
    if (dataset.endpoint) {
      var wrapper = my.DataStore(dataset.endpoint);
    } else {
      var out = my._parseCkanResourceUrl(dataset.url);
      dataset.id = out.resource_id;
      var wrapper = my.DataStore(out.endpoint);
    }
    var actualQuery = my._normalizeQuery(queryObj, dataset);
    var dfd = $.Deferred();
    var jqxhr = wrapper.search(actualQuery);
    jqxhr.done(function(results) {
      var out = {
        total: results.result.total,
        hits: results.result.records,
      };
      dfd.resolve(out);  
    });
    return dfd.promise();
  };

  // ### DataStore
  //
  // Simple wrapper around the CKAN DataStore API
  //
  // @param endpoint: CKAN api endpoint (e.g. http://datahub.io/api)
  my.DataStore = function(endpoint) { 
    var that = {
      endpoint: endpoint || my.API_ENDPOINT
    };
    that.search = function(data) {
      var searchUrl = that.endpoint + '/3/action/datastore_search';
      var jqxhr = $.ajax({
        url: searchUrl,
        data: data,
        dataType: 'json'
      });
      return jqxhr;
    }

    return that;
  };

  // Parse a normal CKAN resource URL and return API endpoint etc
  //
  // Normal URL is something like http://demo.ckan.org/dataset/some-dataset/resource/eb23e809-ccbb-4ad1-820a-19586fc4bebd
  my._parseCkanResourceUrl = function(url) {
    parts = url.split('/');
    var len = parts.length;
    return {
      resource_id: parts[len-1],
      endpoint: parts.slice(0,[len-4]).join('/') + '/api'
    }
  };

  var CKAN_TYPES_MAP = {
    'int4': 'integer',
    'int8': 'integer',
    'float8': 'float'
  };

}(jQuery, this.recline.Backend.Ckan));
this.recline = this.recline || {};
this.recline.Backend = this.recline.Backend || {};
this.recline.Backend.CSV = this.recline.Backend.CSV || {};

// Note that provision of jQuery is optional (it is **only** needed if you use fetch on a remote file)
(function(my, $) {

  // ## fetch
  //
  // fetch supports 3 options depending on the attribute provided on the dataset argument
  //
  // 1. `dataset.file`: `file` is an HTML5 file object. This is opened and parsed with the CSV parser.
  // 2. `dataset.data`: `data` is a string in CSV format. This is passed directly to the CSV parser
  // 3. `dataset.url`: a url to an online CSV file that is ajax accessible (note this usually requires either local or on a server that is CORS enabled). The file is then loaded using $.ajax and parsed using the CSV parser (NB: this requires jQuery)
  //
  // All options generates similar data and use the memory store outcome, that is they return something like:
  //
  // <pre>
  // {
  //   records: [ [...], [...], ... ],
  //   metadata: { may be some metadata e.g. file name }
  //   useMemoryStore: true
  // }
  // </pre>
  my.fetch = function(dataset) {
    var dfd = $.Deferred();
    if (dataset.file) {
      var reader = new FileReader();
      var encoding = dataset.encoding || 'UTF-8';
      reader.onload = function(e) {
        var rows = my.parseCSV(e.target.result, dataset);
        dfd.resolve({
          records: rows,
          metadata: {
            filename: dataset.file.name
          },
          useMemoryStore: true
        });
      };
      reader.onerror = function (e) {
        alert('Failed to load file. Code: ' + e.target.error.code);
      };
      reader.readAsText(dataset.file, encoding);
    } else if (dataset.data) {
      var rows = my.parseCSV(dataset.data, dataset);
      dfd.resolve({
        records: rows,
        useMemoryStore: true
      });
    } else if (dataset.url) {
      $.get(dataset.url).done(function(data) {
        var rows = my.parseCSV(data, dataset);
        dfd.resolve({
          records: rows,
          useMemoryStore: true
        });
      });
    }
    return dfd.promise();
  };

  // ## parseCSV
  //
  // Converts a Comma Separated Values string into an array of arrays.
  // Each line in the CSV becomes an array.
  //
  // Empty fields are converted to nulls and non-quoted numbers are converted to integers or floats.
  //
  // @return The CSV parsed as an array
  // @type Array
  // 
  // @param {String} s The string to convert
  // @param {Object} options Options for loading CSV including
  // 	  @param {Boolean} [trim=false] If set to True leading and trailing
  // 	    whitespace is stripped off of each non-quoted field as it is imported
  //	  @param {String} [delimiter=','] A one-character string used to separate
  //	    fields. It defaults to ','
  //    @param {String} [quotechar='"'] A one-character string used to quote
  //      fields containing special characters, such as the delimiter or
  //      quotechar, or which contain new-line characters. It defaults to '"'
  //
  // Heavily based on uselesscode's JS CSV parser (MIT Licensed):
  // http://www.uselesscode.org/javascript/csv/
  my.parseCSV= function(s, options) {
    // Get rid of any trailing \n
    s = chomp(s);

    var options = options || {};
    var trm = (options.trim === false) ? false : true;
    var delimiter = options.delimiter || ',';
    var quotechar = options.quotechar || '"';

    var cur = '', // The character we are currently processing.
      inQuote = false,
      fieldQuoted = false,
      field = '', // Buffer for building up the current field
      row = [],
      out = [],
      i,
      processField;

    processField = function (field) {
      if (fieldQuoted !== true) {
        // If field is empty set to null
        if (field === '') {
          field = null;
        // If the field was not quoted and we are trimming fields, trim it
        } else if (trm === true) {
          field = trim(field);
        }

        // Convert unquoted numbers to their appropriate types
        if (rxIsInt.test(field)) {
          field = parseInt(field, 10);
        } else if (rxIsFloat.test(field)) {
          field = parseFloat(field, 10);
        }
      }
      return field;
    };

    for (i = 0; i < s.length; i += 1) {
      cur = s.charAt(i);

      // If we are at a EOF or EOR
      if (inQuote === false && (cur === delimiter || cur === "\n")) {
	field = processField(field);
        // Add the current field to the current row
        row.push(field);
        // If this is EOR append row to output and flush row
        if (cur === "\n") {
          out.push(row);
          row = [];
        }
        // Flush the field buffer
        field = '';
        fieldQuoted = false;
      } else {
        // If it's not a quotechar, add it to the field buffer
        if (cur !== quotechar) {
          field += cur;
        } else {
          if (!inQuote) {
            // We are not in a quote, start a quote
            inQuote = true;
            fieldQuoted = true;
          } else {
            // Next char is quotechar, this is an escaped quotechar
            if (s.charAt(i + 1) === quotechar) {
              field += quotechar;
              // Skip the next char
              i += 1;
            } else {
              // It's not escaping, so end quote
              inQuote = false;
            }
          }
        }
      }
    }

    // Add the last field
    field = processField(field);
    row.push(field);
    out.push(row);

    return out;
  };

  // ## serializeCSV
  // 
  // Convert an Object or a simple array of arrays into a Comma
  // Separated Values string.
  //
  // Nulls are converted to empty fields and integers or floats are converted to non-quoted numbers.
  //
  // @return The array serialized as a CSV
  // @type String
  // 
  // @param {Object or Array} dataToSerialize The Object or array of arrays to convert. Object structure must be as follows:
  //
  //     {
  //       fields: [ {id: .., ...}, {id: ..., 
  //       records: [ { record }, { record }, ... ]
  //       ... // more attributes we do not care about
  //     }
  // 
  // @param {object} options Options for serializing the CSV file including
  //   delimiter and quotechar (see parseCSV options parameter above for
  //   details on these).
  //
  // Heavily based on uselesscode's JS CSV serializer (MIT Licensed):
  // http://www.uselesscode.org/javascript/csv/
  my.serializeCSV= function(dataToSerialize, options) {
    var a = null;
    if (dataToSerialize instanceof Array) {
      a = dataToSerialize;
    } else {
      a = [];
      var fieldNames = _.pluck(dataToSerialize.fields, 'id');
      a.push(fieldNames);
      _.each(dataToSerialize.records, function(record, index) {
        var tmp = _.map(fieldNames, function(fn) {
          return record[fn];
        });
        a.push(tmp);
      });
    }
    var options = options || {};
    var delimiter = options.delimiter || ',';
    var quotechar = options.quotechar || '"';

    var cur = '', // The character we are currently processing.
      field = '', // Buffer for building up the current field
      row = '',
      out = '',
      i,
      j,
      processField;

    processField = function (field) {
      if (field === null) {
        // If field is null set to empty string
        field = '';
      } else if (typeof field === "string" && rxNeedsQuoting.test(field)) {
        // Convert string to delimited string
        field = quotechar + field + quotechar;
      } else if (typeof field === "number") {
        // Convert number to string
        field = field.toString(10);
      }

      return field;
    };

    for (i = 0; i < a.length; i += 1) {
      cur = a[i];

      for (j = 0; j < cur.length; j += 1) {
        field = processField(cur[j]);
        // If this is EOR append row to output and flush row
        if (j === (cur.length - 1)) {
          row += field;
          out += row + "\n";
          row = '';
        } else {
          // Add the current field to the current row
          row += field + delimiter;
        }
        // Flush the field buffer
        field = '';
      }
    }

    return out;
  };

  var rxIsInt = /^\d+$/,
    rxIsFloat = /^\d*\.\d+$|^\d+\.\d*$/,
    // If a string has leading or trailing space,
    // contains a comma double quote or a newline
    // it needs to be quoted in CSV output
    rxNeedsQuoting = /^\s|\s$|,|"|\n/,
    trim = (function () {
      // Fx 3.1 has a native trim function, it's about 10x faster, use it if it exists
      if (String.prototype.trim) {
        return function (s) {
          return s.trim();
        };
      } else {
        return function (s) {
          return s.replace(/^\s*/, '').replace(/\s*$/, '');
        };
      }
    }());

  function chomp(s) {
    if (s.charAt(s.length - 1) !== "\n") {
      // Does not end with \n, just return string
      return s;
    } else {
      // Remove the \n
      return s.substring(0, s.length - 1);
    }
  }


}(this.recline.Backend.CSV, jQuery));
this.recline = this.recline || {};
this.recline.Backend = this.recline.Backend || {};
this.recline.Backend.DataProxy = this.recline.Backend.DataProxy || {};

(function($, my) {
  my.__type__ = 'dataproxy';
  // URL for the dataproxy
  my.dataproxy_url = 'http://jsonpdataproxy.appspot.com';
  // Timeout for dataproxy (after this time if no response we error)
  // Needed because use JSONP so do not receive e.g. 500 errors 
  my.timeout = 5000;

  // ## load
  //
  // Load data from a URL via the [DataProxy](http://github.com/okfn/dataproxy).
  //
  // Returns array of field names and array of arrays for records
  my.fetch = function(dataset) {
    var data = {
      url: dataset.url,
      'max-results':  dataset.size || dataset.rows || 1000,
      type: dataset.format || ''
    };
    var jqxhr = $.ajax({
      url: my.dataproxy_url,
      data: data,
      dataType: 'jsonp'
    });
    var dfd = $.Deferred();
    _wrapInTimeout(jqxhr).done(function(results) {
      if (results.error) {
        dfd.reject(results.error);
      }

      dfd.resolve({
        records: results.data,
        fields: results.fields,
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

}(jQuery, this.recline.Backend.DataProxy));
this.recline = this.recline || {};
this.recline.Backend = this.recline.Backend || {};
this.recline.Backend.ElasticSearch = this.recline.Backend.ElasticSearch || {};

(function($, my) {
  my.__type__ = 'elasticsearch';

  // ## ElasticSearch Wrapper
  //
  // A simple JS wrapper around an [ElasticSearch](http://www.elasticsearch.org/) endpoints.
  //
  // @param {String} endpoint: url for ElasticSearch type/table, e.g. for ES running
  // on http://localhost:9200 with index twitter and type tweet it would be:
  // 
  // <pre>http://localhost:9200/twitter/tweet</pre>
  //
  // @param {Object} options: set of options such as:
  //
  // * headers - {dict of headers to add to each request}
  // * dataType: dataType for AJAx requests e.g. set to jsonp to make jsonp requests (default is json requests)
  my.Wrapper = function(endpoint, options) { 
    var self = this;
    this.endpoint = endpoint;
    this.options = _.extend({
        dataType: 'json'
      },
      options);

    // ### mapping
    //
    // Get ES mapping for this type/table
    //
    // @return promise compatible deferred object.
    this.mapping = function() {
      var schemaUrl = self.endpoint + '/_mapping';
      var jqxhr = makeRequest({
        url: schemaUrl,
        dataType: this.options.dataType
      });
      return jqxhr;
    };

    // ### get
    //
    // Get record corresponding to specified id
    //
    // @return promise compatible deferred object.
    this.get = function(id) {
      var base = this.endpoint + '/' + id;
      return makeRequest({
        url: base,
        dataType: 'json'
      });
    };

    // ### upsert
    //
    // create / update a record to ElasticSearch backend
    //
    // @param {Object} doc an object to insert to the index.
    // @return deferred supporting promise API
    this.upsert = function(doc) {
      var data = JSON.stringify(doc);
      url = this.endpoint;
      if (doc.id) {
        url += '/' + doc.id;
      }
      return makeRequest({
        url: url,
        type: 'POST',
        data: data,
        dataType: 'json'
      });
    };

    // ### delete
    //
    // Delete a record from the ElasticSearch backend.
    //
    // @param {Object} id id of object to delete
    // @return deferred supporting promise API
    this.remove = function(id) {
      url = this.endpoint;
      url += '/' + id;
      return makeRequest({
        url: url,
        type: 'DELETE',
        dataType: 'json'
      });
    };

    this._normalizeQuery = function(queryObj) {
      var self = this;
      var queryInfo = (queryObj && queryObj.toJSON) ? queryObj.toJSON() : _.extend({}, queryObj);
      var out = {
        constant_score: {
          query: {}
        }
      };
      if (!queryInfo.q) {
        out.constant_score.query = {
          match_all: {}
        };
      } else {
        out.constant_score.query = {
          query_string: {
            query: queryInfo.q
          }
        };
      }
      if (queryInfo.filters && queryInfo.filters.length) {
        out.constant_score.filter = {
          and: []
        };
        _.each(queryInfo.filters, function(filter) {
          out.constant_score.filter.and.push(self._convertFilter(filter));
        });
      }
      return out;
    },

    // convert from Recline sort structure to ES form
    // http://www.elasticsearch.org/guide/reference/api/search/sort.html
    this._normalizeSort = function(sort) {
      var out = _.map(sort, function(sortObj) {
        var _tmp = {};
        var _tmp2 = _.clone(sortObj);
        delete _tmp2['field'];
        _tmp[sortObj.field] = _tmp2;
        return _tmp;
      });
      return out;
    },

    this._convertFilter = function(filter) {
      var out = {};
      out[filter.type] = {}
      if (filter.type === 'term') {
        out.term[filter.field] = filter.term.toLowerCase();
      } else if (filter.type === 'geo_distance') {
        out.geo_distance[filter.field] = filter.point;
        out.geo_distance.distance = filter.distance;
        out.geo_distance.unit = filter.unit;
      }
      return out;
    },

    // ### query
    //
    // @return deferred supporting promise API
    this.query = function(queryObj) {
      var esQuery = (queryObj && queryObj.toJSON) ? queryObj.toJSON() : _.extend({}, queryObj);
      esQuery.query = this._normalizeQuery(queryObj);
      delete esQuery.q;
      delete esQuery.filters;
      if (esQuery.sort && esQuery.sort.length > 0) {
        esQuery.sort = this._normalizeSort(esQuery.sort);
      }
      var data = {source: JSON.stringify(esQuery)};
      var url = this.endpoint + '/_search';
      var jqxhr = makeRequest({
        url: url,
        data: data,
        dataType: this.options.dataType
      });
      return jqxhr;
    }
  };


  // ## Recline Connectors 
  //
  // Requires URL of ElasticSearch endpoint to be specified on the dataset
  // via the url attribute.

  // ES options which are passed through to `options` on Wrapper (see Wrapper for details)
  my.esOptions = {};

  // ### fetch
  my.fetch = function(dataset) {
    var es = new my.Wrapper(dataset.url, my.esOptions);
    var dfd = $.Deferred();
    es.mapping().done(function(schema) {

      if (!schema){
        dfd.reject({'message':'Elastic Search did not return a mapping'});
        return;
      }

      // only one top level key in ES = the type so we can ignore it
      var key = _.keys(schema)[0];
      var fieldData = _.map(schema[key].properties, function(dict, fieldName) {
        dict.id = fieldName;
        return dict;
      });
      dfd.resolve({
        fields: fieldData
      });
    })
    .fail(function(arguments) {
      dfd.reject(arguments);
    });
    return dfd.promise();
  };

  // ### save
  my.save = function(changes, dataset) {
    var es = new my.Wrapper(dataset.url, my.esOptions);
    if (changes.creates.length + changes.updates.length + changes.deletes.length > 1) {
      var dfd = $.Deferred();
      msg = 'Saving more than one item at a time not yet supported';
      alert(msg);
      dfd.reject(msg);
      return dfd.promise();
    }
    if (changes.creates.length > 0) {
      return es.upsert(changes.creates[0]);
    }
    else if (changes.updates.length >0) {
      return es.upsert(changes.updates[0]);
    } else if (changes.deletes.length > 0) {
      return es.remove(changes.deletes[0].id);
    }
  };

  // ### query
  my.query = function(queryObj, dataset) {
    var dfd = $.Deferred();
    var es = new my.Wrapper(dataset.url, my.esOptions);
    var jqxhr = es.query(queryObj);
    jqxhr.done(function(results) {
      var out = {
        total: results.hits.total
      };
      out.hits = _.map(results.hits.hits, function(hit) {
        if (!('id' in hit._source) && hit._id) {
          hit._source.id = hit._id;
        }
        return hit._source;
      });
      if (results.facets) {
        out.facets = results.facets;
      }
      dfd.resolve(out);
    }).fail(function(errorObj) {
      var out = {
        title: 'Failed: ' + errorObj.status + ' code',
        message: errorObj.responseText
      };
      dfd.reject(out);
    });
    return dfd.promise();
  };


// ### makeRequest
// 
// Just $.ajax but in any headers in the 'headers' attribute of this
// Backend instance. Example:
//
// <pre>
// var jqxhr = this._makeRequest({
//   url: the-url
// });
// </pre>
var makeRequest = function(data, headers) {
  var extras = {};
  if (headers) {
    extras = {
      beforeSend: function(req) {
        _.each(headers, function(value, key) {
          req.setRequestHeader(key, value);
        });
      }
    };
  }
  var data = _.extend(extras, data);
  return $.ajax(data);
};

}(jQuery, this.recline.Backend.ElasticSearch));

this.recline = this.recline || {};
this.recline.Backend = this.recline.Backend || {};
this.recline.Backend.GDocs = this.recline.Backend.GDocs || {};

(function($, my) {
  my.__type__ = 'gdocs';

  // ## Google spreadsheet backend
  // 
  // Fetch data from a Google Docs spreadsheet.
  //
  // Dataset must have a url attribute pointing to the Gdocs or its JSON feed e.g.
  // <pre>
  // var dataset = new recline.Model.Dataset({
  //     url: 'https://docs.google.com/spreadsheet/ccc?key=0Aon3JiuouxLUdGlQVDJnbjZRSU1tUUJWOUZXRG53VkE#gid=0'
  //   },
  //   'gdocs'
  // );
  //
  // var dataset = new recline.Model.Dataset({
  //     url: 'https://spreadsheets.google.com/feeds/list/0Aon3JiuouxLUdDQwZE1JdV94cUd6NWtuZ0IyWTBjLWc/od6/public/values?alt=json'
  //   },
  //   'gdocs'
  // );
  // </pre>
  //
  // @return object with two attributes
  //
  // * fields: array of Field objects
  // * records: array of objects for each row
  my.fetch = function(dataset) {
    var dfd  = $.Deferred(); 
    var urls = my.getGDocsAPIUrls(dataset.url);

    // TODO cover it with tests
    // get the spreadsheet title
    (function () {
      var titleDfd = $.Deferred();

      $.getJSON(urls.spreadsheet, function (d) {
          titleDfd.resolve({
              spreadsheetTitle: d.feed.title.$t
          });
      });

      return titleDfd.promise();
    }()).then(function (response) {

      // get the actual worksheet data
      $.getJSON(urls.worksheet, function(d) {
        var result = my.parseData(d);
        var fields = _.map(result.fields, function(fieldId) {
          return {id: fieldId};
        });

        dfd.resolve({
          metadata: {
              title: response.spreadsheetTitle +" :: "+ result.worksheetTitle,
              spreadsheetTitle: response.spreadsheetTitle,
              worksheetTitle  : result.worksheetTitle
          },
          records       : result.records,
          fields        : fields,
          useMemoryStore: true
        });
      });
    });

    return dfd.promise();
  };

  // ## parseData
  //
  // Parse data from Google Docs API into a reasonable form
  //
  // :options: (optional) optional argument dictionary:
  // columnsToUse: list of columns to use (specified by field names)
  // colTypes: dictionary (with column names as keys) specifying types (e.g. range, percent for use in conversion).
  // :return: tabular data object (hash with keys: field and data).
  // 
  // Issues: seems google docs return columns in rows in random order and not even sure whether consistent across rows.
  my.parseData = function(gdocsSpreadsheet, options) {
    var options  = options || {};
    var colTypes = options.colTypes || {};
    var results = {
      fields : [],
      records: []
    };
    var entries = gdocsSpreadsheet.feed.entry || [];
    var key;
    var colName;
    // percentage values (e.g. 23.3%)
    var rep = /^([\d\.\-]+)\%$/;

    for(key in entries[0]) {
      // it's barely possible it has inherited keys starting with 'gsx$'
      if(/^gsx/.test(key)) {
        colName = key.substr(4);
        results.fields.push(colName);
      }
    }

    // converts non numberical values that should be numerical (22.3%[string] -> 0.223[float])
    results.records = _.map(entries, function(entry) {
      var row = {};

      _.each(results.fields, function(col) {
        var _keyname = 'gsx$' + col;
        var value = entry[_keyname].$t;
        var num;
 
        // TODO cover this part of code with test
        // TODO use the regexp only once
        // if labelled as % and value contains %, convert
        if(colTypes[col] === 'percent' && rep.test(value)) {
          num   = rep.exec(value)[1];
          value = parseFloat(num) / 100;
        }

        row[col] = value;
      });

      return row;
    });

    results.worksheetTitle = gdocsSpreadsheet.feed.title.$t;
    return results;
  };

  // Convenience function to get GDocs JSON API Url from standard URL
  my.getGDocsAPIUrls = function(url) {
    // https://docs.google.com/spreadsheet/ccc?key=XXXX#gid=YYY
    var regex = /.*spreadsheet\/ccc?.*key=([^#?&+]+)[^#]*(#gid=([\d]+).*)?/;
    var matches = url.match(regex);
    var key;
    var worksheet;
    var urls;
    
    if(!!matches) {
        key = matches[1];
        // the gid in url is 0-based and feed url is 1-based
        worksheet = parseInt(matches[3]) + 1;
        if (isNaN(worksheet)) {
          worksheet = 1;
        }
        urls = {
          worksheet  : 'https://spreadsheets.google.com/feeds/list/'+ key +'/'+ worksheet +'/public/values?alt=json',
          spreadsheet: 'https://spreadsheets.google.com/feeds/worksheets/'+ key +'/public/basic?alt=json'
        }
    }
    else {
        // we assume that it's one of the feeds urls
        key = url.split('/')[5];
        // by default then, take first worksheet
        worksheet = 1;
        urls = {
          worksheet  : 'https://spreadsheets.google.com/feeds/list/'+ key +'/'+ worksheet +'/public/values?alt=json',
          spreadsheet: 'https://spreadsheets.google.com/feeds/worksheets/'+ key +'/public/basic?alt=json'
        }            
    }

    return urls;
  };
}(jQuery, this.recline.Backend.GDocs));
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

    my.queryStateInMemory  = new recline.Model.Query();
    my.queryStateOnBackend = new recline.Model.Query();

    // todo has to be merged with query (part is in common)
    my.fetch = function(dataset) {

        console.log("Fetching data structure " + dataset.url);

        var data = {onlydesc: "true"};
        return requestJson(dataset, data);

  };

    my.query = function(queryObj, dataset) {

        var tmpQueryStateInMemory  = new recline.Model.Query();
        var tmpQueryStateOnBackend = new recline.Model.Query();


        if(dataset.inMemoryQueryFields == null && !queryObj.facets && !dataset.useMemoryStore) {
            dataset.useMemoryStore = [];
        } else
            my.useMemoryStore = true;

        var filters =  queryObj.filters;
        for(var i=0;i<filters.length;i++){
            // verify if filter is specified in inmemoryfields

            if(_.indexOf(dataset.inMemoryQueryFields, filters[i].field) == -1) {
                //console.log("filtering " + filters[i].field + " on backend");
                tmpQueryStateOnBackend.addFilter(filters[i]);
            }
            else {
                //console.log("filtering " + filters[i].field + " on memory");
                tmpQueryStateInMemory.addFilter(filters[i]);
            }
        }

        var changedOnBackend = false;
        var changedOnMemory = false;
        var changedFacets = false;

        // verify if filters on backend are changed since last query
        if (my.firstFetchExecuted == null ||
            !_.isEqual(my.queryStateOnBackend.attributes.filters, tmpQueryStateOnBackend.attributes.filters)) {
            my.queryStateOnBackend = tmpQueryStateOnBackend;
            changedOnBackend = true;
            my.firstFetchExecuted = true;
        }

        // verify if filters on memory are changed since last query
        if((dataset.inMemoryQueryFields && dataset.inMemoryQueryFields.length> 0
            && !_.isEqual(my.queryStateInMemory.attributes.filters, tmpQueryStateInMemory.attributes.filters))
            )
        {
            my.queryStateInMemory = tmpQueryStateInMemory;
            changedOnMemory = true;
        }

        // verify if facets are changed
        if(queryObj.facets && !_.isEqual(my.queryStateInMemory.attributes.facets, queryObj.facets)) {
            my.queryStateInMemory.attributes.facets = queryObj.facets;
            changedFacets = true;
        }


        if(changedOnBackend) {
            var data = buildRequestFromQuery(my.queryStateOnBackend);
            console.log("Querying backend for ");
            console.log(data);
            return requestJson(dataset, data);
        }

        if(my.inMemoryStore == null) {
            throw "No memory store available for in memory query, execute initial load"
        }

        var dfd = $.Deferred();
        dfd.resolve(applyInMemoryFilters());
        return dfd.promise();



    };

    function isArrayEquals(a,b) { return !(a<b || b<a); };


    function requestJson(dataset, data) {
        var dfd = $.Deferred();

        var jqxhr = $.ajax({
          url: dataset.url,
          dataType: 'jsonp',
          jsonpCallback: dataset.id,
          data: data,
          cache: true
      });

     _wrapInTimeout(jqxhr).done(function(results) {

          // verify if returned data is not an error
          if (results.results.length != 1 || results.results[0].status.code != 0) {
              console.log("Error in fetching data: " + results.results[0].status.message + " Statuscode:[" + results.results[0].status.code + "]" );

              dfd.reject(results.results[0].status);
          } else
          dfd.resolve(_handleJsonResult(results.results[0].result));

      })
          .fail(function(arguments) {
              dfd.reject(arguments);
          });

        return dfd.promise();

  };

    function _handleJsonResult(data) {
        if(data.description) {
            my.memoryFields = _handleFieldDescription(data.description);
        }

      // Im fetching only record description
      if(data.data == null) {
          return prepareReturnedData(data);
      }

      var result = data;


      if(my.useMemoryStore) {
          // check if is the first time I use the memory store
          my.inMemoryStore = new recline.Backend.Memory.Store(result.data, _handleFieldDescription(result.description));
          my.data = my.inMemoryStore.data;
          return applyInMemoryFilters();

      }
      else {
          // no need to query on memory, return json data
          return prepareReturnedData(result);
     }

  };


    function applyInMemoryFilters() {

        var tmpValue;

        my.inMemoryStore.query(my.queryStateInMemory.toJSON())
            .done(function(value) {
                tmpValue = value;
                tmpValue["fields"] = my.memoryFields;
            });


        return tmpValue;
    };

    function prepareReturnedData(data) {

        if(data.hits == null)


            if(data.data == null) {

            return {
                fields: my.memoryFields,
                useMemoryStore: false
            }
           }
        else
            {

                return {
                    hits: _normalizeRecords(data.data, my.memoryFields ),
                    fields:my.memoryFields,
                    useMemoryStore: false
                }
            }

        return data;
    };

    // convert each record in native format
    // todo verify if could cause performance problems
    function _normalizeRecords(records, fields) {

        _.each(fields, function(f) {
            if(f != "string")
                _.each(records, function(r) {
                    r[f.id] = recline.Data.FormattersMODA[f.type](r[f.id]);
                })
        });

        return records;

    };



    // todo should be in backend
    function getDate(temp) {
        var tmp = new Date();

        var dateStr = padStr(temp.getFullYear()) + "-"  +
            padStr(1 + temp.getMonth()) + "-"  +
            padStr(temp.getDate()) + " " +
            padStr(temp.getHours()) + ":"+
            padStr(temp.getMinutes()) + ":" +
            padStr(temp.getSeconds());
        return dateStr;
    }

    function padStr(i) {
        return (i < 10) ? "0" + i : "" + i;
    }


  function  buildRequestFromQuery(queryObj)  {
      var self=this;
      var filters = queryObj.get("filters");
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
          date   : function (e) {
              var tmp = new Date(e);
              //console.log("---> " + e  + " ---> "+ getDate(tmp)) ;
              return getDate(tmp);

              // return new Date(e).valueOf()
          },
          integer : function(e) { return parseInt(e); }
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
      var outdata = {};
      if(data.length > 0)
        outdata["filters"] = data.toString();

      return outdata;

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
          INTEGER: "integer",
          DOUBLE : "number"
      };


      var res = [];
      for (var k in description) {

              res.push({id:k, type: dataMapping[description[k]]});
        }

      return res;
    }



}(jQuery, this.recline.Backend.Jsonp));
this.recline = this.recline || {};
this.recline.Backend = this.recline.Backend || {};
this.recline.Backend.Memory = this.recline.Backend.Memory || {};

(function ($, my) {
    my.__type__ = 'memory';

    // ## Data Wrapper
    //
    // Turn a simple array of JS objects into a mini data-store with
    // functionality like querying, faceting, updating (by ID) and deleting (by
    // ID).
    //
    // @param data list of hashes for each record/row in the data ({key:
    // value, key: value})
    // @param fields (optional) list of field hashes (each hash defining a field
    // as per recline.Model.Field). If fields not specified they will be taken
    // from the data.
    my.Store = function (data, fields) {
        var self = this;
        this.data = data;
        this.distinctFieldsValues = {};

        if (fields) {
            this.fields = fields;
        } else {
            if (data) {
                this.fields = _.map(data[0], function (value, key) {
                    return {id:key, type:'string'};
                });
            }
        }

        this.update = function (doc) {
            _.each(self.data, function (internalDoc, idx) {
                if (doc.id === internalDoc.id) {
                    self.data[idx] = doc;
                }
            });
        };

        this.remove = function (doc) {
            var newdocs = _.reject(self.data, function (internalDoc) {
                return (doc.id === internalDoc.id);
            });
            this.data = newdocs;
        };

        this.save = function (changes, dataset) {
            var self = this;
            var dfd = $.Deferred();
            // TODO _.each(changes.creates) { ... }
            _.each(changes.updates, function (record) {
                self.update(record);
            });
            _.each(changes.deletes, function (record) {
                self.remove(record);
            });
            dfd.resolve();
            return dfd.promise();
        },

            this.query = function (queryObj) {
                var dfd = $.Deferred();
                var numRows = queryObj.size || this.data.length;
                var start = queryObj.from || 0;
                var results = this.data;

                results = recline.Data.Filters.applyFiltersOnData(queryObj.filters, results, this.fields);
                results = this._applyFreeTextQuery(results, queryObj);

                // TODO: this is not complete sorting!
                // What's wrong is we sort on the *last* entry in the sort list if there are multiple sort criteria
                _.each(queryObj.sort, function (sortObj) {
                    var fieldName = sortObj.field;
                    results = _.sortBy(results, function (doc) {
                        var _out = doc[fieldName];
                        return _out;
                    });
                    if (sortObj.order == 'desc') {
                        results.reverse();
                    }
                });
                var facets = this.computeFacets(results, queryObj);
                var out = {
                    total:results.length,
                    hits:results.slice(start, start + numRows),
                    facets:facets
                };
                dfd.resolve(out);
                return dfd.promise();
            };


        this.getFacetsOnUnfilteredData = function (queryObj) {
            if (this.queryObj != null && !_.isEqual(queryObj.facets, this.queryObj) && this.unfilteredFacets != null)
                return this.unfilteredFacets;

            this.queryObj = queryObj;
            this.unfilteredFacets = this.computeFacets(this.data, queryObj);

            return this.unfilteredFacets;
        };

        // we OR across fields but AND across terms in query string
        this._applyFreeTextQuery = function (results, queryObj) {
            if (queryObj.q) {
                var terms = queryObj.q.split(' ');
                var patterns = _.map(terms, function (term) {
                    return new RegExp(term.toLowerCase());
                    ;
                });
                results = _.filter(results, function (rawdoc) {
                    var matches = true;
                    _.each(patterns, function (pattern) {
                        var foundmatch = false;
                        _.each(self.fields, function (field) {
                            var value = rawdoc[field.id];
                            if ((value !== null) && (value !== undefined)) {
                                value = value.toString();
                            } else {
                                // value can be null (apparently in some cases)
                                value = '';
                            }
                            // TODO regexes?
                            foundmatch = foundmatch || (pattern.test(value.toLowerCase()));
                            // TODO: early out (once we are true should break to spare unnecessary testing)
                            // if (foundmatch) return true;
                        });
                        matches = matches && foundmatch;
                        // TODO: early out (once false should break to spare unnecessary testing)
                        // if (!matches) return false;
                    });
                    return matches;
                });
            }
            return results;
        };

        this.computeFacets = function (records, queryObj) {
            var self = this;
            var facetResults = {};
            if (!queryObj.facets) {
                return facetResults;
            }
            _.each(queryObj.facets, function (query, facetId) {
                // TODO: remove dependency on recline.Model
                facetResults[facetId] = new recline.Model.Facet({id:facetId}).toJSON();
                facetResults[facetId].termsall = {};
            });
            // faceting
            _.each(records, function (doc) {
                _.each(queryObj.facets, function (query, facetId) {
                    var fieldId = query.terms.field;
                    var val = doc[fieldId];
                    var tmp = facetResults[facetId];
                    if (val) {
                        tmp.termsall[val] = tmp.termsall[val] ? {count:tmp.termsall[val].count + 1, value:val} : {count:1, value:val};
                    } else {
                        tmp.missing = tmp.missing + 1;
                    }
                });
            });

            // if all_terms is specified add terms not presents
            this.updateDistinctFieldsForFaceting(queryObj);

            _.each(queryObj.facets, function (query, facetId) {
                var tmp = facetResults[facetId];

                var termsWithZeroCount =
                    _.difference(
                        self.distinctFieldsValues[facetId],
                        _.map(tmp.termsall, function (d) {
                            return d.value
                        })
                    );

                _.each(termsWithZeroCount, function (d) {
                    tmp.termsall[d] = {count:0, value:d};
                });

            });


            _.each(queryObj.facets, function (query, facetId) {
                var tmp = facetResults[facetId];
                var terms = _.map(tmp.termsall, function (res, term) {
                    return { term:res.value, count:res.count };
                });
                tmp.terms = _.sortBy(terms, function (item) {
                    // want descending order
                    return -item.count;
                });
            });


            return facetResults;
        };


        //update uniq values for each terms present in facets with value all_terms
        this.updateDistinctFieldsForFaceting = function (queryObj) {
            var self = this;
            if (this.distinctFieldsValues == null)
                this.distinctFieldsValues = {};

            var fieldsToBeCalculated = [];

            _.each(queryObj.facets, function (query, fieldId) {
                if (query.terms.all_terms && self.distinctFieldsValues[fieldId] == null) {
                    fieldsToBeCalculated.push(fieldId);
                }
            });

            if (fieldsToBeCalculated.length > 0) {
                _.each(fieldsToBeCalculated, function (d) {
                    self.distinctFieldsValues[d] = []
                });

                _.each(self.data, function (d) {
                    _.each(fieldsToBeCalculated, function (field) {
                        self.distinctFieldsValues[field].push(d[field]);
                    });
                });
            }

            _.each(fieldsToBeCalculated, function (d) {
                self.distinctFieldsValues[d] = _.uniq(self.distinctFieldsValues[d])
            });

        };

        this.transform = function (editFunc) {
            var toUpdate = recline.Data.Transform.mapDocs(this.data, editFunc);
            // TODO: very inefficient -- could probably just walk the documents and updates in tandem and update
            _.each(toUpdate.updates, function (record, idx) {
                self.data[idx] = record;
            });
            return this.save(toUpdate);
        };

        this.getDataParser = function (filter) {

            var keyedFields = {};
            _.each(self.fields, function (field) {
                keyedFields[field.id] = field;
            });


            var field = keyedFields[filter.field];
            var fieldType = 'string';

            if (field == null) {
                console.log("Warning could not find field " + filter.field + " for dataset ");
                console.log(self);
            }
            else
                fieldType = field.type;
            return recline.Backend.Memory.dataParsers[fieldType];
        };

        this.filterFunctions = {
            term:function (record, filter, storeInstance) {

                var parse = storeInstance.getDataParser(filter);
                var value = parse(record[filter.field]);
                var term = parse(filter.term);

                return (value === term);
            },

            range:function (record, filter, storeInstance) {

                var parse = storeInstance.getDataParser(filter);
                var value = self(record[filter.field]);
                var start = parse(filter.start);
                var stop = parse(filter.stop);

                return (value >= start && value <= stop);
            }

        };

    };


}(jQuery, this.recline.Backend.Memory));
this.recline = this.recline || {};
this.recline.Backend = this.recline.Backend || {};
this.recline.Backend.Solr = this.recline.Backend.Solr || {};

(function($, my) {
  my.__type__ = 'solr';

  // ### fetch
  //
  // dataset must have a solr or url attribute pointing to solr endpoint
  my.fetch = function(dataset) {
    var jqxhr = $.ajax({
      url: dataset.solr || dataset.url,
      data: {
        rows: 1,
        wt: 'json'
      },
      dataType: 'jsonp',
      jsonp: 'json.wrf'
    });
    var dfd = $.Deferred();
    jqxhr.done(function(results) {
      // if we get 0 results we cannot get fields
      var fields = []
      if (results.response.numFound > 0) {
        fields =  _.map(_.keys(results.response.docs[0]), function(fieldName) {
          return { id: fieldName };
        });
      }
      var out = {
        fields: fields,
        useMemoryStore: false
      };
      dfd.resolve(out);
    });
    return dfd.promise();
  }

  // TODO - much work on proper query support is needed!!
  my.query = function(queryObj, dataset) {
    var q = queryObj.q || '*:*';
    var data = {
      q: q,
      rows: queryObj.size,
      start: queryObj.from,
      wt: 'json'
    };
    var jqxhr = $.ajax({
      url: dataset.solr || dataset.url,
      data: data,
      dataType: 'jsonp',
      jsonp: 'json.wrf'
    });
    var dfd = $.Deferred();
    jqxhr.done(function(results) {
      var out = {
        total: results.response.numFound,
        hits: results.response.docs
      };
      dfd.resolve(out);  
    });
    return dfd.promise();
  };

}(jQuery, this.recline.Backend.Solr));
this.recline = this.recline || {};
this.recline.View = this.recline.View || {};

(function ($, view) {
	
	"use strict";	

	view.d3 = view.d3 || {};

    view.d3.Sparkline = Backbone.View.extend({
        template: '<div id="{{uid}}" style="width: {{width}}px; height: {{height}}px;"> <div> ',

        initialize: function (options) {

            this.el = $(this.el);
    		_.bindAll(this, 'render', 'redraw');
                     

            this.model.bind('change', this.render);
            this.model.fields.bind('reset', this.render);
            this.model.fields.bind('add', this.render);

            this.model.bind('query:done', this.redraw);
            this.model.queryState.bind('selection:done', this.redraw);


			$(window).resize(this.resize);
            this.uid = options.id || ("d3_" + new Date().getTime() + Math.floor(Math.random() * 10000)); // generating an unique id for the chart
            this.width = options.width;
            this.height = options.height;

            if(!this.options.animation) {
                this.options.animation = {
                    duration: 2000,
                    delay: 200
                }
            }

            //render header & svg container
            var out = Mustache.render(this.template, this);
            this.el.html(out);

        },
        
        resize: function(){

        },

        render: function () {
            var self=this;
            var graphid="#" + this.uid;

            if(self.graph)
                jQuery(graphid).empty();

            self.graph = d3.select(graphid)
                .append("svg:svg")
                .attr("width", "100%")
                .attr("height", "100%")
                .style("stroke", function() { return self.options.color || "steelblue"; })
                .style("stroke-width", 1)
                .style("fill", "none");
        },

        redraw: function () {     
            console.log("redraw");
            var field = this.model.fields.get(this.options.field);
            var records = _.map(this.options.model.getRecords(this.options.resultType.type), function(record) {
                return record.getFieldValueUnrendered(field);
            });



            this.drawD3(records, "#" + this.uid);
        },
        drawD3: function(data, graphid) {
            var self=this;


                // X scale will fit values from 0-10 within pixels 0-100
            var x = d3.scale.linear().domain([0, data.length]).range([0, this.width]);
            // Y scale will fit values from 0-10 within pixels 0-100
            var y = d3.scale.linear().domain([_.min(data), _.max(data)]).range([0, this.height]);

            // create a line object that represents the SVN line we're creating
            var line = d3.svg.line()
                // assign the X function to plot our line as we wish
                .x(function(d,i) {
                    // verbose logging to show what's actually being done
                    //console.log('Plotting X value for data point: ' + d + ' using index: ' + i + ' to be at: ' + x(i) + ' using our xScale.');
                    // return the X coordinate where we want to plot this datapoint
                    return x(i);
                })
                .y(function(d) {
                    // verbose logging to show what's actually being done
                    //console.log('Plotting Y value for data point: ' + d + ' to be at: ' + y(d) + " using our yScale.");
                    // return the Y coordinate where we want to plot this datapoint
                    return y(d);
                })


            // display the line by appending an svg:path element with the data line we created above
            if(self.alreadyDrawed)
                self.graph.select("path").transition().duration(self.options.animation.duration).delay(self.options.animation.delay).attr("d", line(data));
            else
                self.graph.append("svg:path").attr("d", line(data));

            self.alreadyDrawed = true;
        }

    });
})(jQuery, recline.View);this.recline = this.recline || {};
this.recline.View = this.recline.View || {};

(function ($, view) {
	
	"use strict";	

	var fetchRecordValue = function(record, dimension){
		var val = null;		
		dimension.fields.forEach(function(field, i){
			if(i==0) val = record.getFieldValue(field);
			else val+= record.getFieldValue(field);
		});
		return val;
	};

	var frv = fetchRecordValue;
	
	var rowClick = function(actions, activeRecords){
				
		return function(row){
			if(actions.length && row){
				//console.log("rowClick");	
						
				var ctrlKey = d3.event.ctrlKey;
				var adding = !d3.select(d3.event.target.parentNode).classed("info");

				if(adding){
					if(ctrlKey){
						activeRecords.push(row);
					}else{
						activeRecords = [row];
					}
				}else{
					if(ctrlKey){
						activeRecords = _.difference(activeRecords, [row]);
					}else{
						activeRecords = [];
					}
				}
				
				actions.forEach(function(actioncontainer){				
					actioncontainer.action.doAction(activeRecords, actioncontainer.mapping);
				});
								
				
			}		
		};
	};
	
	var rowOver = function(actions,activeRecords){
		return function(row){
			if(actions.length && row){
                activeRecords = [];
                activeRecords.push(row);

                actions.forEach(function(actioncontainer){
                    actioncontainer.action.doAction(activeRecords, actioncontainer.mapping);
                });
			}
		};		
	};
	
	var scrollBarWidth = function(){
		  document.body.style.overflow = 'hidden'; 
		  var width = document.body.clientWidth;
		  document.body.style.overflow = 'scroll'; 
		  width -= document.body.clientWidth; 
		  if(!width) width = document.body.offsetWidth - document.body.clientWidth;
		  document.body.style.overflow = ''; 
		  return width; 
	};

	var sort=function(rowHeight, tableId) {
	    return function (dimension) {
	        var dimensionName = dimension.fields[0].id,
	            descending = d3.select(this)
	                .classed("g-ascending");

	        d3.selectAll(".g-descending")
	            .classed("g-descending", false);
	        d3.selectAll(".g-ascending")
	            .classed("g-ascending", false);

	        if (!descending) {
	            d3.select(this)
	                .classed("g-ascending", true);
	            var orderQuantitative = function (a, b) {
	                return (isNaN(frv(a, dimension)) - isNaN(frv(b, dimension))) || (frv(a, dimension) - frv(b, dimension)) || (a.index - b.index);
	            };

	            var orderName = function (a, b) {
	                return b.name.localeCompare(a.name);
	            };
	        } else {
	            d3.select(this)
	                .classed("g-descending", true);

	            var orderQuantitative = function (a, b) {
	                return (isNaN(frv(b, dimension)) - isNaN(frv(a, dimension))) || (frv(b, dimension) - frv(a, dimension)) || (b.index - a.index);
	            };

	            var orderName = function (a, b) {
	                return a.name.localeCompare(b.name);
	            };
	        }

	        d3.selectAll("#"+tableId+" .g-tbody .g-tr")
	            .sort(dimensionName === "name" ? orderName : orderQuantitative)
	            .each(function (record, i) {
	            record.index = i;
	        })
	            .transition()
	            .delay(function (record, i) {
	            return (i - 1) * 10;
	        })
	            .duration(750)
	            .attr("transform", function (record, i) {
	            return "translate(0," + i * rowHeight + ")";
	        });
	    }
	};
	
	var computeWidth=function(view){		
		var tbodycontainer =  d3.select('#'+view.graphId+' .g-tbody-container');
		var thead = view.el.find('.g-thead');
		var tbody = d3.select('#'+view.graphId +' .g-tbody');
		var tfoot = d3.select('#'+view.graphId +' .g-tfoot');
		
		var translationAcc = 0;
		var translationRectAcc = 0;
		
		return d3.sum(view.columns, function(column, i){
            	var th = thead.find('.g-th:nth-child('+(i+1)+')');
            	column.padding_left = parseInt(th.css("padding-left").replace("px", ""));
                column.padding_right = parseInt(th.css("padding-right").replace("px", ""));
                column.computed_width = th.outerWidth(true);               

				column.fields.forEach(function (field, fieldI) {
					field.width = column.width;
					field.computed_width = column.computed_width;					
				});
	           
				var transl = translationAcc;
				translationAcc += column.computed_width;
				column.translation = transl;
				
				if (column.scale) {
                	var scale = column.scale(view.model.records.models, column.computed_width, (column.range || 1.0));
                    //dimension.scale = scale.scale; //mantain the orginal function
                    column.d3scale = scale.scale;
                    column.axisScale = scale.axisScale;
                    column.fields.forEach(function (field, i) {
                        field.scale = column.d3scale;
                        field.axisScale = column.axisScale[field.id];
                    });
                }
						
            	return column.computed_width;
            });
	};
	
	view.d3 = view.d3 || {};

    view.d3.table = Backbone.View.extend({
        className: 'recline-table-editor',
        template: ' \
  				<div id="{{graphId}}" class="g-table g-table-hover g-table-striped g-table-bordered"> \
  					<h2 class="g-title">{{title}}</h2> \
  					<p class="lead">{{instructions}}</p> \
  					<small>{{summary}}</small> \
  				\
  				<div> \
  				\
  			',
        templateHeader: ' \
        			<div class="g-thead"> \
  						<div class="g-tr"> \
  							{{#columns}} \
  							<div class="g-th {{#sortable}}g-sortable{{/sortable}}" style="width: {{hwidth}}"><div>{{label}}</div></div> \
  							{{/columns}} \
  						</div> \
  					</div> \
  					\
  					',
        templateBody: ' \
  					<div class="g-tbody-container" style="width:{{scrollWidth}}px; height:{{height}}px;"> \
  						<div style="width:{{width}}px;"> \
  							<svg class="g-tbody"> \
							</svg> \
						</div> \
					</div> \
					\
  					',
        templateFooter: '\
  					<div class="g-tfoot-container"> \
						<svg class="g-tfoot"> \
						</svg> \
					</div> \
					\
					',
        events: {
            'click .g-thead': 'onEvent'
        },
        initialize: function (options) {
            
            _.defaults(options.conf,{"row_height": 20, "height":200});
            options.actions = options.actions || [];
            this.el = $(this.el);
    		_.bindAll(this, 'render', 'redraw', 'refresh', 'resize');
                     
            this.rowHeight = options.conf.row_height;
            
            var clickActions=[], hoverActions=[];
            //processing actions
            {
            	options.actions.forEach(function(action){
            		action.event.forEach(function(event){
            			if(event==='selection') clickActions.push(action);
            			else if(event==='hover')  hoverActions.push(action);
            		});
            	});
            }           
            
            this.clickActions = clickActions;
            this.hoverActions = hoverActions; 

            this.model.bind('change', this.render);
            this.model.fields.bind('reset', this.render);
            this.model.fields.bind('add', this.render);

            this.model.bind('query:done', this.redraw);
            this.model.queryState.bind('selection:done', this.redraw);


			$(window).resize(this.resize);

			//create a nuew columns array with default values 
            this.columns = _.map(options.columns, function (column) {
                return _.defaults(column, {
                    label: "",
                    type: "text",
                    sortable: false,
                    fields: {}
                });
            });
            
            //render table  				
            this.columns.forEach(function (column, i) {
            	column.width = column.width || 160;
                column.hwidth = column.width;
            }, this);
            
            this.height = options.conf.height;
            this.title = options.title;
            this.summary = options.summary;
            this.instructions = options.instructions;
            this.graphId = options.id || 'd3table_'+Math.floor(Math.random()*1000);

            //render header & svg container
            var out = Mustache.render(this.template, this);
            this.el.html(out);
            this.el.find('#'+this.graphId).append(Mustache.render(this.templateHeader, this));
            
            this.width = options.conf.width;
            //this.render(); 								
        },
        
        resize: function(){
        	console.log('resize');
        	var tbodycontainer =  d3.select('#'+this.graphId+' .g-tbody-container');
        	var tbody = d3.select('#'+this.graphId +' .g-tbody');
        	var tfoot = d3.select('#'+this.graphId +' .g-tfoot');
        	        	
        	this.width = computeWidth(this);            
            this.scrollWidth = scrollBarWidth()+this.width;            
            
            this.el.find('.g-tbody-container').css('width',this.scrollWidth);
            this.el.find('.g-tbody-container > div').css('width',this.width);
            
            var row = tbodycontainer.select('.g-tbody')
                .selectAll(".g-tr");
                
            row.each(function (record) {
            	 var cell = d3.select(this)
                    .selectAll(".g-td").attr("transform", function (dimension, i) {
                    	return "translate(" + (dimension.translation+dimension.padding_left) + ")";
                	});
                	
                
            	//move and resize barchart
            					//barchart               
                var barChartCell = cell.filter(function (dimension) {           	
                    return dimension.scale && dimension.type === 'barchart';
                });
                barChartCell.selectAll(".g-bar").attr("width", function (field, index) {
                    	return field.scale(record.getFieldValue(field));
               		})
                    .attr("transform", function (field, i) {
                    	                    	
	                    var translation = Math.ceil((i === 0) ? ((field.computed_width) / 2) - field.scale(record.getFieldValue(field)) : i * (field.computed_width) / 2);
	
	                    if (i == 0) {
	                        return "translate(" + translation + ")";
	                    } else {
	                        return "translate(" + translation + ")";
	                    }
                	});            	
            });   
                 
            //move vertical lines
            {
            	tbodycontainer.select('.g-tbody').selectAll(".g-column-border").attr("class", "g-column-border").attr("transform", function(dimension) {
					return "translate(" + (dimension.translation) + ",0)";
				}).attr("y2", "100%");
            }     
            
            //move compare lines
            tbodycontainer.select('.g-tbody').selectAll(".g-compare").data(this.columns.filter(function(column) {
				return column.scale;
			})).attr("transform", function(column) {
				return "translate(" + (column.translation+column.padding_left+column.computed_width/2) + ",0)";
			}).attr("y2", "100%");        
            
            //move axis
            {
            	var axisRow = d3.select('#'+this.graphId+' .g-tfoot');
	            
	            var cell = axisRow.selectAll('.g-td')
	                    .attr("width", function (dimension, i) {
	                    	return (dimension.computed_width);
	                	})
	                	.attr("transform", function (dimension, i) {
	                    	return "translate(" + (dimension.translation+dimension.padding_left)+ ")";
                		});
	            
	            var barChartCell = cell.filter(function (dimension) {
                    return dimension.scale && dimension.type === 'barchart';
                });
                
				barChartCell.selectAll(".g-axis").remove();
                
				var fieldNum;
                var range;	
				barChartCell.selectAll(".g-axis").data(function (dimension) {
                		fieldNum = dimension.fields.length;
                		range = dimension.range;
                    	return dimension.fields;
               	  })
               	  .enter()
               	  .append('g')
               	  .attr('class', function(field,i){
               	  	return 'g-axis';
               	  })
               	  .attr("transform", function (field, i) {
               	  			var trans = 0;
               	  			var w = field.computed_width/fieldNum;
               	  			            	  			
               	  			if(i==0) trans = w - w*range;
               	  			else trans = i * w;
               	  			
               	  			return "translate(" + trans + ")";
                		})
               	  .each(function(field, i){
               	  		var axis = d3.svg.axis().scale(field.axisScale).ticks(Math.abs(field.axisScale.range()[1] - field.axisScale.range()[0]) / 80).orient("bottom");
               	  		d3.select(this).call(axis);
               	  	});
                             	  	
           }          		    
           
            
        },
        refresh: function() {
			console.log('d3Table.refresh');

        },
        reset: function () {
            console.log('d3Table.reset');
        },
        render: function () {
            console.log('d3Table.render');
            
            //render table divs            
            //manage width and scrolling
			this.width = computeWidth(this);
            this.scrollWidth = scrollBarWidth()+this.width;
            
            //compile mustache templates
            this.el.find('#'+this.graphId).append(Mustache.render(this.templateBody, this)).append(Mustache.render(this.templateFooter, this));
            
			//merge columns with dimensions
            this.columns.forEach(function (column, i) {
                column.fields = recline.Data.Aggregations.intersectionObjects('id', column.fields, this.model.fields.models);
                column.index = i;
            }, this);
        },
        redraw: function () {     
            console.log('d3Table.redraw');   
            
            var rowHeight = this.rowHeight;
            var columns = this.columns;
            var records = this.model.records.models;
            var activeRecords = []; 
            
			records.forEach(function (record, i) {
                record.index = i;
                if(record.isRecordSelected()) activeRecords.push(record);
            });
            
            //manage width and scrolling
			this.width = computeWidth(this); //this function compute width for each cells and adjust scales
            this.scrollWidth = scrollBarWidth()+this.width;
            
            var tbodycontainer = d3.select('#'+this.graphId+' .g-tbody-container');
            
            tbodycontainer.select('div').style('height',(rowHeight)*records.length+'px');            
            tbodycontainer.classed('g-tbody-container-overflow',(rowHeight)*records.length>this.height);
            
            tbodycontainer.selectAll('.g-tbody .g-tr').remove();            			
            var row = tbodycontainer.select('.g-tbody')
              .selectAll(".g-tr")
              .data(records)
              .enter()
              .append("g")
                .attr("class", "g-tr")
                .attr("transform", function (record, i) {
                	return "translate(0," + i * (rowHeight) + ")";
            	}).classed('info',function(record, i){
            		return record.isRecordSelected();
            	});

            row.append("rect")
                .attr("class", "g-background")
                .attr("width", "100%")
                .attr("height", rowHeight)
                .on('click', rowClick(this.clickActions, activeRecords))
                .on('mouseover', rowOver(this.hoverActions, activeRecords));

            row.each(function (record) {
								
                var cell = d3.select(this)
                  .selectAll(".g-td")
                  .data(columns)
                  .enter()
                  .append("g")
                    .attr("class", "g-td")
                    .classed("g-quantitative", function (dimension) {
                    	return dimension.scale;
                	}).classed("g-categorical", function (dimension) {
                    	return dimension.categorical;
                	}).attr("transform", function (dimension, i) {
                    	return "translate(" + (dimension.translation+dimension.padding_left) + ")";
                	});
                	
                //horizontal lines
               	d3.select(this).append('line').attr('class', 'g-row-border').attr('y1',rowHeight).attr('y2',rowHeight).attr('x2','100%');
               
				//barchart               
                var barChartCell = cell.filter(function (dimension) {           	
                    return dimension.scale && dimension.type === 'barchart';
                });
                barChartCell.selectAll(".g-bar")
                  .data(function (dimension) {
                    	return dimension.fields;
               	  })
                  .enter()
                  .append("rect")
                    .attr("class", "g-bar")
                    .attr("width", function (field, index) {
                    	return field.scale(record.getFieldValue(field));
               		})
                    .attr("height", rowHeight-1)
                    .attr("transform", function (field, i) {
                    	                    	
	                    var translation = Math.ceil((i === 0) ? ((field.computed_width) / 2) - field.scale(record.getFieldValue(field)) : i * (field.computed_width) / 2);
												
	                    if (i == 0) {
	                        return "translate(" + translation + ")";
	                    } else {
	                        return "translate(" + translation + ")";
	                    }
                	})
                    .style("fill", function (field, index) {
                    	return field.color;
                	});


                cell.filter(function (dimension) {           	
                    return !dimension.scale;
                }).append("text")
                    .attr("class", "g-value")
                    .attr("x", function (dimension) {
                    return dimension.scale ? 3 : 0;
                })
                    .attr("y", function (dimension) {
                    return dimension.categorical ? 9 : 10;
                })
                    .attr("dy", ".35em")
                    .classed("g-na", function (dimension) { //null values
                    return frv(record, dimension) === undefined;
                })
                    .text(function (dimension) {
                    return frv(record, dimension);
                })
                    .attr("clip-path", function (dimension) {
                    return (dimension.clipped = this.getComputedTextLength() > ((dimension.computed_width))-20) ? "url(#g-clip-cell)" : null;
                });

                cell.filter(function (dimension) {
                    return dimension.clipped;
                }).append("rect")
                    .style("fill", "url(#g-clip-gradient)")
                    .attr("x", function (dimension) {
                    	return dimension.hwidth;
                	})
                    .attr("width", 20)
                    .attr("height", rowHeight);
            });
            
            //axis management
            {
				var tfoot = d3.select('#'+this.graphId+' .g-tfoot');
				tfoot.selectAll('.axisRow').remove();						
				var axisRow = tfoot.append("g")
	                .attr("class", "axisRow");
	                	            
	            var cell = axisRow.selectAll('.g-td').data(columns).enter().append('g')
	                    .attr("class", "g-td")
	                    .attr("width", function (dimension, i) {
	                    	return (dimension.computed_width);
	                	})
	                	.attr("transform", function (dimension, i) {
	                    	return "translate(" + (dimension.translation+dimension.padding_left)+ ")";
                		});
	            
	            var barChartCell = cell.filter(function (dimension) {
                    return dimension.scale && dimension.type === 'barchart';
                });
                
                var fieldNum;
                var range;
                barChartCell.selectAll(".g-axis").data(function (dimension) {
                		fieldNum = dimension.fields.length;
                		range = dimension.range;
                    	return dimension.fields;
               	  })
               	  .enter()
               	  .append('g')
               	  .attr('class', function(field,i){
               	  	return 'g-axis';
               	  })
               	  .attr("transform", function (field, i) {
               	  			var trans = 0;
               	  			var w = field.computed_width/fieldNum;
               	  			            	  			
               	  			if(i==0) trans = w - w*range;
               	  			else trans = i * w;
               	  			
               	  			return "translate(" + trans + ")";
                		})
               	  .each(function(field, i){
               	  		var axis = d3.svg.axis().scale(field.axisScale).ticks(Math.abs(field.axisScale.range()[1] - field.axisScale.range()[0]) / 80).orient("bottom");
               	  		d3.select(this).call(axis);
               	  	});        
               	  	
            }

			//add sorting
            d3.selectAll('#'+this.graphId+' .g-thead .g-th.g-sortable')
                .data(columns)
                .on("click", sort(rowHeight, this.graphId));    
                
            //vertical lines
            {
            	tbodycontainer.select('.g-tbody').selectAll(".g-column-border").remove();
            	tbodycontainer.select('.g-tbody').selectAll(".g-column-border").data(columns)
            	.enter().append("line").attr("class", "g-column-border").attr("transform", function(dimension) {
					return "translate(" + (dimension.translation) + ",0)";
				}).attr("y2", "100%");
            }            

			//axis lines
			{
				tbodycontainer.select('.g-tbody').selectAll(".g-compare").remove();
				tbodycontainer.select('.g-tbody').selectAll(".g-compare").data(columns.filter(function(dimension) {
					return dimension.scale;
				})).enter().append("line").attr("class", "g-compare").attr("transform", function(dimension) {
					return "translate(" + (dimension.translation+dimension.padding_left + dimension.computed_width/2) + ",0)";
				}).attr("y2", "100%"); 
			}
			
        },
        onEvent: function (e) {}
    });
})(jQuery, recline.View);this.recline = this.recline || {};
this.recline.View = this.recline.View || {};

(function ($, view) {
	
	"use strict";	

	view.d3 = view.d3 || {};

    view.d3.Treemap = Backbone.View.extend({
        template: '<div id="{{uid}}" style="width: {{width}}px; height: {{height}}px;"> <div> ',

        initialize: function (options) {

            this.el = $(this.el);
    		_.bindAll(this, 'render', 'redraw');
                     

            this.model.bind('change', this.render);
            this.model.fields.bind('reset', this.render);
            this.model.fields.bind('add', this.render);

            this.model.bind('query:done', this.redraw);
            this.model.queryState.bind('selection:done', this.redraw);


			$(window).resize(this.resize);
            this.uid = options.id || ("d3_" + new Date().getTime() + Math.floor(Math.random() * 10000)); // generating an unique id for the chart
            this.width = options.width;
            this.height = options.height;

            if(!this.options.animation) {
                this.options.animation = {
                    duration: 2000,
                    delay: 200
                }
            }

            //render header & svg container
            var out = Mustache.render(this.template, this);
            this.el.html(out);

        },
        
        resize: function(){

        },

        render: function () {
            var self=this;
            var graphid="#" + this.uid;

            if(self.graph)
                jQuery(graphid).empty();


            self.treemap = d3.layout.treemap()
                 .size([this.width, this.height])
                 .sticky(false)
                 .value(function(d) {
                    console.log(d);
                    return d.size; });

            self.color = d3.scale.category20c();



            self.div = d3.select(graphid).append("div")
                .style("position", "relative")
                .style("width", this.width + "px")
                .style("height", this.height + "px");
        },

        redraw: function () {     
            console.log("redraw");
            var fieldValue = this.model.fields.get(this.options.fieldValue);
            var fieldName = this.model.fields.get(this.options.fieldName);

            var records = _.map(this.options.model.getRecords(this.options.resultType.type), function(record) {
                return {name: record.getFieldValue(fieldName), size: record.getFieldValueUnrendered(fieldValue) };
            });



            this.drawD3(records, "#" + this.uid);
        },
        drawD3: function(data, graphid) {
            var self=this;

            function cell() {
                this
                    .style("left", function(d) { return d.x + "px"; })
                    .style("top", function(d) { return d.y + "px"; })
                    .style("width", function(d) { return Math.max(0, d.dx - 1) + "px"; })
                    .style("height", function(d) { return Math.max(0, d.dy - 1) + "px"; });
            }

            var leaves = self.treemap(data);


            _.each(data, function(x) {
                self.div.data([x]).selectAll("div")
                    .data(self.treemap.nodes)
                    .enter().append("div")
                    .attr("class", "cell")
                    .style("background", function(d) { self.color(d.name); })
                    .call(cell)
                    .text(function(d) {
                        console.log(d);
                        return d.name; });

            });






            // display the line by appending an svg:path element with the data line we created above
            /*if(self.alreadyDrawed)
                self.graph.select("path").transition().duration(self.options.animation.duration).delay(self.options.animation.delay).attr("d", line(data));
            else
                self.graph.append("svg:path").attr("d", line(data));
            */
            self.alreadyDrawed = true;
        }

    });
})(jQuery, recline.View);this.recline = this.recline || {};
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
        },
        ratioToReport: function (p, v) {},
        runningTotal: function (p, v) {}
    };

    my.Aggregations.initFunctions = {
        sum           : function () {},
        avg           : function () {},
        max           : function () {},
        min           : function () {},
        ratioToReport : function () {},
        runningTotal  : function () {}
    };

    my.Aggregations.resultingDataType = {
        sum           : function (original) { return original },
        avg           : function (original) { return "float"},
        max           : function (original) { return original},
        min           : function (original) { return original},
        ratioToReport : function (original) { return original},
        runningTotal  : function (original) { return original}
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
        max                     : function () {},
        min                     : function () {},
        ratioToReport           : function () {},
        runningTotal           : function () {}
    };

    my.Aggregations.tableCalculations = {
        ratioToReport : function (aggregatedFields, p, r, totalRecords) {
            _.each(aggregatedFields, function(f) {
                if(totalRecords[f + "_sum_sum"] > 0)
                    r[f + "_ratioToReport"]  = r[f + "_sum"] / totalRecords[f + "_sum_sum"];
            });
        },
        runningTotal : function (aggregatedFields, p, r, totalRecords) {
            _.each(aggregatedFields, function(f) {
                if(p)
                    r[f + "_runningTotal"]  =  r[f + "_sum"] + p[f + "_runningTotal"] ;
                else
                    r[f + "_runningTotal"] = r[f + "_sum"];
            });
            return r;
        }
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

    my.Aggregations.checkTableCalculation = function(aggregationFunctions, totalsConfig) {
      var tableCalc = _.intersection(aggregationFunctions, ["runningTotal", "ratioToReport"]);
      if(tableCalc.length > 0) {
          _.each(tableCalc, function(d) {
             if(!_.intersection(totalsConfig.aggregationFunctions, my.Aggregations.tableCalculationDependencies[d]))
                 throw "Data.Aggregation: unable to calculate " + d + ", totals aggregation function ["+ my.Aggregations.tableCalculationDependencies[d] + "] must be defined";
          });
      }

        return tableCalc;
    };

    my.Aggregations.tableCalculationDependencies =  {
        runningTotal: [],
        ratioToReport: ["sum"]
    };

})(this.recline.Data);// # Recline Backbone Models
this.recline = this.recline || {};
this.recline.Data = this.recline.Data || {};
this.recline.Data.ColorSchema = this.recline.Data.ColorSchema || {};

(function ($, my) {


    my.ColorSchema = Backbone.Model.extend({
        constructor:function ColorSchema() {
            Backbone.Model.prototype.constructor.apply(this, arguments);
        },

        // ### initialize
        initialize:function () {
            var self = this;


            if (this.attributes.data) {
                var data = this.attributes.data;
                self._generateLimits(data);
            } else if (this.attributes.dataset) {
                this.bindToDataset();
            } else if (this.attributes.fields) {
                var data = this.attributes.fields;
                this.attributes.type = "scaleWithDistinctData";
                self._generateLimits(data);
            }


            if (this.attributes.twoDimensionalVariation) {
                if (this.attributes.twoDimensionalVariation.data) {
                    var data = this.attributes.twoDimensionalVariation.data;
                    self._generateVariationLimits(data);
                } else if (this.attributes.twoDimensionalVariation.dataset) {
                    this.bindToVariationDataset();
                }
            }
        },

        // generate limits from dataset values
        bindToDataset:function () {
            var self = this;
            self.attributes.dataset.dataset.records.bind('reset', function () {
                self._generateFromDataset();
            });
            if (self.attributes.dataset.dataset.records.models.length > 0) {
                self._generateFromDataset();
            }
        },

        bindToVariationDataset:function () {
            var self = this;
            self.attributes.twoDimensionalVariation.dataset.dataset.records.bind('reset', function () {
                self._generateFromVariationDataset();
            });
            if (self.attributes.twoDimensionalVariation.dataset.dataset.records.models.length > 0) {
                self._generateFromVariationDataset();
            }
        },

        setDataset:function (ds, field, type) {
            var self = this;

            if (!ds.attributes["colorSchema"])
                ds.attributes["colorSchema"] = [];

            // if I'm bounded to a fields name I don't need to refresh upon model update and I don't need to calculate limits on data
            if (self.attributes.fields) {
                _.each(self.attributes.fields, function (s) {
                    ds.attributes["colorSchema"].push({schema:self, field:s});
                });
            } else {
                self.attributes.dataset = {dataset:ds, field:field, type:type};


                ds.attributes["colorSchema"].push({schema:self, field:field});
                self.bindToDataset();
            }

            ds.setColorSchema(type);


        },

        setVariationDataset:function (ds, field) {
            var self = this;
            self.attributes["twoDimensionalVariation"] = {dataset:{dataset:ds, field:field} };

            self.bindToVariationDataset();
        },

        _generateFromDataset:function () {
            var self = this;
            var data = this.getRecordsArray(self.attributes.dataset);
            self._generateLimits(data);

        },

        _generateFromVariationDataset:function () {
            var self = this;
            var data = this.getRecordsArray(self.attributes.twoDimensionalVariation.dataset);
            self._generateVariationLimits(data);
        },

        _generateLimits:function (data) {
            var self = this;
            switch (this.attributes.type) {
                case "scaleWithDataMinMax":
                    self.schema = new chroma.ColorScale({
                        colors:this.attributes.colors,
                        limits:this.limits["minMax"](data)
                    });
                    break;
                case "scaleWithDistinctData":
                    self.schema = new chroma.ColorScale({
                        colors:this.attributes.colors,
                        limits:this.limits["distinct"](data)
                    });
                    break;
                case "fixedLimits":
                    self.schema = new chroma.ColorScale({
                        colors:this.attributes.colors,
                        limits:this.attributes.limits
                    });
                    break;
                default:
                    throw "data.colors.js: unknown or not defined properties type " + this.attributes.type;
            }
        },

        getScaleType:function () {
            return this.attributes.type;
        },

        getScaleLimits:function () {
            return this.schema.limits;
        },

        _generateVariationLimits:function (data) {
            var self = this;
            self.variationLimits = this.limits["minMax"](data);
        },

        getColorFor:function (fieldValue) {
            var self = this;
            if (this.schema == null)
                throw "data.colors.js: colorschema not yet initialized, datasource not fetched?"


            return this.schema.getColor(recline.Data.Transform.getFieldHash(fieldValue));
        },

        getTwoDimensionalColor:function (startingvalue, variation) {
            if (this.schema == null)
                throw "data.colors.js: colorschema not yet initialized, datasource not fetched?"

            if (this.attributes.twoDimensionalVariation == null)
                return this.getColorFor(startingvalue);

            var endColor = '#000000';
            if (this.attributes.twoDimensionalVariation.type == "toLight")
                endColor = '#ffffff';


            var self = this;

            var tempSchema = new chroma.ColorScale({
                colors:[self.getColorFor(startingvalue), endColor],
                limits:self.variationLimits,
                mode:'hsl'
            });

            return tempSchema.getColor(variation);

        },

        getRecordsArray:function (dataset) {
            var self = this;
            var ret = [];

            if (dataset.dataset.isFieldPartitioned(dataset.field)) {
                var fields = dataset.dataset.getPartitionedFields(dataset.field);
                _.each(dataset.dataset.getRecords(dataset.type), function (d) {
                    _.each(fields, function (field) {
                        ret.push(d.attributes[field.id]);
                    });
                });
            }
            else {
                var fields = [dataset.field];
                ;
                _.each(dataset.dataset.getRecords(dataset.type), function (d) {
                    _.each(fields, function (field) {
                        ret.push(d.attributes[field]);
                    });
                });
            }


            return ret;
        },


        limits:{
            minMax:function (data) {
                var limit = [null, null];
                _.each(data, function (d) {
                    if (limit[0] == null)    limit[0] = d;
                    else                    limit[0] = Math.min(limit[0], d);

                    if (limit[1] == null)    limit[1] = d;
                    else                    limit[1] = Math.max(limit[1], d);
                });

                return limit;
            },
            distinct:function (data) {
                var tmp = [];
                _.each(_.uniq(data), function (d) {
                    tmp.push(recline.Data.Transform.getFieldHash(d));

                });
                return tmp;
            }

        }






    })
}(jQuery, this.recline.Data));
// # Recline Backbone Models
this.recline = this.recline || {};
this.recline.Data = this.recline.Data || {};
this.recline.Data.FieldsUtility = this.recline.Data.FieldsUtility || {};

(function($, my) {

    my.setFieldsAttributes = function(fields, model) {


        // if labels are declared in dataset properties merge it;
        if (model.attributes.fieldLabels) {
            for (var i = 0; i < fields.length; i++) {
                var tmp = _.find(model.attributes.fieldLabels, function (x) {
                    return x.id == fields[i].id;
                });
                if (tmp != null)
                    fields[i].label = tmp.label;

            }

        }

        // if format is desclared is updated
        if (model.attributes.fieldsFormat) {
            // if format is declared in dataset properties merge it;
            _.each(model.attributes.fieldsFormat, function (d) {
                var field = _.find(fields, function (f) {
                    return d.id === f.id
                });
                if (field != null)
                    field.format = d.format;
            })
        }


        // assignment of color schema to fields
        if (model.attributes.colorSchema) {
            _.each(model.attributes.colorSchema, function (d) {
                var field = _.find(fields, function (f) {
                    return d.field === f.id
                });
                if (field != null)
                    field.colorSchema = d.schema;
            })
        }

        // assignment of shapes schema to fields
        if (model.attributes.shapeSchema) {
            _.each(model.attributes.shapeSchema, function (d) {
                var field = _.find(fields, function (f) {
                    return d.field === f.id
                });
                if (field != null)
                    field.shapeSchema = d.schema;
            })
        }
    }


}(jQuery, this.recline.Data.FieldsUtility));
this.recline = this.recline || {};
this.recline.Data = this.recline.Data || {};

(function(my) {
// adapted from https://github.com/harthur/costco. heather rules

my.Filters = {};

    // in place filtering (records.toJSON must be passed)
    my.Filters.applyFiltersOnData = function(filters, records, fields) {
        // filter records
        return _.filter(records, function (record) {
            var passes = _.map(filters, function (filter) {
            	return recline.Data.Filters._isNullFilter[filter.type](filter) || recline.Data.Filters._filterFunctions[filter.type](record, filter, fields);
            });

            // return only these records that pass all filters
            return _.all(passes, _.identity);
        });
    };

    // in place filtering  (records model must be used)
    my.Filters.applyFiltersOnRecords = function(filters, records, fields) {
        // filter records
        return _.filter(records.models, function (record) {
            var passes = _.map(filters, function (filter) {
                return recline.Data.Filters._isNullFilter[filter.type](filter) || recline.Data.Filters._filterFunctions[filter.type](record.toJSON(), filter, fields.toJSON());
            });

            // return only these records that pass all filters
            return _.all(passes, _.identity);
        });
    };

    // data should be {records:[model], fields:[model]}
    my.Filters.applySelectionsOnData = function(selections, records, fields) {
        _.each(records, function(currentRecord) {
            currentRecord.setRecordSelection(false);

            _.each(selections, function(sel) {
                if(!recline.Data.Filters._isNullFilter[sel.type](sel) &&
                	recline.Data.Filters._filterFunctions[sel.type](currentRecord.attributes, sel, fields)) {
                    currentRecord.setRecordSelection(true);
                }
            });
        });


    },

    my.Filters._getDataParser =  function(filter, fields) {

        var keyedFields = {};
        var tmpFields;
        if(fields.models)
            tmpFields = fields.models;
        else
            tmpFields = fields;

        _.each(tmpFields, function(field) {
            keyedFields[field.id] = field;
        });


        var field = keyedFields[filter.field];
        var fieldType = 'string';

        if(field == null) {
            throw "data.filters.js: Warning could not find field " + filter.field + " for dataset " ;
        }
        else {
            if(field.attributes)
                fieldType = field.attributes.type;
            else
                fieldType = field.type;
        }
        return recline.Data.Filters._dataParsers[fieldType];
    },
    
    my.Filters._isNullFilter = {
    	term: function(filter){
    		return !filter["term"];
    	},
    	
    	range: function(filter){
    		return !(filter["start"] && filter["stop"]);
    		
    	},
    	
    	list: function(filter){
    		return !filter["list"];
    		
    	}
    },

        // in place filtering
        this._applyFilters = function(results, queryObj) {
            var filters = queryObj.filters;
            // register filters
            var filterFunctions = {
                term         : term,
                range        : range,
                geo_distance : geo_distance
            };
            var dataParsers = {
                integer: function (e) { return parseFloat(e, 10); },
                'float': function (e) { return parseFloat(e, 10); },
                string : function (e) { return e.toString() },
                date   : function (e) { return new Date(e).valueOf() },
                datetime   : function (e) { return new Date(e).valueOf() }
            };
            var keyedFields = {};
            _.each(self.fields, function(field) {
                keyedFields[field.id] = field;
            });
            function getDataParser(filter) {
                var fieldType = keyedFields[filter.field].type || 'string';
                return dataParsers[fieldType];
            }

            // filter records
            return _.filter(results, function (record) {
                var passes = _.map(filters, function (filter) {
                    return filterFunctions[filter.type](record, filter);
                });

                // return only these records that pass all filters
                return _.all(passes, _.identity);
            });


        };

    my.Filters._filterFunctions = {
        term: function(record, filter, fields) {
			var parse = recline.Data.Filters._getDataParser(filter, fields);
            var value = parse(record[filter.field]);
            var term  = parse(filter.term);

            return (value === term);
        },

        range: function (record, filter, fields) {
            var startnull = (filter.start == null || filter.start === '');
            var stopnull = (filter.stop == null || filter.stop === '');
            var parse = recline.Data.Filters._getDataParser(filter, fields);
            var value = parse(record[filter.field]);
            var start = parse(filter.start);
            var stop  = parse(filter.stop);

            // if at least one end of range is set do not allow '' to get through
            // note that for strings '' <= {any-character} e.g. '' <= 'a'
            if ((!startnull || !stopnull) && value === '') {
                return false;
            }
            return ((startnull || value >= start) && (stopnull || value <= stop));

        },

        list: function (record, filter, fields) {

            var parse =  recline.Data.Filters._getDataParser(filter, fields);
            var value = parse(record[filter.field]);
            var list  = filter.list;
            _.each(list, function(data, index) {
                list[index] = parse(data);
            });

            return (_.contains(list, value));
        },

        termAdvanced: function(record, filter, fields) {
            var parse =  recline.Data.Filters._getDataParser(filter, fields);
            var value = parse(record[filter.field]);
            var value = parse(record[filter.field]);

            var operator = filter.operator;

            var operation = {
                ne: function(value, term) { return value !== term },
                eq: function(value, term) { return value === term },
                lt: function(value, term) { return value < term },
                lte: function(value, term) { return value <= term },
                gt: function(value, term) { return value > term },
                gte: function(value, term) { return value >= term },
                bw: function(value, term) { return _.contains(term, value) }
            };

            return operation[operator](valuem, term);
        }
    },

    my.Filters._dataParsers = {
            integer: function (e) { return parseFloat(e, 10); },
            float: function (e) { return parseFloat(e, 10); },
            string : function (e) { return e.toString() },
            date   : function (e) { return new Date(e).valueOf() },
            datetime   : function (e) { return new Date(e).valueOf()},
            number: function (e) { return parseFloat(e, 10); }
        };
}(this.recline.Data))
this.recline = this.recline || {};
this.recline.Data = this.recline.Data || {};

(function(my){

	my.Format = {};

    // formatters define how data is rapresented in internal dataset
    my.FormattersMODA = {
        integer : function (e) { return parseInt(e); },
        string  : function (e) { return e.toString() },
        date    : function (e) { return new Date(parseInt(e)).valueOf() },
        float   : function (e) { return parseFloat(e, 10); },
        number  : function (e) { return parseFloat(e, 10); }
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
						max = (record.getFieldValue({"id":field}) > max) ? record.getFieldValue({"id":field}) : max;
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

    my.Renderers = function(val, field, doc)   {
        var r = my.RenderersImpl[field.attributes.type];
        if(r==null) {
            throw "No renderers defined for field type " + field.attributes.type;
        }

        return r(val, field, doc);
    };

    // renderers use fieldtype and fieldformat to generate output for getFieldValue
    my.RenderersImpl = {
        object: function(val, field, doc) {
            return JSON.stringify(val);
        },
        integer: function(val, field, doc) {
            var format = field.get('format');
            if(format === "currency_euro") {
                return "€ " + val;
            }

            return val;
        },
        date: function(val, field, doc) {
            var format = field.get('format');
            if(format == null || format == "date")
                return val;

            return new Date(val).toLocaleString();
        },
        geo_point: function(val, field, doc) {
            return JSON.stringify(val);
        },
        number: function(val, field, doc) {
            var format = field.get('format');
            if (format === 'percentage') {
                return parseFloat(val.toFixed(2)) + '%';
            } else if(format === "currency_euro") {
                return "€ " + val;
            }

            try {
                return parseFloat(val.toFixed(2));
            }
            catch(err) {
                console.log("Error in conferting val " + val + " toFixed");
                return "N.A.";
            }


        },
        string: function(val, field, doc) {
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
// # Recline Backbone Models
this.recline = this.recline || {};
this.recline.Data = this.recline.Data || {};
this.recline.Data.ShapeSchema = this.recline.Data.ShapeSchema || {};

(function($, my) {



    my.ShapeSchema = Backbone.Model.extend({
        constructor: function ShapeSchema() {
            Backbone.Model.prototype.constructor.apply(this, arguments);
        },

        // ### initialize
        initialize: function() {
            var self=this;


            if(this.attributes.data) {
                var data = this.attributes.data;
                self._generateLimits(data);
            } else if(this.attributes.dataset)
                { this.bindToDataset();}

        },

        bindToDataset: function() {
           var self=this;
            self.attributes.dataset.dataset.records.bind('reset',   function() { self._generateFromDataset(); });
            if(self.attributes.dataset.dataset.records.models.length > 0) {
                self._generateFromDataset();
            }
        },


        setDataset: function(ds, field, type) {
            var self=this;
            self.attributes.dataset = {dataset: ds, field: field, type: type};
            if(!ds.attributes["shapeSchema"])
                ds.attributes["shapeSchema"] = [];

            ds.attributes["shapeSchema"].push({schema:self, field: field});

            ds.setShapeSchema(type);

            self.bindToDataset();
        },


        _generateFromDataset: function() {
            var self=this;
            var data =  this.getRecordsArray(self.attributes.dataset);
            self._generateLimits(data);

        },

        _generateLimits: function(data) {
            var self=this;
            var res = this.limits["distinct"](data);
            this.schema = {};
            for(var i=0;i<res.length;i++){
                this.schema[res[i]] = self.attributes.shapes[i];
            }
        },


        getShapeNameFor: function(fieldValue) {
            var self=this;
            if(this.schema == null)
                throw "data.shape.js: shape schema not yet initialized, datasource not fetched?"


            return  self._shapeName(fieldValue);
        },


        getShapeFor: function(fieldValue, fieldColor, isSVG, isNode) {
            var self=this;
            if(this.schema == null)
                throw "data.shape.js: shape schema not yet initialized, datasource not fetched?"

            var shape = recline.Template.Shapes[this._shapeName(fieldValue)];
            if(shape == null)
                throw "data.shape.js: shape [" +  this._shapeName(fieldValue) + "] not defined in template.shapes";
            return  shape(fieldColor, isNode, isSVG);
        },

        _shapeName: function(fieldValue) {
            var self=this;

            // find the correct shape, limits must be ordered
            if(self.attributes.type && this.attributes.type == "fixedLimits") {
                var shape = self.attributes.shapes[0];


                for(var i=1;i<this.attributes.limits.length;i++) {
                    if(fieldValue >= this.attributes.limits[i-1]
                        && fieldValue < this.attributes.limits[i]) {
                        shape = self.attributes.shapes[i];
                        break;
                    }
                }

                return shape;
            } else
                return self.schema[fieldValue];
        },


        getRecordsArray: function(dataset) {
            var self=this;
            var ret = [];

            if(dataset.dataset.isFieldPartitioned(dataset.field, dataset.type))   {
                var fields = dataset.dataset.getPartitionedFields(dataset.field);
            _.each(dataset.dataset.getRecords(dataset.type), function(d) {
                _.each(fields, function (field) {
                    ret.push(d.attributes[field.id]);
                });
            });
            }
            else{
                var  fields = [dataset.field];;
                _.each(dataset.dataset.getRecords(dataset.type), function(d) {
                    _.each(fields, function (field) {
                        ret.push(d.attributes[field]);
                    });
                });
            }



            return ret;
        },



        limits: {
            distinct: function(data) {
                _.each(_.uniq(data), function(d, index) {
                    data[index]=recline.Data.Transform.getFieldHash(d);
                });
                return data;
            }

        }

    })
}(jQuery, this.recline.Data));
this.recline = this.recline || {};
this.recline.Data = this.recline.Data || {};

(function($, my) {
// adapted from https://github.com/harthur/costco. heather rules

my.StateManagement = {};


    my.StateManagement.State = Backbone.Model.extend({
        constructor:function State() {
            Backbone.Model.prototype.constructor.apply(this, arguments);
        },

        // ### initialize
        initialize:function () {

        },

        setState: function(dataset) {
            var self=this;
            var filters;
            var selections;

            if(this.attributes.fromQueryString) {
                self.attributes.data = jQuery.deparam($.param.querystring());
            }

            if(this.attributes.useOnlyFields) {
                filters = _.filter(self.attributes.data.filters, function(f) {
                    return _.contains(self.attributes.useOnlyFields, f.field)
                });
                selections =_.filter(self.attributes.data.selections, function(f) {
                    return _.contains(self.attributes.useOnlyFields, f.field)
                });
            } else {
                if(self.attributes.data) {
                if(self.attributes.data.filters)
                    filters = self.attributes.data.filters;

                if(self.attributes.data.selections)
                    selections = self.attributes.data.selections;
                }
            }

            _.each(filters, function(f) {
                dataset.queryState.setFilter(f);
            });

            _.each(selections, function(f) {
                dataset.queryState.setSelection(f);
            });

        }


    });

    my.StateManagement.getQueryString = function(objects) {
        var state = this.getState(objects);
        return decodeURIComponent($.param(state));
    }


my.StateManagement.getState = function(objects) {
    var state = {filters: [], selections: []};
    _.each(objects, function(o) {
        if(o.queryState) {
            _.each(o.queryState.get('filters'), function(f)     {state.filters.push(f)});
            _.each(o.queryState.get('selections'), function(f)  {state.selections.push(f)});
        }
    });

    return state;
};


}(jQuery, this.recline.Data))
this.recline = this.recline || {};
this.recline.Data = this.recline.Data || {};

(function(my) {
// adapted from https://github.com/harthur/costco. heather rules

my.Transform = {};

my.Transform.evalFunction = function(funcString) {
  try {
    eval("var editFunc = " + funcString);
  } catch(e) {
    return {errorMessage: e+""};
  }
  return editFunc;
};

my.Transform.previewTransform = function(docs, editFunc, currentColumn) {
  var preview = [];
  var updated = my.Transform.mapDocs($.extend(true, {}, docs), editFunc);
  for (var i = 0; i < updated.docs.length; i++) {      
    var before = docs[i]
      , after = updated.docs[i]
      ;
    if (!after) after = {};
    if (currentColumn) {
      preview.push({before: before[currentColumn], after: after[currentColumn]});      
    } else {
      preview.push({before: before, after: after});      
    }
  }
  return preview;
};

my.Transform.mapDocs = function(docs, editFunc) {
  var edited = []
    , deleted = []
    , failed = []
    ;
  
  var updatedDocs = _.map(docs, function(doc) {
    try {
      var updated = editFunc(_.clone(doc));
    } catch(e) {
      failed.push(doc);
      return;
    }
    if(updated === null) {
      updated = {_deleted: true};
      edited.push(updated);
      deleted.push(doc);
    }
    else if(updated && !_.isEqual(updated, doc)) {
      edited.push(updated);
    }
    return updated;      
  });
  
  return {
    updates: edited, 
    docs: updatedDocs, 
    deletes: deleted, 
    failed: failed
  };
};

    my.Transform.getFieldHash = function(value) {
        if(isNaN(value))
            return  recline.Data.Transform.hashCode(value);
        else
            return Number(value);
    };

    my.Transform.hashCode = function(data){
        var hash = 0, i, char;
        if (data.length == 0) return hash;
        for (i = 0; i < data.length; i++) {
            char = data.charCodeAt(i);
            hash = ((hash<<5)-hash)+char;
            hash = hash & hash; // Convert to 32bit integer
        }
        return hash;
    };

}(this.recline.Data))
// This file adds in full array method support in browsers that don't support it
// see: http://stackoverflow.com/questions/2790001/fixing-javascript-array-functions-in-internet-explorer-indexof-foreach-etc

// Add ECMA262-5 Array methods if not supported natively
if (!('indexOf' in Array.prototype)) {
    Array.prototype.indexOf= function(find, i /*opt*/) {
        if (i===undefined) i= 0;
        if (i<0) i+= this.length;
        if (i<0) i= 0;
        for (var n= this.length; i<n; i++)
            if (i in this && this[i]===find)
                return i;
        return -1;
    };
}
if (!('lastIndexOf' in Array.prototype)) {
    Array.prototype.lastIndexOf= function(find, i /*opt*/) {
        if (i===undefined) i= this.length-1;
        if (i<0) i+= this.length;
        if (i>this.length-1) i= this.length-1;
        for (i++; i-->0;) /* i++ because from-argument is sadly inclusive */
            if (i in this && this[i]===find)
                return i;
        return -1;
    };
}
if (!('forEach' in Array.prototype)) {
    Array.prototype.forEach= function(action, that /*opt*/) {
        for (var i= 0, n= this.length; i<n; i++)
            if (i in this)
                action.call(that, this[i], i, this);
    };
}
if (!('map' in Array.prototype)) {
    Array.prototype.map= function(mapper, that /*opt*/) {
        var other= new Array(this.length);
        for (var i= 0, n= this.length; i<n; i++)
            if (i in this)
                other[i]= mapper.call(that, this[i], i, this);
        return other;
    };
}
if (!('filter' in Array.prototype)) {
    Array.prototype.filter= function(filter, that /*opt*/) {
        var other= [], v;
        for (var i=0, n= this.length; i<n; i++)
            if (i in this && filter.call(that, v= this[i], i, this))
                other.push(v);
        return other;
    };
}
if (!('every' in Array.prototype)) {
    Array.prototype.every= function(tester, that /*opt*/) {
        for (var i= 0, n= this.length; i<n; i++)
            if (i in this && !tester.call(that, this[i], i, this))
                return false;
        return true;
    };
}
if (!('some' in Array.prototype)) {
    Array.prototype.some= function(tester, that /*opt*/) {
        for (var i= 0, n= this.length; i<n; i++)
            if (i in this && tester.call(that, this[i], i, this))
                return true;
        return false;
    };
}/*
this.recline = this.recline || {};

this.recline.Backend = this.recline.Backend || {};
this.recline.Backend.Joined = this.recline.Backend.Joined || {};

(function($, my) {
  my.__type__ = 'joined';


  my.Store = function(joiningmodel) {
    var self = this;


    self.joiningmodel = joiningmodel;

    var startModel = {records: joiningmodel.primaryDataset.records, fields: primaryDataset.fields};

      _.each(joiningmodel.joinedmodel, function(d) {
        startModel = self.join(startModel, d.joinType, d.on, d.sourceField, d.destField);
      });

    self._store = new recline.Backend.Memory.Store(out.records, out.fields);

  };

    my.join = function(model, joinType, on, sourceField, destField) {
        var self=this;
        var newFields   = self.getJoinedFields[joinType](model.fields, on.fields);
        var newRecords  = self.getJoinedRecords[joinType](model.fields, model.records, on.fields, on.records, sourceField, destField);

        return {records: newRecords, fields: newFields};
    };

    my.getJoinedRecords = {
        "union": function(sourceFields, sourceRecords, destFields, destRecords, onSourceField, onDestField) {
           var records = sourceRecords;
            _.each(destRecords, function(d) {
                sourceRecords.push(d);
            });
            return records;
        }
    };

    my.getJoinedFields = {
        "union": function(sourceFields, destFields) {
         var fields = sourceFields;
            _.each(destFields, function(d) {
                if(sourceFields.get(d.id) == null)
                    throw "backend.joined.js: union error, field " + d.id + " not present in master dataset"
            });
          return fields;
        }
    };

}(this.recline.Backend.joined));

*/
// # Recline Backbone Models
this.recline = this.recline || {};
this.recline.Model = this.recline.Model || {};
this.recline.Model.FilteredDataset = this.recline.Model.FilteredDataset || {};


(function ($, my) {

// ## <a id="dataset">VirtualDataset</a>
    my.FilteredDataset = Backbone.Model.extend({
        constructor:function FilteredDataset() {
            Backbone.Model.prototype.constructor.apply(this, arguments);
        },


        initialize:function () {
            var self = this;

            this.fields = this.attributes.dataset.fields;
            this.records = new my.RecordList();
            //todo
            //this.facets = new my.FacetList();
            this.recordCount = null;

            this.queryState = new my.Query();

            if (this.get('initialState')) {
                this.get('initialState').setState(this);
            }

            this.attributes.dataset.bind('query:done', function () {
                self.query();
            })

            this.queryState.bind('change', function () {
                self.query();
            });

        },

        query:function (queryObj) {
            var self=this;
            this.trigger('query:start');

            if (queryObj) {
                this.queryState.set(queryObj, {silent:true});
            }

            var queryObj = this.queryState.toJSON();

            console.log("Query on model query [" + JSON.stringify(queryObj) + "]");

            var dataset = self.attributes.dataset;
            var numRows = queryObj.size || dataset.recordCount;
            var start = queryObj.from || 0;

            //todo use records fitlering in order to inherit all record properties
            //todo perhaps need a new applyfiltersondata
            var results = recline.Data.Filters.applyFiltersOnData(queryObj.filters, dataset.records.toJSON(), dataset.fields.toJSON());

            _.each(queryObj.sort, function (sortObj) {
                var fieldName = sortObj.field;
                results = _.sortBy(results, function (doc) {
                    var _out = doc[fieldName];
                    return _out;
                });
                if (sortObj.order == 'desc') {
                    results.reverse();
                }
            });

            results = results.slice(start, start + numRows);
            self.recordCount = results.length;

            var docs = _.map(results, function (hit) {
                var _doc = new my.Record(hit);
                _doc.fields = dataset.fields;
                _doc.bind('change', function (doc) {
                    self._changes.updates.push(doc.toJSON());
                });
                _doc.bind('destroy', function (doc) {
                    self._changes.deletes.push(doc.toJSON());
                });
                return _doc;
            });

            self.records.reset(docs);

            self.trigger('query:done');
        },

        getRecords:function () {
            return this.records.models;
        },

        getFields:function (type) {
            return this.attributes.dataset.fields;
        },

        toTemplateJSON:function () {
            var data = this.records.toJSON();
            data.recordCount = this.recordCount;
            data.fields = this.fields.toJSON();
            return data;
        },

        getFieldsSummary:function () {
            return this.attributes.dataset.getFieldsSummary();
        }




    })


}(jQuery, this.recline.Model));

// # Recline Backbone Models
this.recline = this.recline || {};
this.recline.Model = this.recline.Model || {};
this.recline.Model.JoinedDataset = this.recline.Model.JoinedDataset || {};


(function ($, my) {

// ## <a id="dataset">VirtualDataset</a>
    my.JoinedDataset = Backbone.Model.extend({
        constructor:function JoinedDataset() {
            Backbone.Model.prototype.constructor.apply(this, arguments);
        },


        initialize:function () {
            var self = this;

            this.fields = this.attributes.dataset1.fields;

            _.each(this.attributes.dataset2.fields.models, function(f) {
               if(!self.fields.get(f.id))
                self.fields.add(f);
            });

            this.records = new my.RecordList();
            //todo
            //this.facets = new my.FacetList();
            this.recordCount = null;

            this.queryState = new my.Query();

            if (this.get('initialState')) {
                this.get('initialState').setState(this);
            }

            this.attributes.dataset1.bind('query:done', function () {
                self.query();
            })
            this.attributes.dataset2.bind('query:done', function () {
                self.query();
            })

            this.queryState.bind('change', function () {
                self.query();
            });

        },

        query:function (queryObj) {
            var self=this;
            this.trigger('query:start');

            if (queryObj) {
                this.queryState.set(queryObj, {silent:true});
            }

            var queryObj = this.queryState.toJSON();

            console.log("Query on model query [" + JSON.stringify(queryObj) + "]");

            var dataset1 = self.attributes.dataset1;
            var dataset2 = self.attributes.dataset2;

            var results = self.join();

            var numRows = queryObj.size || results.length;
            var start = queryObj.from || 0;

            //todo use records filtering in order to inherit all record properties
            //todo perhaps need a new applyfiltersondata

            _.each(queryObj.sort, function (sortObj) {
                var fieldName = sortObj.field;
                results = _.sortBy(results, function (doc) {
                    var _out = doc[fieldName];
                    return _out;
                });
                if (sortObj.order == 'desc') {
                    results.reverse();
                }
            });

            results = results.slice(start, start + numRows);
            self.recordCount = results.length;

            var docs = _.map(results, function (hit) {
                var _doc = new my.Record(hit);
                _doc.fields = self.fields;
                _doc.bind('change', function (doc) {
                    self._changes.updates.push(doc.toJSON());
                });
                _doc.bind('destroy', function (doc) {
                    self._changes.deletes.push(doc.toJSON());
                });
                return _doc;
            });

            self.records.reset(docs);

            self.trigger('query:done');
        },

        join: function() {
            var joinon      = this.attributes.joinon;
            var dataset1    = this.attributes.dataset1;
            var dataset2    = this.attributes.dataset2;


            var results = [];

            _.each(dataset1.getRecords(), function(r) {
                var filters = [];
                // creation of a filter on dataset2 based on dataset1 field value of joinon field
                _.each(joinon, function(f) {
                    var field = dataset1.fields.get(f);
                    filters.push({field: field.id, type: "term", term:r.getFieldValueUnrendered(field), fieldType:field.attributes.type });
                })

                var resultsFromDataset2 = recline.Data.Filters.applyFiltersOnData(filters, dataset2.records.toJSON(), dataset2.fields.toJSON());
                var record1 = r.toJSON();

                _.each(resultsFromDataset2, function(res) {
                    _.each(res, function(field_value, index) {
                        record1[index] = field_value;
                    })
                    results.push(record1);
                })

            })

            return results;
        },

        getRecords:function () {
            return this.records.models;
        },

        getFields:function (type) {
            return this.fields;
        },

        toTemplateJSON:function () {
            var data = this.records.toJSON();
            data.recordCount = this.recordCount;
            data.fields = this.fields.toJSON();
            return data;
        }


    })


}(jQuery, this.recline.Model));

// # Recline Backbone Models
this.recline = this.recline || {};
this.recline.Model = this.recline.Model || {};

(function ($, my) {

// ## <a id="dataset">Dataset</a>
    my.Dataset = Backbone.Model.extend({
        constructor:function Dataset() {
            Backbone.Model.prototype.constructor.apply(this, arguments);
        },

        // ### initialize
        initialize:function () {
            _.bindAll(this, 'query', 'selection');
            this.backend = null;
            if (this.get('backend')) {
                this.backend = this._backendFromString(this.get('backend'));
            } else { // try to guess backend ...
                if (this.get('records')) {
                    this.backend = recline.Backend.Memory;
                }
            }
            this.fields = new my.FieldList();
            this.records = new my.RecordList();
            this._changes = {
                deletes:[],
                updates:[],
                creates:[]
            };
            this.facets = new my.FacetList();

            this.recordCount = null;
            this.queryState = new my.Query();

            if (this.get('initialState')) {
                this.get('initialState').setState(this);
            }


            this.queryState.bind('change', this.query);
            this.queryState.bind('facet:add', this.query);
            this.queryState.bind('selection:change', this.selection);
            // store is what we query and save against
            // store will either be the backend or be a memory store if Backend fetch
            // tells us to use memory store
            this._store = this.backend;
            if (this.backend == recline.Backend.Memory) {
                this.fetch();
            }
        },

        // ### fetch
        //
        // Retrieve dataset and (some) records from the backend.
        fetch:function () {
            var self = this;
            var dfd = $.Deferred();

            if (this.backend !== recline.Backend.Memory) {
                this.backend.fetch(this.toJSON())
                    .done(handleResults)
                    .fail(function (arguments) {
                        console.log("Fail in fetching data");
                        dfd.reject(arguments);
                    });
            } else {
                // special case where we have been given data directly
                handleResults({
                    records:this.get('records'),
                    fields:this.get('fields'),
                    useMemoryStore:true
                });
            }

            function handleResults(results) {
                var out = self._normalizeRecordsAndFields(results.records, results.fields);
                if (results.useMemoryStore) {
                    self._store = new recline.Backend.Memory.Store(out.records, out.fields);
                }

                self.set(results.metadata);


                recline.Data.FieldsUtility.setFieldsAttributes(out.fields, self);
                var options = {renderer:recline.Data.Renderers};

                self.fields.reset(out.fields, options);

                self.query()
                    .done(function () {
                        dfd.resolve(self);
                    })
                    .fail(function (arguments) {
                        dfd.reject(arguments);
                    });
            }

            return dfd.promise();
        },

        setColorSchema:function () {
            var self = this;
            _.each(self.attributes.colorSchema, function (d) {
                var field = _.find(self.fields.models, function (f) {
                    return d.field === f.id
                });
                if (field != null)
                    field.attributes.colorSchema = d.schema;
            })
        },

        setShapeSchema:function () {
            var self = this;
            _.each(self.attributes.shapeSchema, function (d) {
                var field = _.find(self.fields.models, function (f) {
                    return d.field === f.id
                });
                if (field != null)
                    field.attributes.shapeSchema = d.schema;
            })
        },

        // ### _normalizeRecordsAndFields
        //
        // Get a proper set of fields and records from incoming set of fields and records either of which may be null or arrays or objects
        //
        // e.g. fields = ['a', 'b', 'c'] and records = [ [1,2,3] ] =>
        // fields = [ {id: a}, {id: b}, {id: c}], records = [ {a: 1}, {b: 2}, {c: 3}]
        _normalizeRecordsAndFields:function (records, fields) {
            // if no fields get them from records
            if (!fields && records && records.length > 0) {
                // records is array then fields is first row of records ...
                if (records[0] instanceof Array) {
                    fields = records[0];
                    records = records.slice(1);
                } else {
                    fields = _.map(_.keys(records[0]), function (key) {
                        return {id:key};
                    });
                }
            }

            // fields is an array of strings (i.e. list of field headings/ids)
            if (fields && fields.length > 0 && typeof(fields[0]) != 'object') {
                // Rename duplicate fieldIds as each field name needs to be
                // unique.
                var seen = {};
                fields = _.map(fields, function (field, index) {
                    field = field.toString();
                    // cannot use trim as not supported by IE7
                    var fieldId = field.replace(/^\s+|\s+$/g, '');
                    if (fieldId === '') {
                        fieldId = '_noname_';
                        field = fieldId;
                    }
                    while (fieldId in seen) {
                        seen[field] += 1;
                        fieldId = field + seen[field];
                    }
                    if (!(field in seen)) {
                        seen[field] = 0;
                    }
                    // TODO: decide whether to keep original name as label ...
                    // return { id: fieldId, label: field || fieldId }
                    return { id:fieldId };
                });
            }
            // records is provided as arrays so need to zip together with fields
            // NB: this requires you to have fields to match arrays
            if (records && records.length > 0 && records[0] instanceof Array) {
                records = _.map(records, function (doc) {
                    var tmp = {};
                    _.each(fields, function (field, idx) {
                        tmp[field.id] = doc[idx];
                    });
                    return tmp;
                });
            }
            return {
                fields:fields,
                records:records
            };
        },

        save:function () {
            var self = this;
            // TODO: need to reset the changes ...
            return this._store.save(this._changes, this.toJSON());
        },

        transform:function (editFunc) {
            var self = this;
            if (!this._store.transform) {
                alert('Transform is not supported with this backend: ' + this.get('backend'));
                return;
            }
            this.trigger('recline:flash', {message:"Updating all visible docs. This could take a while...", persist:true, loader:true});
            this._store.transform(editFunc).done(function () {
                // reload data as records have changed
                self.query();
                self.trigger('recline:flash', {message:"Records updated successfully"});
            });
        },

        getRecords:function (type) {
            var self = this;

            if (type === 'filtered' || type == null) {
                return self.records.models;
            } else {
                if (self._store.data == null) {
                    throw "Model: unable to retrieve not filtered data, store can't provide data. Use a backend that use a memory store";
                }

                var docs = _.map(self._store.data, function (hit) {
                    var _doc = new my.Record(hit);
                    _doc.fields = self.fields;
                    return _doc;
                });

                return docs;
            }
        },

        getFields:function (type) {
            var self = this;
            return self.fields;

        },


        // ### query
        //
        // AJAX method with promise API to get records from the backend.
        //
        // It will query based on current query state (given by this.queryState)
        // updated by queryObj (if provided).
        //
        // Resulting RecordList are used to reset this.records and are
        // also returned.
        query:function (queryObj) {
            var self = this;
            var dfd = $.Deferred();
            this.trigger('query:start');

            if (queryObj) {
                this.queryState.set(queryObj, {silent:true});
            }
            var actualQuery = this.queryState.toJSON();

            console.log("Query on model [" + self.attributes.id + "] query [" + JSON.stringify(actualQuery) + "]");

            this._store.query(actualQuery, this.toJSON())
                .done(function (queryResult) {
                    self._handleQueryResult(queryResult);
                    self.trigger('query:done');
                    dfd.resolve(self.records);
                })
                .fail(function (arguments) {
                    self.trigger('query:fail', arguments);
                    dfd.reject(arguments);
                });
            return dfd.promise();
        },

        _handleQueryResult:function (queryResult) {
            var self = this;
            self.recordCount = queryResult.total;
            var docs = _.map(queryResult.hits, function (hit) {
                var _doc = new my.Record(hit);
                _doc.fields = self.fields;
                _doc.bind('change', function (doc) {
                    self._changes.updates.push(doc.toJSON());
                });
                _doc.bind('destroy', function (doc) {
                    self._changes.deletes.push(doc.toJSON());
                });
                return _doc;
            });

            recline.Data.Filters.applySelectionsOnData(self.queryState.get('selections'), docs, self.fields);
            self.records.reset(docs);

            if (queryResult.facets) {
                var facets = _.map(queryResult.facets, function (facetResult, facetId) {
                    facetResult.id = facetId;
                    var result = new my.Facet(facetResult);
                    self.addColorsToTerms(facetId, result.attributes.terms);

                    return result;
                });
                self.facets.reset(facets);
            }
        },

        addColorsToTerms:function (field, terms) {
            var self = this;
            _.each(terms, function (t) {

                // assignment of color schema to fields
                if (self.attributes.colorSchema) {
                    _.each(self.attributes.colorSchema, function (d) {
                        if (d.field === field)
                            t.color = d.schema.getColorFor(t.term);
                    })
                }
            });
        },


        selection:function (queryObj) {
            var self = this;

            this.trigger('selection:start');

            if (queryObj) {
                self.queryState.set(queryObj, {silent:true});
            }
            var actualQuery = self.queryState

            // if memory store apply on memory
            /*if (self.backend == recline.Backend.Memory
             || self.backend == recline.Backend.Jsonp) {
             self.backend.applySelections(this.queryState.get('selections'));
             }*/

            // apply on current records
            // needed cause memory store is not mandatory
            recline.Data.Filters.applySelectionsOnData(self.queryState.get('selections'), self.records.models, self.fields);

            self.queryState.trigger('selection:done');

        },


        toTemplateJSON:function () {
            var data = this.toJSON();
            data.recordCount = this.recordCount;
            data.fields = this.fields.toJSON();
            return data;
        },

        // ### getFieldsSummary
        //
        // Get a summary for each field in the form of a `Facet`.
        //
        // @return null as this is async function. Provides deferred/promise interface.
        getFieldsSummary:function () {
            var self = this;
            var query = new my.Query();
            query.set({size:0});
            this.fields.each(function (field) {
                query.addFacet(field.id);
            });
            var dfd = $.Deferred();
            this._store.query(query.toJSON(), this.toJSON()).done(function (queryResult) {
                if (queryResult.facets) {
                    _.each(queryResult.facets, function (facetResult, facetId) {
                        facetResult.id = facetId;
                        var facet = new my.Facet(facetResult);
                        // TODO: probably want replace rather than reset (i.e. just replace the facet with this id)
                        self.fields.get(facetId).facets.reset(facet);
                    });
                }
                dfd.resolve(queryResult);
            });
            return dfd.promise();
        },

        // Deprecated (as of v0.5) - use record.summary()
        recordSummary:function (record) {
            return record.summary();
        },

        // ### _backendFromString(backendString)
        //
        // Look up a backend module from a backend string (look in recline.Backend)
        _backendFromString:function (backendString) {
            var backend = null;
            if (recline && recline.Backend) {
                _.each(_.keys(recline.Backend), function (name) {
                    if (name.toLowerCase() === backendString.toLowerCase()) {
                        backend = recline.Backend[name];
                    }
                });
            }
            return backend;
        },
        isFieldPartitioned:function (field) {
            return false
        },


        getFacetByFieldId:function (fieldId) {
            return _.find(this.facets.models, function (facet) {
                return facet.id == fieldId;
            });
        },

        toFullJSON: function(resultType) {
            var self=this;
            return _.map(self.getRecords(resultType), function(r) {
                var res={};

                _.each(self.getFields(resultType).models, function(f) {
                    res[f.id] = r.getFieldValueUnrendered(f);
                });

                return res;

            });


        }


    });


// ## <a id="record">A Record</a>
// 
// A single record (or row) in the dataset
    my.Record = Backbone.Model.extend({
        constructor:function Record() {
            Backbone.Model.prototype.constructor.apply(this, arguments);
        },

        // ### initialize
        //
        // Create a Record
        //
        // You usually will not do this directly but will have records created by
        // Dataset e.g. in query method
        //
        // Certain methods require presence of a fields attribute (identical to that on Dataset)
        initialize:function () {
            _.bindAll(this, 'getFieldValue');

            this["is_selected"] = false;
        },

        // ### getFieldValue
        //
        // For the provided Field get the corresponding rendered computed data value
        // for this record.
        getFieldValue:function (field) {
            var val = this.getFieldValueUnrendered(field);
            if (field.renderer) {
                val = field.renderer(val, field, this.toJSON());
            }
            return val;
        },

        // ### getFieldValueUnrendered
        //
        // For the provided Field get the corresponding computed data value
        // for this record.
        getFieldValueUnrendered:function (field) {
            var val = this.get(field.id);
            if (field.deriver) {
                val = field.deriver(val, field, this);
            }
            return val;
        },


        getFieldColor:function (field) {
            if (!field.attributes.colorSchema)
                return null;

            if (field.attributes.is_partitioned) {
                return field.attributes.colorSchema.getTwoDimensionalColor(field.attributes.partitionValue, this.getFieldValueUnrendered(field));
            }
            else
                return field.attributes.colorSchema.getColorFor(this.getFieldValueUnrendered(field));

        },

        getFieldShapeName:function (field) {
            if (!field.attributes.shapeSchema)
                return null;

            if (field.attributes.is_partitioned) {
                return field.attributes.shapeSchema.getShapeNameFor(field.attributes.partitionValue);
            }
            else
                return field.attributes.shapeSchema.getShapeNameFor(this.getFieldValueUnrendered(field));

        },

        getFieldShape:function (field, isSVG, isNode) {
            if (!field.attributes.shapeSchema)
                return recline.Template.Shapes["empty"](null, isNode, isSVG);

            var fieldValue;
            var fieldColor = this.getFieldColor(field);

            if (field.attributes.is_partitioned) {
                fieldValue = field.attributes.partitionValue;
            }
            else
                fieldValue = this.getFieldValueUnrendered(field);


            return field.attributes.shapeSchema.getShapeFor(fieldValue, fieldColor, isSVG, isNode);
        },

        isRecordSelected:function () {
            var self = this;
            return self["is_selected"];
        },
        setRecordSelection:function (sel) {
            var self = this;
            self["is_selected"] = sel;
        },

        // ### summary
        //
        // Get a simple html summary of this record in form of key/value list
        summary:function (record) {
            var self = this;
            var html = '<div class="recline-record-summary">';
            this.fields.each(function (field) {
                if (field.id != 'id') {
                    html += '<div class="' + field.id + '"><strong>' + field.get('label') + '</strong>: ' + self.getFieldValue(field) + '</div>';
                }
            });
            html += '</div>';
            return html;
        },

        // Override Backbone save, fetch and destroy so they do nothing
        // Instead, Dataset object that created this Record should take care of
        // handling these changes (discovery will occur via event notifications)
        // WARNING: these will not persist *unless* you call save on Dataset
        fetch:function () {
        },
        save:function () {
        },
        destroy:function () {
            this.trigger('destroy', this);
        }
    });


// ## A Backbone collection of Records
    my.RecordList = Backbone.Collection.extend({
        constructor:function RecordList() {
            Backbone.Collection.prototype.constructor.apply(this, arguments);
        },
        model:my.Record
    });


// ## <a id="field">A Field (aka Column) on a Dataset</a>
    my.Field = Backbone.Model.extend({
        constructor:function Field() {
            Backbone.Model.prototype.constructor.apply(this, arguments);
        },
        // ### defaults - define default values
        defaults:{
            label:null,
            type:'string',
            format:null,
            is_derived:false,
            is_partitioned:false,
            partitionValue:null,
            partitionField:null,
            colorSchema:null,
            shapeSchema:null
        },
        virtualModelFields:{
            label:null,
            type:'string',
            format:null,
            is_derived:false,
            is_partitioned:false,
            partitionValue:null,
            partitionField:null,
            originalField:null,
            colorSchema:null,
            aggregationFunction:null
        },
        // ### initialize
        //
        // @param {Object} data: standard Backbone model attributes
        //
        // @param {Object} options: renderer and/or deriver functions.
        initialize:function (data, options) {
            // if a hash not passed in the first argument throw error
            if ('0' in data) {
                throw new Error('Looks like you did not pass a proper hash with id to Field constructor');
            }
            if (this.attributes.label === null) {
                this.set({label:this.id});
            }
            if (this.attributes.type.toLowerCase() in this._typeMap) {
                this.attributes.type = this._typeMap[this.attributes.type.toLowerCase()];
            }
            if (options) {
                this.renderer = options.renderer;
                this.deriver = options.deriver;
            }
            if (!this.deriver && data.deriver)
                this.deriver = data.deriver;

            if (!this.renderer) {
                this.renderer = this.defaultRenderers[this.get('type')];
            }
            this.facets = new my.FacetList();
        },
        _typeMap:{
            'text':'string',
            'double':'number',
            'float':'number',
            'numeric':'number',
            'int':'integer',
            'datetime':'date-time',
            'bool':'boolean',
            'timestamp':'date-time',
            'json':'object'
        },
        defaultRenderers:{
            object:function (val, field, doc) {
                return JSON.stringify(val);
            },
            geo_point:function (val, field, doc) {
                return JSON.stringify(val);
            },
            'number':function (val, field, doc) {
                var format = field.get('format');
                if (format === 'percentage') {
                    return val + '%';
                }
                return val;
            },
            'string':function (val, field, doc) {
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
            },
            'date':function (val, field, doc) {
                // if val contains timer value (in msecs), possibly in string format, ensure it's converted to number
                var intVal = parseInt(val);
                if (!isNaN(intVal) && isFinite(val))
                    return intVal;
                else return new Date(val);
            }
        },
        getColorForPartition:function () {

            if (!this.attributes.colorSchema)
                return null;

            if (this.attributes.is_partitioned)
                return this.attributes.colorSchema.getColorFor(this.attributes.partitionValue);

            return this.attributes.colorSchema.getColorFor(this.attributes.id);
        }
    });

    my.FieldList = Backbone.Collection.extend({
        constructor:function FieldList() {
            Backbone.Collection.prototype.constructor.apply(this, arguments);
        },
        model:my.Field
    });

// ## <a id="query">Query</a>
    my.Query = Backbone.Model.extend({
        constructor:function Query() {
            Backbone.Model.prototype.constructor.apply(this, arguments);
        },
        defaults:function () {
            return {
                //size: 100,
                from:0,
                q:'',
                facets:{},
                filters:[],
                selections:[]
            };
        },
        _filterTemplates:{
            term:{
                type:'term',
                // TODO do we need this attribute here?
                field:'',
                term:''
            },
            termAdvanced:{
                type:'term',
                operator:"eq",
                field:'',
                term:''
            },
            list:{
                type:'term',
                field:'',
                list:[]
            },
            range:{
                type:'range',
                field:'',
                start:'',
                stop:''
            },
            geo_distance:{
                type:'geo_distance',
                distance:10,
                unit:'km',
                point:{
                    lon:0,
                    lat:0
                }
            }
            // ### addFilter(filter)
        },
        _selectionTemplates:{
            term:{
                type:'term',
                field:'',
                term:''
            },
            range:{
                type:'range',
                field:'',
                start:'',
                stop:''
            }
        },
        // ### addFilter
        //
        // Add a new filter specified by the filter hash and append to the list of filters
        //
        // @param filter an object specifying the filter - see _filterTemplates for examples. If only type is provided will generate a filter by cloning _filterTemplates
        addFilter:function (filter) {
            // crude deep copy
            var ourfilter = JSON.parse(JSON.stringify(filter));
            // not fully specified so use template and over-write
            if (_.keys(filter).length <= 3) {
                ourfilter = _.extend(this._filterTemplates[filter.type], ourfilter);
            }
            var filters = this.get('filters');
            filters.push(ourfilter);
            this.trigger('change:filters:new-blank');
        },

        getFilters:function () {
            return this.get('filters');
        },

        getFilterByFieldName:function (fieldName) {
            var res = _.find(this.get('filters'), function (f) {
                return f.field == fieldName;
            });
            if (res == -1)
                return null;
            else
                return res;

        },


        // update or add the selected filter(s), a change event is not triggered after the update

        setFilter:function (filter) {
            if (filter["remove"]) {
                this.removeFilterByField(filter.field);
                delete filter["remove"];
            } else {

                var filters = this.get('filters');
                var found = false;
                for (var j = 0; j < filters.length; j++) {
                    if (filters[j].field == filter.field) {
                        filters[j] = filter;
                        found = true;
                    }
                }
                if (!found)
                    filters.push(filter);
            }
        },


        updateFilter:function (index, value) {
        },
        // ### removeFilter
        //
        // Remove a filter from filters at index filterIndex
        removeFilter:function (filterIndex) {
            var filters = this.get('filters');
            filters.splice(filterIndex, 1);
            this.set({filters:filters});
            this.trigger('change');
        },
        removeFilterByField:function (field) {
            var filters = this.get('filters');
            for (var j in filters) {
                if (filters[j].field == field) {
                    this.removeFilter(j);
                }
            }
        },
        clearFilter:function (field) {
            var filters = this.get('filters');
            for (var j in filters) {
                if (filters[j].field == field) {
                    filters[j].term = null;
                    filters[j].start = null;
                    filters[j].stop = null;
                    break;
                }
            }
        },

        // ### addSelection
        //
        // Add a new selection (appended to the list of selections)
        //
        // @param selection an object specifying the filter - see _filterTemplates for examples. If only type is provided will generate a filter by cloning _filterTemplates
        addSelection:function (selection) {
            // crude deep copy
            var myselection = JSON.parse(JSON.stringify(selection));
            // not full specified so use template and over-write
            // 3 as for 'type', 'field' and 'fieldType'
            if (_.keys(selection).length <= 3) {
                myselection = _.extend(this._selectionTemplates[selection.type], myselection);
            }
            var selections = this.get('selections');
            selections.push(myselection);
            this.trigger('change:selections');
        },
        // ### removeSelection
        //
        // Remove a selection at index selectionIndex
        removeSelection:function (selectionIndex) {
            var selections = this.get('selections');
            selections.splice(selectionIndex, 1);
            this.set({selections:selections});
            this.trigger('change:selections');
        },
        removeSelectionByField:function (field) {
            var selections = this.get('selections');
            for (var j in filters) {
                if (selections[j].field == field) {
                    removeSelection(j);
                }
            }
        },
        setSelection:function (filter) {
            if (filter["remove"]) {
                removeSelectionByField(filter.field);
            } else {


                var s = this.get('selections');
                var found = false;
                for (var j = 0; j < s.length; j++) {
                    if (s[j].field == filter.field) {
                        s[j] = filter;
                        found = true;
                    }
                }
                if (!found)
                    s.push(filter);
            }
        },

        isSelected:function () {
            return this.get('selections').length > 0;
        },


        // ### addFacet
        //
        // Add a Facet to this query
        //
        // See <http://www.elasticsearch.org/guide/reference/api/search/facets/>
        addFacet:function (fieldId, allTerms) {
            this.addFacetNoEvent(fieldId, allTerms);
            this.trigger('facet:add', this);
        },


        addFacetNoEvent:function (fieldId, allTerms) {
            var facets = this.get('facets');
            // Assume id and fieldId should be the same (TODO: this need not be true if we want to add two different type of facets on same field)
            if (_.contains(_.keys(facets), fieldId)) {
                return;
            }
            var all = false;
            if (allTerms)
                all = true;

            facets[fieldId] = {
                terms:{ field:fieldId, all_terms:all }
            };
            this.set({facets:facets}, {silent:true});

        },

        addHistogramFacet:function (fieldId) {
            var facets = this.get('facets');
            facets[fieldId] = {
                date_histogram:{
                    field:fieldId,
                    interval:'day'
                }
            };
            this.set({facets:facets}, {silent:true});
            this.trigger('facet:add', this);
        }


    });


// ## <a id="facet">A Facet (Result)</a>
    my.Facet = Backbone.Model.extend({
        constructor:function Facet() {
            Backbone.Model.prototype.constructor.apply(this, arguments);
        },
        defaults:function () {
            return {
                _type:'terms',
                total:0,
                other:0,
                missing:0,
                terms:[]       // { field: , all_terms: bool }
            };
        }
    });

// ## A Collection/List of Facets
    my.FacetList = Backbone.Collection.extend({
        constructor:function FacetList() {
            Backbone.Collection.prototype.constructor.apply(this, arguments);
        },
        model:my.Facet
    });

// ## Object State
//
// Convenience Backbone model for storing (configuration) state of objects like Views.
    my.ObjectState = Backbone.Model.extend({
    });


// ## Backbone.sync
//
// Override Backbone.sync to hand off to sync function in relevant backend
    Backbone.sync = function (method, model, options) {
        return model.backend.sync(method, model, options);
    };

}(jQuery, this.recline.Model));

// # Recline Backbone Models
this.recline = this.recline || {};
this.recline.Model = this.recline.Model || {};
this.recline.Model.VirtualDataset = this.recline.Model.VirtualDataset || {};


(function ($, my) {

// ## <a id="dataset">VirtualDataset</a>
    my.VirtualDataset = Backbone.Model.extend({
        constructor:function VirtualDataset() {
            Backbone.Model.prototype.constructor.apply(this, arguments);
        },


        initialize:function () {
            _.bindAll(this, 'query');


            var self = this;
            this.backend = recline.Backend.Memory;
            this.fields = new my.FieldList();
            this.records = new my.RecordList();
            this.facets = new my.FacetList();
            this.recordCount = null;
            this.queryState = new my.Query();

            if (this.get('initialState')) {
                this.get('initialState').setState(this);
            }

            this.attributes.dataset.bind('query:done', function () {
                self.initializeCrossfilter();
            })

            //this.attributes.dataset.records.bind('add',     function() { self.initializeCrossfilter(); });
            //this.attributes.dataset.records.bind('reset',   function() { self.initializeCrossfilter(); });

            this.queryState.bind('change', function () {
                self.query();
            });
            this.queryState.bind('selection:change', function () {
                self.selection();
            });

            // dataset is already been fetched
            if (this.attributes.dataset.records.models.length > 0)
                self.initializeCrossfilter();

            // TODO verify if is better to use a new backend (crossfilter) to manage grouping and filtering instead of using it inside the model
            // TODO OPTIMIZATION use a structure for the reduce function that doesn't need any translation to records/arrays
            // TODO USE crossfilter as backend memory
        },

        getRecords:function (type) {
            var self = this;

            if (type === 'filtered' || type == null) {
                return self.records.models;
            } else if (type === 'totals') {
                if(self.totals == null)
                    self.rebuildTotals();

                return self.totals.records.models;
            } else if (type === 'totals_unfiltered') {
                if(self.totals_unfiltered == null)
                    self.rebuildUnfilteredTotals();

                return self.totals_unfiltered.records.models;
            } else {
                if (self._store.data == null) {
                    throw "VirtualModel: unable to retrieve not filtered data, store can't provide data. Use a backend that use memory store";
                }

                var docs = _.map(self._store.data, function (hit) {
                    var _doc = new my.Record(hit);
                    _doc.fields = self.fields;
                    return _doc;
                });

                return docs;
            }
        },

        getField_byAggregationFunction: function(resultType, fieldName, aggr) {
            var fields = this.getFields(resultType);
            return fields.get(fieldName + "_" + aggr);
        },


        getFields:function (type) {
            var self = this;

            if (type === 'filtered' || type == null) {
                return self.fields;
            } else if (type === 'totals') {
                if(self.totals == null)
                    self.rebuildTotals();

                return self.totals.fields;
            } else if (type === 'totals_unfiltered') {
                if(self.totals == null)
                    self.rebuildUnfilteredTotals();

                return self.totals_unfiltered.fields;
            } else {
                return self.fields;
            }
        },

        initializeCrossfilter:function () {
            var aggregatedFields = this.attributes.aggregation.measures;
            var aggregationFunctions = this.attributes.aggregation.aggregationFunctions;
            var originalFields = this.attributes.dataset.fields;
            var dimensions =  this.attributes.aggregation.dimensions;
            var partitions =this.attributes.aggregation.partitions;

            var crossfilterData = crossfilter(this.attributes.dataset.toFullJSON());
            var group = this.createDimensions(crossfilterData, dimensions);
            var results = this.reduce(group,dimensions,aggregatedFields,aggregationFunctions,partitions);



            this.updateStore(results, originalFields,dimensions,aggregationFunctions,aggregatedFields,partitions);
        },

        setDimensions:function (dimensions) {
            this.attributes.aggregation.dimensions = dimensions;
            this.trigger('dimensions:change');
            this.initializeCrossfilter();
        },

        getDimensions:function () {
            return this.attributes.aggregation.dimensions;
        },

        createDimensions:function (crossfilterData, dimensions) {
            var group;

            if (dimensions == null) {
                // need to evaluate aggregation function on all records
                group = crossfilterData.groupAll();
            }
            else {
                var by_dimension = crossfilterData.dimension(function (d) {
                    var tmp = "";
                    for (i = 0; i < dimensions.length; i++) {
                        if (i > 0) {
                            tmp = tmp + "#";
                        }

                        tmp = tmp + d[dimensions[i]].valueOf();
                    }
                    return tmp;
                });
                group = by_dimension.group();
            }

            return group;
        },

        reduce:function (group, dimensions, aggregatedFields, aggregationFunctions, partitions) {

            if (aggregationFunctions == null || aggregationFunctions.length == 0)
                throw("Error aggregationFunctions parameters is not set for virtual dataset ");


            var partitioning = false;
            var partitionFields = {};
            if (partitions != null) {
                var partitioning = true;
            }

            function addFunction(p, v) {
                p.count = p.count + 1;
                for (i = 0; i < aggregatedFields.length; i++) {

                    // for each aggregation function evaluate results
                    for (j = 0; j < aggregationFunctions.length; j++) {
                        var currentAggregationFunction = this.recline.Data.Aggregations.aggregationFunctions[aggregationFunctions[j]];

                        p[aggregationFunctions[j]][aggregatedFields[i]] =
                            currentAggregationFunction(
                                p[aggregationFunctions[j]][aggregatedFields[i]],
                                v[aggregatedFields[i]]);
                    }


                    if (partitioning) {
                        // for each partition need to verify if exist a value of aggregatefield_by_partition_partitionvalue
                        for (x = 0; x < partitions.length; x++) {
                            var partitionName = partitions[x];
                            var partitionValue = v[partitions[x]];
                            var aggregatedField = aggregatedFields[i];
                            var fieldName = aggregatedField + "_by_" + partitionName + "_" + partitionValue;


                            // for each aggregation function evaluate results
                            for (j = 0; j < aggregationFunctions.length; j++) {

                                if (partitionFields[aggregationFunctions[j]] == null)
                                    partitionFields[aggregationFunctions[j]] = {};

                                var currentAggregationFunction = this.recline.Data.Aggregations.aggregationFunctions[aggregationFunctions[j]];

                                if (p.partitions[aggregationFunctions[j]][fieldName] == null) {
                                    p.partitions[aggregationFunctions[j]][fieldName] = {
                                        value:null,
                                        partition:partitionValue,
                                        originalField:aggregatedField,
                                        aggregationFunction:currentAggregationFunction};

                                    // populate partitions description

                                    partitionFields[aggregationFunctions[j]][fieldName] = {
                                        field:partitionName,
                                        value:partitionValue,
                                        originalField:aggregatedField,
                                        aggregationFunction:currentAggregationFunction,
                                        aggregationFunctionName:aggregationFunctions[j],
                                        id:fieldName + "_" + aggregationFunctions[j]
                                    }; // i need partition name but also original field value
                                }
                                p.partitions[aggregationFunctions[j]][fieldName]["value"] =
                                    currentAggregationFunction(
                                        p.partitions[aggregationFunctions[j]][fieldName]["value"],
                                        v[aggregatedFields[i]]);
                            }

                            if (p.partitions.count[fieldName] == null) {
                                p.partitions.count[fieldName] = {
                                    value:1,
                                    partition:partitionValue,
                                    originalField:aggregatedField,
                                    aggregationFunction:"count"
                                };
                            }
                            else
                                p.partitions.count[fieldName]["value"] += 1;
                        }
                    }


                }
                return p;
            }

            function removeFunction(p, v) {
                throw "crossfilter reduce remove function not implemented";
            }

            function initializeFunction() {

                var tmp = {count:0};

                for (j = 0; j < aggregationFunctions.length; j++) {
                    tmp[aggregationFunctions[j]] = {};
                    this.recline.Data.Aggregations.initFunctions[aggregationFunctions[j]](tmp, aggregatedFields, partitions);
                }

                if (partitioning) {
                    tmp["partitions"] = {};
                    tmp["partitions"]["count"] = {};

                    for (j = 0; j < aggregationFunctions.length; j++) {
                        tmp["partitions"][aggregationFunctions[j]] = {};
                    }

                    /*_.each(partitions, function(p){
                     tmp.partitions.list[p] = 0;
                     });*/
                }

                return tmp;
            }

            var reducedGroup = group.reduce(addFunction, removeFunction, initializeFunction);

            var tmpResult;

            if (dimensions == null) {
                tmpResult = [reducedGroup.value()];
            }
            else {
                tmpResult = reducedGroup.all();
            }

            return {reducedResult:tmpResult,
                partitionFields:partitionFields};

        },

        updateStore:function (results, originalFields, dimensions, aggregationFunctions, aggregatedFields, partitions) {
            var self = this;

            var reducedResult = results.reducedResult;
            var partitionFields = results.partitionFields;
            this.partitionFields = partitionFields;

            var fields = self.buildFields(reducedResult, originalFields, partitionFields, dimensions, aggregationFunctions);
            var result = self.buildResult(reducedResult, originalFields, partitionFields, dimensions, aggregationFunctions, aggregatedFields, partitions);

            this._store = new recline.Backend.Memory.Store(result, fields);

            recline.Data.FieldsUtility.setFieldsAttributes(fields, self);
            this.fields.reset(fields, {renderer:recline.Data.Renderers});
            this.clearUnfilteredTotals();

            this.query();

        },

        rebuildTotals: function() {
            this._rebuildTotals(this.records, this.fields, true);

        },
        rebuildUnfilteredTotals: function() {
            this._rebuildTotals(this._store.data, this.fields, false);
        },
        clearUnfilteredTotals: function() {
            this.totals_unfiltered = null;
           this.clearFilteredTotals();
        },
        clearFilteredTotals: function() {
            this.totals = null;
       },

        _rebuildTotals: function(records, originalFields, filtered) {
            /*
                totals: {
                    aggregationFunctions:["sum"],
                    aggregatedFields: ["fielda"]
                    }
            */
            var self=this;
            var aggregatedFields = self.attributes.totals.measures;
            var aggregationFunctions =  self.attributes.totals.aggregationFunctions;

            var rectmp;

            if(records.constructor == Array)
                rectmp = records;
            else
                rectmp = _.map(records.models, function(d) { return d.attributes;}) ;

            var crossfilterData =  crossfilter(rectmp);

            var group = this.createDimensions(crossfilterData, null);
            var results = this.reduce(group, null,aggregatedFields, aggregationFunctions, null);

            var fields = self.buildFields(results.reducedResult, originalFields, {}, null, aggregationFunctions);
            var result = self.buildResult(results.reducedResult, originalFields, {}, null, aggregationFunctions, aggregatedFields, null);

            // I need to apply table calculations
            var tableCalc = recline.Data.Aggregations.checkTableCalculation(self.attributes.aggregation.aggregationFunctions, self.attributes.totals);

                _.each(tableCalc, function(f) {
                    var p;
                    _.each(rectmp, function(r) {
                        p = recline.Data.Aggregations.tableCalculations[f](self.attributes.aggregation.measures, p, r, result[0]);
                    });
                });

            recline.Data.FieldsUtility.setFieldsAttributes(fields, self);

            if(filtered) {
                if(this.totals == null) { this.totals = {records: new my.RecordList(), fields: new my.FieldList() }}

                    this.totals.fields.reset(fields, {renderer:recline.Data.Renderers}) ;
                    this.totals.records.reset(result);
            }   else   {
                if(this.totals_unfiltered == null) { this.totals_unfiltered = {records: new my.RecordList(), fields: new my.FieldList() }}

                    this.totals_unfiltered.fields.reset(fields, {renderer:recline.Data.Renderers}) ;
                    this.totals_unfiltered.records.reset(result);
            }


        },

        buildResult:function (reducedResult, originalFields, partitionFields, dimensions, aggregationFunctions, aggregatedFields, partitions) {

            var partitioning = false;

            if (partitions != null) {
                var partitioning = true;
            }

            var tmpField;
            if (dimensions == null) {
                tmpField = reducedResult;
            }
            else {
                if (reducedResult.length > 0) {
                    tmpField = reducedResult[0].value;
                }
                else
                    tmpField = {count:0};
            }

            var result = [];

            // set  results of dataset
            for (var i = 0; i < reducedResult.length; i++) {

                var currentField;
                var currentResult = reducedResult[i];
                var tmp;

                // if dimensions specified add dimension' fields
                if (dimensions != null) {
                    var keyField = reducedResult[i].key.split("#");

                    tmp = {dimension:currentResult.key, count:currentResult.value.count};

                    for (var j = 0; j < keyField.length; j++) {
                        var field = dimensions[j];
                        var originalFieldAttributes = originalFields.get(field).attributes;
                        var type = originalFieldAttributes.type;

                        var parse = recline.Data.FormattersMODA[type];
                        var value = parse(keyField[j]);

                        tmp[dimensions[j]] = value;
                    }
                    currentField = currentResult.value;

                }
                else {
                    currentField = currentResult;
                    tmp = {count:currentResult.count};
                }

                // add records foreach aggregation function
                for (var j = 0; j < aggregationFunctions.length; j++) {

                    // apply finalization function, was not applied since now
                    // todo verify if can be moved above
                    // note that finalization can't be applyed at init cause we don't know in advance wich partitions data are present


                    var tmpPartitionFields = [];
                    if (partitionFields[aggregationFunctions[j]] != null)
                        tmpPartitionFields = partitionFields[aggregationFunctions[j]];
                    recline.Data.Aggregations.finalizeFunctions[aggregationFunctions[j]](
                        currentField,
                        aggregatedFields,
                        _.keys(tmpPartitionFields));

                    var tempValue;


                    if (typeof currentField[aggregationFunctions[j]] == 'function')
                        tempValue = currentField[aggregationFunctions[j]]();
                    else
                        tempValue = currentField[aggregationFunctions[j]];


                    for (var x in tempValue) {

                        var tempValue2;
                        if (typeof tempValue[x] == 'function')
                            tempValue2 = tempValue[x]();
                        else
                            tempValue2 = tempValue[x];

                        tmp[x + "_" + aggregationFunctions[j]] = tempValue2;
                    }


                    // adding partition records
                    if (partitioning) {
                        var tempValue;
                        if (typeof currentField.partitions[aggregationFunctions[j]] == 'function')
                            tempValue = currentField.partitions[aggregationFunctions[j]]();
                        else
                            tempValue = currentField.partitions[aggregationFunctions[j]];

                        for (var x in tempValue) {
                            var tempValue2;
                            if (typeof currentField.partitions[aggregationFunctions[j]] == 'function')
                                tempValue2 = currentField.partitions[aggregationFunctions[j]]();
                            else
                                tempValue2 = currentField.partitions[aggregationFunctions[j]];

                            var fieldName = x + "_" + aggregationFunctions[j];

                            tmp[fieldName] = tempValue2[x].value;


                        }

                    }

                }

                // count is always calculated for each partition
                if (partitioning) {
                    for (var x in tmpField.partitions["count"]) {
                        if (currentResult.value.partitions["count"][x] == null)
                            tmp[x + "_count"] = 0;
                        else
                            tmp[x + "_count"] = currentResult.value.partitions["count"][x].value;
                    }
                }


                result.push(tmp);
            }

            return result;
        },

        buildFields:function (reducedResult, originalFields, partitionFields, dimensions, aggregationFunctions) {
            var self = this;

            var fields = [];

            var tmpField;
            if (dimensions == null ) {
                if(reducedResult.constructor != Array)
                    tmpField = reducedResult;
                else
                if (reducedResult.length > 0) {
                    tmpField = reducedResult[0];
                }
                else
                    tmpField = {count:0};
            }
            else {
                if (reducedResult.length > 0) {
                    tmpField = reducedResult[0].value;
                }
                else
                    tmpField = {count:0};
            }


            // creation of fields

            fields.push({id:"count", type:"integer"});

            // defining fields based on aggreagtion functions
            for (var j = 0; j < aggregationFunctions.length; j++) {

                var tempValue;
                if (typeof tmpField[aggregationFunctions[j]] == 'function')
                    tempValue = tmpField[aggregationFunctions[j]]();
                else
                    tempValue = tmpField[aggregationFunctions[j]];

                for (var x in tempValue) {
                    var originalFieldAttributes = originalFields.get(x).attributes;
                    var newType = recline.Data.Aggregations.resultingDataType[aggregationFunctions[j]](originalFieldAttributes.type);

                    fields.push({
                        id:x + "_" + aggregationFunctions[j],
                        type:newType,
                        is_partitioned:false,
                        colorSchema:originalFieldAttributes.colorSchema,
                        shapeSchema:originalFieldAttributes.shapeSchema,
                        originalField:x,
                        aggregationFunction:aggregationFunctions[j]
                    });
                }

                // add partition fields
                _.each(partitionFields, function (aggrFunction) {
                    _.each(aggrFunction, function (d) {
                        var originalFieldAttributes = originalFields.get(d.field).attributes;
                        var newType = recline.Data.Aggregations.resultingDataType[aggregationFunctions[j]](originalFieldAttributes.type);

                        var fieldId = d.id;
                        var fieldLabel = fieldId;

                        if (self.attributes.fieldLabelForPartitions) {
                            fieldLabel = self.attributes.fieldLabelForPartitions
                                .replace("{originalField}", d.originalField)
                                .replace("{partitionFieldName}", d.field)
                                .replace("{partitionFieldValue}", d.value)
                                .replace("{aggregatedFunction}", aggregationFunctions[j]);
                        }

                        fields.push({
                                id:fieldId,
                                type:newType,
                                is_partitioned:true,
                                partitionField:d.field,
                                partitionValue:d.value,
                                colorSchema:originalFieldAttributes.colorSchema, // the schema is the one used to specify partition
                                shapeSchema:originalFieldAttributes.shapeSchema,
                                originalField:d.originalField,
                                aggregationFunction:aggregationFunctions[j],
                                label:fieldLabel
                            }
                        );
                    })
                });

            }

            // adding all dimensions to field list
            if (dimensions != null) {
                fields.push({id:"dimension"});
                for (var i = 0; i < dimensions.length; i++) {
                    var originalFieldAttributes = originalFields.get(dimensions[i]).attributes;
                    fields.push({
                        id:dimensions[i],
                        type:originalFieldAttributes.type,
                        label:originalFieldAttributes.label,
                        format:originalFieldAttributes.format,
                        colorSchema:originalFieldAttributes.colorSchema,
                        shapeSchema:originalFieldAttributes.shapeSchema
                    });

                }
            }


            return fields;
        },

        query:function (queryObj) {

            var self = this;
            var dfd = $.Deferred();
            this.trigger('query:start');

            if (queryObj) {
                this.queryState.set(queryObj, {silent:true});
            }
            var actualQuery = this.queryState.toJSON();
            console.log("VModel [" + self.attributes.name + "] query [" + JSON.stringify(actualQuery) + "]");

            if (this._store == null) {
                console.log("Warning query called before data has been calculated for virtual model, call fetch on source dataset");
                return;
            }

            self.clearFilteredTotals();

            this._store.query(actualQuery, this.toJSON())
                .done(function (queryResult) {
                    self._handleQueryResult(queryResult);
                    self.trigger('query:done');
                    dfd.resolve(self.records);
                })
                .fail(function (arguments) {
                    self.trigger('query:fail', arguments);
                    dfd.reject(arguments);
                });
            return dfd.promise();
        },

        selection:function (queryObj) {
            var self = this;

            this.trigger('selection:start');

            if (queryObj) {
                self.queryState.set(queryObj, {silent:true});
            }
            var actualQuery = self.queryState


            // apply on current records
            // needed cause memory store is not mandatory
            recline.Data.Filters.applySelectionsOnData(self.queryState.get('selections'), self.records.models, self.fields);

            self.queryState.trigger('selection:done');

        },

        _handleQueryResult:function (queryResult) {
            var self = this;
            self.recordCount = queryResult.total;
            var docs = _.map(queryResult.hits, function (hit) {
                var _doc = new my.Record(hit);
                _doc.fields = self.fields;
                return _doc;
            });

                self.clearFilteredTotals();
                self.records.reset(docs);


            if (queryResult.facets) {
                var facets = _.map(queryResult.facets, function (facetResult, facetId) {
                    facetResult.id = facetId;
                    var result = new my.Facet(facetResult);

                    self.addColorsToTerms(facetId, result.attributes.terms);

                    return result;
                });
                self.facets.reset(facets);
            }


        },


        setColorSchema:function (type) {
            var self = this;
            _.each(self.attributes.colorSchema, function (d) {
                var field = _.find(self.getFields(type).models, function (f) {
                    return d.field === f.id
                });
                if (field != null)
                    field.attributes.colorSchema = d.schema;
            })
        },

        setShapeSchema:function (type) {
            var self = this;
            _.each(self.attributes.shapeSchema, function (d) {
                var field = _.find(self.getFields(type).models, function (f) {
                    return d.field === f.id
                });
                if (field != null)
                    field.attributes.shapeSchema = d.schema;
            })
        },

        addColorsToTerms:function (field, terms) {
            var self = this;
            _.each(terms, function (t) {

                // assignment of color schema to fields
                if (self.attributes.colorSchema) {
                    _.each(self.attributes.colorSchema, function (d) {
                        if (d.field === field)
                            t.color = d.schema.getColorFor(t.term);
                    })
                }
            });
        },

        getFacetByFieldId:function (fieldId) {
            return _.find(this.facets.models, function (facet) {
                return facet.id == fieldId;
            });
        },

        toTemplateJSON:function () {
            var data = this.records.toJSON();
            data.recordCount = this.recordCount;
            data.fields = this.fields.toJSON();
            return data;
        },

        // ### getFieldsSummary
        //
        // Get a summary for each field in the form of a `Facet`.
        //
        // @return null as this is async function. Provides deferred/promise interface.
        getFieldsSummary:function () {
            // TODO update function in order to manage facets/filter and selection

            var self = this;
            var query = new my.Query();
            query.set({size:0});

            var dfd = $.Deferred();
            this._store.query(query.toJSON(), this.toJSON()).done(function (queryResult) {
                if (queryResult.facets) {
                    _.each(queryResult.facets, function (facetResult, facetId) {
                        facetResult.id = facetId;
                        var facet = new my.Facet(facetResult);
                        // TODO: probably want replace rather than reset (i.e. just replace the facet with this id)
                        self.fields.get(facetId).facets.reset(facet);
                    });
                }
                dfd.resolve(queryResult);
            });
            return dfd.promise();
        },

        // Retrieve the list of partitioned field for the specified aggregated field
        getPartitionedFields:function (partitionedField, measureField) {
            //var field = this.fields.get(fieldName);

            var fields = _.filter(this.fields.models, function (d) {
                return (
                    d.attributes.partitionField == partitionedField
                        && d.attributes.originalField == measureField
                    );
            });

            if (fields == null)
                field = [];

            //fields.push(field);

            return fields;

        },

        isFieldPartitioned:function (fieldName, type) {
            return  this.getFields(type).get(fieldName).attributes.aggregationFunction
                && this.attributes.aggregation.partitions;
        },

        getPartitionedFieldsForAggregationFunction:function (aggregationFunction, aggregatedFieldName) {
            var self = this;
            var fields = [];

            _.each(self.partitionFields[aggregationFunction], function (p) {
                if (p.originalField == aggregatedFieldName)
                    fields.push(self.fields.get(p.id));
            });

            return fields;
        }

    });


}(jQuery, this.recline.Model));

this.recline = this.recline || {};
this.recline.Template = this.recline.Template || {};
this.recline.Template.Shapes = this.recline.Template.Shapes || {};

(function($, my) {

   my.Shapes = {
        circle: function(color, isNode, isSVG) {
            var template = '<circle cx="100" cy="50" r="40" stroke="black" stroke-width="2" fill="{{color}}"/>';

            var data = {color: color};

            return my._internalDataConversion(isNode, isSVG, template, data );


        },
       empty: function(color, isNode, isSVG) { my._internalDataConversion(isNode, isSVG,  ""); }
   };

   my._internalDataConversion = function(isNode, isSVG, mustacheTemplate, mustacheData) {
       if(isSVG) {
           mustacheTemplate = "<svg>"+ mustacheTemplate +"</svg>";
       }
       var res =  Mustache.render(mustacheTemplate, mustacheData);

        if(isNode)
            return jQuery(res);
        else
            return res;
   }

}(jQuery, this.recline.Template));
this.recline = this.recline || {};
this.recline.View = this.recline.View || {};

(function ($, view) {
	
	"use strict";	

    // dimension: female male
    // measures: visits

    view.Composed = Backbone.View.extend({
        templates: {
        horizontal: '<div id="{{uid}}"> ' +
                '<div class="composedview_table">' +
                '<div class="c_group c_header">' +
                '<div class="c_row">' +
                    '<div class="cell cell_empty"></div>' +
                        '{{#dimensions}}' +
                            '<div class="cell cell_name">{{term}}</div>' +
                        '{{/dimensions}}' +
                    '</div>' +
                '</div>' +
                '<div class="c_group c_body">' +
                    '<div class="c_row">' +
            '<div class="cell cell_title">{{title}}</div>' +
            '{{#dimensions}}' +
            '{{#measures}}' +
                            '<div class="cell cell_graph" id="{{id}}"></div>' +
                    '{{/measures}}' +
                 '{{/dimensions}}' +
            '</div>' +
                '</div>' +
                '<div class="c_group c_footer"></div>' +
                '</div>' +
                '<div> ',

        vertical: '<div id="{{uid}}"> ' +
            '<div class="composedview_table">' +
            '<div class="c_group c_header">' +
            '<div class="c_row">' +
            '<div class="cell cell_empty"></div>' +
            '{{#measures}}' +
            '<div class="cell cell_title">{{title}}</div>' +
            '{{/measures}}' +
            '</div>' +
            '</div>' +
            '<div class="c_group c_body">' +
            '{{#dimensions}}' +
            '<div class="c_row">' +
            '<div class="cell cell_name">{{term}}</div>' +
            '{{#measures}}' +
            '<div class="cell cell_graph" id="{{id}}"></div>' +
            '{{/measures}}' +
            '</div>' +
            '{{/dimensions}}' +
            '</div>' +
            '<div class="c_group c_footer"></div>' +
            '</div>' +
            '<div> '
        },

        initialize: function (options) {

            this.el = $(this.el);
    		_.bindAll(this, 'render', 'redraw');
                     

            this.model.bind('change', this.render);
            this.model.fields.bind('reset', this.render);
            this.model.fields.bind('add', this.render);

            this.model.bind('query:done', this.redraw);
            this.model.queryState.bind('selection:done', this.redraw);


			this.uid = options.id || ("composed_" + new Date().getTime() + Math.floor(Math.random() * 10000)); // generating an unique id for the chart


            //contains the array of views contained in the composed view
            this.views = [];

            //if(this.options.template)
            //    this.template = this.options.template;

        },
        
        resize: function(){

        },

        render: function () {
            var self=this;
            var graphid="#" + this.uid;

            if(self.graph)
                jQuery(graphid).empty();

            //self.graph =
        },

        redraw: function () {
            var self=this;

            self.dimensions= [ ];

            // if a dimension is defined I need a facet to identify all possibile values
            if(self.options.groupBy) {
                var facets = this.model.getFacetByFieldId(self.options.groupBy);
                var field = this.model.fields.get(self.options.groupBy);

                if (!facets) {
                    throw "ComposedView: no facet present for dimension [" + this.attributes.dimension + "]. Define a facet on the model before view render";
                }

                _.each(facets.attributes.terms, function(t) {
                    if(t.count > 0)  {
                        var uid = (new Date().getTime() + Math.floor(Math.random() * 10000)); // generating an unique id for the chart
                        self.dimensions.push(self.addFilteredMeasuresToDimension({term:t.term, id: uid}, field));
                    }
                })

            } else
            {
                var field = this.model.fields.get(self.options.dimension);

                _.each(self.model.getRecords(self.options.resultType), function(r) {
                    var uid = (new Date().getTime() + Math.floor(Math.random() * 10000)); // generating an unique id for the chart
                    self.dimensions.push( self.addMeasuresToDimension({term: r.getFieldValue(field), id: uid}, field, r));
                });

            }
            this.measures=this.options.measures;

            var tmpl = this.templates.vertical;
            if(this.options.template)
                tmpl = this.templates[this.options.template];

            var out = Mustache.render(tmpl, self);
            this.el.html(out);

            this.attachViews();

            //var field = this.model.getFields();
            //var records = _.map(this.options.model.getRecords(this.options.resultType.type), function(record) {
            //    return record.getFieldValueUnrendered(field);
            //});



            //this.drawD3(records, "#" + this.uid);
        },

        attachViews: function() {
            var self=this;
            _.each(self.dimensions, function(dim) {
                _.each(dim.measures, function(m) {
                    var $el = $('#' + m.id);
                    m.props["el"] = $el;
                    m.props["model"] = m.dataset;
                    var view =  new recline.View[m.view](m.props);
                    self.views.push(view);

                    if(typeof(view.render) != 'undefined'){ view.render(); }
                    if(typeof(view.redraw) != 'undefined'){ view.redraw(); }

                })
            })
        },



        addFilteredMeasuresToDimension: function(currentRow, dimensionField) {
            var self=this;

            // dimension["data"] = [view]
            // a filtered dataset should be created on the original data and must be associated to the view
            var filtereddataset = new recline.Model.FilteredDataset({dataset: self.model});

            var filter = {field: dimensionField.get("id"), type: "term", term: currentRow.term, fieldType: dimensionField.get("type") };
            filtereddataset.queryState.addFilter(filter);
            filtereddataset.query();
            // foreach measure we need to add a view do the dimension

            var data = [];
            _.each(self.options.measures, function(d) {
                var uid = (new Date().getTime() + Math.floor(Math.random() * 10000)); // generating an unique id for the chart
                var val = {view: d.view, id: uid, props:d.props, dataset: filtereddataset, title:d.title};
                data.push(val);
            });

            currentRow["measures"] = data;
            return currentRow;

        },

        addMeasuresToDimension: function(currentRow, dimensionField, record) {
            var self=this;

            var ds = new recline.Model.Dataset({
                     records: [record.toJSON()],
                    fields: self.model.fields.toJSON()
                });


            var data = [];
            _.each(self.options.measures, function(d) {
                var uid = (new Date().getTime() + Math.floor(Math.random() * 10000)); // generating an unique id for the chart
                var val = {view: d.view, id: uid, props:d.props, dataset: ds, title:d.title};
                data.push(val);
            });

            currentRow["measures"] = data;
            return currentRow;

        }


    });
})(jQuery, recline.View);/*jshint multistr:true */

this.recline = this.recline || {};
this.recline.View = this.recline.View || {};

(function($, my) {

// ## Graph view for a Dataset using Flot graphing library.
//
// Initialization arguments (in a hash in first parameter):
//
// * model: recline.Model.Dataset
// * state: (optional) configuration hash of form:
//
//        { 
//          group: {column name for x-axis},
//          series: [{column name for series A}, {column name series B}, ... ],
//          graphType: 'line'
//        }
//
// NB: should *not* provide an el argument to the view but must let the view
// generate the element itself (you can then append view.el to the DOM.
my.Graph = Backbone.View.extend({
  template: ' \
    <div class="recline-graph"> \
      <div class="panel graph" style="display: block;"> \
        <div class="js-temp-notice alert alert-block"> \
          <h3 class="alert-heading">Hey there!</h3> \
          <p>There\'s no graph here yet because we don\'t know what fields you\'d like to see plotted.</p> \
          <p>Please tell us by <strong>using the menu on the right</strong> and a graph will automatically appear.</p> \
        </div> \
      </div> \
    </div> \
',

  initialize: function(options) {
    var self = this;
    this.graphColors = ["#edc240", "#afd8f8", "#cb4b4b", "#4da74d", "#9440ed"];

    this.el = $(this.el);
    _.bindAll(this, 'render', 'redraw');
    this.needToRedraw = false;
    this.model.bind('change', this.render);
    this.model.fields.bind('reset', this.render);
    this.model.fields.bind('add', this.render);
    this.model.records.bind('add', this.redraw);
    this.model.records.bind('reset', this.redraw);
    var stateData = _.extend({
        group: null,
        // so that at least one series chooser box shows up
        series: [],
        graphType: 'lines-and-points'
      },
      options.state
    );
    this.state = new recline.Model.ObjectState(stateData);
    this.editor = new my.GraphControls({
      model: this.model,
      state: this.state.toJSON()
    });
    this.editor.state.bind('change', function() {
      self.state.set(self.editor.state.toJSON());
      self.redraw();
    });
    this.elSidebar = this.editor.el;
  },

  render: function() {
    var self = this;
    var tmplData = this.model.toTemplateJSON();
    var htmls = Mustache.render(this.template, tmplData);
    $(this.el).html(htmls);
    this.$graph = this.el.find('.panel.graph');
    return this;
  },

  redraw: function() {
    // There appear to be issues generating a Flot graph if either:

    // * The relevant div that graph attaches to his hidden at the moment of creating the plot -- Flot will complain with
    //
    //   Uncaught Invalid dimensions for plot, width = 0, height = 0
    // * There is no data for the plot -- either same error or may have issues later with errors like 'non-existent node-value' 
    var areWeVisible = !jQuery.expr.filters.hidden(this.el[0]);
    if ((!areWeVisible || this.model.records.length === 0)) {
      this.needToRedraw = true;
      return;
    }

    // check we have something to plot
    if (this.state.get('group') && this.state.get('series')) {
      // faff around with width because flot draws axes *outside* of the element width which means graph can get push down as it hits element next to it
      this.$graph.width(this.el.width() - 20);
      var series = this.createSeries();
      var options = this.getGraphOptions(this.state.attributes.graphType);
      this.plot = Flotr.draw(this.$graph.get(0), series, options);
    }
  },

  show: function() {
    // because we cannot redraw when hidden we may need to when becoming visible
    if (this.needToRedraw) {
      this.redraw();
    }
  },

  // ### getGraphOptions
  //
  // Get options for Flot Graph
  //
  // needs to be function as can depend on state
  //
  // @param typeId graphType id (lines, lines-and-points etc)
  getGraphOptions: function(typeId) { 
    var self = this;

    var tickFormatter = function (x) {
      return getFormattedX(x);
    };
    
    // infoboxes on mouse hover on points/bars etc
    var trackFormatter = function (obj) {
      var x = obj.x;
      var y = obj.y;
      // it's horizontal so we have to flip
      if (self.state.attributes.graphType === 'bars') {
        var _tmp = x;
        x = y;
        y = _tmp;
      }
      
      x = getFormattedX(x);

      var content = _.template('<%= group %> = <%= x %>, <%= series %> = <%= y %>', {
        group: self.state.attributes.group,
        x: x,
        series: obj.series.label,
        y: y
      });
      
      return content;
    };
    
    var getFormattedX = function (x) {
      var xfield = self.model.fields.get(self.state.attributes.group);

      // time series
      var xtype = xfield.get('type');
      var isDateTime = (xtype === 'date' || xtype === 'date-time' || xtype  === 'time');

      if (self.model.records.models[parseInt(x)]) {
        x = self.model.records.models[parseInt(x)].get(self.state.attributes.group);
        if (isDateTime) {
          x = new Date(x).toLocaleDateString();
        }
      } else if (isDateTime) {
        x = new Date(parseInt(x)).toLocaleDateString();
      }
      return x;    
    }
    
    var xaxis = {};
    xaxis.tickFormatter = tickFormatter;

    var yaxis = {};
    yaxis.autoscale = true;
    yaxis.autoscaleMargin = 0.02;
    
    var mouse = {};
    mouse.track = true;
    mouse.relative = true;
    mouse.trackFormatter = trackFormatter;
    
    var legend = {};
    legend.position = 'ne';
    
    // mouse.lineColor is set in createSeries
    var optionsPerGraphType = { 
      lines: {
        legend: legend,
        colors: this.graphColors,
        lines: { show: true },
        xaxis: xaxis,
        yaxis: yaxis,
        mouse: mouse
      },
      points: {
        legend: legend,
        colors: this.graphColors,
        points: { show: true, hitRadius: 5 },
        xaxis: xaxis,
        yaxis: yaxis,
        mouse: mouse,
        grid: { hoverable: true, clickable: true }
      },
      'lines-and-points': {
        legend: legend,
        colors: this.graphColors,
        points: { show: true, hitRadius: 5 },
        lines: { show: true },
        xaxis: xaxis,
        yaxis: yaxis,
        mouse: mouse,
        grid: { hoverable: true, clickable: true }
      },
      bars: {
        legend: legend,
        colors: this.graphColors,
        lines: { show: false },
        xaxis: yaxis,
        yaxis: xaxis,
        mouse: { 
          track: true,
          relative: true,
          trackFormatter: trackFormatter,
          fillColor: '#FFFFFF',
          fillOpacity: 0.3,
          position: 'e'
        },
        bars: {
          show: true,
          horizontal: true,
          shadowSize: 0,
          barWidth: 0.8         
        }
      },
      columns: {
        legend: legend,
        colors: this.graphColors,
        lines: { show: false },
        xaxis: xaxis,
        yaxis: yaxis,
        mouse: { 
            track: true,
            relative: true,
            trackFormatter: trackFormatter,
            fillColor: '#FFFFFF',
            fillOpacity: 0.3,
            position: 'n'
        },
        bars: {
            show: true,
            horizontal: false,
            shadowSize: 0,
            barWidth: 0.8         
        }
      },
      grid: { hoverable: true, clickable: true }
    };
    return optionsPerGraphType[typeId];
  },

  createSeries: function() {
    var self = this;
    var series = [];
    _.each(this.state.attributes.series, function(field) {
      var points = [];
      _.each(self.model.records.models, function(doc, index) {
        var xfield = self.model.fields.get(self.state.attributes.group);
        var x = doc.getFieldValue(xfield);

        // time series
        var xtype = xfield.get('type');
        var isDateTime = (xtype === 'date' || xtype === 'date-time' || xtype  === 'time');
        
        if (isDateTime) {
          // datetime
          if (self.state.attributes.graphType != 'bars' && self.state.attributes.graphType != 'columns') {
            // not bar or column
            x = new Date(x).getTime();
          } else {
            // bar or column
            x = index;
          }
        } else if (typeof x === 'string') {
          // string
          x = parseFloat(x);
          if (isNaN(x)) {
            x = index;
          }
        }

        var yfield = self.model.fields.get(field);
        var y = doc.getFieldValue(yfield);
        
        // horizontal bar chart
        if (self.state.attributes.graphType == 'bars') {
          points.push([y, x]);
        } else {
          points.push([x, y]);
        }
      });
      series.push({data: points, label: field, mouse:{lineColor: self.graphColors[series.length]}});
    });
    return series;
  }
});

my.GraphControls = Backbone.View.extend({
  className: "editor",
  template: ' \
  <div class="editor"> \
    <form class="form-stacked"> \
      <div class="clearfix"> \
        <label>Graph Type</label> \
        <div class="input editor-type"> \
          <select> \
          <option value="lines-and-points">Lines and Points</option> \
          <option value="lines">Lines</option> \
          <option value="points">Points</option> \
          <option value="bars">Bars</option> \
          <option value="columns">Columns</option> \
          </select> \
        </div> \
        <label>Group Column (x-axis)</label> \
        <div class="input editor-group"> \
          <select> \
          <option value="">Please choose ...</option> \
          {{#fields}} \
          <option value="{{id}}">{{label}}</option> \
          {{/fields}} \
          </select> \
        </div> \
        <div class="editor-series-group"> \
        </div> \
      </div> \
      <div class="editor-buttons"> \
        <button class="btn editor-add">Add Series</button> \
      </div> \
      <div class="editor-buttons editor-submit" comment="hidden temporarily" style="display: none;"> \
        <button class="editor-save">Save</button> \
        <input type="hidden" class="editor-id" value="chart-1" /> \
      </div> \
    </form> \
  </div> \
',
  templateSeriesEditor: ' \
    <div class="editor-series js-series-{{seriesIndex}}"> \
      <label>Series <span>{{seriesName}} (y-axis)</span> \
        [<a href="#remove" class="action-remove-series">Remove</a>] \
      </label> \
      <div class="input"> \
        <select> \
        {{#fields}} \
        <option value="{{id}}">{{label}}</option> \
        {{/fields}} \
        </select> \
      </div> \
    </div> \
  ',
  events: {
    'change form select': 'onEditorSubmit',
    'click .editor-add': '_onAddSeries',
    'click .action-remove-series': 'removeSeries'
  },

  initialize: function(options) {
    var self = this;
    this.el = $(this.el);
    _.bindAll(this, 'render');
    this.model.fields.bind('reset', this.render);
    this.model.fields.bind('add', this.render);
    this.state = new recline.Model.ObjectState(options.state);
    this.render();
  },

  render: function() {
    var self = this;
    var tmplData = this.model.toTemplateJSON();
    var htmls = Mustache.render(this.template, tmplData);
    this.el.html(htmls);

    // set up editor from state
    if (this.state.get('graphType')) {
      this._selectOption('.editor-type', this.state.get('graphType'));
    }
    if (this.state.get('group')) {
      this._selectOption('.editor-group', this.state.get('group'));
    }
    // ensure at least one series box shows up
    var tmpSeries = [""];
    if (this.state.get('series').length > 0) {
      tmpSeries = this.state.get('series');
    }
    _.each(tmpSeries, function(series, idx) {
      self.addSeries(idx);
      self._selectOption('.editor-series.js-series-' + idx, series);
    });
    return this;
  },

  // Private: Helper function to select an option from a select list
  //
  _selectOption: function(id,value){
    var options = this.el.find(id + ' select > option');
    if (options) {
      options.each(function(opt){
        if (this.value == value) {
          $(this).attr('selected','selected');
          return false;
        }
      });
    }
  },

  onEditorSubmit: function(e) {
    var select = this.el.find('.editor-group select');
    var $editor = this;
    var $series  = this.el.find('.editor-series select');
    var series = $series.map(function () {
      return $(this).val();
    });
    var updatedState = {
      series: $.makeArray(series),
      group: this.el.find('.editor-group select').val(),
      graphType: this.el.find('.editor-type select').val()
    };
    this.state.set(updatedState);
  },

  // Public: Adds a new empty series select box to the editor.
  //
  // @param [int] idx index of this series in the list of series
  //
  // Returns itself.
  addSeries: function (idx) {
    var data = _.extend({
      seriesIndex: idx,
      seriesName: String.fromCharCode(idx + 64 + 1)
    }, this.model.toTemplateJSON());

    var htmls = Mustache.render(this.templateSeriesEditor, data);
    this.el.find('.editor-series-group').append(htmls);
    return this;
  },

  _onAddSeries: function(e) {
    e.preventDefault();
    this.addSeries(this.state.get('series').length);
  },

  // Public: Removes a series list item from the editor.
  //
  // Also updates the labels of the remaining series elements.
  removeSeries: function (e) {
    e.preventDefault();
    var $el = $(e.target);
    $el.parent().parent().remove();
    this.onEditorSubmit();
  }
});

})(jQuery, recline.View);

/*jshint multistr:true */

this.recline = this.recline || {};
this.recline.View = this.recline.View || {};

(function($, my) {
// ## (Data) Grid Dataset View
//
// Provides a tabular view on a Dataset.
//
// Initialize it with a `recline.Model.Dataset`.
my.Grid = Backbone.View.extend({
  tagName:  "div",
  className: "recline-grid-container",

  initialize: function(modelEtc) {
    var self = this;
    this.el = $(this.el);
    _.bindAll(this, 'render', 'onHorizontalScroll');

    this.model.records.bind('add', this.render);
    this.model.records.bind('reset', this.render);
    this.model.records.bind('remove', this.render);
    this.tempState = {};
    var state = _.extend({
        hiddenFields: []
      }, modelEtc.state
    ); 
    this.state = new recline.Model.ObjectState(state);
  },

  events: {
    // does not work here so done at end of render function
    // 'scroll .recline-grid tbody': 'onHorizontalScroll'
  },

  // ======================================================
  // Column and row menus

  setColumnSort: function(order) {
    var sort = [{}];
    sort[0][this.tempState.currentColumn] = {order: order};
    this.model.query({sort: sort});
  },
  
  hideColumn: function() {
    var hiddenFields = this.state.get('hiddenFields');
    hiddenFields.push(this.tempState.currentColumn);
    this.state.set({hiddenFields: hiddenFields});
    // change event not being triggered (because it is an array?) so trigger manually
    this.state.trigger('change');
    this.render();
  },
  
  showColumn: function(e) {
    var hiddenFields = _.without(this.state.get('hiddenFields'), $(e.target).data('column'));
    this.state.set({hiddenFields: hiddenFields});
    this.render();
  },

  onHorizontalScroll: function(e) {
    var currentScroll = $(e.target).scrollLeft();
    this.el.find('.recline-grid thead tr').scrollLeft(currentScroll);
  },

  // ======================================================
  // #### Templating
  template: ' \
    <div class="table-container"> \
    <table class="recline-grid table-striped table-condensed" cellspacing="0"> \
      <thead class="fixed-header"> \
        <tr> \
          {{#fields}} \
            <th class="column-header {{#hidden}}hidden{{/hidden}}" data-field="{{id}}" style="width: {{width}}px; max-width: {{width}}px; min-width: {{width}}px;" title="{{label}}"> \
              <span class="column-header-name">{{label}}</span> \
            </th> \
          {{/fields}} \
          <th class="last-header" style="width: {{lastHeaderWidth}}px; max-width: {{lastHeaderWidth}}px; min-width: {{lastHeaderWidth}}px; padding: 0; margin: 0;"></th> \
        </tr> \
      </thead> \
      <tbody class="scroll-content"></tbody> \
    </table> \
    </div> \
  ',

  toTemplateJSON: function() {
    var self = this; 
    var modelData = this.model.toJSON();
    modelData.notEmpty = ( this.fields.length > 0 );
    // TODO: move this sort of thing into a toTemplateJSON method on Dataset?
    modelData.fields = _.map(this.fields, function(field) {
      return field.toJSON();
    });
    // last header width = scroll bar - border (2px) */
    modelData.lastHeaderWidth = this.scrollbarDimensions.width - 2;
    return modelData;
  },
  render: function() {
    var self = this;
    this.fields = this.model.fields.filter(function(field) {
      return _.indexOf(self.state.get('hiddenFields'), field.id) == -1;
    });
    this.scrollbarDimensions = this.scrollbarDimensions || this._scrollbarSize(); // skip measurement if already have dimensions
    var numFields = this.fields.length;
    // compute field widths (-20 for first menu col + 10px for padding on each col and finally 16px for the scrollbar)
    var fullWidth = self.el.width() - 20 - 10 * numFields - this.scrollbarDimensions.width;
    var width = parseInt(Math.max(50, fullWidth / numFields));
    // if columns extend outside viewport then remainder is 0 
    var remainder = Math.max(fullWidth - numFields * width,0);
    _.each(this.fields, function(field, idx) {
      // add the remainder to the first field width so we make up full col
      if (idx == 0) {
        field.set({width: width+remainder});
      } else {
        field.set({width: width});
      }
    });
    var htmls = Mustache.render(this.template, this.toTemplateJSON());
    this.el.html(htmls);
    this.model.records.forEach(function(doc) {
      var tr = $('<tr />');
      self.el.find('tbody').append(tr);
      var newView = new my.GridRow({
          model: doc,
          el: tr,
          fields: self.fields
        });
      newView.render();
    });
    // hide extra header col if no scrollbar to avoid unsightly overhang
    var $tbody = this.el.find('tbody')[0];
    if ($tbody.scrollHeight <= $tbody.offsetHeight) {
      this.el.find('th.last-header').hide();
    }
    this.el.find('.recline-grid').toggleClass('no-hidden', (self.state.get('hiddenFields').length === 0));
    this.el.find('.recline-grid tbody').scroll(this.onHorizontalScroll);
    return this;
  },

  // ### _scrollbarSize
  // 
  // Measure width of a vertical scrollbar and height of a horizontal scrollbar.
  //
  // @return: { width: pixelWidth, height: pixelHeight }
  _scrollbarSize: function() {
    var $c = $("<div style='position:absolute; top:-10000px; left:-10000px; width:100px; height:100px; overflow:scroll;'></div>").appendTo("body");
    var dim = { width: $c.width() - $c[0].clientWidth + 1, height: $c.height() - $c[0].clientHeight };
    $c.remove();
    return dim;
  }
});

// ## GridRow View for rendering an individual record.
//
// Since we want this to update in place it is up to creator to provider the element to attach to.
//
// In addition you *must* pass in a FieldList in the constructor options. This should be list of fields for the Grid.
//
// Example:
//
// <pre>
// var row = new GridRow({
//   model: dataset-record,
//     el: dom-element,
//     fields: mydatasets.fields // a FieldList object
//   });
// </pre>
my.GridRow = Backbone.View.extend({
  initialize: function(initData) {
    _.bindAll(this, 'render');
    this._fields = initData.fields;
    this.el = $(this.el);
    this.model.bind('change', this.render);
  },

  template: ' \
      {{#cells}} \
      <td data-field="{{field}}" style="width: {{width}}px; max-width: {{width}}px; min-width: {{width}}px;"> \
        <div class="data-table-cell-content"> \
          <a href="javascript:{}" class="data-table-cell-edit" title="Edit this cell">&nbsp;</a> \
          <div class="data-table-cell-value">{{{value}}}</div> \
        </div> \
      </td> \
      {{/cells}} \
    ',
  events: {
    'click .data-table-cell-edit': 'onEditClick',
    'click .data-table-cell-editor .okButton': 'onEditorOK',
    'click .data-table-cell-editor .cancelButton': 'onEditorCancel'
  },
  
  toTemplateJSON: function() {
    var self = this;
    var doc = this.model;
    var cellData = this._fields.map(function(field) {
      return {
        field: field.id,
        width: field.get('width'),
        value: doc.getFieldValue(field)
      };
    });
    return { id: this.id, cells: cellData };
  },

  render: function() {
    this.el.attr('data-id', this.model.id);
    var html = Mustache.render(this.template, this.toTemplateJSON());
    $(this.el).html(html);
    return this;
  },

  // ===================
  // Cell Editor methods

  cellEditorTemplate: ' \
    <div class="menu-container data-table-cell-editor"> \
      <textarea class="data-table-cell-editor-editor" bind="textarea">{{value}}</textarea> \
      <div id="data-table-cell-editor-actions"> \
        <div class="data-table-cell-editor-action"> \
          <button class="okButton btn primary">Update</button> \
          <button class="cancelButton btn danger">Cancel</button> \
        </div> \
      </div> \
    </div> \
  ',

  onEditClick: function(e) {
    var editing = this.el.find('.data-table-cell-editor-editor');
    if (editing.length > 0) {
      editing.parents('.data-table-cell-value').html(editing.text()).siblings('.data-table-cell-edit').removeClass("hidden");
    }
    $(e.target).addClass("hidden");
    var cell = $(e.target).siblings('.data-table-cell-value');
    cell.data("previousContents", cell.text());
    var templated = Mustache.render(this.cellEditorTemplate, {value: cell.text()});
    cell.html(templated);
  },

  onEditorOK: function(e) {
    var self = this;
    var cell = $(e.target);
    var rowId = cell.parents('tr').attr('data-id');
    var field = cell.parents('td').attr('data-field');
    var newValue = cell.parents('.data-table-cell-editor').find('.data-table-cell-editor-editor').val();
    var newData = {};
    newData[field] = newValue;
    this.model.set(newData);
    this.trigger('recline:flash', {message: "Updating row...", loader: true});
    this.model.save().then(function(response) {
        this.trigger('recline:flash', {message: "Row updated successfully", category: 'success'});
      })
      .fail(function() {
        this.trigger('recline:flash', {
          message: 'Error saving row',
          category: 'error',
          persist: true
        });
      });
  },

  onEditorCancel: function(e) {
    var cell = $(e.target).parents('.data-table-cell-value');
    cell.html(cell.data('previousContents')).siblings('.data-table-cell-edit').removeClass("hidden");
  }
});

})(jQuery, recline.View);
/*jshint multistr:true */

this.recline = this.recline || {};
this.recline.View = this.recline.View || {};

(function($, my) {

// ## Indicator view for a Dataset 
//
// Initialization arguments (in a hash in first parameter):
//
// * model: recline.Model.Dataset (should be a VirtualDataset that already performs the aggregation
// * state: (optional) configuration hash of form:
//
//        { 
//          series: [{column name for series A}, {column name series B}, ... ],   // only first record of dataset is used
//			format: (optional) format to use (see D3.format for reference)
//        }
//
// NB: should *not* provide an el argument to the view but must let the view
// generate the element itself (you can then append view.el to the DOM.
    my.Indicator = Backbone.View.extend({
	  defaults: {
		format: 'd'
	  },

  templateBase: '<div class="recline-indicator"> \
      <div class="panel indicator_{{viewId}}" style="display: block;"> \
        <div id="indicator_{{viewId}}"> \
			<table class="condensed-table border-free-table"> \
                <tr><td></td><td style="text-align: center;">{{label}}</td></tr>    \
                <tr><td></td><td style="text-align: center;"><small>{{description}}</small></td></tr>    \
                <tr><td><div>{{& shape}}</div></td><td style="text-align: center;"><strong>{{value}}</strong></td></tr>  \
             </table>  \
		</div>\
      </div> \
    </div> ',
  templatePercentageCompare: '<div class="recline-indicator"> \
      <div class="panel indicator_{{viewId}}" style="display: block;"> \
        <div id="indicator_{{viewId}}"> \
			 <table class="condensed-table border-free-table"> \
                <tr><td></td><td style="text-align: center;">{{label}}</td></tr>    \
                <tr><td></td><td style="text-align: center;"><small>{{description}}</small></td></tr>    \
                <tr><td><div>{{& shape}}</div></td><td style="text-align: center;"><strong>{{value}}</strong></td></tr>  \
                <tr><td></td><td style="text-align: center;"><small>% of total: {{comparePercentage}} ({{compareWithValue}})</small></td></tr>  \
             </table>  \
		</div>\
      </div> \
    </div> ',




  initialize: function(options) {
    var self = this;

    this.el = $(this.el);
    _.bindAll(this, 'render');
      this.uid = options.id || ("" + new Date().getTime() + Math.floor(Math.random() * 10000)); // generating an unique id for the chart

      this.options.state.kpi.dataset.bind('query:done', this.render);
      if(this.options.state.compareWith)
          this.options.state.compareWith.dataset.bind('query:done', this.render);

  },

    render: function() {
        var self = this;
        var tmplData = {};
        tmplData["viewId"] = this.uid;
		tmplData.label = this.options.state && this.options.state["label"];

        var kpi     = self.options.state.kpi.dataset.getRecords(self.options.state.kpi.type);
        //var field   = self.options.state.kpi.dataset.getFields(self.options.state.kpi.type).get(self.options.state.kpi.field);
        var field;
        if(self.options.state.kpi.aggr)
            field = self.options.state.kpi.dataset.getField_byAggregationFunction(self.options.state.kpi.type, self.options.state.kpi.field, self.options.state.kpi.aggr);
        else
            field = self.options.state.kpi.dataset.getFields(self.options.state.kpi.type).get(self.options.state.kpi.field);

        var kpiValue;




        if(kpi.length > 0) {
            kpiValue = kpi[0].getFieldValueUnrendered(field);
            tmplData["value"] = kpi[0].getFieldValue(field);
            tmplData["shape"] = kpi[0].getFieldShape(field, true, false);
        }
        else tmplData["value"] = "N/A"

        var template = this.templateBase;

        if(self.options.state.compareWith) {
            var compareWithRecord  = self.options.state.compareWith.dataset.getRecords(self.options.state.compareWith.type);
            var compareWithField;

            if(self.options.state.kpi.aggr)
                compareWithField= self.options.state.compareWith.dataset.getField_byAggregationFunction(self.options.state.compareWith.type, self.options.state.compareWith.field, self.options.state.compareWith.aggr);
            else
                compareWithField= self.options.state.compareWith.dataset.getFields(self.options.state.compareWith.type).get(self.options.state.compareWith.field);

            tmplData["compareWithValue"]  = compareWithRecord[0].getFieldValue(compareWithField);
            var compareWithValue =  compareWithRecord[0].getFieldValueUnrendered(compareWithField);

            var compareValue;
            if(self.options.state.compareWith.compareType == "percentage") {
                var tmpField = new recline.Model.Field({type: "number", format: "percentage"});

                tmplData["comparePercentage"]  =  recline.Data.Renderers(kpiValue / compareWithValue * 100, tmpField);
                template = this.templatePercentageCompare;
            }
        }


        if(this.options.state.description)
            tmplData["description"] = this.options.state.description;

        if(this.options.state.labelColor)
            tmplData["labelColor"] = this.options.state.labelColor;
        if(this.options.state.descriptionColor)
            tmplData["descriptionColor"] = this.options.state.descriptionColor;
        if(this.options.state.textColor)
            tmplData["textColor"] = this.options.state.textColor;

        var htmls = Mustache.render(template, tmplData);
        $(this.el).html(htmls);


        //this.$graph = this.el.find('.panel.indicator_' + tmplData["viewId"]);


        return this;
    }



});


})(jQuery, recline.View);
/*jshint multistr:true */

this.recline = this.recline || {};
this.recline.View = this.recline.View || {};

(function ($, my) {


    my.KartoGraph = Backbone.View.extend({

        template:'<div id="cartograph_{{viewId}}"></div> ',

        rendered: false,

        initialize:function (options) {
            var self = this;

            this.el = $(this.el);
            _.bindAll(this, 'render', 'redraw');

            this.model.bind('change', self.render);
            this.model.fields.bind('reset', self.render);
            this.model.fields.bind('add', self.render);

            this.model.bind('query:done', this.redraw);
            this.model.queryState.bind('selection:done', this.redraw);

            this.uid = "" + new Date().getTime() + Math.floor(Math.random() * 10000); // generating an unique id for the chart

            this.unselectedColor = "#C0C0C0";
            if (this.options.state.unselectedColor)
                this.unselectedColor = this.options.state.unselectedColor;

        },

        render:function () {
            var self = this;
            var tmplData = {};
            tmplData["viewId"] = this.uid;
            var htmls = Mustache.render(this.template, tmplData);
            $(this.el).html(htmls);

            var map_url = this.options.state["svgURI"];
            var layers = this.options.state["layers"];

            self.map = $K.map('#cartograph_' + this.uid);
            self.map.loadMap(map_url, function (m) {
                _.each(layers, function (d) {
                    m.addLayer(d, self.getEventsForLayer(d));
                });
                self.rendered = true;
                self.updateMap();


            });

            return this;
        },

        redraw:function () {
            var self = this;

            self.updateMap();
        },

        updateMap:function () {
            var self = this;

            if(!self.rendered)
                return;

            var map = self.map;


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
                        var res = filteredResults[d[currentMapping["destAttribute"]]];

                        // check if current shape is present into results
                           if(res != null)
                                return res.color;
                            else
                                return self.unselectedColor;
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

            var selectionActive = false;
            if (self.model.queryState.isSelected())
                selectionActive = true;

            var res = {};
            _.each(records, function (d) {

                if(_.contains(paths, d.getFieldValueUnrendered(srcShapef))) {
                    var color = self.unselectedColor;
                    if(selectionActive) {
                        if(d.isRecordSelected())
                            color = d.getFieldColor(srcValuef);
                    } else {
                            color = d.getFieldColor(srcValuef);
                    }


                    res[d.getFieldValueUnrendered(srcShapef)] =  {record: d, field: srcValuef, color: color, value:d.getFieldValueUnrendered(srcValuef) };

                }
            });

            return res;
        },

        getEventsForLayer: function(layer) {
            var self=this;
            var ret = {};

            // fiend all fields of this layer
            //  mapping: [{srcShapeField: "state", srcValueField: "value", destAttribute: "name", destLayer: "usa"}],

            var fields = _.filter(this.options.state["mapping"], function(m) {
                return m.destLayer == layer;
            });

            if(fields.length == 0)
                return {};
            if(fields.length > 1)
                throw "view.Kartograph.js: more than one field associated with layer, impossible to link with actions"

            //fields = _.map(fields, function(d) {return d.srcShapeField});

            // find all actions for selection
            var clickEvents = self.getActionsForEvent("selection");

            // filter actions that doesn't contain fields

            var clickActions = _.filter(clickEvents, function(d) {
                return d.mapping.srcField == fields.srcShapeField;
            });


            if(clickActions.length > 0)
            ret["click"] = function(data, path, event) {

                console.log(data);
                _.each(clickActions, function(a) {
                    var params = [];
                    _.each(a.mapping, function(m) {
                       params.push({filter:m.filter,  value: [data[fields[0].destAttribute]]});
                    });

                    a.action._internalDoAction(params, "add");
                });

            };

            return ret;
        },


        getMapping: function(srcField) {
            var self=this;
            var mapping = this.options.state["mapping"];
            return _.filter(mapping, function(d) {
                return d.srcShapeField == srcField
            });

        },

        /*bindEvents: function() {
            var self=this;
            var actions = self.getActionsForEvent("selection");

            map.addLayer('mylayer', {
                click: function(data, path, event) {
                    // handle mouse clicks
                    // *data* holds the data dictionary of the clicked path
                    // *path* is the raphael object
                    // *event* is the original JavaScript event
                }
            });

            if (actions.length > 0) {
                //

                options["callback"] = function (x) {

                    // selection is done on x axis so I need to take the record with range [min_x, max_x]
                    // is the group attribute
                    var record_min = _.min(x, function (d) {
                        return d.min.x
                    });
                    var record_max = _.max(x, function (d) {
                        return d.max.x
                    });

                    view.doActions(actions, [record_min.min.record, record_max.max.record]);

                };
            } else
                options["callback"] = function () {
                };
        },*/


        doActions:function (actions, data) {

            _.each(actions, function (d) {
                d.action._internalDoAction([data]);
            });

            params.push({
                filter : mapp.filter,
                value : values
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

/*jshint multistr:true */

this.recline = this.recline || {};
this.recline.View = this.recline.View || {};

(function($, my) {

// ## Map view for a Dataset using Leaflet mapping library.
//
// This view allows to plot gereferenced records on a map. The location
// information can be provided in 2 ways:
//
// 1. Via a single field. This field must be either a geo_point or 
// [GeoJSON](http://geojson.org) object
// 2. Via two fields with latitude and longitude coordinates.
//
// Which fields in the data these correspond to can be configured via the state
// (and are guessed if no info is provided).
//
// Initialization arguments are as standard for Dataset Views. State object may
// have the following (optional) configuration options:
//
// <pre>
//   {
//     // geomField if specified will be used in preference to lat/lon
//     geomField: {id of field containing geometry in the dataset}
//     lonField: {id of field containing longitude in the dataset}
//     latField: {id of field containing latitude in the dataset}
//     autoZoom: true,
//     // use cluster support
//     cluster: false
//   }
// </pre>
//
// Useful attributes to know about (if e.g. customizing)
//
// * map: the Leaflet map (L.Map)
// * features: Leaflet GeoJSON layer containing all the features (L.GeoJSON)
my.Map = Backbone.View.extend({
  template: ' \
    <div class="recline-map"> \
      <div class="panel map"></div> \
    </div> \
',

  // These are the default (case-insensitive) names of field that are used if found.
  // If not found, the user will need to define the fields via the editor.
  latitudeFieldNames: ['lat','latitude'],
  longitudeFieldNames: ['lon','longitude'],
  geometryFieldNames: ['geojson', 'geom','the_geom','geometry','spatial','location', 'geo', 'lonlat'],

  initialize: function(options) {
    var self = this;
    this.el = $(this.el);
    this.visible = true;
    this.mapReady = false;
    // this will be the Leaflet L.Map object (setup below)
    this.map = null;

    this.uid = options.id || ("" + new Date().getTime() + Math.floor(Math.random() * 10000)); // generating an unique id for the chart

    var stateData = _.extend({
        geomField: null,
        lonField: null,
        latField: null,
        autoZoom: true,
        cluster: false
      },
      options.state
    );
    this.state = new recline.Model.ObjectState(stateData);

    this._clusterOptions = {
      zoomToBoundsOnClick: true,
      //disableClusteringAtZoom: 10,
      maxClusterRadius: 80,
      singleMarkerMode: false,
      skipDuplicateAddTesting: true,
      animateAddingMarkers: false
    };

    // Listen to changes in the fields
    this.model.fields.bind('change', function() {
      self._setupGeometryField();
      self.render();
    });

    // Listen to changes in the records
    this.model.records.bind('add', function(doc){self.redraw('add',doc);});
    this.model.records.bind('change', function(doc){
        self.redraw('remove',doc);
        self.redraw('add',doc);
    });
    this.model.records.bind('remove', function(doc){self.redraw('remove',doc);});
    this.model.records.bind('reset', function(){self.redraw('reset');});

    this.menu = new my.MapMenu({
      model: this.model,
      state: this.state.toJSON()
    });
    this.menu.state.bind('change', function() {
      self.state.set(self.menu.state.toJSON());
      self.redraw();
    });
    this.state.bind('change', function() {
      self.redraw();
    });
    this.elSidebar = this.menu.el;
  },

  // ## Customization Functions
  //
  // The following methods are designed for overriding in order to customize
  // behaviour

  // ### infobox
  //
  // Function to create infoboxes used in popups. The default behaviour is very simple and just lists all attributes.
  //
  // Users should override this function to customize behaviour i.e.
  //
  //     view = new View({...});
  //     view.infobox = function(record) {
  //       ...
  //     }
  infobox: function(record) {
    var html = '';
    for (key in record.attributes){
      if (!(this.state.get('geomField') && key == this.state.get('geomField'))){
        html += '<div><strong>' + key + '</strong>: '+ record.attributes[key] + '</div>';
      }
    }
    return html;
  },

  // Options to use for the [Leaflet GeoJSON layer](http://leaflet.cloudmade.com/reference.html#geojson)
  // See also <http://leaflet.cloudmade.com/examples/geojson.html>
  //
  // e.g.
  //
  //     pointToLayer: function(feature, latLng)
  //     onEachFeature: function(feature, layer)
  //
  // See defaults for examples
  geoJsonLayerOptions: {
    // pointToLayer function to use when creating points
    //
    // Default behaviour shown here is to create a marker using the
    // popupContent set on the feature properties (created via infobox function
    // during feature generation)
    //
    // NB: inside pointToLayer `this` will be set to point to this map view
    // instance (which allows e.g. this.markers to work in this default case)
    pointToLayer: function (feature, latlng) {
      var marker = new L.Marker(latlng);
      marker.bindPopup(feature.properties.popupContent);
      // this is for cluster case
      this.markers.addLayer(marker);
      return marker;
    },
    // onEachFeature default which adds popup in
    onEachFeature: function(feature, layer) {
      if (feature.properties && feature.properties.popupContent) {
        layer.bindPopup(feature.properties.popupContent);
      }
    }
  },

  // END: Customization section
  // ----

  // ### Public: Adds the necessary elements to the page.
  //
  // Also sets up the editor fields and the map if necessary.
  render: function() {
    var self = this;

    htmls = Mustache.render(this.template, this.model.toTemplateJSON());
    $(this.el).html(htmls);
    this.$map = this.el.find('.panel.map');
    this.redraw();
    return this;
  },

  // ### Public: Redraws the features on the map according to the action provided
  //
  // Actions can be:
  //
  // * reset: Clear all features
  // * add: Add one or n features (records)
  // * remove: Remove one or n features (records)
  // * refresh: Clear existing features and add all current records
  redraw: function(action, doc){
    var self = this;
    action = action || 'refresh';
    // try to set things up if not already
    if (!self._geomReady()){
      self._setupGeometryField();
    }
    if (!self.mapReady){
      self._setupMap();
    }

    if (this._geomReady() && this.mapReady){
      // removing ad re-adding the layer enables faster bulk loading
      this.map.removeLayer(this.features);
      this.map.removeLayer(this.markers);

      var countBefore = 0;
      this.features.eachLayer(function(){countBefore++;});

      if (action == 'refresh' || action == 'reset') {
        this.features.clearLayers();
        // recreate cluster group because of issues with clearLayer
        this.map.removeLayer(this.markers);
        this.markers = new L.MarkerClusterGroup(this._clusterOptions);
        this._add(this.model.records.models);
      } else if (action == 'add' && doc){
        this._add(doc);
      } else if (action == 'remove' && doc){
        this._remove(doc);
      }

      // enable clustering if there is a large number of markers
      var countAfter = 0;
      this.features.eachLayer(function(){countAfter++;});
      var sizeIncreased = countAfter - countBefore > 0;
      if (!this.state.get('cluster') && countAfter > 64 && sizeIncreased) {
        this.state.set({cluster: true});
        return;
      }

      // this must come before zooming!
      // if not: errors when using e.g. circle markers like
      // "Cannot call method 'project' of undefined"
      if (this.state.get('cluster')) {
        this.map.addLayer(this.markers);
      } else {
        this.map.addLayer(this.features);
      }

      if (this.state.get('autoZoom')){
        if (this.visible){
          this._zoomToFeatures();
        } else {
          this._zoomPending = true;
        }
      }
    }
  },

  show: function() {
    // If the div was hidden, Leaflet needs to recalculate some sizes
    // to display properly
    if (this.map){
      this.map.invalidateSize();
      if (this._zoomPending && this.state.get('autoZoom')) {
        this._zoomToFeatures();
        this._zoomPending = false;
      }
    }
    this.visible = true;
  },

  hide: function() {
    this.visible = false;
  },

  _geomReady: function() {
    return Boolean(this.state.get('geomField') || (this.state.get('latField') && this.state.get('lonField')));
  },

  // Private: Add one or n features to the map
  //
  // For each record passed, a GeoJSON geometry will be extracted and added
  // to the features layer. If an exception is thrown, the process will be
  // stopped and an error notification shown.
  //
  // Each feature will have a popup associated with all the record fields.
  //
  _add: function(docs){
    var self = this;

    if (!(docs instanceof Array)) docs = [docs];

    var count = 0;
    var wrongSoFar = 0;
    _.every(docs, function(doc){
      count += 1;
      var feature = self._getGeometryFromRecord(doc);
      if (typeof feature === 'undefined' || feature === null){
        // Empty field
        return true;
      } else if (feature instanceof Object){
        feature.properties = {
          popupContent: self.infobox(doc),
          // Add a reference to the model id, which will allow us to
          // link this Leaflet layer to a Recline doc
          cid: doc.cid
        };

        try {
          self.features.addData(feature);
        } catch (except) {
          wrongSoFar += 1;
          var msg = 'Wrong geometry value';
          if (except.message) msg += ' (' + except.message + ')';
          if (wrongSoFar <= 10) {
            self.trigger('recline:flash', {message: msg, category:'error'});
          }
        }
      } else {
        wrongSoFar += 1;
        if (wrongSoFar <= 10) {
          self.trigger('recline:flash', {message: 'Wrong geometry value', category:'error'});
        }
      }
      return true;
    });
  },

  // Private: Remove one or n features from the map
  //
  _remove: function(docs){

    var self = this;

    if (!(docs instanceof Array)) docs = [docs];

    _.each(docs,function(doc){
      for (key in self.features._layers){
        if (self.features._layers[key].feature.properties.cid == doc.cid){
          self.features.removeLayer(self.features._layers[key]);
        }
      }
    });

  },

  // Private: Return a GeoJSON geomtry extracted from the record fields
  //
  _getGeometryFromRecord: function(doc){
    if (this.state.get('geomField')){
      var value = doc.get(this.state.get('geomField'));
      if (typeof(value) === 'string'){
        // We *may* have a GeoJSON string representation
        try {
          value = $.parseJSON(value);
        } catch(e) {}
      }

      if (typeof(value) === 'string') {
        value = value.replace('(', '').replace(')', '');
        var parts = value.split(',');
        var lat = parseFloat(parts[0]);
        var lon = parseFloat(parts[1]);
        if (!isNaN(lon) && !isNaN(parseFloat(lat))) {
          return {
            "type": "Point",
            "coordinates": [lon, lat]
          };
        } else {
          return null;
        }
      } else if (value && _.isArray(value)) {
        // [ lon, lat ]
        return {
          "type": "Point",
          "coordinates": [value[0], value[1]]
        };
      } else if (value && value.lat) {
        // of form { lat: ..., lon: ...}
        return {
          "type": "Point",
          "coordinates": [value.lon || value.lng, value.lat]
        };
      }
      // We o/w assume that contents of the field are a valid GeoJSON object
      return value;
    } else if (this.state.get('lonField') && this.state.get('latField')){
      // We'll create a GeoJSON like point object from the two lat/lon fields
      var lon = doc.get(this.state.get('lonField'));
      var lat = doc.get(this.state.get('latField'));
      if (!isNaN(parseFloat(lon)) && !isNaN(parseFloat(lat))) {
        return {
          type: 'Point',
          coordinates: [lon,lat]
        };
      }
    }
    return null;
  },

  // Private: Check if there is a field with GeoJSON geometries or alternatively,
  // two fields with lat/lon values.
  //
  // If not found, the user can define them via the UI form.
  _setupGeometryField: function(){
    // should not overwrite if we have already set this (e.g. explicitly via state)
    if (!this._geomReady()) {
      this.state.set({
        geomField: this._checkField(this.geometryFieldNames),
        latField: this._checkField(this.latitudeFieldNames),
        lonField: this._checkField(this.longitudeFieldNames)
      });
      this.menu.state.set(this.state.toJSON());
    }
  },

  // Private: Check if a field in the current model exists in the provided
  // list of names.
  //
  //
  _checkField: function(fieldNames){
    var field;
    var modelFieldNames = this.model.fields.pluck('id');
    for (var i = 0; i < fieldNames.length; i++){
      for (var j = 0; j < modelFieldNames.length; j++){
        if (modelFieldNames[j].toLowerCase() == fieldNames[i].toLowerCase())
          return modelFieldNames[j];
      }
    }
    return null;
  },

  // Private: Zoom to map to current features extent if any, or to the full
  // extent if none.
  //
  _zoomToFeatures: function(){
    var bounds = this.features.getBounds();
    if (bounds && bounds.getNorthEast() && bounds.getSouthWest()){
      this.map.fitBounds(bounds);
    } else {
      this.map.setView([0, 0], 2);
    }
  },

  // Private: Sets up the Leaflet map control and the features layer.
  //
  // The map uses a base layer from [MapQuest](http://www.mapquest.com) based
  // on [OpenStreetMap](http://openstreetmap.org).
  //
  _setupMap: function(){
    var self = this;
    this.map = new L.Map(this.$map.get(0));

    var mapUrl = "http://otile{s}.mqcdn.com/tiles/1.0.0/osm/{z}/{x}/{y}.png";
    var osmAttribution = 'Map data &copy; 2011 OpenStreetMap contributors, Tiles Courtesy of <a href="http://www.mapquest.com/" target="_blank">MapQuest</a> <img src="http://developer.mapquest.com/content/osm/mq_logo.png">';
    var bg = new L.TileLayer(mapUrl, {maxZoom: 18, attribution: osmAttribution ,subdomains: '1234'});
    this.map.addLayer(bg);

    this.markers = new L.MarkerClusterGroup(this._clusterOptions);

    // rebind this (as needed in e.g. default case above)
    this.geoJsonLayerOptions.pointToLayer =  _.bind(
        this.geoJsonLayerOptions.pointToLayer,
        this);
    this.features = new L.GeoJSON(null, this.geoJsonLayerOptions);

    this.map.setView([0, 0], 2);

    this.mapReady = true;
  },

  // Private: Helper function to select an option from a select list
  //
  _selectOption: function(id,value){
    var options = $('.' + id + ' > select > option');
    if (options){
      options.each(function(opt){
        if (this.value == value) {
          $(this).attr('selected','selected');
          return false;
        }
      });
    }
  }
});

my.MapMenu = Backbone.View.extend({
  className: 'editor',

  template: ' \
    <form class="form-stacked"> \
      <div class="clearfix"> \
        <div class="editor-field-type"> \
            <label class="radio"> \
              <input type="radio" id="editor-field-type-latlon" name="editor-field-type" value="latlon" checked="checked"/> \
              Latitude / Longitude fields</label> \
            <label class="radio"> \
              <input type="radio" id="editor-field-type-geom" name="editor-field-type" value="geom" /> \
              GeoJSON field</label> \
        </div> \
        <div class="editor-field-type-latlon"> \
          <label>Latitude field</label> \
          <div class="input editor-lat-field"> \
            <select> \
            <option value=""></option> \
            {{#fields}} \
            <option value="{{id}}">{{label}}</option> \
            {{/fields}} \
            </select> \
          </div> \
          <label>Longitude field</label> \
          <div class="input editor-lon-field"> \
            <select> \
            <option value=""></option> \
            {{#fields}} \
            <option value="{{id}}">{{label}}</option> \
            {{/fields}} \
            </select> \
          </div> \
        </div> \
        <div class="editor-field-type-geom" style="display:none"> \
          <label>Geometry field (GeoJSON)</label> \
          <div class="input editor-geom-field"> \
            <select> \
            <option value=""></option> \
            {{#fields}} \
            <option value="{{id}}">{{label}}</option> \
            {{/fields}} \
            </select> \
          </div> \
        </div> \
      </div> \
      <div class="editor-buttons"> \
        <button class="btn editor-update-map">Update</button> \
      </div> \
      <div class="editor-options" > \
        <label class="checkbox"> \
          <input type="checkbox" id="editor-auto-zoom" value="autozoom" checked="checked" /> \
          Auto zoom to features</label> \
        <label class="checkbox"> \
          <input type="checkbox" id="editor-cluster" value="cluster"/> \
          Cluster markers</label> \
      </div> \
      <input type="hidden" class="editor-id" value="map-1" /> \
      </div> \
    </form> \
  ',

  // Define here events for UI elements
  events: {
    'click .editor-update-map': 'onEditorSubmit',
    'change .editor-field-type': 'onFieldTypeChange',
    'click #editor-auto-zoom': 'onAutoZoomChange',
    'click #editor-cluster': 'onClusteringChange'
  },

  initialize: function(options) {
    var self = this;
    this.el = $(this.el);
    _.bindAll(this, 'render');
    this.model.fields.bind('change', this.render);
    this.state = new recline.Model.ObjectState(options.state);
    this.state.bind('change', this.render);
    this.render();
  },

  // ### Public: Adds the necessary elements to the page.
  //
  // Also sets up the editor fields and the map if necessary.
  render: function() {
    var self = this;
    htmls = Mustache.render(this.template, this.model.toTemplateJSON());
    $(this.el).html(htmls);

    if (this._geomReady() && this.model.fields.length){
      if (this.state.get('geomField')){
        this._selectOption('editor-geom-field',this.state.get('geomField'));
        this.el.find('#editor-field-type-geom').attr('checked','checked').change();
      } else{
        this._selectOption('editor-lon-field',this.state.get('lonField'));
        this._selectOption('editor-lat-field',this.state.get('latField'));
        this.el.find('#editor-field-type-latlon').attr('checked','checked').change();
      }
    }
    if (this.state.get('autoZoom')) {
      this.el.find('#editor-auto-zoom').attr('checked', 'checked');
    } else {
      this.el.find('#editor-auto-zoom').removeAttr('checked');
    }
    if (this.state.get('cluster')) {
      this.el.find('#editor-cluster').attr('checked', 'checked');
    } else {
      this.el.find('#editor-cluster').removeAttr('checked');
    }
    return this;
  },

  _geomReady: function() {
    return Boolean(this.state.get('geomField') || (this.state.get('latField') && this.state.get('lonField')));
  },

  // ## UI Event handlers
  //

  // Public: Update map with user options
  //
  // Right now the only configurable option is what field(s) contains the
  // location information.
  //
  onEditorSubmit: function(e){
    e.preventDefault();
    if (this.el.find('#editor-field-type-geom').attr('checked')){
      this.state.set({
        geomField: this.el.find('.editor-geom-field > select > option:selected').val(),
        lonField: null,
        latField: null
      });
    } else {
      this.state.set({
        geomField: null,
        lonField: this.el.find('.editor-lon-field > select > option:selected').val(),
        latField: this.el.find('.editor-lat-field > select > option:selected').val()
      });
    }
    return false;
  },

  // Public: Shows the relevant select lists depending on the location field
  // type selected.
  //
  onFieldTypeChange: function(e){
    if (e.target.value == 'geom'){
        this.el.find('.editor-field-type-geom').show();
        this.el.find('.editor-field-type-latlon').hide();
    } else {
        this.el.find('.editor-field-type-geom').hide();
        this.el.find('.editor-field-type-latlon').show();
    }
  },

  onAutoZoomChange: function(e){
    this.state.set({autoZoom: !this.state.get('autoZoom')});
  },

  onClusteringChange: function(e){
    this.state.set({cluster: !this.state.get('cluster')});
  },

  // Private: Helper function to select an option from a select list
  //
  _selectOption: function(id,value){
    var options = this.el.find('.' + id + ' > select > option');
    if (options){
      options.each(function(opt){
        if (this.value == value) {
          $(this).attr('selected','selected');
          return false;
        }
      });
    }
  }
});

})(jQuery, recline.View);

/*jshint multistr:true */

// Standard JS module setup
this.recline = this.recline || {};
this.recline.View = this.recline.View || {};

(function($, my) {
// ## MultiView
//
// Manage multiple views together along with query editor etc. Usage:
// 
// <pre>
// var myExplorer = new model.recline.MultiView({
//   model: {{recline.Model.Dataset instance}}
//   el: {{an existing dom element}}
//   views: {{dataset views}}
//   state: {{state configuration -- see below}}
// });
// </pre> 
//
// ### Parameters
// 
// **model**: (required) recline.model.Dataset instance.
//
// **el**: (required) DOM element to bind to. NB: the element already
// being in the DOM is important for rendering of some subviews (e.g.
// Graph).
//
// **views**: (optional) the dataset views (Grid, Graph etc) for
// MultiView to show. This is an array of view hashes. If not provided
// initialize with (recline.View.)Grid, Graph, and Map views (with obvious id
// and labels!).
//
// <pre>
// var views = [
//   {
//     id: 'grid', // used for routing
//     label: 'Grid', // used for view switcher
//     view: new recline.View.Grid({
//       model: dataset
//     })
//   },
//   {
//     id: 'graph',
//     label: 'Graph',
//     view: new recline.View.Graph({
//       model: dataset
//     })
//   }
// ];
// </pre>
//
// **sidebarViews**: (optional) the sidebar views (Filters, Fields) for
// MultiView to show. This is an array of view hashes. If not provided
// initialize with (recline.View.)FilterEditor and Fields views (with obvious 
// id and labels!).
//
// <pre>
// var sidebarViews = [
//   {
//     id: 'filterEditor', // used for routing
//     label: 'Filters', // used for view switcher
//     view: new recline.View.FielterEditor({
//       model: dataset
//     })
//   },
//   {
//     id: 'fieldsView',
//     label: 'Fields',
//     view: new recline.View.Fields({
//       model: dataset
//     })
//   }
// ];
// </pre>
//
// **state**: standard state config for this view. This state is slightly
//  special as it includes config of many of the subviews.
//
// <pre>
// state = {
//     query: {dataset query state - see dataset.queryState object}
//     view-{id1}: {view-state for this view}
//     view-{id2}: {view-state for }
//     ...
//     // Explorer
//     currentView: id of current view (defaults to first view if not specified)
//     readOnly: (default: false) run in read-only mode
// }
// </pre>
//
// Note that at present we do *not* serialize information about the actual set
// of views in use -- e.g. those specified by the views argument -- but instead 
// expect either that the default views are fine or that the client to have
// initialized the MultiView with the relevant views themselves.
my.MultiView = Backbone.View.extend({
  template: ' \
  <div class="recline-data-explorer"> \
    <div class="alert-messages"></div> \
    \
    <div class="header clearfix"> \
      <div class="navigation"> \
        <div class="btn-group" data-toggle="buttons-radio"> \
        {{#views}} \
        <a href="#{{id}}" data-view="{{id}}" class="btn">{{label}}</a> \
        {{/views}} \
        </div> \
      </div> \
      <div class="recline-results-info"> \
        <span class="doc-count">{{recordCount}}</span> records\
      </div> \
      <div class="menu-right"> \
        <div class="btn-group" data-toggle="buttons-checkbox"> \
          {{#sidebarViews}} \
          <a href="#" data-action="{{id}}" class="btn active">{{label}}</a> \
          {{/sidebarViews}} \
        </div> \
      </div> \
      <div class="query-editor-here" style="display:inline;"></div> \
    </div> \
    <div class="data-view-sidebar"></div> \
    <div class="data-view-container"></div> \
  </div> \
  ',
  events: {
    'click .menu-right a': '_onMenuClick',
    'click .navigation a': '_onSwitchView'
  },

  initialize: function(options) {
    var self = this;
    this.el = $(this.el);
    this._setupState(options.state);

    // Hash of 'page' views (i.e. those for whole page) keyed by page name
    if (options.views) {
      this.pageViews = options.views;
    } else {
      this.pageViews = [{
        id: 'grid',
        label: 'Grid',
        view: new my.SlickGrid({
          model: this.model,
          state: this.state.get('view-grid')
        })
      }, {
        id: 'graph',
        label: 'Graph',
        view: new my.Graph({
          model: this.model,
          state: this.state.get('view-graph')
        })
      }, {
        id: 'map',
        label: 'Map',
        view: new my.Map({
          model: this.model,
          state: this.state.get('view-map')
        })
      }, {
        id: 'timeline',
        label: 'Timeline',
        view: new my.Timeline({
          model: this.model,
          state: this.state.get('view-timeline')
        })
      }, {
        id: 'transform',
        label: 'Transform',
        view: new my.Transform({
          model: this.model
        })
      }];
    }
    // Hashes of sidebar elements
    if(options.sidebarViews) {
      this.sidebarViews = options.sidebarViews;
    } else {
      this.sidebarViews = [{
        id: 'filterEditor',
        label: 'Filters',
        view: new my.FilterEditor({
          model: this.model
        })
      }, {
        id: 'fieldsView',
        label: 'Fields',
        view: new my.Fields({
          model: this.model
        })
      }];
    }
    // these must be called after pageViews are created
    this.render();
    this._bindStateChanges();
    this._bindFlashNotifications();
    // now do updates based on state (need to come after render)
    if (this.state.get('readOnly')) {
      this.setReadOnly();
    }
    if (this.state.get('currentView')) {
      this.updateNav(this.state.get('currentView'));
    } else {
      this.updateNav(this.pageViews[0].id);
    }

    this.model.bind('query:start', function() {
        self.notify({loader: true, persist: true});
      });
    this.model.bind('query:done', function() {
        self.clearNotifications();
        self.el.find('.doc-count').text(self.model.recordCount || 'Unknown');
      });
    this.model.bind('query:fail', function(error) {
        self.clearNotifications();
        var msg = '';
        if (typeof(error) == 'string') {
          msg = error;
        } else if (typeof(error) == 'object') {
          if (error.title) {
            msg = error.title + ': ';
          }
          if (error.message) {
            msg += error.message;
          }
        } else {
          msg = 'There was an error querying the backend';
        }
        self.notify({message: msg, category: 'error', persist: true});
      });

    // retrieve basic data like fields etc
    // note this.model and dataset returned are the same
    // TODO: set query state ...?
    this.model.queryState.set(self.state.get('query'), {silent: true});
    this.model.fetch()
      .fail(function(error) {
        self.notify({message: error.message, category: 'error', persist: true});
      });
  },

  setReadOnly: function() {
    this.el.addClass('recline-read-only');
  },

  render: function() {
    var tmplData = this.model.toTemplateJSON();
    tmplData.views = this.pageViews;
    tmplData.sidebarViews = this.sidebarViews;
    var template = Mustache.render(this.template, tmplData);
    $(this.el).html(template);

    // now create and append other views
    var $dataViewContainer = this.el.find('.data-view-container');
    var $dataSidebar = this.el.find('.data-view-sidebar');

    // the main views
    _.each(this.pageViews, function(view, pageName) {
      view.view.render();
      $dataViewContainer.append(view.view.el);
      if (view.view.elSidebar) {
        $dataSidebar.append(view.view.elSidebar);
      }
    });

    _.each(this.sidebarViews, function(view) {
      this['$'+view.id] = view.view.el;
      $dataSidebar.append(view.view.el);
    }, this);

    var pager = new recline.View.Pager({
      model: this.model.queryState
    });
    this.el.find('.recline-results-info').after(pager.el);

    var queryEditor = new recline.View.QueryEditor({
      model: this.model.queryState
    });
    this.el.find('.query-editor-here').append(queryEditor.el);

  },

  updateNav: function(pageName) {
    this.el.find('.navigation a').removeClass('active');
    var $el = this.el.find('.navigation a[data-view="' + pageName + '"]');
    $el.addClass('active');
    // show the specific page
    _.each(this.pageViews, function(view, idx) {
      if (view.id === pageName) {
        view.view.el.show();
        if (view.view.elSidebar) {
          view.view.elSidebar.show();
        }
        if (view.view.show) {
          view.view.show();
        }
      } else {
        view.view.el.hide();
        if (view.view.elSidebar) {
          view.view.elSidebar.hide();
        }
        if (view.view.hide) {
          view.view.hide();
        }
      }
    });
  },

  _onMenuClick: function(e) {
    e.preventDefault();
    var action = $(e.target).attr('data-action');
    this['$'+action].toggle();
  },

  _onSwitchView: function(e) {
    e.preventDefault();
    var viewName = $(e.target).attr('data-view');
    this.updateNav(viewName);
    this.state.set({currentView: viewName});
  },

  // create a state object for this view and do the job of
  // 
  // a) initializing it from both data passed in and other sources (e.g. hash url)
  //
  // b) ensure the state object is updated in responese to changes in subviews, query etc.
  _setupState: function(initialState) {
    var self = this;
    // get data from the query string / hash url plus some defaults
    var qs = my.parseHashQueryString();
    var query = qs.reclineQuery;
    query = query ? JSON.parse(query) : self.model.queryState.toJSON();
    // backwards compatability (now named view-graph but was named graph)
    var graphState = qs['view-graph'] || qs.graph;
    graphState = graphState ? JSON.parse(graphState) : {};

    // now get default data + hash url plus initial state and initial our state object with it
    var stateData = _.extend({
        query: query,
        'view-graph': graphState,
        backend: this.model.backend.__type__,
        url: this.model.get('url'),
        dataset: this.model.toJSON(),
        currentView: null,
        readOnly: false
      },
      initialState);
    this.state = new recline.Model.ObjectState(stateData);
  },

  _bindStateChanges: function() {
    var self = this;
    // finally ensure we update our state object when state of sub-object changes so that state is always up to date
    this.model.queryState.bind('change', function() {
      self.state.set({query: self.model.queryState.toJSON()});
    });
    _.each(this.pageViews, function(pageView) {
      if (pageView.view.state && pageView.view.state.bind) {
        var update = {};
        update['view-' + pageView.id] = pageView.view.state.toJSON();
        self.state.set(update);
        pageView.view.state.bind('change', function() {
          var update = {};
          update['view-' + pageView.id] = pageView.view.state.toJSON();
          // had problems where change not being triggered for e.g. grid view so let's do it explicitly
          self.state.set(update, {silent: true});
          self.state.trigger('change');
        });
      }
    });
  },

  _bindFlashNotifications: function() {
    var self = this;
    _.each(this.pageViews, function(pageView) {
      pageView.view.bind('recline:flash', function(flash) {
        self.notify(flash);
      });
    });
  },

  // ### notify
  //
  // Create a notification (a div.alert in div.alert-messsages) using provided
  // flash object. Flash attributes (all are optional):
  //
  // * message: message to show.
  // * category: warning (default), success, error
  // * persist: if true alert is persistent, o/w hidden after 3s (default = false)
  // * loader: if true show loading spinner
  notify: function(flash) {
    var tmplData = _.extend({
      message: 'Loading',
      category: 'warning',
      loader: false
      },
      flash
    );
    var _template;
    if (tmplData.loader) {
      _template = ' \
        <div class="alert alert-info alert-loader"> \
          {{message}} \
          <span class="notification-loader">&nbsp;</span> \
        </div>';
    } else {
      _template = ' \
        <div class="alert alert-{{category}} fade in" data-alert="alert"><a class="close" data-dismiss="alert" href="#">×</a> \
          {{message}} \
        </div>';
    }
    var _templated = $(Mustache.render(_template, tmplData));
    _templated = $(_templated).appendTo($('.recline-data-explorer .alert-messages'));
    if (!flash.persist) {
      setTimeout(function() {
        $(_templated).fadeOut(1000, function() {
          $(this).remove();
        });
      }, 1000);
    }
  },

  // ### clearNotifications
  //
  // Clear all existing notifications
  clearNotifications: function() {
    var $notifications = $('.recline-data-explorer .alert-messages .alert');
    $notifications.fadeOut(1500, function() {
      $(this).remove();
    });
  }
});

// ### MultiView.restore
//
// Restore a MultiView instance from a serialized state including the associated dataset
//
// This inverts the state serialization process in Multiview
my.MultiView.restore = function(state) {
  // hack-y - restoring a memory dataset does not mean much ... (but useful for testing!)
  if (state.backend === 'memory') {
    var datasetInfo = {
      backend: 'memory',
      records: [{stub: 'this is a stub dataset because we do not restore memory datasets'}]
    };
  } else {
    var datasetInfo = _.extend({
        url: state.url,
        backend: state.backend
      },
      state.dataset
    );
  }
  var dataset = new recline.Model.Dataset(datasetInfo);
  var explorer = new my.MultiView({
    model: dataset,
    state: state
  });
  return explorer;
}

// ## Miscellaneous Utilities
var urlPathRegex = /^([^?]+)(\?.*)?/;

// Parse the Hash section of a URL into path and query string
my.parseHashUrl = function(hashUrl) {
  var parsed = urlPathRegex.exec(hashUrl);
  if (parsed === null) {
    return {};
  } else {
    return {
      path: parsed[1],
      query: parsed[2] || ''
    };
  }
};

// Parse a URL query string (?xyz=abc...) into a dictionary.
my.parseQueryString = function(q) {
  if (!q) {
    return {};
  }
  var urlParams = {},
    e, d = function (s) {
      return unescape(s.replace(/\+/g, " "));
    },
    r = /([^&=]+)=?([^&]*)/g;

  if (q && q.length && q[0] === '?') {
    q = q.slice(1);
  }
  while (e = r.exec(q)) {
    // TODO: have values be array as query string allow repetition of keys
    urlParams[d(e[1])] = d(e[2]);
  }
  return urlParams;
};

// Parse the query string out of the URL hash
my.parseHashQueryString = function() {
  q = my.parseHashUrl(window.location.hash).query;
  return my.parseQueryString(q);
};

// Compse a Query String
my.composeQueryString = function(queryParams) {
  var queryString = '?';
  var items = [];
  $.each(queryParams, function(key, value) {
    if (typeof(value) === 'object') {
      value = JSON.stringify(value);
    }
    items.push(key + '=' + encodeURIComponent(value));
  });
  queryString += items.join('&');
  return queryString;
};

my.getNewHashForQueryString = function(queryParams) {
  var queryPart = my.composeQueryString(queryParams);
  if (window.location.hash) {
    // slice(1) to remove # at start
    return window.location.hash.split('?')[0].slice(1) + queryPart;
  } else {
    return queryPart;
  }
};

my.setHashQueryString = function(queryParams) {
  window.location.hash = my.getNewHashForQueryString(queryParams);
};

})(jQuery, recline.View);

/*jshint multistr:true */

this.recline = this.recline || {};
this.recline.View = this.recline.View || {};

(function ($, my) {

// ## Linegraph view for a Dataset using nvd3 graphing library.
//
// Initialization arguments (in a hash in first parameter):
//
// * model: recline.Model.Dataset
// * state: (optional) configuration hash of form:
//
//        { 
//          group: {column name for x-axis},
//          series: [{column name for series A}, {column name series B}, ... ],
//          colors: ["#edc240", "#afd8f8", ...]
//        }
//
// NB: should *not* provide an el argument to the view but must let the view
// generate the element itself (you can then append view.el to the DOM.
    my.NVD3Graph = Backbone.View.extend({

        template:'<div class="recline-graph"> \
      <div class="panel nvd3graph_{{viewId}}"style="display: block;"> \
        <div id="nvd3chart_{{viewId}}"><svg class="bstrap"></svg></div>\
      </div> \
    </div> ',

        initialize:function (options) {
            var self = this;

            this.uid = options.id || ("" + new Date().getTime() + Math.floor(Math.random() * 10000)); // generating an unique id for the chart
            this.el = $(this.el);
            _.bindAll(this, 'render', 'redraw', 'graphResize', 'changeDimensions');


            this.model.bind('change', this.render);
            this.model.fields.bind('reset', this.render);
            this.model.fields.bind('add', this.render);

            this.model.bind('query:done', this.redraw);
            this.model.queryState.bind('selection:done', this.redraw);
            this.model.bind('dimensions:change', this.changeDimensions);


            var stateData = _.extend({
                    group:null,
                    seriesNameField:[],
                    seriesValues:[],
                    colors:["#edc240", "#afd8f8", "#cb4b4b", "#4da74d", "#9440ed"],
                    graphType:"lineChart",
                    xLabel:"",
                    id:0



                },
                options.state
            );
            this.state = new recline.Model.ObjectState(stateData);


        },

        changeDimensions: function() {
            var self=this;
            self.state.attributes.group = self.model.getDimensions();
        },

        render:function () {
            var self = this;

            var tmplData = this.model.toTemplateJSON();
            tmplData["viewId"] = this.uid;

            delete this.chart;


            var htmls = Mustache.render(this.template, tmplData);
            $(this.el).html(htmls);
            this.$graph = this.el.find('.panel.nvd3graph_' + tmplData["viewId"]);
            return this;
        },

        getActionsForEvent:function (eventType) {
            var actions = [];

            _.each(this.options.actions, function (d) {
                if (_.contains(d.event, eventType))
                    actions.push(d);
            });

            return actions;
        },

        redraw:function () {

            var self = this;

            var state = this.state;
            var seriesNVD3 = this.createSeriesNVD3();

            var graphType = this.state.get("graphType");

            var viewId = this.uid;

            var model = this.model;
            var state = this.state;
            var xLabel = this.state.get("xLabel");
            var yLabel = this.state.get("yLabel");


            nv.addGraph(function () {
                self.chart = self.getGraph[graphType](self);

                if (self.state.attributes.options) {
                    _.each(_.keys(self.state.attributes.options), function (d) {
                        try {
                            self.addOption[d](self.chart, self.state.attributes.options[d]);
                        }
                        catch (err) {
                            console.log("view.nvd3.graph.js: cannot add options " + d + " for graph type " + graphType)
                        }
                    });
                }
                ;

                d3.select('#nvd3chart_' + self.uid + '  svg')
                    .datum(seriesNVD3)
                    .transition()
                    .duration(500)
                    .call(self.chart);

                nv.utils.windowResize(self.graphResize);
                nv.utils.windowResize(self.graphResize);
                self.graphResize()
                return  self.chart;
            });
        },

        graphResize:function () {
            var self = this;
            var viewId = this.uid;

            // this only works by previously setting the body height to a numeric pixel size (percentage size don't work)
            // so we assign the window height to the body height with the command below
            var container = self.el;
            while (!container.hasClass('container-fluid') && !container.hasClass('container'))
            	container = container.parent();
            
            if (typeof container != "undefined" && container != null 
            		&& (container.hasClass('container') || container.hasClass('container-fluid'))
            		&& container[0].style && container[0].style.height
            		&& container[0].style.height.indexOf("%") > 0) 
            {
	            $("body").height($(window).innerHeight() - 10);
	
	            var currAncestor = self.el;
	            while (!currAncestor.hasClass('row-fluid') && !currAncestor.hasClass('row'))
	                currAncestor = currAncestor.parent();
	
	            if (typeof currAncestor != "undefined" && currAncestor != null && (currAncestor.hasClass('row-fluid') || currAncestor.hasClass('row'))) {
	                var newH = currAncestor.height();
	                $('#nvd3chart_' + viewId).height(newH);
	                $('#nvd3chart_' + viewId + '  svg').height(newH);
	            }
            }
            self.chart.update(); // calls original 'update' function
        },


        setAxis:function (axis, chart) {
            var self = this;

            var xLabel = self.state.get("xLabel");

            if (axis == "all" || axis == "x") {
                var xfield = self.model.fields.get(self.state.attributes.group);

                // set label
                if (xLabel == null || xLabel == "" || typeof xLabel == 'undefined')
                    xLabel = xfield.get('label');

                // set data format
                chart.xAxis
                    .axisLabel(xLabel)
                    .tickFormat(self.getFormatter[xfield.get('type')]);

            } else if (axis == "all" || axis == "y") {
                var yLabel = self.state.get("yLabel");

                if (yLabel == null || yLabel == "" || typeof yLabel == 'undefined')
                    yLabel = self.state.attributes.seriesValues.join("/");

                // todo yaxis format must be passed as prop
                chart.yAxis
                    .axisLabel(yLabel)
                    .tickFormat(d3.format('s'));

            }
        },

        getFormatter:{
            "string":d3.format(',s'),
            "float":d3.format(',r'),
            "integer":d3.format(',r'),
            "date":function (d) {
                return d3.time.format('%x')(new Date(d));
            }

        },

        addOption:{
            "staggerLabels":function (chart, value) {
                chart.staggerLabels(value);
            },
            "tooltips":function (chart, value) {
                chart.tooltips(value);
            },
            "showValues":function (chart, value) {
                chart.showValues(value);
            },
            "tooltip": function(chart, value) {
                var t = function(key, x, y, e, graph) {
                    return value.replace("{x}", x)
                        .replace("{y}", y)
                        .replace("{key}", key);
                };
                chart.tooltip(t);
            },
            "minmax":function () {
            },
            "trendlines":function () {
            }

        },


        getGraph:{
            "multiBarChart":function (view) {
                var chart;
                if (view.chart != null)
                    chart = view.chart;
                else
                    chart = nv.models.multiBarChart();

                view.setAxis("all", chart);
                return chart;
            },
            "lineChart":function (view) {
                var chart;
                if (view.chart != null)
                    chart = view.chart;
                else
                    chart = nv.models.lineChart();
                view.setAxis("all", chart);
                return chart;
            },
            "lineWithFocusChart":function (view) {
                var chart;
                if (view.chart != null)
                    chart = view.chart;
                else
                    chart = nv.models.lineWithFocusChart();

                view.setAxis("all", chart);
                return chart;
            },
            "indentedTree":function (view) {
                var chart;
                if (view.chart != null)
                    chart = view.chart;
                else
                    chart = nv.models.indentedTree();
            },
            "stackedAreaChart":function (view) {
                var chart;
                if (view.chart != null)
                    chart = view.chart;
                else
                    chart = nv.models.stackedAreaChart();
                view.setAxis("all", chart);
                return chart;
            },

            "historicalBar":function (view) {
                var chart;
                if (view.chart != null)
                    chart = view.chart;
                else
                    chart = nv.models.historicalBar();
                return chart;
            },
            "multiBarHorizontalChart":function (view) {
                var chart;
                if (view.chart != null)
                    chart = view.chart;
                else
                    chart = nv.models.multiBarHorizontalChart();
                view.setAxis("all", chart);
                return chart;
            },
            "legend":function (view) {
                var chart;
                if (view.chart != null)
                    chart = view.chart;
                else
                    chart = nv.models.legend();
                return chart;
            },
            "line":function (view) {
                var chart;
                if (view.chart != null)
                    chart = view.chart;
                else
                    chart = nv.models.line();
                return chart;
            },
            "sparkline":function (view) {
                var chart;
                if (view.chart != null)
                    chart = view.chart;
                else
                    chart = nv.models.sparkline();
                return chart;
            },
            "sparklinePlus":function (view) {
                var chart;
                if (view.chart != null)
                    chart = view.chart;
                else
                    chart = nv.models.sparklinePlus();
                return chart;
            },

            "multiChart":function (view) {
                var chart;
                if (view.chart != null)
                    chart = view.chart;
                else
                    chart = nv.models.multiChart();
                return chart;
            },


            "bulletChart":function (view) {
                var chart;
                if (view.chart != null)
                    chart = view.chart;
                else
                    chart = nv.models.bulletChart();
                return chart;
            },
            "linePlusBarChart":function (view) {
                var chart;
                if (view.chart != null)
                    chart = view.chart;
                else
                    chart = nv.models.linePlusBarChart();
                view.setAxis("all", chart);
                return chart;
            },
            "cumulativeLineChart":function (view) {
                var chart;
                if (view.chart != null)
                    chart = view.chart;
                else
                    chart = nv.models.cumulativeLineChart();
                view.setAxis("all", chart);
                return chart;
            },
            "scatterChart":function (view) {
                var chart;
                if (view.chart != null)
                    chart = view.chart;
                else
                    chart = nv.models.scatterChart();
                chart.showDistX(true)
                    .showDistY(true);
                view.setAxis("all", chart);
                return chart;
            },
            "discreteBarChart":function (view) {
                var actions = view.getActionsForEvent("selection");
                var chart;
                if (view.chart != null)
                    chart = view.chart;
                else
                    chart = nv.models.discreteBarChart();
                view.setAxis("all", chart);

                if (actions.length > 0)
                    chart.discretebar.dispatch.on('elementClick', function (e) {
                        view.doActions(actions, [e.point.record]);
                    });
                return chart;
                var actions = view.getActionsForEvent("selection");
                var options = {};

                if (view.state.attributes.options) {
                    if (view.state.attributes.options("trendlines"))
                        options["trendlines"] = view.state.attributes.options("trendlines");
                    if (view.state.attributes.options("minmax"))
                        options["minmax"] = view.state.attributes.options("minmax");

                }


                if (actions.length > 0) {
                    options["callback"] = function (x) {

                        // selection is done on x axis so I need to take the record with range [min_x, max_x]
                        // is the group attribute
                        var record_min = _.min(x, function (d) {
                            return d.min.x
                        });
                        var record_max = _.max(x, function (d) {
                            return d.max.x
                        });

                        view.doActions(actions, [record_min.min.record, record_max.max.record]);

                    };
                } else
                    options["callback"] = function () {
                    };
            },
            "lineWithBrushChart":function (view) {


                var chart;
                if (view.chart != null)
                    chart = view.chart;
                else
                    chart = nv.models.lineWithBrushChart(options);
                view.setAxis("all", chart);
                return  chart
            },
            "multiBarWithBrushChart":function (view) {
                var actions = view.getActionsForEvent("selection");
                var options = {};

                if (view.state.attributes.options) {
                    if (view.state.attributes.options("trendlines"))
                        options["trendlines"] = view.state.attributes.options("trendlines");
                    if (view.state.attributes.options("minmax"))
                        options["minmax"] = view.state.attributes.options("minmax");

                }

                if (actions.length > 0) {
                    options["callback"] = function (x) {

                        // selection is done on x axis so I need to take the record with range [min_x, max_x]
                        // is the group attribute
                        var record_min = _.min(x, function (d) {
                            return d.min.x
                        });
                        var record_max = _.max(x, function (d) {
                            return d.max.x
                        });

                        view.doActions(actions, [record_min.min.record, record_max.max.record]);

                    };
                } else
                    options["callback"] = function () {
                    };

                var chart;
                if (view.chart != null)
                    chart = view.chart;
                else
                    chart = nv.models.multiBarWithBrushChart(options);

                return chart;
            },

            "pieChart":function (view) {
                var chart;
                if (view.chart != null)
                    chart = view.chart;
                else
                    chart = nv.models.pieChart();

                chart.values(function(d) {
                    var ret=[];
                    _.each(d.values, function(dd) {
                        ret.push({x: dd.x, y:dd.y});
                    });
                    return ret;
                });

                return chart;
            }

        },


        doActions:function (actions, records) {

            _.each(actions, function (d) {
                d.action.doAction(records, d.mapping);
            });

        },

        getFieldLabel: function(field){
            var self=this;
            var fieldLabel = field.attributes.label;
            if (field.attributes.is_partitioned)
                fieldLabel = field.attributes.partitionValue;

            if (typeof self.state.attributes.fieldLabels != "undefined" && self.state.attributes.fieldLabels != null) {
                var fieldLabel_alternateObj = _.find(self.state.attributes.fieldLabels, function (fl) {
                    return fl.id == fieldLabel
                });
                if (typeof fieldLabel_alternateObj != "undefined" && fieldLabel_alternateObj != null)
                    fieldLabel = fieldLabel_alternateObj.label;
            }

            return fieldLabel;
        },


        createSeriesNVD3:function () {

            var self = this;
            var series = [];

            //  {type: "byFieldName", fieldvaluesField: ["y", "z"]}
            var seriesAttr = this.state.attributes.series;

            var fillEmptyValuesWith = seriesAttr.fillEmptyValuesWith;

            //var seriesNameField = self.model.fields.get(this.state.attributes.seriesNameField) ;
            //var seriesValues = self.model.fields.get(this.state.attributes.seriesValues);
            //if(seriesValues == null)
            //var seriesValues = this.state.get("seriesValues") ;

            var xAxisIsDate = false;
            var unselectedColor = "#C0C0C0";
            if (self.state.attributes.unselectedColor)
                unselectedColor = self.state.attributes.unselectedColor;
            var selectionActive = false;
            if (self.model.queryState.isSelected())
                selectionActive = true;

            var resultType = "filtered";
            if(self.options.resultType !== null)
                resultType = self.options.resultType;

            var records = self.model.getRecords(resultType);  //self.model.records.models;

            var xfield = self.model.fields.get(self.state.attributes.group);

            if (xfield.get('type') === 'date') {
                xAxisIsDate = true;
            }

            var uniqueX = [];
            var sizeField;
            if (seriesAttr.sizeField) {
                sizeField = self.model.fields.get(seriesAttr.sizeField);
            }


            // series are calculated on data, data should be analyzed in order to create series
            if (seriesAttr.type == "byFieldValue") {
                var seriesTmp = {};
                var seriesNameField = self.model.fields.get(seriesAttr.seriesField);
                var fieldValue = self.model.fields.get(seriesAttr.valuesField);

                _.each(records, function (doc, index) {

                    // key is the field that identiy the value that "build" series
                    var key = doc.getFieldValueUnrendered(seriesNameField);
                    var tmpS;

                    // verify if the serie is already been initialized
                    if (seriesTmp[key] != null) {
                        tmpS = seriesTmp[key]
                    }
                    else {
                        tmpS = {key:key, values:[]};

                        var color = doc.getFieldColor(seriesNameField);

                        if (color != null)
                            tmpS["color"] = color;


                    }
                    var shape = doc.getFieldShapeName(seriesNameField);

                    var x = doc.getFieldValueUnrendered(xfield);
                    var y = doc.getFieldValueUnrendered(fieldValue);


                    var point = {x:x, y:y, record:doc};
                    if (sizeField)
                        point["size"] = doc.getFieldValueUnrendered(sizeField);
                    if(shape != null)
                        point["shape"] = shape;

                    tmpS.values.push(point);

                    if (fillEmptyValuesWith != null) {
                        uniqueX.push(x);

                    }

                    seriesTmp[key] = tmpS;

                });

                for (var j in seriesTmp) {
                    series.push(seriesTmp[j]);
                }

            }
            else if (seriesAttr.type == "byFieldName" || seriesAttr.type == "byPartitionedField") {
                var serieNames;

                // if partitions are active we need to retrieve the list of partitions
                if (seriesAttr.type == "byFieldName")
                    serieNames = seriesAttr.valuesField;
                else {
                    serieNames = [];
                    _.each(seriesAttr.aggregationFunctions, function (a) {
                        _.each(self.model.getPartitionedFieldsForAggregationFunction(a, seriesAttr.aggregatedField), function (f) {
                            serieNames.push(f.get("id"));
                        })

                    });

                }

                _.each(serieNames, function (field) {
                    var yfield = self.model.fields.get(field);

                    var points = [];

                    _.each(records, function (doc, index) {

                        var x = doc.getFieldValueUnrendered(xfield);

                        try {

                            var y = doc.getFieldValueUnrendered(yfield);
                            if (y != null) {
                                var color;

                                if (selectionActive) {
                                    if (doc.isRecordSelected())
                                        color = doc.getFieldColor(yfield);
                                    else
                                        color = unselectedColor;
                                } else
                                    color = doc.getFieldColor(yfield);

                                var shape = doc.getFieldShapeName(yfield);

                                var point = {x:x, y:y, record:doc};

                                if(color != null)
                                    point["color"] = color;
                                if(shape != null)
                                    point["shape"] = shape;

                                if (sizeField)
                                    point["size"] = doc.getFieldValueUnrendered(sizeField);

                                points.push(point);

                                if (fillEmptyValuesWith != null) {
                                    uniqueX.push(x);
                                }
                            }

                        }
                        catch (err) {
                            //console.log("Can't add field [" + field + "] to graph, filtered?")
                        }
                    });

                    if (points.length > 0)
                        series.push({values:points, key:self.getFieldLabel(yfield), color:yfield.getColorForPartition()});
                });

            } else throw "views.nvd3.graph.js: unsupported or not defined type " + seriesAttr.type;

            // foreach series fill empty values
            if (fillEmptyValuesWith != null) {
                uniqueX = _.unique(uniqueX);
                _.each(series, function (s) {
                    // foreach series obtain the unique list of x
                    var tmpValues = _.map(s.values, function (d) {
                        return d.x
                    });
                    // foreach non present field set the value
                    _.each(_.difference(uniqueX, tmpValues), function (diff) {
                        s.values.push({x:diff, y:fillEmptyValuesWith});
                    });

                });
            }

            return series;
        }


    });


})(jQuery, recline.View);

this.recline = this.recline || {};
this.recline.View = this.recline.View || {};

(function ($, view) {

    "use strict";

    view.Rickshaw = Backbone.View.extend({
        template:'<div id="{{uid}}" style="width: {{width}}px; height: {{height}}px;"> <div> ',

        initialize:function (options) {

            this.el = $(this.el);
            _.bindAll(this, 'render', 'redraw');


            this.model.bind('change', this.render);
            this.model.fields.bind('reset', this.render);
            this.model.fields.bind('add', this.render);

            this.model.bind('query:done', this.redraw);
            this.model.queryState.bind('selection:done', this.redraw);


            $(window).resize(this.resize);
            this.uid = options.id || ("d3_" + new Date().getTime() + Math.floor(Math.random() * 10000)); // generating an unique id for the chart
            this.width = options.width;
            this.height = options.height;


            //render header & svg container
            var out = Mustache.render(this.template, this);
            this.el.html(out);

        },

        resize:function () {

        },

        render:function () {


        },

        redraw:function () {

            this.draw(this.createSeries(), "#" + this.uid);
        },
        draw:function (data, graphid) {
            var self = this;

            self.graph = new Rickshaw.Graph({
                element:document.querySelector(graphid),
                renderer:'bar',
                width:self.width,
                height:self.height,
                series:data,
                stroke:true
            });

            self.graph.render();

            var hoverDetail = new Rickshaw.Graph.HoverDetail({
                graph:self.graph
            });

            var xAxis = new Rickshaw.Graph.Axis.Time({
                graph:self.graph
            });

            xAxis.render();

            var yAxis = new Rickshaw.Graph.Axis.Y({
                graph:self.graph
            });


            yAxis.render();

            if (self.options.state.events) {

                self.annotator = new Rickshaw.Graph.Annotate({
                    graph:self.graph,
                    element:document.getElementById('timeline')
                });

                self.annotator.add(1,"ciccio");

                var timeField = self.options.state.events.timeField;
                var valueField = self.options.state.events.valueField;
                var endField = self.options.state.events.endField;


                _.each(self.options.state.events.dataset.getRecords(self.options.state.events.resultType), function (d) {
                    if(endField)
                        self.annotator.add(d.attributes[timeField], d.attributes[valueField], d.attributes[endField]);
                    else
                        self.annotator.add(d.attributes[timeField], d.attributes[valueField]);

                })

                self.annotator.update()

            }

            if (self.options.legend) {
                var legend = new Rickshaw.Graph.Legend({
                    graph:self.graph,
                    element:document.querySelector('#' + self.options.legend)
                });

                var shelving = new Rickshaw.Graph.Behavior.Series.Toggle({
                    graph:self.graph,
                    legend:legend
                });

                var order = new Rickshaw.Graph.Behavior.Series.Order({
                    graph:self.graph,
                    legend:legend
                });

                var highlighter = new Rickshaw.Graph.Behavior.Series.Highlight({
                    graph:self.graph,
                    legend:legend
                });
            }


            self.alreadyDrawed = true;
        },

        createSeries:function () {

            var self = this;
            var series = [];

            //  {type: "byFieldName", fieldvaluesField: ["y", "z"]}
            var seriesAttr = this.options.state.series;

            var fillEmptyValuesWith = seriesAttr.fillEmptyValuesWith;

            //var seriesNameField = self.model.fields.get(this.state.attributes.seriesNameField) ;
            //var seriesValues = self.model.fields.get(this.state.attributes.seriesValues);
            //if(seriesValues == null)
            //var seriesValues = this.state.get("seriesValues") ;


            var unselectedColor = "#C0C0C0";
            if (self.options.state.unselectedColor)
                unselectedColor = self.options.state.unselectedColor;
            var selectionActive = false;
            if (self.model.queryState.isSelected())
                selectionActive = true;

            var resultType = "filtered";
            if (self.options.resultType !== null)
                resultType = self.options.resultType;

            var records = self.model.getRecords(resultType);  //self.model.records.models;

            var xfield = self.model.fields.get(self.options.state.group);


            var uniqueX = [];
            var sizeField;
            if (seriesAttr.sizeField) {
                sizeField = self.model.fields.get(seriesAttr.sizeField);
            }


            // series are calculated on data, data should be analyzed in order to create series
            if (seriesAttr.type == "byFieldValue") {
                var seriesTmp = {};
                var seriesNameField = self.model.fields.get(seriesAttr.seriesField);
                var fieldValue = self.model.fields.get(seriesAttr.valuesField);

                _.each(records, function (doc, index) {

                    // key is the field that identiy the value that "build" series
                    var key = doc.getFieldValueUnrendered(seriesNameField);
                    var tmpS;

                    // verify if the serie is already been initialized
                    if (seriesTmp[key] != null) {
                        tmpS = seriesTmp[key]
                    }
                    else {
                        tmpS = {name:key, data:[]};

                        var color = doc.getFieldColor(seriesNameField);

                        if (color != null)
                            tmpS["color"] = color;


                    }
                    var shape = doc.getFieldShapeName(seriesNameField);

                    var x = doc.getFieldValueUnrendered(xfield);
                    var y = doc.getFieldValueUnrendered(fieldValue);


                    var point = {x:x, y:y, record:doc};
                    if (sizeField)
                        point["size"] = doc.getFieldValueUnrendered(sizeField);
                    if (shape != null)
                        point["shape"] = shape;

                    tmpS.values.push(point);

                    if (fillEmptyValuesWith != null) {
                        uniqueX.push(x);

                    }

                    seriesTmp[key] = tmpS;

                });

                for (var j in seriesTmp) {
                    series.push(seriesTmp[j]);
                }

            }
            else if (seriesAttr.type == "byFieldName" || seriesAttr.type == "byPartitionedField") {
                var serieNames;

                // if partitions are active we need to retrieve the list of partitions
                if (seriesAttr.type == "byFieldName")
                    serieNames = seriesAttr.valuesField;
                else {
                    serieNames = [];
                    _.each(seriesAttr.aggregationFunctions, function (a) {
                        _.each(self.model.getPartitionedFieldsForAggregationFunction(a, seriesAttr.aggregatedField), function (f) {
                            serieNames.push(f.get("id"));
                        })

                    });

                }

                _.each(serieNames, function (field) {
                    var yfield = self.model.fields.get(field);

                    var points = [];

                    _.each(records, function (doc, index) {

                        var x = doc.getFieldValueUnrendered(xfield);

                        try {

                            var y = doc.getFieldValueUnrendered(yfield);
                            if (y != null) {
                                var color;

                                if (selectionActive) {
                                    if (doc.isRecordSelected())
                                        color = doc.getFieldColor(yfield);
                                    else
                                        color = unselectedColor;
                                } else
                                    color = doc.getFieldColor(yfield);

                                var shape = doc.getFieldShapeName(yfield);

                                var point = {x:x, y:y, record:doc};

                                if (color != null)
                                    point["color"] = color;
                                if (shape != null)
                                    point["shape"] = shape;

                                if (sizeField)
                                    point["size"] = doc.getFieldValueUnrendered(sizeField);

                                points.push(point);

                                if (fillEmptyValuesWith != null) {
                                    uniqueX.push(x);
                                }
                            }

                        }
                        catch (err) {
                            //console.log("Can't add field [" + field + "] to graph, filtered?")
                        }
                    });

                    if (points.length > 0)
                        series.push({data:points, name:self.getFieldLabel(yfield), color:yfield.getColorForPartition()});
                });

            } else throw "views.rickshaw.graph.js: unsupported or not defined type " + seriesAttr.type;

            // foreach series fill empty values
            if (fillEmptyValuesWith != null) {
                uniqueX = _.unique(uniqueX);
                _.each(series, function (s) {
                    // foreach series obtain the unique list of x
                    var tmpValues = _.map(s.values, function (d) {
                        return d.x
                    });
                    // foreach non present field set the value
                    _.each(_.difference(uniqueX, tmpValues), function (diff) {
                        s.values.push({x:diff, y:fillEmptyValuesWith});
                    });

                });
            }

            return series;
        },
        getFieldLabel:function (field) {
            var self = this;
            var fieldLabel = field.attributes.label;
            if (field.attributes.is_partitioned)
                fieldLabel = field.attributes.partitionValue;

            if (typeof self.options.state.fieldLabels != "undefined" && self.options.state.fieldLabels != null) {
                var fieldLabel_alternateObj = _.find(self.state.attributes.fieldLabels, function (fl) {
                    return fl.id == fieldLabel
                });
                if (typeof fieldLabel_alternateObj != "undefined" && fieldLabel_alternateObj != null)
                    fieldLabel = fieldLabel_alternateObj.label;
            }

            return fieldLabel;
        },


    });
})(jQuery, recline.View);/*jshint multistr:true */

this.recline = this.recline || {};
this.recline.View = this.recline.View || {};

(function($, my) {
// ## SlickGrid Dataset View
//
// Provides a tabular view on a Dataset, based on SlickGrid.
//
// https://github.com/mleibman/SlickGrid
//
// Initialize it with a `recline.Model.Dataset`.
//
// NB: you need an explicit height on the element for slickgrid to work
my.SlickGrid = Backbone.View.extend({
  initialize: function(modelEtc) {
    var self = this;
    this.el = $(this.el);
    this.el.addClass('recline-slickgrid');
    _.bindAll(this, 'render');
    _.bindAll(this, 'onSelectionChanged');

      this.resultType = "filtered";
      if(self.options.resultType !== null)
          this.resultType = self.options.resultType;



      this.model.records.bind('add', this.render);
    this.model.records.bind('reset', this.render);
    this.model.records.bind('remove', this.render);

    var state = _.extend({
        hiddenColumns: [],
        visibleColumns: [],
        columnsOrder: [],
        columnsSort: {},
        columnsWidth: [],
        fitColumns: false
      }, modelEtc.state
    );
    this.state = new recline.Model.ObjectState(state);
  },

  events: {
  },
  render: function() {
    var self = this;

    var options = {
      enableCellNavigation: true,
      enableColumnReorder: true,
      enableExpandCollapse: true,
      explicitInitialization: true,
      syncColumnCellResize: true,
      forceFitColumns: this.state.get('fitColumns'),
      useInnerChart: this.state.get('useInnerChart'),
      innerChartMax: this.state.get('innerChartMax'),
      useStripedStyle: this.state.get('useStripedStyle'),
      useCondensedStyle: this.state.get('useCondensedStyle'),
      useHoverStyle: this.state.get('useHoverStyle'),
      showLineNumbers: this.state.get('showLineNumbers'),
      showTotals: this.state.get('showTotals'),
      showPartitionedData: this.state.get('showPartitionedData'),
	};

    // We need all columns, even the hidden ones, to show on the column picker
    var columns = [];
    // custom formatter as default one escapes html
    // plus this way we distinguish between rendering/formatting and computed value (so e.g. sort still works ...)
    // row = row index, cell = cell index, value = value, columnDef = column definition, dataContext = full row values
    var formatter = function(row, cell, value, columnDef, dataContext) {
        var field = self.model.getFields(self.resultType).get(columnDef.id);
      if (field.renderer) {
        return field.renderer(value, field, dataContext);
      } else {
        return value;
      }
    }
    if (options.showLineNumbers == true && self.model.getRecords(self.resultType).length > 0)
	{
        var column = {
                id:'lineNumberField',
                name:'#',
                field:'lineNumberField',
                sortable: (options.showPartitionedData ? false : true),
                maxWidth: 80,
                formatter: Slick.Formatters.FixedCellFormatter
              };
    	columns.push(column); 
	}
    var validFields = [];
    var columnsOrderToUse = this.state.get('columnsOrder');
    if (options.showPartitionedData)
	{
    	var getObjectClass = function (obj) {
    	    if (obj && obj.constructor && obj.constructor.toString) {
    	        var arr = obj.constructor.toString().match(
    	            /function\s*(\w+)/);

    	        if (arr && arr.length == 2) {
    	            return arr[1];
    	        }
    	    }

    	    return undefined;
    	}
    	if (getObjectClass(self.model) != "VirtualDataset")
    		throw "Slickgrid exception: showPartitionedData option can only be used on a partitioned virtualmodel! Exiting";

        // obtain a fake partition field since the virtualmodel is missing it.
        // take the first partitioned field available so that the formatter may work
    	var firstMeasureFieldname = options.showPartitionedData.measures[0].field;
    	var partitionFieldname = options.showPartitionedData.partition;
    	var modelAggregatFields = self.model.getPartitionedFields(partitionFieldname, firstMeasureFieldname);
    	var fakePartitionFieldname = modelAggregatFields[0].id; 

    	validFields = self.model.attributes.aggregation.dimensions.concat([options.showPartitionedData.partition]).concat(
    			_.map(options.showPartitionedData.measures, function(m) { return m.field+"_"+m.aggregation})
    			);
    	// slightly different version of list above. Using fake name instead of real name of column 
    	var validFieldsForOrdering = self.model.attributes.aggregation.dimensions.concat([fakePartitionFieldname]).concat(
    			_.map(options.showPartitionedData.measures, function(m) { return m.field+"_"+m.aggregation})
		);
    	var columnsOrder = this.state.get('columnsOrder'); 
        if (typeof columnsOrder == "undefined" || columnsOrder == null || columnsOrder.length == 0)
        	columnsOrderToUse = validFieldsForOrdering;
        
        
    	var columnPart = {
  	          id: fakePartitionFieldname,
  	          name:options.showPartitionedData.partition,
  	          field: options.showPartitionedData.partition,
  	          sortable: false,
  	          minWidth: 80,
  	          formatter: formatter,
  	        };
        var widthInfo = _.find(self.state.get('columnsWidth'),function(c){return c.column == field.id});
        if (widthInfo){
          column['width'] = widthInfo.width;
        }
    	columns.push(columnPart);
	}
    
    _.each(self.model.getFields(self.resultType).toJSON(),function(field){
        var column = {
          id:field['id'],
          name:field['label'],
          field:field['id'],
          sortable: (options.showPartitionedData ? false : true),
          minWidth: 80,
          formatter: formatter,
        };
        var widthInfo = _.find(self.state.get('columnsWidth'),function(c){return c.column == field.id});
        if (widthInfo){
          column['width'] = widthInfo.width;
        }
        if (options.showPartitionedData)
    	{
        	if (_.contains(validFields, field['id']) || (field['id'] == fakePartitionFieldname && field['field'] == options.showPartitionedData.partition))
        		columns.push(column);
    	}
        else columns.push(column);
    });
    
	if (options.useInnerChart == true && self.model.getRecords(self.resultType).length > 0)
	{
		columns.push({
        name: self.state.get('innerChartHeader'),
        id: 'innerChart',
        field:'innerChart',
        sortable: false,
		alignLeft: true,
        minWidth: 150,
        formatter: Slick.Formatters.TwinBarFormatter
      })
	}
	if (self.state.get('fieldLabels') && self.state.get('fieldLabels').length > 0)
	{
		_.each(self.state.get('fieldLabels'), function(newIdAndLabel) {
			for (var c in columns)
				if (columns[c].id == newIdAndLabel.id)
					columns[c].name = newIdAndLabel.label;
		});
	}
	var visibleColumns = [];
	
	if (self.state.get('visibleColumns').length > 0)
	{
		visibleColumns = columns.filter(function(column) {
		  return (_.indexOf(self.state.get('visibleColumns'), column.id) >= 0 || (options.showLineNumbers == true && column.id == 'lineNumberField'));
		});
		if (self.state.get('useInnerChart') == true && self.model.getRecords(self.resultType).length > 0)
			visibleColumns.push(columns[columns.length - 1]); // innerChart field is last one added
	}
	else
	{
		// Restrict the visible columns
		visibleColumns = columns.filter(function(column) {
		  return _.indexOf(self.state.get('hiddenColumns'), column.id) == -1;
		});
	}
    // Order them if there is ordering info on the state
    if (columnsOrderToUse) {
      visibleColumns = visibleColumns.sort(function(a,b){
        return _.indexOf(columnsOrderToUse,a.id) > _.indexOf(columnsOrderToUse,b.id) ? 1 : -1;
      });
      columns = columns.sort(function(a,b){
        return _.indexOf(columnsOrderToUse,a.id) > _.indexOf(columnsOrderToUse,b.id) ? 1 : -1;
      });
    }

    // Move hidden columns to the end, so they appear at the bottom of the
    // column picker
    var tempHiddenColumns = [];
    for (var i = columns.length -1; i >= 0; i--){
      if (_.indexOf(_.pluck(visibleColumns,'id'),columns[i].id) == -1){
        tempHiddenColumns.push(columns.splice(i,1)[0]);
      }
    }
    columns = columns.concat(tempHiddenColumns);

	var max = 0;
	var adjustMax = function(val) {
		// adjust max in order to return the highest comfortable number
		var valStr = ""+parseInt(val);
		var totDigits = valStr.length;
		if (totDigits <= 1)
			return 10;
		else
		{
			var firstChar = parseInt(valStr.charAt(0));
			var secondChar = parseInt(valStr.charAt(1));
			if (secondChar < 5)
				return (firstChar+0.5)*Math.pow(10, totDigits-1)
			else return (firstChar+1)*Math.pow(10, totDigits-1)
		}
	}
	var innerChartSerie1Name = self.state.get('innerChartSerie1');
	var innerChartSerie2Name = self.state.get('innerChartSerie2');

    if (self.state.get('useInnerChart') == true && innerChartSerie1Name != null && innerChartSerie2Name != null && self.model.getRecords(self.resultType).length > 0)
	{
        _.each(self.model.getRecords(self.resultType), function(doc){
		  var row = {};
            _.each(self.model.getFields(self.resultType).models, function(field){
			row[field.id] = doc.getFieldValue(field);
			if (field.id == innerChartSerie1Name || field.id == innerChartSerie2Name)
			{
				var currVal = Math.abs(parseFloat(row[field.id]));
				if (currVal > max)
					max = currVal;
			}
		  });
		});
		max = adjustMax(max);
		options.innerChartMax = max;
	}
    var data = [];
	var rowsToSelect = [];
	var unselectableRowIds = [];
	var jj = 0;
	
    if (options.showPartitionedData)
	{
    	var partitionFieldname = options.showPartitionedData.partition;
    	var dimensionFieldnames = self.model.attributes.aggregation.dimensions;
    	var records = self.model.getRecords(self.resultType);
    	var dimensionValues = []
    	for (var d in dimensionFieldnames)
		{
    		var dimensionFieldname = dimensionFieldnames[d];
    		var currDimensionValues = _.map(records, function(record){ return record.attributes[dimensionFieldname]; });
    		dimensionValues[d] = _.uniq(currDimensionValues); // should be already sorted
		}
    	var firstMeasureFieldname = options.showPartitionedData.measures[0].field;
    	var modelAggregatFields = self.model.getPartitionedFields(partitionFieldname, firstMeasureFieldname);
		var allPartitionValues = _.map(modelAggregatFields, function(f){ return f.attributes.partitionValue; });
		var partitionValues = _.uniq(allPartitionValues); // should be already sorted
    		
    	var row = {};
    	var useSingleDimension = false;
    	if (dimensionFieldnames.length == 1)
		{
    		useSingleDimension = true;
    		dimensionValues[1] = [""]
    		dimensionFieldnames[1] = "___fake____";
		}
    	
    	for (var i0 in dimensionValues[0])
		{
    		row = {};
    		var dimensionFieldname0 = dimensionFieldnames[0];
	    	for (var i1 in dimensionValues[1])
			{
	    		row = {};
	    		var dimensionFieldname1 = dimensionFieldnames[1];
    			var rec = _.find(records, function(r) { return r.attributes[dimensionFieldname0] == dimensionValues[0][i0] && (useSingleDimension || r.attributes[dimensionFieldname1] == dimensionValues[1][i1]); });
		    	for (var i2 in partitionValues)
		    	{
		    		row = {};
		    		if (i1 == 0 && i2 == 0)
		    			row[dimensionFieldname0] = dimensionValues[0][i0];

		    		if (i2 == 0)
		    			row[dimensionFieldname1] = dimensionValues[1][i1];
		    		
		    		row[partitionFieldname] = partitionValues[i2];
		    		
    	    		for (var m in options.showPartitionedData.measures)
        			{
    	    			var measureField = options.showPartitionedData.measures[m];
    	    			var measureFieldName = measureField.field
    	    			var modelAggregationFields = self.model.getPartitionedFields(partitionFieldname, measureFieldName);
    	    			var modelField = _.find(modelAggregationFields, function(f) { return f.attributes.partitionValue == partitionValues[i2]});
    	    			if (modelField)
	    				{
    	    				if (rec)
	    					{
    	    					var formattedValue = rec.getFieldValue(modelField);
    	    					if (formattedValue)
        	    					row[measureFieldName+"_"+measureField.aggregation] = rec.getFieldValue(modelField);
            	    			else row[measureFieldName+"_"+measureField.aggregation] = 0;
	    					}
        	    			else row[measureFieldName+"_"+measureField.aggregation] = 0;
	    				}
        			}
	
		    		if (options.showLineNumbers == true)
					    row['lineNumberField'] = jj;
		    		
		    		data.push(row);
		    	}
		    	if (options.showPartitionedData.showSubTotals)
	    		{
		    		row = {};
		    		row[partitionFieldname] = "<b>Total(s)</b>";
    	    		for (var m in options.showPartitionedData.measures)
        			{
    	    			var measureField = options.showPartitionedData.measures[m];
    	    			var measureFieldName = measureField.field+"_"+measureField.aggregation
    	    			var modelField = _.find(self.model.getFields(self.resultType).models, function(f) { return f.attributes.id == measureFieldName});
    	    			if (modelField && rec)
	    				{
	    					var formattedValue = rec.getFieldValue(modelField);
	    					if (formattedValue)
    	    					row[measureFieldName] = "<b>"+rec.getFieldValue(modelField)+"</b>";
        	    			else row[measureFieldName] = "<b>"+0+"</b>";
	    				}
    	    			else row[measureFieldName] = "<b>"+0+"</b>";
        			}
    	    		unselectableRowIds.push(data.length)
		    		data.push(row);
	    		}
			}
		}
	}
    else
	{
      _.each(self.model.getRecords(self.resultType), function(doc){
	      if (doc.is_selected)
			rowsToSelect.push(jj);
			
		  var row = {schema_colors: []};
	
	        _.each(self.model.getFields(self.resultType).models, function(field){
	        row[field.id] = doc.getFieldValue(field);
	        if (innerChartSerie1Name != null && field.id == innerChartSerie1Name)
	    		row.schema_colors[0] = doc.getFieldColor(field);
	        
	        if (innerChartSerie2Name != null && field.id == innerChartSerie2Name)
	    		row.schema_colors[1] = doc.getFieldColor(field);
	      });
		  
		  if (self.state.get('useInnerChart') == true && innerChartSerie1Name != null && innerChartSerie2Name != null) 
			row['innerChart'] = [ row[innerChartSerie1Name], row[innerChartSerie2Name], max ];
	
		  data.push(row);
			
	      jj++;
	      
		  if (options.showLineNumbers == true)
			    row['lineNumberField'] = jj;
	    });
	}
      
      if (options.showTotals && self.model.records.length > 0)
	  {
    	  options.totals = {};
    	  var totalsRecord = self.model.getRecords("totals");
    	  for (var f in options.showTotals)
		  {
    		  var currTotal = options.showTotals[f];
    		  var fieldObj = self.model.getField_byAggregationFunction("totals"+(currTotal.filtered ? "_filtered" : ""), currTotal.field, currTotal.aggregation);
    		  if (typeof fieldObj != "undefined")
    			  options.totals[currTotal.field] = totalsRecord[0].getFieldValue(fieldObj);
		  }
	  }

	if (this.options.actions != null && typeof this.options.actions != "undefined")
	{
		_.each(this.options.actions, function(currAction) {
			if (_.indexOf(currAction.event, "hover") >= 0)
				options.trackMouseHover = true;
		});
	}
    data.getItemMetadata = function (row) 
	{
        if (_.contains(unselectableRowIds, row))
          return { "selectable": false }
	}
	
    this.grid = new Slick.Grid(this.el, data, visibleColumns, options);
	
    var classesToAdd = ["s-table"];
    if (options.useHoverStyle)
    	classesToAdd.push("s-table-hover")
    if (options.useCondensedStyle)
    	classesToAdd.push("s-table-condensed")
    if (options.useStripedStyle)
    	classesToAdd.push("s-table-striped")
    	
	this.grid.addClassesToGrid(classesToAdd);
	this.grid.removeClassesFromGrid(["ui-widget"]);
	
	this.grid.setSelectionModel(new Slick.RowSelectionModel());
	this.grid.getSelectionModel().setSelectedRows(rowsToSelect);
	
    this.grid.onSelectedRowsChanged.subscribe(function(e, args){
		self.onSelectionChanged(args.rows)
	});

    // Column sorting
    var sortInfo = this.model.queryState.get('sort');
    if (sortInfo){
      var column = sortInfo[0].field;
      var sortAsc = !(sortInfo[0].order == 'desc');
      this.grid.sort(column, sortAsc);
    }

    this.grid.onSort.subscribe(function(e, args){
      var order = (args.sortAsc) ? 'asc':'desc';
      var sort = [{
        field: args.sortCol.field,
        order: order
      }];
      self.model.query({sort: sort});
    });

    this.grid.onColumnsReordered.subscribe(function(e, args){
      self.state.set({columnsOrder: _.pluck(self.grid.getColumns(),'id')});
    });

    this.grid.onColumnsResized.subscribe(function(e, args){
        var columns = args.grid.getColumns();
        var defaultColumnWidth = args.grid.getOptions().defaultColumnWidth;
        var columnsWidth = [];
        _.each(columns,function(column){
          if (column.width != defaultColumnWidth){
            columnsWidth.push({column:column.id,width:column.width});
          }
        });
        self.state.set({columnsWidth:columnsWidth});
    });

      //
    this.grid.onRowHoverIn.subscribe(function(e, args){
		//console.log("HoverIn "+args.row)
		var selectedRecords = [];
		selectedRecords.push(self.model.records.models[args.row]);
		var actions = self.options.actions;
		actions.forEach(function(currAction){				
			currAction.action.doAction(selectedRecords, currAction.mapping);
		});
    });
	
    var columnpicker = new Slick.Controls.ColumnPicker(columns, this.grid,
                                                       _.extend(options,{state:this.state}));

    this.model.queryState.bind('selection:done', self.grid.render);
    
    if (self.visible){
      self.grid.init();
      self.rendered = true;
    } else {
      // Defer rendering until the view is visible
      self.rendered = false;
    }

    function resizeSlickGrid()
    {
    	if (self.model.getRecords(self.resultType).length > 0)
    	{
    		var container = self.el.parent();
            if (typeof container != "undefined" && container != null && 
            		((container[0].style && container[0].style.height && container[0].style.height.indexOf("%") > 0)
            		|| container.hasClass("h100") ) )
        	{
        		//console.log("Resizing container height from "+self.el.height()+" to "+self.el.parent()[0].offsetHeight)
	        	
            	// force container height to element height 
	        	self.el.height(self.el.parent()[0].offsetHeight);
	        	self.grid.invalidateAllRows();
	        	self.grid.resizeCanvas();
	        	self.grid.render();
        	}    		
    	}
    }
    resizeSlickGrid();
    nv.utils.windowResize(resizeSlickGrid);
    
    return this;
 },
  onSelectionChanged: function(rows) {
	var self = this;
	var selectedRecords = [];
	_.each(rows, function(row) {
		selectedRecords.push(self.model.records.models[row]);
	});
	var actions = this.options.actions;
	   if(actions != null)
        actions.forEach(function(currAction){
		    currAction.action.doAction(selectedRecords, currAction.mapping);
	    });
  },
  show: function() {
    // If the div is hidden, SlickGrid will calculate wrongly some
    // sizes so we must render it explicitly when the view is visible
    if (!this.rendered){
      if (!this.grid){
        this.render();
      }
      this.grid.init();
      this.rendered = true;
    }
    this.visible = true;
  },

  hide: function() {
    this.visible = false;
  }
});

})(jQuery, recline.View);

/*
* Context menu for the column picker, adapted from
* http://mleibman.github.com/SlickGrid/examples/example-grouping
*
*/
(function ($) {
  function SlickColumnPicker(columns, grid, options) {
    var $menu;
    var columnCheckboxes;

    var defaults = {
      fadeSpeed:250
    };

    function init() {
      grid.onHeaderContextMenu.subscribe(handleHeaderContextMenu);
      options = $.extend({}, defaults, options);

      $menu = $('<ul class="dropdown-menu slick-contextmenu" style="display:none;position:absolute;z-index:20;" />').appendTo(document.body);

      $menu.bind('mouseleave', function (e) {
        $(this).fadeOut(options.fadeSpeed)
      });
      $menu.bind('click', updateColumn);

    }

    function handleHeaderContextMenu(e, args) {
      e.preventDefault();
      $menu.empty();
      columnCheckboxes = [];

      var $li, $input;
      for (var i = 0; i < columns.length; i++) {
        $li = $('<li />').appendTo($menu);
        $input = $('<input type="checkbox" />').data('column-id', columns[i].id).attr('id','slick-column-vis-'+columns[i].id);
        columnCheckboxes.push($input);

        if (grid.getColumnIndex(columns[i].id) != null) {
          $input.attr('checked', 'checked');
        }
        $input.appendTo($li);
        $('<label />')
            .text(columns[i].name)
            .attr('for','slick-column-vis-'+columns[i].id)
            .appendTo($li);
      }
      $('<li/>').addClass('divider').appendTo($menu);
      $li = $('<li />').data('option', 'autoresize').appendTo($menu);
      $input = $('<input type="checkbox" />').data('option', 'autoresize').attr('id','slick-option-autoresize');
      $input.appendTo($li);
      $('<label />')
          .text('Force fit columns')
          .attr('for','slick-option-autoresize')
          .appendTo($li);
      if (grid.getOptions().forceFitColumns) {
        $input.attr('checked', 'checked');
      }

      $menu.css('top', e.pageY - 10)
          .css('left', e.pageX - 10)
          .fadeIn(options.fadeSpeed);
    }

    function updateColumn(e) {
      if ($(e.target).data('option') == 'autoresize') {
        var checked;
        if ($(e.target).is('li')){
            var checkbox = $(e.target).find('input').first();
            checked = !checkbox.is(':checked');
            checkbox.attr('checked',checked);
        } else {
          checked = e.target.checked;
        }

        if (checked) {
          grid.setOptions({forceFitColumns:true});
          grid.autosizeColumns();
        } else {
          grid.setOptions({forceFitColumns:false});
        }
        options.state.set({fitColumns:checked});
        return;
      }

      if (($(e.target).is('li') && !$(e.target).hasClass('divider')) ||
            $(e.target).is('input')) {
        if ($(e.target).is('li')){
            var checkbox = $(e.target).find('input').first();
            checkbox.attr('checked',!checkbox.is(':checked'));
        }
        var visibleColumns = [];
        var hiddenColumnsIds = [];
        $.each(columnCheckboxes, function (i, e) {
          if ($(this).is(':checked')) {
            visibleColumns.push(columns[i]);
          } else {
            hiddenColumnsIds.push(columns[i].id);
          }
        });


        if (!visibleColumns.length) {
          $(e.target).attr('checked', 'checked');
          return;
        }

        grid.setColumns(visibleColumns);
        options.state.set({hiddenColumns:hiddenColumnsIds});
      }
    }
    init();
  }

  // Slick.Controls.ColumnPicker
  $.extend(true, window, { Slick:{ Controls:{ ColumnPicker:SlickColumnPicker }}});
})(jQuery);
/*jshint multistr:true */

this.recline = this.recline || {};
this.recline.View = this.recline.View || {};

(function($, my) {
// turn off unnecessary logging from VMM Timeline
if (typeof VMM !== 'undefined') {
  VMM.debug = false;
}

// ## Timeline
//
// Timeline view using http://timeline.verite.co/
my.Timeline = Backbone.View.extend({
  template: ' \
    <div class="recline-timeline"> \
      <div id="vmm-timeline-id"></div> \
    </div> \
  ',

  // These are the default (case-insensitive) names of field that are used if found.
  // If not found, the user will need to define these fields on initialization
  startFieldNames: ['date','startdate', 'start', 'start-date'],
  endFieldNames: ['end','endDate'],
  elementId: '#vmm-timeline-id',

  initialize: function(options) {
    var self = this;
    this.el = $(this.el);
    this.timeline = new VMM.Timeline();
    this._timelineIsInitialized = false;
    this.model.fields.bind('reset', function() {
      self._setupTemporalField();
    });
    this.model.records.bind('all', function() {
      self.reloadData();
    });
    var stateData = _.extend({
        startField: null,
        endField: null
      },
      options.state
    );
    this.state = new recline.Model.ObjectState(stateData);
    this._setupTemporalField();
  },

  render: function() {
    var tmplData = {};
    var htmls = Mustache.render(this.template, tmplData);
    this.el.html(htmls);
    // can only call _initTimeline once view in DOM as Timeline uses $
    // internally to look up element
    if ($(this.elementId).length > 0) {
      this._initTimeline();
    }
  },

  show: function() {
    // only call _initTimeline once view in DOM as Timeline uses $ internally to look up element
    if (this._timelineIsInitialized === false) {
      this._initTimeline();
    }
  },

  _initTimeline: function() {
    var $timeline = this.el.find(this.elementId);
    // set width explicitly o/w timeline goes wider that screen for some reason
    var width = Math.max(this.el.width(), this.el.find('.recline-timeline').width());
    if (width) {
      $timeline.width(width);
    }
    var config = {};
    var data = this._timelineJSON();
    this.timeline.init(data, this.elementId, config);
    this._timelineIsInitialized = true
  },

  reloadData: function() {
    if (this._timelineIsInitialized) {
      var data = this._timelineJSON();
      this.timeline.reload(data);
    }
  },

  // Convert record to JSON for timeline
  //
  // Designed to be overridden in client apps
  convertRecord: function(record, fields) {
    return this._convertRecord(record, fields);
  },

  // Internal method to generate a Timeline formatted entry
  _convertRecord: function(record, fields) {
    var start = this._parseDate(record.get(this.state.get('startField')));
    var end = this._parseDate(record.get(this.state.get('endField')));
    if (start) {
      var tlEntry = {
        "startDate": start,
        "endDate": end,
        "headline": String(record.get('title') || ''),
        "text": record.get('description') || record.summary()
      };
      return tlEntry;
    } else {
      return null;
    }
  },

  _timelineJSON: function() {
    var self = this;
    var out = {
      'timeline': {
        'type': 'default',
        'headline': '',
        'date': [
        ]
      }
    };
    this.model.records.each(function(record) {
      var newEntry = self.convertRecord(record, self.fields);
      if (newEntry) {
        out.timeline.date.push(newEntry); 
      }
    });
    // if no entries create a placeholder entry to prevent Timeline crashing with error
    if (out.timeline.date.length === 0) {
      var tlEntry = {
        "startDate": '2000,1,1',
        "headline": 'No data to show!'
      };
      out.timeline.date.push(tlEntry);
    }
    return out;
  },

  _parseDate: function(date) {
    if (!date) {
      return null;
    }
    var out = date.trim();
    out = out.replace(/(\d)th/g, '$1');
    out = out.replace(/(\d)st/g, '$1');
    out = out.trim() ? moment(out) : null;
    if (out.toDate() == 'Invalid Date') {
      return null;
    } else {
      // fix for moment weirdness around date parsing and time zones
      // moment('1914-08-01').toDate() => 1914-08-01 00:00 +01:00
      // which in iso format (with 0 time offset) is 31 July 1914 23:00
      // meanwhile native new Date('1914-08-01') => 1914-08-01 01:00 +01:00
      out = out.subtract('minutes', out.zone());
      return out.toDate();
    }
  },

  _setupTemporalField: function() {
    this.state.set({
      startField: this._checkField(this.startFieldNames),
      endField: this._checkField(this.endFieldNames)
    });
  },

  _checkField: function(possibleFieldNames) {
    var modelFieldNames = this.model.fields.pluck('id');
    for (var i = 0; i < possibleFieldNames.length; i++){
      for (var j = 0; j < modelFieldNames.length; j++){
        if (modelFieldNames[j].toLowerCase() == possibleFieldNames[i].toLowerCase())
          return modelFieldNames[j];
      }
    }
    return null;
  }
});

})(jQuery, recline.View);
/*jshint multistr:true */

this.recline = this.recline || {};
this.recline.View = this.recline.View || {};

// Views module following classic module pattern
(function($, my) {

// ## ColumnTransform
//
// View (Dialog) for doing data transformations
my.Transform = Backbone.View.extend({
  template: ' \
    <div class="recline-transform"> \
      <div class="script"> \
        <h2> \
          Transform Script \
          <button class="okButton btn btn-primary">Run on all records</button> \
        </h2> \
        <textarea class="expression-preview-code"></textarea> \
      </div> \
      <div class="expression-preview-parsing-status"> \
        No syntax error. \
      </div> \
      <div class="preview"> \
        <h3>Preview</h3> \
        <div class="expression-preview-container"></div> \
      </div> \
    </div> \
  ',

  events: {
    'click .okButton': 'onSubmit',
    'keydown .expression-preview-code': 'onEditorKeydown'
  },

  initialize: function(options) {
    this.el = $(this.el);
  },

  render: function() {
    var htmls = Mustache.render(this.template);
    this.el.html(htmls);
    // Put in the basic (identity) transform script
    // TODO: put this into the template?
    var editor = this.el.find('.expression-preview-code');
    if (this.model.fields.length > 0) {
      var col = this.model.fields.models[0].id;
    } else {
      var col = 'unknown';
    }
    editor.val("function(doc) {\n  doc['"+ col +"'] = doc['"+ col +"'];\n  return doc;\n}");
    editor.keydown();
  },

  onSubmit: function(e) {
    var self = this;
    var funcText = this.el.find('.expression-preview-code').val();
    var editFunc = recline.Data.Transform.evalFunction(funcText);
    if (editFunc.errorMessage) {
      this.trigger('recline:flash', {message: "Error with function! " + editFunc.errorMessage});
      return;
    }
    this.model.transform(editFunc);
  },

  editPreviewTemplate: ' \
      <table class="table table-condensed table-bordered before-after"> \
      <thead> \
      <tr> \
        <th>Field</th> \
        <th>Before</th> \
        <th>After</th> \
      </tr> \
      </thead> \
      <tbody> \
      {{#row}} \
      <tr> \
        <td> \
          {{field}} \
        </td> \
        <td class="before {{#different}}different{{/different}}"> \
          {{before}} \
        </td> \
        <td class="after {{#different}}different{{/different}}"> \
          {{after}} \
        </td> \
      </tr> \
      {{/row}} \
      </tbody> \
      </table> \
  ',

  onEditorKeydown: function(e) {
    var self = this;
    // if you don't setTimeout it won't grab the latest character if you call e.target.value
    window.setTimeout( function() {
      var errors = self.el.find('.expression-preview-parsing-status');
      var editFunc = recline.Data.Transform.evalFunction(e.target.value);
      if (!editFunc.errorMessage) {
        errors.text('No syntax error.');
        var docs = self.model.records.map(function(doc) {
          return doc.toJSON();
        });
        var previewData = recline.Data.Transform.previewTransform(docs, editFunc);
        var $el = self.el.find('.expression-preview-container');
        var fields = self.model.fields.toJSON();
        var rows = _.map(previewData.slice(0,4), function(row) {
          return _.map(fields, function(field) {
            return {
              field: field.id,
              before: row.before[field.id],
              after: row.after[field.id],
              different: !_.isEqual(row.before[field.id], row.after[field.id])
            }
          });
        });
        $el.html('');
        _.each(rows, function(row) {
          var templated = Mustache.render(self.editPreviewTemplate, {
            row: row
          });
          $el.append(templated);
        });
      } else {
        errors.text(editFunc.errorMessage);
      }
    }, 1, true);
  }
});

})(jQuery, recline.View);
/*jshint multistr:true */
this.recline = this.recline || {};
this.recline.View = this.recline.View || {};

(function ($, my) {

    my.CurrentFilter = Backbone.View.extend({
        template:'\
    	<script> \
    	$(function() { \
    		$(".chzn-select-deselect").chosen({allow_single_deselect:true}); \
    	}); \
    	</script> \
      <div"> \
        <fieldset data-filter-field="{{field}}" data-filter-id="{{id}}"> \
			<select class="chzn-select-deselect data-control-id" multiple data-placeholder="{{label}}"> \
            {{#values}} \
            <option value="{{dataset_index}}-{{filter_index}}" selected>{{val}}</option> \
            {{/values}} \
          </select> \
        </fieldset> \
      </div>',
        events:{
            'change .chzn-select-deselect':'onFilterValueChanged'
        },

        initialize:function (args) {
            var self = this;
            this.el = $(this.el);
            _.bindAll(this, 'render');

            this._sourceDatasets = args.models;
            this.uid = args.id || Math.floor(Math.random() * 100000);

            _.each(this._sourceDatasets, function (d) {
                d.bind('query:done', self.render);
                d.queryState.bind('selection:done', self.render);
            });

        },

        render:function () {
            var self = this;
            var tmplData = {
                id:self.uid,
                label:"Active filters"
            };

            var values = [];
            _.each(self._sourceDatasets, function (ds, ds_index) {
                _.each(ds.queryState.getFilters(), function (filter, filter_index) {
                    var v = {dataset_index:ds_index, filter_index:filter_index};
                    v["val"] = self.filterDescription[filter.type](filter, ds);

                    values.push(v);

                });
            });
            tmplData["values"] = values;


            var out = Mustache.render(self.template, tmplData);
            this.el.html(out);
        },

        filterDescription:{
            term:function (filter, dataset) {
                return dataset.fields.get(filter.field).attributes.label + ": " + filter.term;
            },
            range:function (filter, dataset) {
                return dataset.fields.get(filter.field).attributes.label + ": " + filter.start + "-" + filter.stop;
            },
            list:function (filter, dataset) {
                var val = dataset.fields.get(filter.field).attributes.label + ": ";
                _.each(filter.list, function (data, index) {
                    if (index > 0)
                        val += ",";

                    val += data;
                });

                return val;
            }
        },

        onFilterValueChanged:function (e) {
            var self=this;

            e.preventDefault();
            var $target = $(e.target).parent();
           var values = $target.find('.data-control-id')[0][0].value.split("-");

            var dataset_index = values[0];
            var filter_index = values[1];

            self._sourceDatasets[dataset_index].queryState.removeFilter(filter_index);


        }


    });

})(jQuery, recline.View);
this.recline = this.recline || {};
this.recline.View = this.recline.View || {};

(function ($, view) {

    "use strict";

    view.DatePicker = Backbone.View.extend({


        template:'<div style="width: 230px;" id="datepicker-calendar-{{uid}}"></div>',


        initialize:function (options) {

            this.el = $(this.el);
            _.bindAll(this, 'render', 'redraw');

            if (this.model) {
                this.model.bind('change', this.render);
                this.model.fields.bind('reset', this.render);
                this.model.fields.bind('add', this.render);

                this.model.bind('query:done', this.redraw);
                this.model.queryState.bind('selection:done', this.redraw);
            }

            $(window).resize(this.resize);
            this.uid = options.id || (new Date().getTime() + Math.floor(Math.random() * 10000)); // generating an unique id

            var out = Mustache.render(this.template, this);
            this.el.html(out);

        },

        onChange: function(view) {
            var exec = function (data, widget) {

            var actions = view.getActionsForEvent("selection");

            if (actions.length > 0) {
                var startDate= new Date(data.dr1from_millis);
                var endDate= new Date(data.dr1to_millis);

                /*var date_a = [
                    new Date(startDate.getYear(), startDate.getMonth(), startDate.getDay(), 0, 0, 0, 0),
                    new Date(endDate.getYear(), endDate.getMonth(), endDate.getDay(), 23, 59, 59, 999)
                ];*/
                view.doActions(actions, [startDate, endDate]);
            }

            var actions_compare = view.getActionsForEvent("selection_compare");

            if (actions_compare.length > 0) {
                var date_compare = [null, null];

                if (data.comparisonEnabled) {
                    var startDate= new Date(data.dr2from_millis);
                    var endDate= new Date(data.dr2to_millis);
                    if(startDate != null && endDate != null)
                        date_compare=[startDate, endDate];
                }
                else {
                    date_compare = [null,null];
                }

                view.doActions(actions_compare, date_compare);
            }

        }
            return exec;
        },

        doActions:function (actions, values) {

            _.each(actions, function (d) {
                d.action.doActionWithValues(values, d.mapping);
            });

        },

        render:function () {
            var self = this;
            var uid = this.uid;

            $('#datepicker-calendar-' + uid).DateRangesWidget(
                {
                    aggregations:[],
                    values:{
                        comparisonEnabled:false,
                        daterangePreset:"lastweeks",
                        comparisonPreset:"previousperiod"
                    },
                    onChange: self.onChange(self)

                });

        },

        redraw:function () {

        },

        getActionsForEvent:function (eventType) {
            var actions = [];

            _.each(this.options.actions, function (d) {
                if (_.contains(d.event, eventType))
                    actions.push(d);
            });

            return actions;
        }


    });
})(jQuery, recline.View);/*jshint multistr:true */

this.recline = this.recline || {};
this.recline.View = this.recline.View || {};

(function($, my) {

// ## FacetViewer
//
// Widget for displaying facets 
//
// Usage:
//
//      var viewer = new FacetViewer({
//        model: dataset
//      });
my.FacetViewer = Backbone.View.extend({
  className: 'recline-facet-viewer', 
  template: ' \
    <div class="facets"> \
      {{#facets}} \
      <div class="facet-summary" data-facet="{{id}}"> \
        <h3> \
          {{id}} \
        </h3> \
        <ul class="facet-items"> \
        {{#terms}} \
          <li><a class="facet-choice js-facet-filter" data-value="{{term}}" href="#{{term}}">{{term}} ({{count}})</a></li> \
        {{/terms}} \
        {{#entries}} \
          <li><a class="facet-choice js-facet-filter" data-value="{{time}}">{{term}} ({{count}})</a></li> \
        {{/entries}} \
        </ul> \
      </div> \
      {{/facets}} \
    </div> \
  ',

  events: {
    'click .js-facet-filter': 'onFacetFilter'
  },
  initialize: function(model) {
    _.bindAll(this, 'render');
    this.el = $(this.el);
    this.model.facets.bind('all', this.render);
    this.model.fields.bind('all', this.render);
    this.render();
  },
  render: function() {
    var tmplData = {
      fields: this.model.fields.toJSON()
    };
    tmplData.facets = _.map(this.model.facets.toJSON(), function(facet) {
      if (facet._type === 'date_histogram') {
        facet.entries = _.map(facet.entries, function(entry) {
          entry.term = new Date(entry.time).toDateString();
          return entry;
        });
      }
      return facet;
    });
    var templated = Mustache.render(this.template, tmplData);
    this.el.html(templated);
    // are there actually any facets to show?
    if (this.model.facets.length > 0) {
      this.el.show();
    } else {
      this.el.hide();
    }
  },
  onHide: function(e) {
    e.preventDefault();
    this.el.hide();
  },
  onFacetFilter: function(e) {
    e.preventDefault();
    var $target= $(e.target);
    var fieldId = $target.closest('.facet-summary').attr('data-facet');
    var value = $target.attr('data-value');
    this.model.queryState.addFilter({type: 'term', field: fieldId, term: value});
    // have to trigger explicitly for some reason
    this.model.query();
  }
});


})(jQuery, recline.View);

/*jshint multistr:true */

// Field Info
//
// For each field
//
// Id / Label / type / format

// Editor -- to change type (and possibly format)
// Editor for show/hide ...

// Summaries of fields
//
// Top values / number empty
// If number: max, min average ...

// Box to boot transform editor ...

this.recline = this.recline || {};
this.recline.View = this.recline.View || {};

(function($, my) {

my.Fields = Backbone.View.extend({
  className: 'recline-fields-view', 
  template: ' \
    <div class="accordion fields-list well"> \
    <h3>Fields <a href="#" class="js-show-hide">+</a></h3> \
    {{#fields}} \
      <div class="accordion-group field"> \
        <div class="accordion-heading"> \
          <i class="icon-file"></i> \
          <h4> \
            {{label}} \
            <small> \
              {{type}} \
              <a class="accordion-toggle" data-toggle="collapse" href="#collapse{{id}}"> &raquo; </a> \
            </small> \
          </h4> \
        </div> \
        <div id="collapse{{id}}" class="accordion-body collapse in"> \
          <div class="accordion-inner"> \
            {{#facets}} \
            <div class="facet-summary" data-facet="{{id}}"> \
              <ul class="facet-items"> \
              {{#terms}} \
                <li class="facet-item"><span class="term">{{term}}</span> <span class="count">[{{count}}]</span></li> \
              {{/terms}} \
              </ul> \
            </div> \
            {{/facets}} \
            <div class="clear"></div> \
          </div> \
        </div> \
      </div> \
    {{/fields}} \
    </div> \
  ',

  events: {
    'click .js-show-hide': 'onShowHide'
  },
  initialize: function(model) {
    var self = this;
    this.el = $(this.el);
    _.bindAll(this, 'render');

    // TODO: this is quite restrictive in terms of when it is re-run
    // e.g. a change in type will not trigger a re-run atm.
    // being more liberal (e.g. binding to all) can lead to being called a lot (e.g. for change:width)
    this.model.fields.bind('reset', function(action) {
      self.model.fields.each(function(field) {
        field.facets.unbind('all', self.render);
        field.facets.bind('all', self.render);
      });


      // fields can get reset or changed in which case we need to recalculate
      self.model.getFieldsSummary();
      self.render();
    });




    this.render();
  },
  render: function() {
    var self = this;
    var tmplData = {
      fields: []
    };
    this.model.fields.each(function(field) {
      var out = field.toJSON();
      out.facets = field.facets.toJSON();
      tmplData.fields.push(out);
    });
    var templated = Mustache.render(this.template, tmplData);
    this.el.html(templated);
    this.el.find('.collapse').collapse('hide');
  },
  onShowHide: function(e) {
    e.preventDefault();
    var $target  = $(e.target);
    // weird collapse class seems to have been removed (can watch this happen
    // if you watch dom) but could not work why. Absence of collapse then meant
    // we could not toggle.
    // This seems to fix the problem.
    this.el.find('.accordion-body').addClass('collapse');;
    if ($target.text() === '+') {
      this.el.find('.collapse').collapse('show');
      $target.text('-');
    } else {
      this.el.find('.collapse').collapse('hide');
      $target.text('+');
    }
  }
});

})(jQuery, recline.View);

/*jshint multistr:true */

this.recline = this.recline || {};
this.recline.View = this.recline.View || {};

(function($, my) {

my.FilterEditor = Backbone.View.extend({
  className: 'recline-filter-editor well', 
  template: ' \
    <div class="filters"> \
      <h3>Filters</h3> \
      <a href="#" class="js-add-filter">Add filter</a> \
      <form class="form-stacked js-add" style="display: none;"> \
        <fieldset> \
          <label>Field</label> \
          <select class="fields"> \
            {{#fields}} \
            <option value="{{id}}">{{label}}</option> \
            {{/fields}} \
          </select> \
          <label>Filter type</label> \
          <select class="filterType"> \
            <option value="term">Value</option> \
            <option value="range">Range</option> \
            <option value="geo_distance">Geo distance</option> \
          </select> \
          <button type="submit" class="btn">Add</button> \
        </fieldset> \
      </form> \
      <form class="form-stacked js-edit"> \
        {{#filters}} \
          {{{filterRender}}} \
        {{/filters}} \
        {{#filters.length}} \
        <button type="submit" class="btn">Update</button> \
        {{/filters.length}} \
      </form> \
    </div> \
  ',
  filterTemplates: {
    term: ' \
      <div class="filter-{{type}} filter"> \
        <fieldset> \
          <legend> \
            {{field}} <small>{{type}}</small> \
            <a class="js-remove-filter" href="#" title="Remove this filter" data-filter-id="{{id}}">&times;</a> \
          </legend> \
          <input type="text" value="{{term}}" name="term" data-filter-field="{{field}}" data-filter-id="{{id}}" data-filter-type="{{type}}" /> \
        </fieldset> \
      </div> \
    ',
    range: ' \
      <div class="filter-{{type}} filter"> \
        <fieldset> \
          <legend> \
            {{field}} <small>{{type}}</small> \
            <a class="js-remove-filter" href="#" title="Remove this filter" data-filter-id="{{id}}">&times;</a> \
          </legend> \
          <label class="control-label" for="">From</label> \
          <input type="text" value="{{start}}" name="start" data-filter-field="{{field}}" data-filter-id="{{id}}" data-filter-type="{{type}}" /> \
          <label class="control-label" for="">To</label> \
          <input type="text" value="{{stop}}" name="stop" data-filter-field="{{field}}" data-filter-id="{{id}}" data-filter-type="{{type}}" /> \
        </fieldset> \
      </div> \
    ',
    geo_distance: ' \
      <div class="filter-{{type}} filter"> \
        <fieldset> \
          <legend> \
            {{field}} <small>{{type}}</small> \
            <a class="js-remove-filter" href="#" title="Remove this filter" data-filter-id="{{id}}">&times;</a> \
          </legend> \
          <label class="control-label" for="">Longitude</label> \
          <input type="text" value="{{point.lon}}" name="lon" data-filter-field="{{field}}" data-filter-id="{{id}}" data-filter-type="{{type}}" /> \
          <label class="control-label" for="">Latitude</label> \
          <input type="text" value="{{point.lat}}" name="lat" data-filter-field="{{field}}" data-filter-id="{{id}}" data-filter-type="{{type}}" /> \
          <label class="control-label" for="">Distance (km)</label> \
          <input type="text" value="{{distance}}" name="distance" data-filter-field="{{field}}" data-filter-id="{{id}}" data-filter-type="{{type}}" /> \
        </fieldset> \
      </div> \
    '
  },
  events: {
    'click .js-remove-filter': 'onRemoveFilter',
    'click .js-add-filter': 'onAddFilterShow',
    'submit form.js-edit': 'onTermFiltersUpdate',
    'submit form.js-add': 'onAddFilter'
  },
  initialize: function() {
    this.el = $(this.el);
    _.bindAll(this, 'render');
    this.model.fields.bind('all', this.render);
    this.model.queryState.bind('change', this.render);
    this.model.queryState.bind('change:filters:new-blank', this.render);
    this.render();
  },
  render: function() {
    var self = this;
    var tmplData = $.extend(true, {}, this.model.queryState.toJSON());
    // we will use idx in list as there id ...
    tmplData.filters = _.map(tmplData.filters, function(filter, idx) {
      filter.id = idx;
      return filter;
    });
    tmplData.fields = this.model.fields.toJSON();
    tmplData.filterRender = function() {
      return Mustache.render(self.filterTemplates[this.type], this);
    };
    var out = Mustache.render(this.template, tmplData);
    this.el.html(out);
  },
  onAddFilterShow: function(e) {
    e.preventDefault();
    var $target = $(e.target);
    $target.hide();
    this.el.find('form.js-add').show();
  },
  onAddFilter: function(e) {
    e.preventDefault();
    var $target = $(e.target);
    $target.hide();
    var filterType = $target.find('select.filterType').val();
    var field      = $target.find('select.fields').val();
    this.model.queryState.addFilter({type: filterType, field: field});
    // trigger render explicitly as queryState change will not be triggered (as blank value for filter)
    this.render();
  },
  onRemoveFilter: function(e) {
    e.preventDefault();
    var $target = $(e.target);
    var filterId = $target.attr('data-filter-id');
    this.model.queryState.removeFilter(filterId);
  },
  onTermFiltersUpdate: function(e) {
   var self = this;
    e.preventDefault();
    var filters = self.model.queryState.get('filters');
    var $form = $(e.target);
    _.each($form.find('input'), function(input) {
      var $input = $(input);
      var filterType  = $input.attr('data-filter-type');
      var fieldId     = $input.attr('data-filter-field');
      var filterIndex = parseInt($input.attr('data-filter-id'));
      var name        = $input.attr('name');
      var value       = $input.val();

      switch (filterType) {
        case 'term':
          filters[filterIndex].term = value;
          break;
        case 'range':
          filters[filterIndex][name] = value;
          break;
        case 'geo_distance':
          if(name === 'distance') {
            filters[filterIndex].distance = parseFloat(value);
          }
          else {
            filters[filterIndex].point[name] = parseFloat(value);
          }
          break;
      }
    });
    self.model.queryState.set({filters: filters});
    self.model.queryState.trigger('change');
  }
});


})(jQuery, recline.View);

/*jshint multistr:true */
this.recline = this.recline || {};
this.recline.View = this.recline.View || {};

(function ($, my) {

    my.GenericFilter = Backbone.View.extend({
        className:'recline-filter-editor well',
        template:'<div class="filters" style="background-color:{{backgroundColor}}"> \
      <div class="form-stacked js-edit"> \
	  	<div class="label label-info" style="display:{{titlePresent}}" > \
		  	<h4>{{filterDialogTitle}}</h4> \
		  	{{filterDialogDescription}} \
	  	</div> \
        {{#filters}} \
          {{{filterRender}}} \
		  <hr style="display:{{hrVisible}}"> \
        {{/filters}} \
      </div> \
    </div>',
        templateHoriz:'<style> .separated-item { padding-left:20px;padding-right:20px; } </style> <div class="filters" style="background-color:{{backgroundColor}}"> \
      <table > \
	  	<tbody> \
	  		<tr>\
	  			<td class="separated-item" style="display:{{titlePresent}}">\
				  	<div class="label label-info"> \
					  	<h4>{{filterDialogTitle}}</h4> \
					  	{{filterDialogDescription}} \
				  	</div> \
				</td>\
			  	{{#filters}} \
			  	<td class="separated-item">\
          			{{{filterRender}}} \
          		</td>\
  				{{/filters}} \
        	</tr>\
  		</tbody>\
  	   </table> \
    </div> ',
        filterTemplates:{
            term:' \
      <div class="filter-{{type}} filter" id="{{ctrlId}}"> \
        <fieldset data-filter-field="{{field}}" data-filter-id="{{id}}" data-filter-type="{{type}}" data-control-type="{{controlType}}"> \
            <legend style="display:{{useLegend}}">{{label}}</legend>  \
    		<div style="float:left;padding-right:10px;padding-top:2px;display:{{useLeftLabel}}">{{label}}</div> \
          <input type="text" value="{{term}}" name="term" class="data-control-id" /> \
          <input type="button" class="btn" id="setFilterValueButton" value="Set"></input> \
        </fieldset> \
      </div> \
    ',
            slider:' \
	<script> \
		$(document).ready(function(){ \
			$( "#slider{{ctrlId}}" ).slider({ \
				min: {{min}}, \
				max: {{max}}, \
				value: {{term}}, \
				slide: function( event, ui ) { \
					$( "#amount{{ctrlId}}" ).html( "{{label}}: "+ ui.value ); \
				} \
			}); \
			$( "#amount{{ctrlId}}" ).html( "{{label}}: "+ $( "#slider{{ctrlId}}" ).slider( "value" ) ); \
		}); \
	</script> \
      <div class="filter-{{type}} filter" id="{{ctrlId}}" style="min-width:100px"> \
        <fieldset data-filter-field="{{field}}" data-filter-id="{{id}}" data-filter-type="{{type}}" data-control-type="{{controlType}}"> \
            <legend style="display:{{useLegend}}">{{label}} \
			<a class="js-remove-filter" href="#" title="Remove this filter">&times;</a> \
		</legend>  \
		  <label id="amount{{ctrlId}}">{{label}}: </label> \
		  <div id="slider{{ctrlId}}" class="data-control-id"></div> \
		  <br> \
          <input type="button" class="btn" id="setFilterValueButton" value="Set"></input> \
        </fieldset> \
      </div> \
    ',
            slider_styled:' \
	<style> \
		 .layout-slider { padding-bottom:15px;width:150px } \
	</style> \
	<script> \
		$(document).ready(function(){ \
			$( "#slider{{ctrlId}}" ).jslider({ \
				from: {{min}}, \
				to: {{max}}, \
				scale: [{{min}},"|","{{step1}}","|","{{mean}}","|","{{step3}}","|",{{max}}], \
				step: {{step}}, \
				limits: false, \
				skin: "plastic" \
			}); \
		}); \
	</script> \
      <div class="filter-{{type}} filter" id="{{ctrlId}}"> \
        <fieldset data-filter-field="{{field}}" data-filter-id="{{id}}" data-filter-type="{{type}}" data-control-type="{{controlType}}"> \
            <legend style="display:{{useLegend}}">{{label}} \
			<a class="js-remove-filter" href="#" title="Remove this filter">&times;</a> \
		</legend>  \
		<div style="float:left;padding-right:15px;display:{{useLeftLabel}}">{{label}} \
			<a class="js-remove-filter" href="#" title="Remove this filter">&times;</a> \
		</div> \
	    <div style="float:left" class="layout-slider" > \
	    	<input type="slider" id="slider{{ctrlId}}" value="{{term}}" class="slider-styled data-control-id" /> \
	    </div> \
        </fieldset> \
      </div> \
    ',
            range:' \
      <div class="filter-{{type}} filter" id="{{ctrlId}}"> \
        <fieldset data-filter-field="{{field}}" data-filter-id="{{id}}" data-filter-type="{{type}}" data-control-type="{{controlType}}"> \
            <legend style="display:{{useLegend}}">{{label}}</legend>  \
          <label class="control-label" for="">From</label> \
          <input type="text" value="{{start}}" name="start"  class="data-control-id-from" style="width:auto"/> \
          <label class="control-label" for="">To</label> \
          <input type="text" value="{{stop}}" name="stop" class="data-control-id-to"  style="width:auto"/> \
		  <br> \
          <input type="button" class="btn" id="setFilterValueButton" value="Set"></input> \
        </fieldset> \
      </div> \
    ',
            range_slider:' \
	<script> \
		$(document).ready(function(){ \
			$( "#slider-range{{ctrlId}}" ).slider({ \
				range: true, \
				min: {{min}}, \
				max: {{max}}, \
				values: [ {{from}}, {{to}} ], \
				slide: function( event, ui ) { \
					$( "#amount{{ctrlId}}" ).html(  "{{label}}: " + ui.values[ 0 ] + " - " + ui.values[ 1 ] ); \
				} \
			}); \
			$( "#amount{{ctrlId}}" ).html(  "{{label}}: " + $( "#slider-range{{ctrlId}}" ).slider( "values", 0 ) + " - " + $( "#slider-range{{ctrlId}}" ).slider( "values", 1 ) ); \
		}); \
	</script> \
      <div class="filter-{{type}} filter" id="{{ctrlId}}" style="min-width:100px"> \
        <fieldset data-filter-field="{{field}}" data-filter-id="{{id}}" data-filter-type="{{type}}" data-control-type="{{controlType}}"> \
            <legend style="display:{{useLegend}}">{{label}}</legend>  \
		  <label id="amount{{ctrlId}}">{{label}} range: </label> \
		  <div id="slider-range{{ctrlId}}" class="data-control-id" ></div> \
		  <br> \
          <input type="button" class="btn" id="setFilterValueButton" value="Set"></input> \
        </fieldset> \
      </div> \
    ',
            range_slider_styled:' \
	<style> \
	 .layout-slider { padding-bottom:15px;width:150px } \
	</style> \
	<script> \
		$(document).ready(function(){ \
			$( "#slider{{ctrlId}}" ).jslider({ \
				from: {{min}}, \
				to: {{max}}, \
				scale: [{{min}},"|","{{step1}}","|","{{mean}}","|","{{step3}}","|",{{max}}], \
				limits: false, \
				step: {{step}}, \
				skin: "round_plastic", \
			}); \
		}); \
	</script> \
      <div class="filter-{{type}} filter" id="{{ctrlId}}"> \
        <fieldset data-filter-field="{{field}}" data-filter-id="{{id}}" data-filter-type="{{type}}" data-control-type="{{controlType}}"> \
            <legend style="display:{{useLegend}}">{{label}} \
		</legend>  \
		<div style="float:left;padding-right:15px;display:{{useLeftLabel}}">{{label}}</div> \
	    <div style="float:left" class="layout-slider" > \
	    	<input type="slider" id="slider{{ctrlId}}" value="{{from}};{{to}}" class="slider-styled data-control-id" /> \
	    </div> \
        </fieldset> \
      </div> \
    ',
            month_week_calendar:' \
	  <style> \
		.list-filter-item { cursor:pointer; } \
		.list-filter-item:hover { background: lightblue;cursor:pointer; } \
	  </style> \
      <div class="filter-{{type}} filter" id="{{ctrlId}}"> \
        <fieldset data-filter-field="{{field}}" data-filter-id="{{id}}" data-filter-type="{{type}}" data-control-type="{{controlType}}"> \
            <legend style="display:{{useLegend}}">{{label}}  \
            <a class="js-remove-filter" href="#" title="Remove this filter">&times;</a> \
			</legend> \
			Year<br> \
			<select class="drop-down2 fields data-control-id" > \
            {{#yearValues}} \
            <option value="{{val}}" {{selected}}>{{val}}</option> \
            {{/yearValues}} \
          </select> \
			<br> \
			Type<br> \
			<select class="drop-down3 fields" > \
				{{#periodValues}} \
				<option value="{{val}}" {{selected}}>{{val}}</option> \
				{{/periodValues}} \
			</select> \
			<br> \
			<div style="max-height:500px;width:100%;border:1px solid grey;overflow:auto;"> \
				<table class="table table-striped table-hover table-condensed" style="width:100%" data-filter-field="{{field}}" data-filter-id="{{id}}" data-filter-type="{{type}}" data-control-type="{{controlType}}"> \
				<tbody>\
				{{#values}} \
				<tr class="{{selected}}"><td class="list-filter-item " myValue="{{val}}" startDate="{{startDate}}" stopDate="{{stopDate}}">{{label}}</td></tr> \
				{{/values}} \
				</tbody> \
			  </table> \
		  </div> \
	    </fieldset> \
      </div> \
	',
            range_calendar:' \
	<script> \
	$(function() { \
		$( "#from{{ctrlId}}" ).datepicker({ \
			defaultDate: "{{startDate}}", \
			changeMonth: true, \
			numberOfMonths: 1, \
			dateFormat: "D M dd yy", \
			onSelect: function( selectedDate ) { \
				$( "#to{{ctrlId}}" ).datepicker( "option", "minDate", selectedDate ); \
			} \
		}); \
		$( "#to{{ctrlId}}" ).datepicker({ \
			defaultDate: "{{endDate}}", \
			changeMonth: true, \
			numberOfMonths: 1, \
			dateFormat: "D M dd yy", \
			onSelect: function( selectedDate ) { \
				$( "#from{{ctrlId}}" ).datepicker( "option", "maxDate", selectedDate ); \
			} \
		}); \
	}); \
	</script> \
      <div class="filter-{{type}} filter" id="{{ctrlId}}"> \
        <fieldset data-filter-field="{{field}}" data-filter-id="{{id}}" data-filter-type="{{type}}" data-control-type="{{controlType}}"> \
            <legend style="display:{{useLegend}}">{{label}}</legend>  \
			<label for="from{{ctrlId}}">From</label> \
			<input type="text" id="from{{ctrlId}}" name="from{{ctrlId}}" class="data-control-id-from" value="{{startDate}}" style="width:auto"/> \
			<br> \
			<label for="to{{ctrlId}}">to</label> \
			<input type="text" id="to{{ctrlId}}" name="to{{ctrlId}}" class="data-control-id-to" value="{{endDate}}" style="width:auto"/> \
 		  <br> \
          <input type="button" class="btn" id="setFilterValueButton" value="Set"></input> \
       </fieldset> \
      </div> \
	',
            dropdown:' \
      <script>  \
    	function updateColor(elem) { \
    		if (elem.prop("selectedIndex") == 0) elem.addClass("dimmed"); else elem.removeClass("dimmed"); \
  		} \
      </script> \
      <div class="filter-{{type}} filter" id="{{ctrlId}}"> \
        <fieldset data-filter-field="{{field}}" data-filter-id="{{id}}" data-filter-type="{{type}}" data-control-type="{{controlType}}"> \
            <legend style="display:{{useLegend}}">{{label}} \
    		</legend>  \
    		<div style="float:left;padding-right:10px;padding-top:2px;display:{{useLeftLabel}}">{{label}}</div> \
    		<select class="drop-down fields data-control-id dimmed" onchange="updateColor($(this))"> \
			<option class="dimmedDropDownText">{{innerLabel}}</option> \
            {{#values}} \
            <option class="normalDropDownText" value="{{val}}" {{selected}}><span>{{val}}</span><span><b>[{{count}}]</b></span></option> \
            {{/values}} \
          </select> \
        </fieldset> \
      </div> \
    ',
            dropdown_styled:' \
    	<script> \
    	$(function() { \
    		$(".chzn-select-deselect").chosen({allow_single_deselect:true}); \
    	}); \
    	</script> \
      <div class="filter-{{type}} filter" id="{{ctrlId}}"> \
        <fieldset data-filter-field="{{field}}" data-filter-id="{{id}}" data-filter-type="{{type}}" data-control-type="{{controlType}}"> \
            <legend style="display:{{useLegend}}">{{label}}</legend>  \
			<div style="float:left;padding-right:10px;padding-top:3px;display:{{useLeftLabel}}">{{label}}</div> \
    		<select class="chzn-select-deselect data-control-id" data-placeholder="{{innerLabel}}"> \
    		<option></option> \
            {{#values}} \
            <option value="{{val}}" {{selected}}>{{valCount}}</option> \
            {{/values}} \
          </select> \
        </fieldset> \
      </div> \
    ',
            dropdown_date_range:' \
      <div class="filter-{{type}} filter" id="{{ctrlId}}"> \
        <fieldset data-filter-field="{{field}}" data-filter-id="{{id}}" data-filter-type="{{type}}" data-control-type="{{controlType}}"> \
            <legend style="display:{{useLegend}}">{{label}} \
    		</legend>  \
    		<div style="float:left;padding-right:10px;padding-top:3px;display:{{useLeftLabel}}">{{label}}</div> \
			<select class="drop-down fields data-control-id" > \
			<option></option> \
            {{#date_values}} \
            <option startDate="{{startDate}}" stopDate="{{stopDate}}" {{selected}}>{{val}}</option> \
            {{/date_values}} \
          </select> \
        </fieldset> \
      </div> \
    ',
            list:' \
	  <style> \
		.list-filter-item { cursor:pointer; } \
		.list-filter-item:hover { background: lightblue;cursor:pointer; } \
	  </style> \
      <div class="filter-{{type}} filter" id="{{ctrlId}}"> \
        <fieldset data-filter-field="{{field}}" data-filter-id="{{id}}" data-filter-type="{{type}}" data-control-type="{{controlType}}"> \
            <legend style="display:{{useLegend}}">{{label}}  \
            <a class="js-remove-filter" href="#" title="Remove this filter">&times;</a> \
			</legend> \
    		<div style="float:left;padding-right:10px;display:{{useLeftLabel}}">{{label}} \
    			<a class="js-remove-filter" href="#" title="Remove this filter">&times;</a> \
    		</div> \
			<div style="max-height:500px;width:100%;border:1px solid grey;overflow:auto;"> \
				<table class="table table-striped table-hover table-condensed" style="width:100%" data-filter-field="{{field}}" data-filter-id="{{id}}" data-filter-type="{{type}}" > \
				<tbody>\
				{{#values}} \
				<tr class="{{selected}}"><td class="list-filter-item" >{{val}}</td><td style="text-align:right">{{count}}</td></tr> \
				{{/values}} \
				</tbody>\
			  </table> \
		  </div> \
	    </fieldset> \
      </div> \
	',
            listbox:' \
      <div class="filter-{{type}} filter" id="{{ctrlId}}"> \
        <fieldset data-filter-field="{{field}}" data-filter-id="{{id}}" data-filter-type="{{type}}" data-control-type="{{controlType}}"> \
            <legend style="display:{{useLegend}}">{{label}}</legend>  \
    		<div style="float:left;padding-right:10px;display:{{useLeftLabel}}">{{label}}</div> \
			<select class="fields data-control-id"  multiple SIZE=10> \
            {{#values}} \
            <option value="{{val}}" {{selected}}>{{valCount}}</option> \
            {{/values}} \
          </select> \
		  <br> \
          <input type="button" class="btn" id="setFilterValueButton" value="Set"></input> \
        </fieldset> \
      </div> \
    ',
            listbox_styled:' \
    	<script> \
    	$(function() { \
    		$(".chzn-select-deselect").chosen({allow_single_deselect:true}); \
    	}); \
    	</script> \
      <div class="filter-{{type}} filter" id="{{ctrlId}}"> \
        <fieldset data-filter-field="{{field}}" data-filter-id="{{id}}" data-filter-type="{{type}}" data-control-type="{{controlType}}"> \
            <legend style="display:{{useLegend}}">{{label}} \
    		</legend>  \
    		<div style="float:left;padding-right:10px;padding-top:4px;display:{{useLeftLabel}}">{{label}}</div> \
			<select class="chzn-select-deselect data-control-id" multiple data-placeholder="{{innerLabel}}"> \
            {{#values}} \
            <option value="{{val}}" {{selected}}>{{valCount}}</option> \
            {{/values}} \
          </select> \
        </fieldset> \
      </div> \
    ',
            radiobuttons:' \
        <div class="filter-{{type}} filter" id="{{ctrlId}}"> \
            <div data-filter-field="{{field}}" data-filter-id="{{id}}" data-filter-type="{{type}}" data-control-type="{{controlType}}"> \
                <legend style="display:{{useLegend}}">{{label}}</legend>  \
    			<div style="float:left;padding-right:10px;padding-top:4px;display:{{useLeftLabel}}">{{label}}</div> \
    			<div class="btn-group data-control-id" > \
    				<button class="btn grouped-button btn-primary">All</button> \
    	            {{#values}} \
    	    		<button class="btn grouped-button {{selected}}">{{val}}</button> \
    	            {{/values}} \
              	</div> \
            </div> \
        </div> \
        ',
            multibutton:' \
    <div class="filter-{{type}} filter" id="{{ctrlId}}"> \
        <fieldset data-filter-field="{{field}}" data-filter-id="{{id}}" data-filter-type="{{type}}" data-control-type="{{controlType}}"> \
    		<legend style="display:{{useLegend}}">{{label}} \
    		</legend>  \
    		<div style="float:left;padding-right:10px;padding-top:4px;display:{{useLeftLabel}}">{{label}}</div> \
    		<div class="btn-group data-control-id" > \
	            {{#values}} \
	    		<button class="btn grouped-button {{selected}}">{{val}}</button> \
	            {{/values}} \
          </div> \
        </fieldset> \
    </div> \
    ',
            legend:' \
	  <style> \
      .legend-item { \
					border-top:2px solid black;border-left:2px solid black; \
					border-bottom:2px solid darkgrey;border-right:2px solid darkgrey; \
					width:16px;height:16px;padding:1px;margin:5px; \
					opacity: 0.85 \
					}  \
	 .legend-item.not-selected { background-color:transparent !important; } /* the idea is that the color "not-selected" overrides the original color (this way we may use a global style) */ \
	  </style> \
      <div class="filter-{{type}} filter" id="{{ctrlId}}"> \
        <fieldset data-filter-field="{{field}}" data-filter-id="{{id}}" data-filter-type="{{type}}" data-control-type="{{controlType}}"> \
            <legend style="display:{{useLegend}}">{{label}}</legend>  \
			<div style="float:left;padding-right:10px;display:{{useLeftLabel}}">{{label}}</div> \
			<table style="width:100%;background-color:transparent">\
			{{#values}} \
				<tr> \
				<td style="width:25px"><div class="legend-item {{notSelected}}" myValue="{{val}}" style="background-color:{{color}}"></td> \
				<td style="vertical-align:middle"><label style="color:{{color}};text-shadow: black 1px 1px, black -1px -1px, black -1px 1px, black 1px -1px, black 0px 1px, black 0px -1px, black 1px 0px, black -1px 0px">{{val}}</label></td>\
				<td><label style="text-align:right">[{{count}}]</label></td>\
				</tr>\
			{{/values}}\
			</table> \
	    </fieldset> \
      </div> \
	',
            color_legend:' \
	<div class="filter-{{type}} filter" style="width:{{totWidth2}}px;max-height:{{totHeight2}}px"> \
        <fieldset data-filter-field="{{field}}" data-filter-id="{{id}}" data-filter-type="{{type}}"> \
            <legend style="display:{{useLegend}}">{{label}}</legend>  \
				<div style="float:left;padding-right:10px;height:{{lineHeight}}px;display:{{useLeftLabel}}"> \
					<label style="line-height:{{lineHeight}}px">{{label}}</label> \
				</div> \
				<div style="width:{{totWidth}}px;height:{{totHeight}}px;display:inline"> \
					<svg height="{{totHeight}}" xmlns="http://www.w3.org/2000/svg"> \
					{{#colorValues}} \
				    	<rect width="{{width}}" height={{lineHeight}} fill="{{color}}" x="{{x}}" y={{y}}/> \
						<text width="{{width}}" fill="{{textColor}}" x="{{x}}" y="{{yplus30}}">{{val}}</text> \
					{{/colorValues}}\
					</svg>		\
				</div> \
	    </fieldset> \
	</div> \
	'
        },

        FiltersTemplate:{
            "range_calendar":{ needFacetedField:false},
            "month_week_calendar":{ needFacetedField:true},
            "list":{ needFacetedField:true},
            "legend":{ needFacetedField:true},
            "dropdown":{ needFacetedField:true},
            "dropdown_styled":{ needFacetedField:true},
            "dropdown_date_range":{ needFacetedField:false},
            "listbox":{ needFacetedField:true},
            "listbox_styled":{ needFacetedField:true},
            "term":{ needFacetedField:false},
            "range":{ needFacetedField:true},
            "slider":{ needFacetedField:true},
            "range_slider":{ needFacetedField:true},
            "range_slider_styled":{ needFacetedField:true},
            "color_legend":{ needFacetedField:true},
            "multibutton":{ needFacetedField:true},
            "radiobuttons":{ needFacetedField:true}


        },

        events:{
            'click .js-remove-filter':'onRemoveFilter',
            'click .js-add-filter':'onAddFilterShow',
            'click #addFilterButton':'onAddFilter',
            'click .list-filter-item':'onListItemClicked',
            'click .legend-item':'onLegendItemClicked',
            'click #setFilterValueButton':'onFilterValueChanged',
            'change .drop-down':'onFilterValueChanged',
            'change .chzn-select-deselect':'onFilterValueChanged',
            'change .drop-down2':'onListItemClicked',
            'change .drop-down3':'onPeriodChanged',
            'click .grouped-button':'onButtonsetClicked',
            'change .slider-styled':'onStyledSliderValueChanged'
        },

        activeFilters:new Array(),
        _sourceDataset:null,
        _selectedClassName:"info", // use bootstrap ready-for-use classes to highlight list item selection (avail classes are success, warning, info & error)

        initialize:function (args) {
            this.el = $(this.el);
            _.bindAll(this, 'render');
            _.bindAll(this, 'update');
            _.bindAll(this, 'getFieldType');
            _.bindAll(this, 'onRemoveFilter');
            _.bindAll(this, 'onPeriodChanged');
            _.bindAll(this, 'findActiveFilterByField');

            _.bindAll(this, 'updateDropdown');
            _.bindAll(this, 'updateDropdownStyled');
            _.bindAll(this, 'updateSlider');
            _.bindAll(this, 'updateSliderStyled');
            _.bindAll(this, 'updateRadiobuttons');
            _.bindAll(this, 'updateRangeSlider');
            _.bindAll(this, 'updateRangeSliderStyled');
            _.bindAll(this, 'updateRangeCalendar');
            _.bindAll(this, 'updateMonthWeekCalendar');
            _.bindAll(this, 'updateDropdownDateRange');
            _.bindAll(this, 'updateList');
            _.bindAll(this, 'updateListbox');
            _.bindAll(this, 'updateListboxStyled');
            _.bindAll(this, 'updateLegend');
            _.bindAll(this, 'updateMultibutton');
            _.bindAll(this, 'redrawGenericControl');

            this._sourceDataset = args.sourceDataset;
            this.uid = args.id || Math.floor(Math.random() * 100000); // unique id of the view containing all filters
            this.numId = 0; // auto-increasing id used for a single filter

            this.sourceFields = args.sourceFields;
            if (args.state) {
                this.filterDialogTitle = args.state.title;
                this.filterDialogDescription = args.state.description;
                this.useHorizontalLayout = args.state.useHorizontalLayout;
                this.showBackground = args.state.showBackground;
                if (this.showBackground == false) {
                    $(this).removeClass("well");
                    $(this.el).removeClass("well");
                }

                this.backgroundColor = args.state.backgroundColor;
            }
            this.activeFilters = new Array();

            this._actions = args.actions;

            if (this.sourceFields && this.sourceFields.length)
                for (var k in this.sourceFields)
                    this.addNewFilterControl(this.sourceFields[k]);

            // not all filters required a source of data
            if (this._sourceDataset) {
                this._sourceDataset.bind('query:done', this.render);
                this._sourceDataset.queryState.bind('selection:done', this.update);
            }
        },

        areValuesEqual:function (a, b) {
            // this also handles date equalities.
            // For instance comparing a Date obj with its corresponding timer value now returns true
            if (typeof a == "undefined" || typeof b == "undefined")
                return false;

            if (a == b)
                return true;
            if (a && a.valueOf() == b)
                return true;
            if (b && a == b.valueOf())
                return true;
            if (a && b && a.valueOf == b.valueOf())
                return true;

            return false;
        },

        update:function () {
            var self = this;
            // retrieve filter values (start/from/term/...)
            _.each(this._sourceDataset.queryState.get('selections'), function (filter) {
                for (var j in self.activeFilters) {
                    if (self.activeFilters[j].field == filter.field) {
                        self.activeFilters[j].list = filter.list
                        self.activeFilters[j].term = filter.term
                        self.activeFilters[j].start = filter.start
                        self.activeFilters[j].stop = filter.stop
                    }
                }
            });

            var currFilters = this.el.find("div.filter");
            _.each(currFilters, function (flt) {
                var currFilterCtrl = $(flt).find(".data-control-id");
                if (typeof currFilterCtrl != "undefined" && currFilterCtrl != null) {
                    //console.log($(currFilterCtrl));
                }
                else {
                    var currFilterCtrlFrom = $(flt).find(".data-control-id-from");
                    var currFilterCtrlTo = $(flt).find(".data-control-id-to");
                }
                var currActiveFilter = null;
                for (var j in self.activeFilters) {
                    if (self.activeFilters[j].ctrlId == flt.id) {
                        currActiveFilter = self.activeFilters[j]
                        break;
                    }
                }
                if (currActiveFilter != null) {
                    if (currActiveFilter.userChanged) {
                        // skip the filter that triggered the change
                        currActiveFilter.userChanged = undefined;
                        return;
                    }
                    switch (currActiveFilter.controlType) {
                        // term
                        case "dropdown" :
                            return self.updateDropdown($(flt), currActiveFilter, $(currFilterCtrl));
                        case "dropdown_styled" :
                            return self.updateDropdownStyled($(flt), currActiveFilter, $(currFilterCtrl));
                        case "slider" :
                            return self.updateSlider($(flt), currActiveFilter, $(currFilterCtrl));
                        case "slider_styled" :
                            return self.updateSliderStyled($(flt), currActiveFilter, $(currFilterCtrl));
                        case "radiobuttons" :
                            return self.updateRadiobuttons($(flt), currActiveFilter, $(currFilterCtrl));
                        // range
                        case "range_slider" :
                            return self.updateRangeSlider($(flt), currActiveFilter, $(currFilterCtrl));
                        case "range_slider_styled" :
                            return self.updateRangeSliderStyled($(flt), currActiveFilter, $(currFilterCtrl));
                        case "range_calendar" :
                            return self.updateRangeCalendar($(flt), currActiveFilter, $(currFilterCtrlFrom), $(currFilterCtrlTo));
                        case "month_week_calendar" :
                            return self.updateMonthWeekCalendar($(flt), currActiveFilter, $(currFilterCtrl));
                        case "dropdown_date_range" :
                            return self.updateDropdownDateRange($(flt), currActiveFilter, $(currFilterCtrl));
                        // list
                        case "list" :
                            return self.updateList($(flt), currActiveFilter, $(currFilterCtrl));
                        case "listbox":
                            return self.updateListbox($(flt), currActiveFilter, $(currFilterCtrl));
                        case "listbox_styled":
                            return self.updateListboxStyled($(flt), currActiveFilter, $(currFilterCtrl));
                        case "legend" :
                            return self.updateLegend($(flt), currActiveFilter, $(currFilterCtrl));
                        case "multibutton" :
                            return self.updateMultibutton($(flt), currActiveFilter, $(currFilterCtrl));
                    }
                }
            });
        },

        computeUserChoices:function (currActiveFilter) {
            var valueList = currActiveFilter.list;
            if ((typeof valueList == "undefined" || valueList == null) && currActiveFilter.term)
                valueList = [currActiveFilter.term];

            return valueList;
        },

        redrawGenericControl:function (filterContainer, currActiveFilter) {
            var out = this.createSingleFilter(currActiveFilter);
            filterContainer.parent().html(out);
        },

        updateDropdown:function (filterContainer, currActiveFilter, filterCtrl) {
            var valueList = this.computeUserChoices(currActiveFilter);

            if (valueList != null && valueList.length == 1) {
                filterCtrl[0].style.color = "";
                filterCtrl.val(currActiveFilter.list[0]);
            }
            else
                filterCtrl.find("option:first").prop("selected", "selected");

            if (filterCtrl.prop("selectedIndex") == 0)
                filterCtrl.addClass("dimmed");
            else filterCtrl.removeClass("dimmed");
        },
        updateDropdownStyled:function (filterContainer, currActiveFilter, filterCtrl) {
            this.redrawGenericControl(filterContainer, currActiveFilter);
        },
        updateSlider:function (filterContainer, currActiveFilter, filterCtrl) {
            var valueList = this.computeUserChoices(currActiveFilter);
            if (valueList != null && valueList.length == 1) {
                filterCtrl.slider("value", valueList[0]);
                $("#amount" + currActiveFilter.ctrlId).html(currActiveFilter.label + ": " + valueList[0]); // sistema di riserva
                filterCtrl.trigger("slide", filterCtrl); // non pare funzionare
            }
        },
        updateSliderStyled:function (filterContainer, currActiveFilter, filterCtrl) {
            var valueList = this.computeUserChoices(currActiveFilter);
            if (valueList != null && valueList.length == 1)
                filterCtrl.jslider("value", valueList[0]);
        },
        updateRadiobuttons:function (filterContainer, currActiveFilter, filterCtrl) {
            var valueList = this.computeUserChoices(currActiveFilter);

            var buttons = filterCtrl.find("button.grouped-button");
            _.each(buttons, function (btn) {
                $(btn).removeClass("btn-primary")
            });
            if (valueList != null) {
                if (valueList.length == 1) {
                    // do not use each or other jquery/underscore methods since they don't work well here
                    for (var i = 0; i < buttons.length; i++) {
                        var btn = $(buttons[i]);
                        for (var j = 0; j < valueList.length; j++) {
                            var v = valueList[j];
                            if (this.areValuesEqual(v, btn.html())) {
                                btn.addClass("btn-primary");
                                break;
                            }
                        }
                    }
                }
                else if (valueList.length == 0)
                    $(buttons[0]).addClass("btn-primary"); // select button "All"
            }
            else $(buttons[0]).addClass("btn-primary"); // select button "All"
        },
        updateRangeSlider:function (filterContainer, currActiveFilter, filterCtrl) {
            var valueList = this.computeUserChoices(currActiveFilter);
            if (valueList != null && valueList.length == 2) {
                filterCtrl.slider("values", 0, valueList[0]);
                filterCtrl.slider("values", 1, valueList[1]);
                $("#amount" + currActiveFilter.ctrlId).html(currActiveFilter.label + ": " + valueList[0] + " - " + valueList[1]); // sistema di riserva
                filterCtrl.trigger("slide", filterCtrl); // non pare funzionare
            }
        },
        updateRangeSliderStyled:function (filterContainer, currActiveFilter, filterCtrl) {
            var valueList = this.computeUserChoices(currActiveFilter);
            if (valueList != null && valueList.length == 2)
                filterCtrl.jslider("value", valueList[0], valueList[1]);
        },
        updateRangeCalendar:function (filterContainer, currActiveFilter, filterCtrlFrom, filterCtrlTo) {
            this.redrawGenericControl(filterContainer, currActiveFilter);
        },
        updateMonthWeekCalendar:function (filterContainer, currActiveFilter, filterCtrl) {
            this.redrawGenericControl(filterContainer, currActiveFilter);
        },
        updateDropdownDateRange:function (filterContainer, currActiveFilter, filterCtrl) {
            this.redrawGenericControl(filterContainer, currActiveFilter);
        },
        updateList:function (filterContainer, currActiveFilter, filterCtrl) {
            this.redrawGenericControl(filterContainer, currActiveFilter);
        },
        updateListbox:function (filterContainer, currActiveFilter, filterCtrl) {
            this.redrawGenericControl(filterContainer, currActiveFilter);
        },
        updateListboxStyled:function (filterContainer, currActiveFilter, filterCtrl) {
            this.redrawGenericControl(filterContainer, currActiveFilter);
        },
        updateLegend:function (filterContainer, currActiveFilter, filterCtrl) {
            this.redrawGenericControl(filterContainer, currActiveFilter);
        },
        updateMultibutton:function (filterContainer, currActiveFilter, filterCtrl) {
            var valueList = this.computeUserChoices(currActiveFilter);

            var buttons = filterCtrl.find("button.grouped-button");
            _.each(buttons, function (btn) {
                $(btn).removeClass("btn-info")
            });

            // from now on, do not use each or other jquery/underscore methods since they don't work well here
            if (valueList != null)
                for (var i = 0; i < buttons.length; i++) {
                    var btn = $(buttons[i]);
                    for (var j = 0; j < valueList.length; j++) {
                        var v = valueList[j];
                        if (this.areValuesEqual(v, btn.html()))
                            btn.addClass("btn-info");
                    }
                }
        },

        filterRender:function () {
            return this.self.createSingleFilter(this); // make sure you pass the current active filter
        },
        createSingleFilter:function (currActiveFilter) {
            var self = currActiveFilter.self;

            //check facet
            var filterTemplate = self.FiltersTemplate[currActiveFilter.controlType];
            var facetTerms;

            if (!filterTemplate)
                throw("GenericFilter: Invalid control type " + currActiveFilter.controlType);

            if (filterTemplate.needFacetedField) {
                currActiveFilter.facet = self._sourceDataset.getFacetByFieldId(currActiveFilter.field);
                facetTerms = currActiveFilter.facet.attributes.terms;

                if (currActiveFilter.facet == null) {
                    throw "GenericFilter: no facet present for field [" + currActiveFilter.field + "]. Define a facet before filter render";
                }
                if (typeof currActiveFilter.label == "undefined" || currActiveFilter.label == null)
                    currActiveFilter.label = currActiveFilter.field;
            }

            currActiveFilter.useLegend = "block";
            if (currActiveFilter.labelPosition != 'top')
                currActiveFilter.useLegend = "none";

            currActiveFilter.useLeftLabel = "none";
            if (currActiveFilter.labelPosition == 'left')
                currActiveFilter.useLeftLabel = "block";

            if (currActiveFilter.labelPosition == 'inside')
                currActiveFilter.innerLabel = currActiveFilter.label;

            currActiveFilter.values = new Array();

            // add value list to selected filter or templating of record values will not work
            if (currActiveFilter.controlType.indexOf('calendar') >= 0) {
                if (currActiveFilter.start)
                    currActiveFilter.startDate = self.dateConvert(currActiveFilter.start);

                if (currActiveFilter.stop)
                    currActiveFilter.endDate = self.dateConvert(currActiveFilter.stop);
            }
            if (currActiveFilter.controlType.indexOf('slider') >= 0) {
                if (facetTerms.length > 0 && typeof facetTerms[0].term != "undefined") {
                    currActiveFilter.max = facetTerms[0].term;
                    currActiveFilter.min = facetTerms[0].term;
                }
                else {
                    currActiveFilter.max = 100;
                    currActiveFilter.min = 0;
                }
            }

            if (currActiveFilter.controlType == "month_week_calendar") {
                currActiveFilter.weekValues = [];
                currActiveFilter.periodValues = [
                    {val:"Months", selected:(currActiveFilter.period == "Months" ? "selected" : "")},
                    {val:"Weeks", selected:(currActiveFilter.period == "Weeks" ? "selected" : "")}
                ]
                var currYear = currActiveFilter.year;
                var januaryFirst = new Date(currYear, 0, 1);
                var januaryFirst_time = januaryFirst.getTime();
                var weekOffset = januaryFirst.getDay();
                var finished = false;
                for (var w = 0; w <= 53 && !finished; w++) {
                    var weekStartTime = januaryFirst_time + 7 * 86400000 * (w - 1) + (7 - weekOffset) * 86400000;
                    var weekEndTime = weekStartTime + 7 * 86400000;
                    if (w == 0)
                        weekStartTime = januaryFirst_time;

                    if (new Date(weekEndTime).getFullYear() > currYear) {
                        weekEndTime = new Date(currYear + 1, 0, 1).getTime();
                        finished = true;
                    }
                    currActiveFilter.weekValues.push({val:w + 1,
                        label:"" + (w + 1) + " [" + d3.time.format("%x")(new Date(weekStartTime)) + " -> " + d3.time.format("%x")(new Date(weekEndTime - 1000)) + "]",
                        startDate:new Date(weekStartTime),
                        stopDate:new Date(weekEndTime),
                        selected:(currActiveFilter.term == w + 1 ? self._selectedClassName : "")
                    });
                }

                currActiveFilter.monthValues = [];
                for (m = 1; m <= 12; m++) {
                    var endYear = currYear;
                    var endMonth = m;
                    if (m == 12) {
                        endYear = currYear + 1;
                        endMonth = 0;
                    }
                    currActiveFilter.monthValues.push({ val:d3.format("02d")(m),
                        label:d3.time.format("%B")(new Date(m + "/01/2012")) + " " + currYear,
                        startDate:new Date(currYear, m - 1, 1, 0, 0, 0, 0),
                        stopDate:new Date(endYear, endMonth, 1, 0, 0, 0, 0),
                        selected:(currActiveFilter.term == m ? self._selectedClassName : "")
                    });
                }
                if (currActiveFilter.period == "Months")
                    currActiveFilter.values = currActiveFilter.monthValues;
                else if (currActiveFilter.period == "Weeks")
                    currActiveFilter.values = currActiveFilter.weekValues;

                currActiveFilter.yearValues = [];
                var startYear = 2010;
                var endYear = parseInt(d3.time.format("%Y")(new Date()))
                for (var y = startYear; y <= endYear; y++)
                    currActiveFilter.yearValues.push({val:y, selected:(currActiveFilter.year == y ? "selected" : "")});

            }
            else if (currActiveFilter.controlType == "dropdown_date_range") {
                currActiveFilter.date_values = [];

                var defaultDateFilters = [
                    { label:'This week', start:"sunday", stop:"next sunday"},
                    { label:'This month', start:"1", delta:{months:1}},
                    { label:'This year', start:"january 1", delta:{years:1}},
                    { label:'Past week', stop:"sunday", delta:{days:-7}},
                    { label:'Past month', stop:"1", delta:{months:-1}},
                    { label:'Past 2 months', stop:"1", delta:{months:-2}},
                    { label:'Past 3 months', stop:"1", delta:{months:-3}},
                    { label:'Past 6 months', stop:"1", delta:{months:-6}},
                    { label:'Past year', stop:"january 1", delta:{years:-1}},
                    { label:'Last 7 days', start:"-6", stop:"t +1 d"},
                    { label:'Last 30 days', start:"-29", stop:"t +1 d"},
                    { label:'Last 90 days', start:"-89", stop:"t +1 d"},
                    { label:'Last 365 days', start:"-1 y", stop:"t +1 d"},
                ]
                var fullDateFilters = defaultDateFilters;
                if (currActiveFilter.skipDefaultFilters)
                    fullDateFilters = [];

                if (currActiveFilter.userFilters)
                    fullDateFilters = fullDateFilters.concat(currActiveFilter.userFilters);

                for (var i in fullDateFilters) {
                    var flt = fullDateFilters[i];
                    var startDate = null;
                    var stopDate = null;
                    if (flt.start && flt.stop) {
                        startDate = Date.parse(flt.start);
                        stopDate = Date.parse(flt.stop);
                    }
                    else if (flt.start && flt.delta) {
                        startDate = Date.parse(flt.start);
                        if (startDate) {
                            stopDate = new Date(startDate);
                            stopDate.add(flt.delta);
                        }
                    }
                    else if (flt.stop && flt.delta) {
                        stopDate = Date.parse(flt.stop);
                        if (stopDate) {
                            startDate = new Date(stopDate);
                            startDate.add(flt.delta);
                        }
                    }
                    if (startDate && stopDate && flt.label)
                        currActiveFilter.date_values.push({ val:flt.label,
                            startDate:startDate,
                            stopDate:stopDate
                        });
                }
                for (var j in currActiveFilter.date_values)
                    if (currActiveFilter.date_values[j].val == currActiveFilter.term) {
                        currActiveFilter.date_values[j].selected = self._selectedClassName;
                        break;
                    }
            }
            else if (currActiveFilter.controlType == "legend") {
                // OLD code, somehow working but wrong
                currActiveFilter.tmpValues = _.pluck(currActiveFilter.facet.attributes.terms, "term");

                if (typeof currActiveFilter.origLegend == "undefined") {
                    currActiveFilter.origLegend = currActiveFilter.tmpValues;
                    currActiveFilter.legend = currActiveFilter.origLegend;
                }
                currActiveFilter.tmpValues = currActiveFilter.origLegend;
                var legendSelection = currActiveFilter.legend;
                for (var i in currActiveFilter.tmpValues) {
                    var v = currActiveFilter.tmpValues[i];
                    var notSelected = "";
                    if ((currActiveFilter.fieldType != "date" && legendSelection.indexOf(v) < 0)
                        || (currActiveFilter.fieldType == "date" && legendSelection.indexOf(v) < 0 && legendSelection.indexOf(new Date(v).valueOf()) < 0))
                        notSelected = "not-selected";

                    currActiveFilter.values.push({val:v, notSelected:notSelected, color:currActiveFilter.facet.attributes.terms[i].color, count:currActiveFilter.facet.attributes.terms[i].count});
                }

// 			NEW code. Will work when facet will be returned correctly even after filtering
//		  currActiveFilter.tmpValues = _.pluck(currActiveFilter.facet.attributes.terms, "term");
//		  for (var v in currActiveFilter.tmpValues)
//		  {
//				var color;
//				var currTerm = _.find(currActiveFilter.facet.attributes.terms, function(currT) { return currT.term == v; });
//				if (typeof currTerm != "undefined" && currTerm != null)
//				{
//					color = currTerm.color;
//					count = currTerm.count;
//				}
//				var notSelected = "";
//				var legendSelection = currActiveFilter.legend;
//				if (typeof legendSelection == "undefined" || legendSelection == null || legendSelection.indexOf(v) < 0)
//					notSelected = "not-selected";
//				
//				currActiveFilter.values.push({val: v, notSelected: notSelected, color: color, count: count});
//		  }		  
            }
            else if (currActiveFilter.controlType == "color_legend") {
                var ruler = document.getElementById("my_string_width_calculation_ruler");
                if (typeof ruler == "undefined" || ruler == null) {
                    ruler = document.createElement("span");
                    ruler.setAttribute('id', "my_string_width_calculation_ruler");
                    ruler.style.visibility = "hidden";
                    ruler.style.width = "auto";
                    document.body.appendChild(ruler);
                }
                var maxWidth = 250;
                currActiveFilter.colorValues = [];

                currActiveFilter.tmpValues = _.pluck(currActiveFilter.facet.attributes.terms, "term");

                var pixelW = 0;
                // calculate needed pixel width for every string
                for (var i in currActiveFilter.tmpValues) {
                    var v = currActiveFilter.tmpValues[i];
                    ruler.innerHTML = v;
                    var w = ruler.offsetWidth
                    if (w > pixelW)
                        pixelW = w;
                }
                pixelW += 2;
                currActiveFilter.lineHeight = 40;

                // calculate needed row number and columns per row
                var maxColsPerRow = Math.floor(maxWidth / pixelW);
                var totRighe = Math.ceil(currActiveFilter.tmpValues.length / maxColsPerRow);
                var colsPerRow = Math.ceil(currActiveFilter.tmpValues.length / totRighe);
                currActiveFilter.totWidth = colsPerRow * pixelW;
                currActiveFilter.totWidth2 = currActiveFilter.totWidth + (currActiveFilter.labelPosition == 'left' ? currActiveFilter.label.length * 10 : 10)
                currActiveFilter.totHeight = totRighe * currActiveFilter.lineHeight;
                currActiveFilter.totHeight2 = currActiveFilter.totHeight + 40;

                var riga = 0;
                var colonna = 0;

                for (var i in currActiveFilter.tmpValues) {
                    var v = currActiveFilter.tmpValues[i];
                    var color = currActiveFilter.facet.attributes.terms[i].color;
                    if (colonna == colsPerRow) {
                        riga++;
                        colonna = 0;
                    }
                    currActiveFilter.colorValues.push({width:pixelW, color:color, textColor:self.complementColor(color),
                        val:v, x:pixelW * colonna, y:riga * currActiveFilter.lineHeight, yplus30:riga * currActiveFilter.lineHeight + 25 });

                    colonna++;
                }
            }
            else {
                var lastV = null;
                currActiveFilter.step = null;
                for (var i in facetTerms) {
                    var selected = "";
                    var v = facetTerms[i].term;
                    var count = facetTerms[i].count
                    if (currActiveFilter.controlType == "list") {
                        if (count > 0)
                            selected = self._selectedClassName;
                    }
                    else if (currActiveFilter.controlType == "radiobuttons") {
                        if (self.areValuesEqual(currActiveFilter.term, v) || (typeof currActiveFilter.list != "undefined" && currActiveFilter.list && currActiveFilter.list.length == 1 && self.areValuesEqual(currActiveFilter.list[0], v)))
                            selected = 'btn-primary'
                    }
                    else if (currActiveFilter.controlType == "multibutton") {
                        if (self.areValuesEqual(currActiveFilter.term, v))
                            selected = 'btn-info'
                        else if (typeof currActiveFilter.list != "undefined" && currActiveFilter.list != null) {
                            for (var j in currActiveFilter.list)
                                if (self.areValuesEqual(currActiveFilter.list[j], v))
                                    selected = 'btn-info'
                        }
                    }
                    else if (currActiveFilter.controlType == "dropdown" || currActiveFilter.controlType == "dropdown_styled") {
                        if (self.areValuesEqual(currActiveFilter.term, v) || (typeof currActiveFilter.list != "undefined" && currActiveFilter.list && currActiveFilter.list.length == 1 && self.areValuesEqual(currActiveFilter.list[0], v)))
                            selected = "selected"
                    }
                    else if (currActiveFilter.controlType == "listbox" || currActiveFilter.controlType == "listbox_styled") {
                        if (self.areValuesEqual(currActiveFilter.term, v))
                            selected = "selected"
                        else if (typeof currActiveFilter.list != "undefined" && currActiveFilter.list != null) {
                            for (var j in currActiveFilter.list)
                                if (self.areValuesEqual(currActiveFilter.list[j], v))
                                    selected = "selected"
                        }
                    }
                    if (currActiveFilter.showCount)
                    	currActiveFilter.values.push({val:v, selected:selected, valCount: v+"\t["+count+"]", count: "["+count+"]" });
                    else currActiveFilter.values.push({val:v, selected:selected, valCount: v });

                    if (currActiveFilter.controlType.indexOf('slider') >= 0) {
                        if (v > currActiveFilter.max)
                            currActiveFilter.max = v;

                        if (v < currActiveFilter.min)
                            currActiveFilter.min = v;

                        if (currActiveFilter.controlType.indexOf('styled') > 0 && lastV != null) {
                            if (currActiveFilter.step == null)
                                currActiveFilter.step = v - lastV;
                            else if (v - lastV != currActiveFilter.step)
                                currActiveFilter.step = 1;
                        }
                    }
                    lastV = v;
                }
                if (currActiveFilter.controlType.indexOf('slider') >= 0) {
                    if (typeof currActiveFilter.from == "undefined")
                        currActiveFilter.from = currActiveFilter.min;

                    if (typeof currActiveFilter.to == "undefined")
                        currActiveFilter.to = currActiveFilter.max;

                    if (typeof currActiveFilter.term == "undefined")
                        currActiveFilter.term = currActiveFilter.min;

                    if (currActiveFilter.controlType.indexOf('styled') > 0) {
                        if (currActiveFilter.min % 2 == 0 && currActiveFilter.max % 2 == 0) {
                            currActiveFilter.step1 = (currActiveFilter.max - currActiveFilter.min) / 4 + currActiveFilter.min
                            currActiveFilter.mean = (currActiveFilter.max - currActiveFilter.min) / 2
                            currActiveFilter.step2 = (currActiveFilter.max - currActiveFilter.min) * 3 / 4 + currActiveFilter.min
                            if (currActiveFilter.step1 != Math.floor(currActiveFilter.step1) || currActiveFilter.step2 != Math.floor(currActiveFilter.step2)) {
                                currActiveFilter.step1 = "|"
                                currActiveFilter.step2 = "|"
                            }
                        }
                        else {
                            currActiveFilter.step1 = "|"
                            currActiveFilter.mean = "|"
                            currActiveFilter.step2 = "|"
                        }
                    }
                }
            }
            currActiveFilter.ctrlId = self.uid + "_" + self.numId;
            self.numId++;

            return Mustache.render(self.filterTemplates[currActiveFilter.controlType], currActiveFilter);
        },

        render:function () {
            var self = this;
            var tmplData = {filters:this.activeFilters};
            _.each(tmplData.filters, function (flt) {
                flt.hrVisible = 'block';
                flt.self = self; // pass self to filters!
            });

            //  map them to the correct controlType and retain their values (start/from/term/...)
            if (self._sourceDataset) {
                _.each(self._sourceDataset.queryState.get('selections'), function (filter) {
                    for (var j in tmplData.filters) {
                        if (tmplData.filters[j].field == filter.field) {
                            tmplData.filters[j].list = filter.list
                            tmplData.filters[j].term = filter.term
                            tmplData.filters[j].start = filter.start
                            tmplData.filters[j].stop = filter.stop
                        }
                    }
                });

                tmplData.fields = this._sourceDataset.fields.toJSON();

            }

            if (tmplData.filters.length > 0)
                tmplData.filters[tmplData.filters.length - 1].hrVisible = 'none'

            var resultType = "filtered";
            if (self.options.resultType !== null)
                resultType = self.options.resultType;

            tmplData.filterDialogTitle = this.filterDialogTitle;
            tmplData.filterDialogDescription = this.filterDialogDescription;
            if (this.filterDialogTitle || this.filterDialogDescription)
                tmplData.titlePresent = "block";
            else tmplData.titlePresent = "none";
            tmplData.dateConvert = self.dateConvert;
            tmplData.filterRender = self.filterRender;
            var currTemplate = this.template;
            if (this.useHorizontalLayout)
                currTemplate = this.templateHoriz

            if (self.showBackground == false) {
                self.className = self.className.replace("well", "")
                $(self).removeClass("well");
                $(self.el).removeClass("well");
            }
            else {
                tmplData.backgroundColor = self.backgroundColor;
                if (self.showBackground == true) {
                    if (self.className.indexOf("well") < 0)
                        self.className += " well";

                    $(self).addClass("well");
                    $(self.el).addClass("well");
                }
            }

            var out = Mustache.render(currTemplate, tmplData);
            this.el.html(out);
        },

        complementColor:function (c) {
            // calculates a readable color to use over a given color
            // usually returns black for light colors and white for dark colors.
//	  var c1 = c.hsv();
//	  if (c1[2] >= 0.5)
//		  return chroma.hsv(c1[0],c1[1],0);
//	  else return chroma.hsv(c1[0],c1[1],1);
            var c1 = c.rgb;
            if (c1[0] + c1[1] + c1[2] < 255 * 3 / 2)
                return "white";
            else return "black";
        },
        onButtonsetClicked:function (e) {
            e.preventDefault();
            var $target = $(e.currentTarget);
            var $fieldSet = $target.parent().parent();
            var type = $fieldSet.attr('data-filter-type');
            var fieldId = $fieldSet.attr('data-filter-field');
            var controlType = $fieldSet.attr('data-control-type');
            var classToUse = "btn-info"
            if (controlType == "multibutton") {
                $target.toggleClass(classToUse);
            }
            else if (controlType == "radiobuttons") {
                // ensure one and only one selection is performed
                classToUse = "btn-primary"
                $fieldSet.find('div.btn-group button.' + classToUse).each(function () {
                    $(this).removeClass(classToUse);
                });
                $target.addClass(classToUse);
            }
            var listaValori = [];
            $fieldSet.find('div.btn-group button.' + classToUse).each(function () {
                listaValori.push($(this).html().valueOf()); // in case there's a date, convert it with valueOf
            });
            var currActiveFilter = this.findActiveFilterByField(fieldId, controlType);
            currActiveFilter.userChanged = true;
            if (controlType == "multibutton")
                currActiveFilter.list = listaValori;
            else if (controlType == "radiobuttons") {
                if (listaValori.length == 1 && listaValori[0] == "All") {
                    listaValori = [];
                    currActiveFilter.term = "";
                }
                else currActiveFilter.term = $target.html().valueOf();
            }
            this.doAction("onButtonsetClicked", fieldId, listaValori, "add");
        },
        onLegendItemClicked:function (e) {
            e.preventDefault();
            var $target = $(e.currentTarget);
            var $fieldSet = $target.parent().parent().parent().parent().parent();
            var type = $fieldSet.attr('data-filter-type');
            var fieldId = $fieldSet.attr('data-filter-field');
            var controlType = $fieldSet.attr('data-control-type');

            $target.toggleClass("not-selected");
            var listaValori = [];
            $fieldSet.find('div.legend-item').each(function () {
                if (!$(this).hasClass("not-selected"))
                    listaValori.push($(this).attr("myValue").valueOf()); // in case there's a date, convert it with valueOf
            });

            // make sure at least one value is selected
            if (listaValori.length > 0) {
                var currActiveFilter = this.findActiveFilterByField(fieldId, controlType)
                currActiveFilter.userChanged = true;
                currActiveFilter.legend = listaValori;

                this.doAction("onLegendItemClicked", fieldId, listaValori, "add");
            }
            else $target.toggleClass("not-selected"); // reselect the item and exit
        },
        onListItemClicked:function (e) {
            e.preventDefault();
            // let's check if user clicked on combobox or table and behave consequently
            var $target = $(e.currentTarget);
            var $table;
            var $targetTD;
            var $targetOption;
            var $combo;
            if ($target.is('td')) {
                $targetTD = $target;
                $table = $target.parent().parent().parent();
                var type = $table.attr('data-filter-type');
                if (type == "range")
                    $combo = $table.parent().parent().find(".drop-down2");
            }
            else if ($target.is('select')) {
                $combo = $target;
                $table = $combo.parent().find(".table");
            }
            this.handleListItemClicked($targetTD, $table, $combo, e.ctrlKey);
        },
        handleListItemClicked:function ($targetTD, $table, $combo, ctrlKey) {
            var fieldId = $table.attr('data-filter-field');
            var controlType = $table.attr('data-control-type');
            var type = $table.attr('data-filter-type');
            if (type == "range" && typeof $targetTD == "undefined") {
                // case month_week_calendar
                // user clicked on year combo
                var year = parseInt($combo.val());
                // update year value in filter (so that the value is retained after re-rendering)
                this.findActiveFilterByField(fieldId, controlType).year = year;
                this.render();
            }
            if (typeof $targetTD != "undefined") {
                // user clicked on table
                if (!ctrlKey) {
                    $table.find('tr').each(function () {
                        $(this).removeClass(this._selectedClassName);
                    });
                }
                $targetTD.parent().addClass(this._selectedClassName);
                var listaValori = [];
                if (type == "list") {
                    $table.find('tr.' + this._selectedClassName + " td").each(function () {
                        listaValori.push($(this).text());
                    });
                }

                var currFilter = this.findActiveFilterByField(fieldId, controlType);
                currFilter.userChanged = true;

                if (type == "range") {
                    // case month_week_calendar
                    var year = parseInt($combo.val());
                    var startDate = $targetTD.attr('startDate');
                    var endDate = $targetTD.attr('stopDate');

                    currFilter.term = $targetTD.attr('myValue'); // save selected item for re-rendering later

                    this.doAction("onListItemClicked", fieldId, [startDate, endDate], "add");
                }
                else if (type == "list") {
                    this.doAction("onListItemClicked", fieldId, listaValori, "add");
                }
                else if (type == "term") {
                    this.doAction("onListItemClicked", fieldId, [$targetTD.text()], "add");
                }
            }
        },

        // action could be add or remove
        doAction:function (eventType, fieldName, values, actionType) {

            var actions = this.options.actions;
            var eventData = {};
            eventData[fieldName] = values;

            recline.ActionUtility.doAction(actions, eventType, eventData, actionType);
        },

        dateConvert:function (d) {
            var dd = new Date(d);
            return dd.toDateString();
        },

        dateConvertBack:function (d) {
            // convert 01/31/2012  to 2012-01-31 00:00:00
            try {
                var p = d.split(/\D/);
                return p[2] + "-" + p[0] + "-" + p[1] + " 00:00:00";
            }
            catch (ex) {
                return d;
            }
        },

        onStyledSliderValueChanged:function (e, value) {
            e.preventDefault();
            var $target = $(e.target).parent().parent();
            var fieldId = $target.attr('data-filter-field');
            var fieldType = $target.attr('data-filter-type');
            var controlType = $target.attr('data-control-type');
            if (fieldType == "term") {
                var term = value;
                var activeFilter = this.findActiveFilterByField(fieldId, controlType);
                activeFilter.userChanged = true;
                activeFilter.term = term;
                activeFilter.list = [term];
                this.doAction("onStyledSliderValueChanged", fieldId, [term], "add");
            }
            else if (fieldType == "range") {
                var activeFilter = this.findActiveFilterByField(fieldId, controlType);
                activeFilter.userChanged = true;
                var fromTo = value.split(";");
                var from = fromTo[0];
                var to = fromTo[1];
                activeFilter.from = from;
                activeFilter.to = to;
                this.doAction("onStyledSliderValueChanged", fieldId, [from, to], "add");
            }
        },
        onFilterValueChanged:function (e) {
            e.preventDefault();
            var $target = $(e.target).parent();
            var fieldId = $target.attr('data-filter-field');
            var fieldType = $target.attr('data-filter-type');
            var controlType = $target.attr('data-control-type');

            var activeFilter = this.findActiveFilterByField(fieldId, controlType);
            activeFilter.userChanged = true;
            if (fieldType == "term") {
                var term;
                var termObj = $target.find('.data-control-id');
                switch (controlType) {
                    case "term":
                        term = termObj.val();
                        break;
                    case "slider":
                        term = termObj.slider("value");
                        break;
                    case "slider_styled":
                        term = termObj.attr("value");
                        break;
                    case "dropdown":
                    case "dropdown_styled":
                        term = termObj.val();
                        break;
                    case "listbox":
                        term = termObj.val();
                        break;
                }
                activeFilter.term = term;
                activeFilter.list = [term];
                this.doAction("onFilterValueChanged", fieldId, [term], "add");
            }
            else if (fieldType == "list") {
                var list = new Array();
                var listObj = $target.find('.data-control-id')[0]; //return a plain HTML select obj
                for (var i in listObj.options)
                    if (listObj.options[i].selected)
                        list.push(listObj.options[i].value);

                activeFilter.list = list;
                this.doAction("onFilterValueChanged", fieldId, list, "add");
            }
            else if (fieldType == "range") {
                var from;
                var to;
                var fromTo;
                var fromObj = $target.find('.data-control-id-from');
                var toObj = $target.find('.data-control-id-to');
                var fromToObj = $target.find('.data-control-id');
                switch (controlType) {
                    case "range":
                        from = fromObj.val();
                        to = toObj.val();
                        break;
                    case "range_slider":
                        from = fromToObj.slider("values", 0);
                        to = fromToObj.slider("values", 1);
                        break;
                    case "range_slider_styled":
                        fromTo = fromToObj.attr("value").split(";");
                        from = fromTo[0];
                        to = fromTo[1];
                        break;
                    case "range_calendar":
                        from = new Date(fromObj.val());
                        to = new Date(toObj.val());
                        break;
                    case "dropdown_date_range":
                        from = fromToObj.find(":selected").attr("startDate");
                        to = fromToObj.find(":selected").attr("stopDate");
                        activeFilter.term = fromToObj.val();
                        break;
                }
                activeFilter.from = from;
                activeFilter.to = to;
                this.doAction("onFilterValueChanged", fieldId, [from, to], "add");
            }
        },
        onAddFilterShow:function (e) {
            e.preventDefault();
            var $target = $(e.target);
            $target.hide();
            this.el.find('div.js-add').show();
        },
        hidePanel:function (obj) {
            $(function () {
                obj.hide("blind", {}, 1000, function () {
                });
            });
        },
        getFilterTypeFromControlType:function (controlType) {
            switch (controlType) {
                case "dropdown" :
                case "dropdown_styled" :
                case "slider" :
                case "slider_styled" :
                case "radiobuttons" :
                    return "term";
                case "range_slider" :
                case "range_slider_styled" :
                case "range_calendar" :
                case "month_week_calendar" :
                case "dropdown_date_range" :
                    return "range";
                case "list" :
                case "listbox":
                case "listbox_styled":
                case "legend" :
                case "multibutton" :
                    return "list";
            }
            return controlType;
        },
        getFieldType:function (field) {
            var fieldFound = this._sourceDataset.fields.find(function (e) {
                return e.get('id') === field
            })
            if (typeof fieldFound != "undefined" && fieldFound != null)
                return fieldFound.get('type');

            return "string";
        },
        onAddFilter:function (e) {
            e.preventDefault();
            var $target = $(e.target).parent().parent();
            $target.hide();
            var controlType = $target.find('select.filterType').val();
            var filterType = this.getFilterTypeFromControlType(controlType);
            var field = $target.find('select.fields').val();
            this.addNewFilterControl({type:filterType, field:field, controlType:controlType});
        },
        addNewFilterControl:function (newFilter) {
            if (typeof newFilter.type == 'undefined')
                newFilter.type = this.getFilterTypeFromControlType(newFilter.controlType)

            if (typeof newFilter.fieldType == 'undefined')
                newFilter.fieldType = this.getFieldType(newFilter.field)

            if (newFilter.controlType == "month_week_calendar") {
                if (typeof newFilter.period == "undefined")
                    newFilter.period = "Months"

                if (typeof newFilter.year == "undefined")
                    newFilter.year = new Date().getFullYear();
            }
            this.activeFilters.push(newFilter);

        },
        onPeriodChanged:function (e) {
            e.preventDefault();
            var $table = $(e.target).parent().find(".table");
            //var $yearCombo = $(e.target).parent().find(".drop-down2");
            var fieldId = $table.attr('data-filter-field');
            var controlType = $table.attr('data-control-type');

            var type = $table.attr('data-filter-type');
            var currFilter = this.findActiveFilterByField(fieldId, controlType);
            currFilter.period = $(e.target).val();
            currFilter.term = null;
            this.render();
        },
        findActiveFilterByField:function (fieldId, controlType) {
            for (var j in this.activeFilters) {
                if (this.activeFilters[j].field == fieldId && this.activeFilters[j].controlType == controlType)
                    return this.activeFilters[j];
            }
            return new Object(); // to avoid "undefined" errors
        },
        onRemoveFilter:function (e) {
            e.preventDefault();
            var $target = $(e.target);
            var field = $target.parent().parent().attr('data-filter-field');
            var controlType = $target.parent().parent().attr('data-control-type');
            var currFilter = this.findActiveFilterByField(field, controlType);
            currFilter.term = undefined;
            currFilter.value = [];
            currFilter.userChanged = undefined;

            if (currFilter.controlType == "list" || currFilter.controlType == "month_week_calendar") {
                $table = $target.parent().parent().find(".table")
                if (typeof $table != "undefined") {
                    $table.find('tr').each(function () {
                        $(this).removeClass(this._selectedClassName);
                    });
                }
            }
            else if (currFilter.controlType == "slider_styled") {
                var filterCtrl = $target.parent().parent().find(".slider-styled")
                filterCtrl.jslider("value", filterCtrl.jslider().settings.from);
            }

            this.doAction("onRemoveFilter", field, [], "remove");

        },

        composeStateData:function () {
            var self = this;
            var queryString = '?';
            var items = [];
            $.each(self._sourceDataset.queryState.toJSON(), function (key, value) {
                if (typeof(value) === 'object') {
                    value = JSON.stringify(value);
                }
                items.push(key + '=' + encodeURIComponent(value));
            });

            return items;
        },


    });

})(jQuery, recline.View);
/*jshint multistr:true */

this.recline = this.recline || {};
this.recline.View = this.recline.View || {};

(function($, my) {

my.Pager = Backbone.View.extend({
  className: 'recline-pager', 
  template: ' \
    <div class="pagination"> \
      <ul> \
        <li class="prev action-pagination-update"><a href="">&laquo;</a></li> \
        <li class="active"><a><input name="from" type="text" value="{{from}}" /> &ndash; <input name="to" type="text" value="{{to}}" /> </a></li> \
        <li class="next action-pagination-update"><a href="">&raquo;</a></li> \
      </ul> \
    </div> \
  ',

  events: {
    'click .action-pagination-update': 'onPaginationUpdate',
    'change input': 'onFormSubmit'
  },

  initialize: function() {
    _.bindAll(this, 'render');
    this.el = $(this.el);
    this.model.bind('change', this.render);
    this.render();
  },
  onFormSubmit: function(e) {
    e.preventDefault();
    var newFrom = parseInt(this.el.find('input[name="from"]').val());
    var newSize = parseInt(this.el.find('input[name="to"]').val()) - newFrom;
    this.model.set({size: newSize, from: newFrom});
  },
  onPaginationUpdate: function(e) {
    e.preventDefault();
    var $el = $(e.target);
    var newFrom = 0;
    if ($el.parent().hasClass('prev')) {
      newFrom = this.model.get('from') - Math.max(0, this.model.get('size'));
    } else {
      newFrom = this.model.get('from') + this.model.get('size');
    }
    this.model.set({from: newFrom});
  },
  render: function() {
    var tmplData = this.model.toJSON();
    tmplData.to = this.model.get('from') + this.model.get('size');
    var templated = Mustache.render(this.template, tmplData);
    this.el.html(templated);
  }
});

})(jQuery, recline.View);

/*jshint multistr:true */

this.recline = this.recline || {};
this.recline.View = this.recline.View || {};

(function($, my) {

my.QueryEditor = Backbone.View.extend({
  className: 'recline-query-editor', 
  template: ' \
    <form action="" method="GET" class="form-inline"> \
      <div class="input-prepend text-query"> \
        <span class="add-on"><i class="icon-search"></i></span> \
        <input type="text" name="q" value="{{q}}" class="span2" placeholder="Search data ..." class="search-query" /> \
      </div> \
      <button type="submit" class="btn">Go &raquo;</button> \
    </form> \
  ',

  events: {
    'submit form': 'onFormSubmit'
  },

  initialize: function() {
    _.bindAll(this, 'render');
    this.el = $(this.el);
    this.model.bind('change', this.render);
    this.render();
  },
  onFormSubmit: function(e) {
    e.preventDefault();
    var query = this.el.find('.text-query input').val();
    this.model.set({q: query});
  },
  render: function() {
    var tmplData = this.model.toJSON();
    var templated = Mustache.render(this.template, tmplData);
    this.el.html(templated);
  }
});

})(jQuery, recline.View);

/*jshint multistr:true */

this.recline = this.recline || {};
this.recline.View = this.recline.View || {};

(function ($, my) {


    my.VisualSearch = Backbone.View.extend({

        template:'<div id="search_box_container"></div><div id="search_query">&nbsp;</div>',

        initialize:function (options) {
            var self = this;

            this.el = $(this.el);
            _.bindAll(this, 'render', 'redraw');

            /*
            this.model.bind('change', self.render);
            this.model.fields.bind('reset', self.render);
            this.model.fields.bind('add', self.render);
            this.model.records.bind('add', self.redraw);
            this.model.records.bind('reset', self.redraw);
            */


        },

        render:function () {
            var self = this;


            var tmplData = {};
            tmplData["viewId"] = self.uid;
            var htmls = Mustache.render(this.template, tmplData);
            $(this.el).html(htmls);


            return this;
        },

        redraw:function () {
            var self = this;

            console.log($().jquery);
            console.log($.ui.version);

            window.visualSearch = VS.init({
                container  : $('#search_box_container'),
                query      : 'country: "South Africa" account: 5-samuel "U.S. State": California',
                showFacets : true,
                unquotable : [
                    'text',
                    'account',
                    'filter',
                    'access'
                ],
                callbacks  : {
                    search : function(query, searchCollection) {
                        var $query = $('#search_query');
                        $query.stop().animate({opacity : 1}, {duration: 300, queue: false});
                        $query.html('<span class="raquo">&raquo;</span> You searched for: <b>' + searchCollection.serialize() + '</b>');
                        clearTimeout(window.queryHideDelay);
                        window.queryHideDelay = setTimeout(function() {
                            $query.animate({
                                opacity : 0
                            }, {
                                duration: 1000,
                                queue: false
                            });
                        }, 2000);
                    },
                    valueMatches : function(category, searchTerm, callback) {
                        switch (category) {
                            case 'account':
                                callback([
                                    { value: '1-amanda', label: 'Amanda' },
                                    { value: '2-aron',   label: 'Aron' },
                                    { value: '3-eric',   label: 'Eric' },
                                    { value: '4-jeremy', label: 'Jeremy' },
                                    { value: '5-samuel', label: 'Samuel' },
                                    { value: '6-scott',  label: 'Scott' }
                                ]);
                                break;
                            case 'filter':
                                callback(['published', 'unpublished', 'draft']);
                                break;
                            case 'access':
                                callback(['public', 'private', 'protected']);
                                break;
                            case 'title':
                                callback([
                                    'Pentagon Papers',
                                    'CoffeeScript Manual',
                                    'Laboratory for Object Oriented Thinking',
                                    'A Repository Grows in Brooklyn'
                                ]);
                                break;
                            case 'city':
                                callback([
                                    'Cleveland',
                                    'New York City',
                                    'Brooklyn',
                                    'Manhattan',
                                    'Queens',
                                    'The Bronx',
                                    'Staten Island',
                                    'San Francisco',
                                    'Los Angeles',
                                    'Seattle',
                                    'London',
                                    'Portland',
                                    'Chicago',
                                    'Boston'
                                ])
                                break;
                            case 'U.S. State':
                                callback([
                                    "Alabama", "Alaska", "Arizona", "Arkansas", "California",
                                    "Colorado", "Connecticut", "Delaware", "District of Columbia", "Florida",
                                    "Georgia", "Guam", "Hawaii", "Idaho", "Illinois",
                                    "Indiana", "Iowa", "Kansas", "Kentucky", "Louisiana",
                                    "Maine", "Maryland", "Massachusetts", "Michigan", "Minnesota",
                                    "Mississippi", "Missouri", "Montana", "Nebraska", "Nevada",
                                    "New Hampshire", "New Jersey", "New Mexico", "New York", "North Carolina",
                                    "North Dakota", "Ohio", "Oklahoma", "Oregon", "Pennsylvania",
                                    "Puerto Rico", "Rhode Island", "South Carolina", "South Dakota", "Tennessee",
                                    "Texas", "Utah", "Vermont", "Virginia", "Virgin Islands",
                                    "Washington", "West Virginia", "Wisconsin", "Wyoming"
                                ]);
                                break
                            case 'country':
                                callback([
                                    "China", "India", "United States", "Indonesia", "Brazil",
                                    "Pakistan", "Bangladesh", "Nigeria", "Russia", "Japan",
                                    "Mexico", "Philippines", "Vietnam", "Ethiopia", "Egypt",
                                    "Germany", "Turkey", "Iran", "Thailand", "D. R. of Congo",
                                    "France", "United Kingdom", "Italy", "Myanmar", "South Africa",
                                    "South Korea", "Colombia", "Ukraine", "Spain", "Tanzania",
                                    "Sudan", "Kenya", "Argentina", "Poland", "Algeria",
                                    "Canada", "Uganda", "Morocco", "Iraq", "Nepal",
                                    "Peru", "Afghanistan", "Venezuela", "Malaysia", "Uzbekistan",
                                    "Saudi Arabia", "Ghana", "Yemen", "North Korea", "Mozambique",
                                    "Taiwan", "Syria", "Ivory Coast", "Australia", "Romania",
                                    "Sri Lanka", "Madagascar", "Cameroon", "Angola", "Chile",
                                    "Netherlands", "Burkina Faso", "Niger", "Kazakhstan", "Malawi",
                                    "Cambodia", "Guatemala", "Ecuador", "Mali", "Zambia",
                                    "Senegal", "Zimbabwe", "Chad", "Cuba", "Greece",
                                    "Portugal", "Belgium", "Czech Republic", "Tunisia", "Guinea",
                                    "Rwanda", "Dominican Republic", "Haiti", "Bolivia", "Hungary",
                                    "Belarus", "Somalia", "Sweden", "Benin", "Azerbaijan",
                                    "Burundi", "Austria", "Honduras", "Switzerland", "Bulgaria",
                                    "Serbia", "Israel", "Tajikistan", "Hong Kong", "Papua New Guinea",
                                    "Togo", "Libya", "Jordan", "Paraguay", "Laos",
                                    "El Salvador", "Sierra Leone", "Nicaragua", "Kyrgyzstan", "Denmark",
                                    "Slovakia", "Finland", "Eritrea", "Turkmenistan"
                                ], {preserveOrder: true});
                                break;
                        }
                    },
                    facetMatches : function(callback) {
                        callback([
                            'account', 'filter', 'access', 'title',
                            { label: 'city',    category: 'location' },
                            { label: 'address', category: 'location' },
                            { label: 'country', category: 'location' },
                            { label: 'U.S. State', category: 'location' }
                        ]);
                    }
                }
            });

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

