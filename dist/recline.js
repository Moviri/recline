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
  // * Every dataset must have an id equal to its resource id on the CKAN instance
  // * You should set the CKAN API endpoint for requests by setting API_ENDPOINT value on this module (recline.Backend.Ckan.API_ENDPOINT)

  my.__type__ = 'ckan';

  // Default CKAN API endpoint used for requests (you can change this but it will affect every request!)
  my.API_ENDPOINT = 'http://datahub.io/api';

  // ### fetch
  my.fetch = function(dataset) {
    var wrapper = my.DataStore();
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
    var actualQuery = my._normalizeQuery(queryObj, dataset);
    var wrapper = my.DataStore();
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
  }

  var CKAN_TYPES_MAP = {
    'int4': 'integer',
    'float8': 'float',
    'text': 'string'
  };

}(jQuery, this.recline.Backend.Ckan));
this.recline = this.recline || {};
this.recline.Backend = this.recline.Backend || {};
this.recline.Backend.CSV = this.recline.Backend.CSV || {};

(function(my) {
  // ## fetch
  //
  // 3 options
  //
  // 1. CSV local fileobject -> HTML5 file object + CSV parser
  // 2. Already have CSV string (in data) attribute -> CSV parser
  // 2. online CSV file that is ajax-able -> ajax + csv parser
  //
  // All options generates similar data and give a memory store outcome
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

  // ### serializeCSV
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


}(this.recline.Backend.CSV));
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
    this.delete = function(id) {
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
      return es.delete(changes.deletes[0].id);
    }
  };

  // ### query
  my.query = function(queryObj, dataset) {
    var dfd = $.Deferred();
    var es = new my.Wrapper(dataset.url, my.esOptions);
    var jqxhr = es.query(queryObj);
    jqxhr.done(function(results) {
      var out = {
        total: results.hits.total,
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
    var regex = /.*spreadsheet\/ccc?.*key=([^#?&+]+).*gid=([\d]+).*/;
    var matches = url.match(regex);
    var key;
    var worksheet;
    var urls;
    
    if(!!matches) {
        key = matches[1];
        // the gid in url is 0-based and feed url is 1-based
        worksheet = parseInt(matches[2]) + 1;
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
this.recline = this.recline || {};
this.recline.Backend = this.recline.Backend || {};
this.recline.Backend.Memory = this.recline.Backend.Memory || {};

(function($, my) {
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
  my.Store = function(data, fields) {
    var self = this;
    this.data = data;
    if (fields) {
      this.fields = fields;
    } else {
      if (data) {
        this.fields = _.map(data[0], function(value, key) {
          return {id: key};
        });
      }
    }

    this.update = function(doc) {
      _.each(self.data, function(internalDoc, idx) {
        if(doc.id === internalDoc.id) {
          self.data[idx] = doc;
        }
      });
    };

    this.delete = function(doc) {
      var newdocs = _.reject(self.data, function(internalDoc) {
        return (doc.id === internalDoc.id);
      });
      this.data = newdocs;
    };

    this.save = function(changes, dataset) {
      var self = this;
      var dfd = $.Deferred();
      // TODO _.each(changes.creates) { ... }
      _.each(changes.updates, function(record) {
        self.update(record);
      });
      _.each(changes.deletes, function(record) {
        self.delete(record);
      });
      dfd.resolve();
      return dfd.promise();
    },

    this.query = function(queryObj) {
      var dfd = $.Deferred();
      var numRows = queryObj.size || this.data.length;
      var start = queryObj.from || 0;
      var results = this.data;

      results = this._applyFilters(results, queryObj);
      results = this._applyFreeTextQuery(results, queryObj);

      // TODO: this is not complete sorting!
      // What's wrong is we sort on the *last* entry in the sort list if there are multiple sort criteria
      _.each(queryObj.sort, function(sortObj) {
        var fieldName = sortObj.field;
        results = _.sortBy(results, function(doc) {
          var _out = doc[fieldName];
          return _out;
        });
        if (sortObj.order == 'desc') {
          results.reverse();
        }
      });
      var facets = this.computeFacets(results, queryObj);
      var out = {
        total: results.length,
        hits: results.slice(start, start+numRows),
        facets: facets
      };
      dfd.resolve(out);
      return dfd.promise();
    };

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
        number : function (e) { return parseFloat(e, 10); },
        string : function (e) { return e.toString() },
        date   : function (e) { return new Date(e).valueOf() }
      };

      // filter records
      return _.filter(results, function (record) {
          var passes = _.map(filters, function (filter) {
          return filterFunctions[filter.type](record, filter);
        });

        // return only these records that pass all filters
        return _.all(passes, _.identity);
      });

      // filters definitions

      function term(record, filter) {
        var parse = dataParsers[filter.fieldType];
        var value = parse(record[filter.field]);
        var term  = parse(filter.term);

        return (value === term);
      }

      function range(record, filter) {
        var parse = dataParsers[filter.fieldType];
        var value = parse(record[filter.field]);
        var start = parse(filter.start);
        var stop  = parse(filter.stop);

        return (value >= start && value <= stop);
      }

      function geo_distance() {
        // TODO code here
      }
    };

    // we OR across fields but AND across terms in query string
    this._applyFreeTextQuery = function(results, queryObj) {
      if (queryObj.q) {
        var terms = queryObj.q.split(' ');
        var patterns=_.map(terms, function(term) {
          return new RegExp(term.toLowerCase());;
          });
        results = _.filter(results, function(rawdoc) {
          var matches = true;
          _.each(patterns, function(pattern) {
            var foundmatch = false;
            _.each(self.fields, function(field) {
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

    this.computeFacets = function(records, queryObj) {
      var facetResults = {};
      if (!queryObj.facets) {
        return facetResults;
      }
      _.each(queryObj.facets, function(query, facetId) {
        // TODO: remove dependency on recline.Model
        facetResults[facetId] = new recline.Model.Facet({id: facetId}).toJSON();
        facetResults[facetId].termsall = {};
        facetResults[facetId].termsall_sum = {};
      });
      // faceting
      _.each(records, function(doc) {
        _.each(queryObj.facets, function(query, facetId) {
          var fieldId = query.terms.field;
          var val = doc[fieldId];
          var tmp = facetResults[facetId];
          if (val) {
            tmp.termsall[val] = tmp.termsall[val] ? tmp.termsall[val] + 1 : 1;
            tmp.termsall_sum[val] = tmp.termsall_sum[val] ? tmp.termsall_sum[val] + 1 : 1;
          } else {
            tmp.missing = tmp.missing + 1;
          }
        });
      });
      _.each(queryObj.facets, function(query, facetId) {
        var tmp = facetResults[facetId];
        var terms = _.map(tmp.termsall, function(count, term) {
          return { term: term, count: count };
        });
        tmp.terms = _.sortBy(terms, function(item) {
          // want descending order
          return -item.count;
        });
        tmp.terms = tmp.terms.slice(0, 10);                        facetResults
      });
      return facetResults;
    };

    this.transform = function(editFunc) {
      var toUpdate = recline.Data.Transform.mapDocs(this.data, editFunc);
      // TODO: very inefficient -- could probably just walk the documents and updates in tandem and update
      _.each(toUpdate.updates, function(record, idx) {
        self.data[idx] = record;
      });
      return this.save(toUpdate);
    };


  };

}(jQuery, this.recline.Backend.Memory));
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
                        map[part[j]] = resultData.partitions.sum[part[j]] / resultData.partitions.count[part[j]];
                    }
                    return map;
                }
            }(aggregatedFields, partitionsFields);

            }


        },
        max         : function () {},
        min         : function () {}
    };


})(this.recline.Data);this.recline = this.recline || {};
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

}(this.recline.Data))
// # Recline Backbone Models
this.recline = this.recline || {};
this.recline.Model = this.recline.Model || {};

(function($, my) {

// ## <a id="dataset">Dataset</a>
my.Dataset = Backbone.Model.extend({
  constructor: function Dataset() {
    Backbone.Model.prototype.constructor.apply(this, arguments);
  },

  // ### initialize
  initialize: function() {


    _.bindAll(this, 'query');
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
      deletes: [],
      updates: [],
      creates: []
    };
    this.facets = new my.FacetList();

    this.recordCount = null;
    this.queryState = new my.Query();
    this.queryState.bind('change', this.query);
    this.queryState.bind('facet:add', this.query);
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
  fetch: function() {
    var self = this;
    var dfd = $.Deferred();


    if (this.backend !== recline.Backend.Memory) {
      this.backend.fetch(this.toJSON())
        .done(handleResults)
        .fail(function(arguments) {
          console.log("Fail in fetching data");
          dfd.reject(arguments);
        });
    } else {
      // special case where we have been given data directly
      handleResults({
        records: this.get('records'),
        fields: this.get('fields'),
        useMemoryStore: true
      });
    }

    function handleResults(results) {
      var out = self._normalizeRecordsAndFields(results.records, results.fields);
      if (results.useMemoryStore) {
          self._store = new recline.Backend.Memory.Store(out.records, out.fields);
      }

      self.set(results.metadata);


        // if labels are declared in dataset properties merge it;
        if(self.attributes.fieldLabels) {
            for(var i=0; i<out.fields.length; i++) {
                var tmp  = _.find(self.attributes.fieldLabels, function(x){ return x.id==out.fields[i].id; });
                if(tmp != null)
                  out.fields[i].label = tmp.label;

            }

        }

        self.fields.reset(out.fields);

        self.query()
        .done(function() {
          dfd.resolve(self);
        })
        .fail(function(arguments) {
          dfd.reject(arguments);
        });

    }

    return dfd.promise();
  },



  // ### _normalizeRecordsAndFields
  // 
  // Get a proper set of fields and records from incoming set of fields and records either of which may be null or arrays or objects
  //
  // e.g. fields = ['a', 'b', 'c'] and records = [ [1,2,3] ] =>
  // fields = [ {id: a}, {id: b}, {id: c}], records = [ {a: 1}, {b: 2}, {c: 3}]
  _normalizeRecordsAndFields: function(records, fields) {
    // if no fields get them from records
    if (!fields && records && records.length > 0) {
      // records is array then fields is first row of records ...
      if (records[0] instanceof Array) {
        fields = records[0];
        records = records.slice(1);
      } else {
        fields = _.map(_.keys(records[0]), function(key) {
          return {id: key};
        });
      }
    } 

    // fields is an array of strings (i.e. list of field headings/ids)
    if (fields && fields.length > 0 && typeof fields[0] === 'string') {
      // Rename duplicate fieldIds as each field name needs to be
      // unique.
      var seen = {};
      fields = _.map(fields, function(field, index) {
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
        return { id: fieldId };
      });
    }
    // records is provided as arrays so need to zip together with fields
    // NB: this requires you to have fields to match arrays
    if (records && records.length > 0 && records[0] instanceof Array) {
      records = _.map(records, function(doc) {
        var tmp = {};
        _.each(fields, function(field, idx) {
          tmp[field.id] = doc[idx];
        });
        return tmp;
      });
    }
    return {
      fields: fields,
      records: records
    };
  },

  save: function() {
    var self = this;
    // TODO: need to reset the changes ...
    return this._store.save(this._changes, this.toJSON());
  },

  transform: function(editFunc) {
    var self = this;
    if (!this._store.transform) {
      alert('Transform is not supported with this backend: ' + this.get('backend'));
      return;
    }
    this.trigger('recline:flash', {message: "Updating all visible docs. This could take a while...", persist: true, loader: true});
    this._store.transform(editFunc).done(function() {
      // reload data as records have changed
      self.query();
      self.trigger('recline:flash', {message: "Records updated successfully"});
    });
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
  query: function(queryObj) {

    var self = this;
    var dfd = $.Deferred();
    this.trigger('query:start');

    if (queryObj) {
      this.queryState.set(queryObj, {silent: true});
    }
    var actualQuery = this.queryState.toJSON();

    this._store.query(actualQuery, this.toJSON())
      .done(function(queryResult) {
        self._handleQueryResult(queryResult);
        self.trigger('query:done');
        dfd.resolve(self.records);
      })
      .fail(function(arguments) {
        self.trigger('query:fail', arguments);
        dfd.reject(arguments);
      });
    return dfd.promise();
  },

  _handleQueryResult: function(queryResult) {

    var self = this;

    self.recordCount = queryResult.total;
    var docs = _.map(queryResult.hits, function(hit) {
      var _doc = new my.Record(hit);

      _doc.fields = self.fields;
      _doc.bind('change', function(doc) {
        self._changes.updates.push(doc.toJSON());
      });
      _doc.bind('destroy', function(doc) {
        self._changes.deletes.push(doc.toJSON());
      });
      return _doc;
    });
    self.records.reset(docs);


    if (queryResult.facets) {
      var facets = _.map(queryResult.facets, function(facetResult, facetId) {
        facetResult.id = facetId;
        return new my.Facet(facetResult);
      });
      self.facets.reset(facets);
    }
  },

  toTemplateJSON: function() {
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
  getFieldsSummary: function() {
    var self = this;
    var query = new my.Query();
    query.set({size: 0});
    this.fields.each(function(field) {
      query.addFacet(field.id);
    });
    var dfd = $.Deferred();
    this._store.query(query.toJSON(), this.toJSON()).done(function(queryResult) {
      if (queryResult.facets) {
        _.each(queryResult.facets, function(facetResult, facetId) {
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
  recordSummary: function(record) {
    return record.summary();
  },

  // ### _backendFromString(backendString)
  //
  // Look up a backend module from a backend string (look in recline.Backend)
  _backendFromString: function(backendString) {
    var backend = null;
    if (recline && recline.Backend) {
      _.each(_.keys(recline.Backend), function(name) {
        if (name.toLowerCase() === backendString.toLowerCase()) {
          backend = recline.Backend[name];
        }
      });
    }
    return backend;
  }
});


// ## <a id="record">A Record</a>
// 
// A single record (or row) in the dataset
my.Record = Backbone.Model.extend({
  constructor: function Record() {
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
  initialize: function() {
    _.bindAll(this, 'getFieldValue');
  },

  // ### getFieldValue
  //
  // For the provided Field get the corresponding rendered computed data value
  // for this record.
  getFieldValue: function(field) {
    val = this.getFieldValueUnrendered(field);
    if (field.renderer) {
      val = field.renderer(val, field, this.toJSON());
    }
    return val;
  },

  // ### getFieldValueUnrendered
  //
  // For the provided Field get the corresponding computed data value
  // for this record.
  getFieldValueUnrendered: function(field) {

      var val = this.get(field.id);


    if (field.deriver) {
      val = field.deriver(val, field, this);
    }
    return val;
  },

  // ### summary
  //
  // Get a simple html summary of this record in form of key/value list
  summary: function(record) {
    var self = this;
    var html = '<div class="recline-record-summary">';
    this.fields.each(function(field) { 
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
  fetch: function() {},
  save: function() {},
  destroy: function() { this.trigger('destroy', this); }
});


// ## A Backbone collection of Records
my.RecordList = Backbone.Collection.extend({
  constructor: function RecordList() {
    Backbone.Collection.prototype.constructor.apply(this, arguments);
  },
  model: my.Record
});


// ## <a id="field">A Field (aka Column) on a Dataset</a>
my.Field = Backbone.Model.extend({
  constructor: function Field() {
    Backbone.Model.prototype.constructor.apply(this, arguments);
  },
  // ### defaults - define default values
  defaults: {
    label: null,
    type: 'string',
    format: null,
    is_derived: false
  },
  // ### initialize
  //
  // @param {Object} data: standard Backbone model attributes
  //
  // @param {Object} options: renderer and/or deriver functions.
  initialize: function(data, options) {
    // if a hash not passed in the first argument throw error
    if ('0' in data) {
      throw new Error('Looks like you did not pass a proper hash with id to Field constructor');
    }
    if (this.attributes.label === null) {
      this.set({label: this.id});
    }
    if (options) {
      this.renderer = options.renderer;
      this.deriver = options.deriver;
    }
    if (!this.renderer) {
      this.renderer = this.defaultRenderers[this.get('type')];
    }
    this.facets = new my.FacetList();
  },
  defaultRenderers: {
    object: function(val, field, doc) {
      return JSON.stringify(val);
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
});

my.FieldList = Backbone.Collection.extend({
  constructor: function FieldList() {
    Backbone.Collection.prototype.constructor.apply(this, arguments);
  },
  model: my.Field
});

// ## <a id="query">Query</a>
my.Query = Backbone.Model.extend({
  constructor: function Query() {
    Backbone.Model.prototype.constructor.apply(this, arguments);
  },
  defaults: function() {
    return {
      from: 0,
      q: '',
      facets: {},
      filters: [],
      selections: []
    };
  },
  _filterTemplates: {
    term: {
      type: 'term',
      field: '',
      term: ''
    },
    termAdvanced: {
          type: 'term',
          operator : "eq",
          field: '',
          term: ''
      },
    list: {
      type: 'term',
     field: '',
      list: []
    },
    range: {
      type: 'range',
      start: '',
      stop: ''
    },
    geo_distance: {
      type: 'geo_distance',
      distance: 10,
      unit: 'km',
      point: {
        lon: 0,
        lat: 0
      }
    }
  },
      _selectionTemplates: {
          term: {
              type: 'term',
              field: '',
              term: ''
          },
          range: {
              type: 'range',
              start: '',
              stop: ''
          }
      },
  // ### addFilter
  //
  // Add a new filter (appended to the list of filters)
  //
  // @param filter an object specifying the filter - see _filterTemplates for examples. If only type is provided will generate a filter by cloning _filterTemplates
  addFilter: function(filter) {

    // crude deep copy
    var ourfilter = JSON.parse(JSON.stringify(filter));
    // not full specified so use template and over-write
    // 3 as for 'type', 'field' and 'fieldType'

    if (_.keys(filter).length <= 3) {
      ourfilter = _.extend(this._filterTemplates[filter.type], ourfilter);
    }
    var filters = this.get('filters');
    filters.push(ourfilter);
    this.trigger('change:filters:new-blank');
  },


    _setSingleFilter: function(filter) {
        var filters = this.get('filters');
        for(x=0;x<filters.length;x++){
            if(filters[x].field == filter.field) {
                if(filters[x] != filter) {
                    filters[x] = filter;
                    return 1;
                } else return 0;
            }
        }
        filters.push(filter);
        return 1;
    },

    // update or add the selected filter(s), a change event is triggered after the update

  setFilter: function(filter) {

      var self = this;
      // todo should be optimized in order to make only one cycle on filters

      var updatedFilters = 0;

      if(filter.constructor == Array) {
          for(y=0;y<filter.length;y++){
              updatedFilters = updatedFilters + this._setSingleFilter(filter[y]);
          }
      } else {
          updatedFilters = this._setSingleFilter(filter);
      }

      if(updatedFilters > 0) {
         self.trigger('change');
      }
  },



  updateFilter: function(index, value) {
  },
  // ### removeFilter
  //
  // Remove a filter from filters at index filterIndex
  removeFilter: function(filterIndex) {
    var filters = this.get('filters');
    filters.splice(filterIndex, 1);
    this.set({filters: filters});
    this.trigger('change');
  },

      // ### addSelection
      //
      // Add a new selection (appended to the list of selections)
      //
      // @param selection an object specifying the filter - see _filterTemplates for examples. If only type is provided will generate a filter by cloning _filterTemplates
      addSelection: function(selection) {
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
      removeSelection: function(selectionIndex) {
          var selections = this.get('selections');
          selections.splice(selectionIndex, 1);
          this.set({selections: selections});
          this.trigger('change:selections');
      },
      isFieldSelected: function(fieldName, fieldVale) {
          // todo check if field is selected
          return false;
      },
        setSelection: function(s) {
        // todo should be optimized in order to make only one cycle on filters

        if(s.constructor == Array) {
            for(y=0;y<s.length;y++){
                this._setSingleSelection(s[y]);
            }
        } else {
            this._setSingleSelection(s);
        }

        this.trigger('change:selections');
    },
    _setSingleSelection: function(s) {
        var selections = this.get('selections');
        for(x=0;x<selections.length;x++){
            if(selections[x].field == s.field) {
                selections[x] = s;
                return;
            }
        }
        selections.push(s);
    },




    // ### addFacet
  //
  // Add a Facet to this query
  //
  // See <http://www.elasticsearch.org/guide/reference/api/search/facets/>
  addFacet: function(fieldId) {
    var facets = this.get('facets');
    // Assume id and fieldId should be the same (TODO: this need not be true if we want to add two different type of facets on same field)
    if (_.contains(_.keys(facets), fieldId)) {
      return;
    }
    facets[fieldId] = {
      terms: { field: fieldId }
    };
    this.set({facets: facets}, {silent: true});
    this.trigger('facet:add', this);
  },
  addHistogramFacet: function(fieldId) {
    var facets = this.get('facets');
    facets[fieldId] = {
      date_histogram: {
        field: fieldId,
        interval: 'day'
      }
    };
    this.set({facets: facets}, {silent: true});
    this.trigger('facet:add', this);
  }
});


// ## <a id="facet">A Facet (Result)</a>
my.Facet = Backbone.Model.extend({
  constructor: function Facet() {
    Backbone.Model.prototype.constructor.apply(this, arguments);
  },
  defaults: function() {
    return {
      _type: 'terms',
      total: 0,
      other: 0,
      missing: 0,
      terms: []
    };
  }
});

// ## A Collection/List of Facets
my.FacetList = Backbone.Collection.extend({
  constructor: function FacetList() {
    Backbone.Collection.prototype.constructor.apply(this, arguments);
  },
  model: my.Facet
});







// ## Object State
//
// Convenience Backbone model for storing (configuration) state of objects like Views.
my.ObjectState = Backbone.Model.extend({
});


// ## Backbone.sync
//
// Override Backbone.sync to hand off to sync function in relevant backend
Backbone.sync = function(method, model, options) {
  return model.backend.sync(method, model, options);
};

}(jQuery, this.recline.Model));
/*jshint multistr:true */

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
      var isDateTime = xfield.get('type') === 'date';

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
        },
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
        },
      },
      grid: { hoverable: true, clickable: true },
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
        var isDateTime = xfield.get('type') === 'date';
        
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
      seriesName: String.fromCharCode(idx + 64 + 1),
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
		format: 'd',
	  },

  template: '<div class="recline-graph"> \
      <div class="panel indicator_{{viewId}}"style="display: block;"> \
        <div id="indicator_{{viewId}}">{{value}}</div>\
      </div> \
    </div> ',

  initialize: function(options) {
    var self = this;

    this.el = $(this.el);
    _.bindAll(this, 'render');

    this.model.records.bind('add',      function() {self.render();});
    this.model.records.bind('reset',    function() {self.render();});
    this.model.records.bind('change',      function() {self.render();});

    var stateData = _.extend({
        id: 0
      },
      options.state
    );
    this.state = new recline.Model.ObjectState(stateData);

  },

    render: function() {
        var self = this;
        var tmplData = this.model.toTemplateJSON();
        tmplData["viewId"] = this.state.attributes["id"];
		var format = this.state.attributes.format || this.defaults.format;
		var applyFormatFunction = d3.format(format)
		
        if (this.model.records && this.model.records.length > 0)
			tmplData["value"] = applyFormatFunction(this.model.records.models[0].attributes[this.state.attributes["series"]]);
		else tmplData["value"] = "N/A"

        var htmls = Mustache.render(this.template, tmplData);
         $(this.el).html(htmls);
        this.$graph = this.el.find('.panel.indicator_' + tmplData["viewId"]);
        return this;
    },

    show: function() {
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
// information can be provided either via a field with
// [GeoJSON](http://geojson.org) objects or two fields with latitude and
// longitude coordinates.
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

      if (this.state.get('autoZoom')){
        if (this.visible){
          this._zoomToFeatures();
        } else {
          this._zoomPending = true;
        }
      }
      if (this.state.get('cluster')) {
        this.map.addLayer(this.markers);
      } else {
        this.map.addLayer(this.features);
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
      } else if (value && value.slice) {
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

    this.features = new L.GeoJSON(null,{
        pointToLayer: function (feature, latlng) {
          var marker = new L.marker(latlng);
          marker.bindPopup(feature.properties.popupContent);
          self.markers.addLayer(marker);
          return marker;
        }
    });

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
    <div class="header"> \
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
      <div class="clearfix"></div> \
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

(function($, my) {

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

  template: '<div class="recline-graph"> \
      <div class="panel nvd3graph_{{viewId}}"style="display: block;"> \
        <div id="nvd3chart_{{viewId}}"><svg></svg></div>\
      </div> \
    </div> ',

  initialize: function(options) {
    var self = this;

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
            seriesNameField: [],
            seriesValues: [],
            colors: ["#edc240", "#afd8f8", "#cb4b4b", "#4da74d", "#9440ed"],
            graphType: "lineChart",
            xLabel: "",
            id: 0



      },
      options.state
    );
    this.state = new recline.Model.ObjectState(stateData);


  },

    render: function() {
        var self = this;

    var tmplData = this.model.toTemplateJSON();
    tmplData["viewId"] = this.state.get("id");



    var htmls = Mustache.render(this.template, tmplData);
    $(this.el).html(htmls);
    this.$graph = this.el.find('.panel.nvd3graph_' + tmplData["viewId"]);
    return this;
  },

  redraw: function() {
    var self=this;
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
    if (this.state.get('group') && this.state.get('seriesValues')) {
      // faff around with width because flot draws axes *outside* of the element width which means graph can get push down as it hits element next to it
      //this.$graph.width(this.el.width() - 20);

      // nvd3
        var state = this.state;
        var seriesNVD3 = this.createSeriesNVD3();

        var graphType = this.state.get("graphType") ;
        var viewId = this.state.get("id");
        var model = this.model;
		var state = this.state;
        var xLabel = this.state.get("xLabel");
        var yLabel = this.state.get("yLabel");


        nv.addGraph(function() {
            var chart;
            // todo per gli stacked è necessario ciclare sulla serie per inserire dati null o zero dove non siano presenti

            switch(graphType) {
                case 'lineChart':
                    chart = nv.models.lineChart();
                    break;
                case "stackedAreaChart":
                    chart = nv.models.stackedAreaChart()
                        .clipEdge(true);
                    break;
                case "multiBarHorizontalChart":
                    chart = nv.models.multiBarHorizontalChart()
                    break;
                case "bulletChart" :
                    chart = nv.models.bulletChart();
                     break;
                case "cumulativeLineChart":
                    chart = nv.models.cumulativeLineChart()
                    break;
                case "discreteBarChart":
                    chart = nv.models.discreteBarChart()
                        .staggerLabels(true)
                        .tooltips(false)
                        .showValues(true);

                        chart.discretebar.dispatch.on('elementClick', function(e) {
                            self.applyFiltersAndSelections(e.series);
                        });
                break;
                case "multiBarChart":
                    chart = nv.models.multiBarChart().stacked(true).showControls(false);
                    break;
            }

            chart.x(function(d) { return d[0] })
                .y(function(d) { return d[1] });

			var     xfield =  model.fields.get(state.attributes.group);
			if (xLabel == null || xLabel == "" || typeof xLabel == 'undefined')
				xLabel = xfield.get('label')

			if (yLabel == null || yLabel == "" || typeof yLabel == 'undefined')
				yLabel = state.attributes.seriesValues.join("/");

            chart.yAxis
                .axisLabel(yLabel)

                .tickFormat(d3.format('.02f'));

			if (xfield.get('type') == 'DATE' || 
				(xfield.get('type') == 'STRING' && xLabel.indexOf('date') >= 0 && model.recordCount > 0 && new Date(model.records.get(0).get(xLabel)) instanceof Date))
			{
				chart.xAxis
					.axisLabel(xLabel)
					.tickFormat(function(d) {
             			return d3.time.format('%x')(new Date(d)) ;
		           })   ;
			}
			else
			{
				chart.xAxis
					.axisLabel(xLabel)
					.tickFormat(d3.format(',r'));
			}


  		d3.select('#nvd3chart_' +viewId + '  svg')
      		.datum(seriesNVD3)
    		.transition().duration(500)
      		.call(chart);

        nv.utils.windowResize(chart.update);

  return  chart;
});


    }
  },

    show: function() {
    // because we cannot redraw when hidden we may need to when becoming visible
    if (this.needToRedraw) {
      this.redraw();
    }
  },

  applyFiltersAndSelections: function(series) {

      var actions = this.options.actions;
      var state = this.options.state;

      var selection ;
      if(actions.FiltersTargetDataset != null
          || actions.SelectionsTargetDataset != null) {



      if(state.seriesNameField != null) {
          // we use a field to define series
          // todo fieldtype must be evaluated on fields structure
          selection = {field: state.seriesNameField, type: "term", term:series.key, fieldType: "string"}   ;
      } else
      {
          // todo to be verified, series index must be used
          selection = {field: state.series[series.id], type: "term", term:series.key, fieldType: "string"}       ;
      }

          if(actions.FiltersTargetDataset != null) {
              for (var i = 0; i < actions.FiltersTargetDataset.length; i++) {
                  actions.FiltersTargetDataset[i].queryState.setFilter(selection);
              }
          }

          if(actions.SelectionsTargetDataset != null) {
              for (var i = 0; i < actions.SelectionsTargetDataset.length; i++) {
                  actions.SelectionsTargetDataset[i].queryState.setSelection(selection);
              }
          }

      }
  },
  
  createSeriesNVD3: function() {

      var self = this;
      var series = [];
      var colors = this.state.get("colors") ;
      var seriesNameField = self.model.fields.get(this.state.attributes.seriesNameField) ;
      var seriesValues = self.model.fields.get(this.state.attributes.seriesValues);
      if(seriesValues == null)
          seriesValues = this.state.get("seriesValues") ;

      var xAxisIsDate = false;

      var records = self.model.records.models;
      var xfield =  self.model.fields.get(self.state.attributes.group);

      var seriesTmp = {};

      var color = 0;

     if(seriesNameField != null) {

         _.each(records, function(doc, index) {
             //console.log(doc);

             var key = doc.getFieldValue(seriesNameField);
             var tmpS;

             if(seriesTmp[key] != null ) { tmpS = seriesTmp[key]  }
             else {
                 tmpS = {key: key, values: [], color:  colors[color]}
                 color=color+1;
             };


             var points = [];
             var x = parseFloat(doc.getFieldValue(xfield));
             var y = parseFloat(doc.getFieldValue(seriesValues));
             tmpS["values"].push([x, y]);

             //console.log("xfield: " + xfield + " seriesvalue: " + seriesValues + " seriesNameField: " + seriesNameField + " key: " + key + " x: "+ x + " y: "+ y);
             seriesTmp[key] = tmpS;

         });

         for (var j in seriesTmp) {
             series.push(seriesTmp[j]);
         }
         //console.log(seriesTmp);

     }
      else {
         // todo this has to be merged with above, only one branch has to be present
         //console.log(seriesValues);
       _.each(seriesValues, function(field) {
           color=color+1;

          var points = [];

          _.each(records, function(doc, index) {


              var x = doc.getFieldValue(xfield);

              var yfield = self.model.fields.get(field);
              var y = doc.getFieldValue(yfield);

              var isDateTime = xfield.get('type') === 'date';

              if (isDateTime) {
                  xAxisIsDate = true;
              }

              //points.push({x: x, y: y});
              points.push([x,y]);
              //console.log("x: " +x + " y: " + y + " doc: " + doc);

          });

          series.push({values: points, key: field, color:  colors[color]});
       });
     }

      //console.log(JSON.stringify(series));
      return series;
}


});



})(jQuery, recline.View);

/*jshint multistr:true */

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
    this.model.records.bind('add', this.render);
    this.model.records.bind('reset', this.render);
    this.model.records.bind('remove', this.render);

    var state = _.extend({
        hiddenColumns: [],
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
      explicitInitialization: true,
      syncColumnCellResize: true,
      forceFitColumns: this.state.get('fitColumns'),
      useInnerChart: this.state.get('useInnerChart'),
      innerChartMax: this.state.get('innerChartMax'),    
	};

    // We need all columns, even the hidden ones, to show on the column picker
    var columns = [];
    // custom formatter as default one escapes html
    // plus this way we distinguish between rendering/formatting and computed value (so e.g. sort still works ...)
    // row = row index, cell = cell index, value = value, columnDef = column definition, dataContext = full row values
    var formatter = function(row, cell, value, columnDef, dataContext) {
      var field = self.model.fields.get(columnDef.id);
      if (field.renderer) {
        return field.renderer(value, field, dataContext);
      } else {
        return value;
      }
    }
    _.each(this.model.fields.toJSON(),function(field){
      var column = {
        id:field['id'],
        name:field['label'],
        field:field['id'],
        sortable: true,
        minWidth: 80,
        formatter: formatter
      };

      var widthInfo = _.find(self.state.get('columnsWidth'),function(c){return c.column == field.id});
      if (widthInfo){
        column['width'] = widthInfo.width;
      }

      columns.push(column);
    });
	if (self.state.get('useInnerChart') == true && self.model.records.length > 0)
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
	
    // Restrict the visible columns
    var visibleColumns = columns.filter(function(column) {
      return _.indexOf(self.state.get('hiddenColumns'), column.id) == -1;
    });

    // Order them if there is ordering info on the state
    if (this.state.get('columnsOrder')){
      visibleColumns = visibleColumns.sort(function(a,b){
        return _.indexOf(self.state.get('columnsOrder'),a.id) > _.indexOf(self.state.get('columnsOrder'),b.id) ? 1 : -1;
      });
      columns = columns.sort(function(a,b){
        return _.indexOf(self.state.get('columnsOrder'),a.id) > _.indexOf(self.state.get('columnsOrder'),b.id) ? 1 : -1;
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
	
	if (self.state.get('useInnerChart') == true && self.state.get('innerChartSerie1') != null && self.state.get('innerChartSerie2') != null && this.model.records.length > 0)
	{
		this.model.records.each(function(doc){
		  var row = {};
		  self.model.fields.each(function(field){
			row[field.id] = doc.getFieldValueUnrendered(field);
			if (field.id == self.state.get('innerChartSerie1') || field.id == self.state.get('innerChartSerie2'))
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

    this.model.records.each(function(doc){
      var row = {};
      self.model.fields.each(function(field){
        row[field.id] = doc.getFieldValueUnrendered(field);
      });
	  if (self.state.get('useInnerChart') == true && self.state.get('innerChartSerie1') != null && self.state.get('innerChartSerie2') != null)
		row['innerChart'] = [ row[self.state.get('innerChartSerie1')], row[self.state.get('innerChartSerie2')], max ];

      data.push(row);
    });

    this.grid = new Slick.Grid(this.el, data, visibleColumns, options);

    // Column sorting
    var sortInfo = this.model.queryState.get('sort');
    if (sortInfo){
      var column = sortInfo[0].field;
      var sortAsc = !(sortInfo[0].order == 'desc');
      this.grid.setSortColumn(column, sortAsc);
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

    var columnpicker = new Slick.Controls.ColumnPicker(columns, this.grid,
                                                       _.extend(options,{state:this.state}));

    if (self.visible){
      self.grid.init();
      self.rendered = true;
    } else {
      // Defer rendering until the view is visible
      self.rendered = false;
    }

    return this;
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
// # Recline Backbone Models
this.recline = this.recline || {};
this.recline.Model = this.recline.Model || {};
this.recline.Model.VirtualDataset = this.recline.Model.VirtualDataset || {};


(function($, my) {

// ## <a id="dataset">VirtualDataset</a>
    my.VirtualDataset = Backbone.Model.extend({
        constructor: function VirtualDataset() {
            Backbone.Model.prototype.constructor.apply(this, arguments);
        },


        initialize: function() {
            _.bindAll(this, 'query');


            var self = this;
            this.backend = recline.Backend.Memory;
            this.fields = new my.FieldList();
            this.records = new my.RecordList();
            this.recordCount = null;
            this.queryState = new my.Query();

            //this.attributes.dataset.records.bind('add',     function() { self.initializeCrossfilter(); });
            this.attributes.dataset.records.bind('reset',   function() { self.initializeCrossfilter(); });

            this.queryState.bind('change',                  function() { self.query(); });

            // TODO verify if is better to use a new backend (crossfilter) to manage grouping and filtering instead of using it inside the model
        },

        modifyGrouping: function(dimensions, aggregationField)
        {
            this.attributes.aggregation.aggregatedFields = aggregationField;
            this.attributes.aggregation.dimensions = dimensions;
            updateCrossfilter(this);
        },
        addDimension: function(dimension)
        {
            this.attributes.aggregation.dimensions.push = dimension;
            updateCrossfilter(this);
        },
        addAggregationField: function(field) {
            this.attributes.aggregation.aggregatedFields.push(field);
            updateCrossfilter(this);
        },

        initializeCrossfilter: function() {
            this.updateCrossfilter(crossfilter(this.attributes.dataset.records.toJSON()));
        },

        createDimensions: function(crossfilterData) {
            var dimensions = this.attributes.aggregation.dimensions;
            var group;

            if(dimensions == null ){
                // need to evaluate aggregation function on all records
                group =  crossfilterData.groupAll();
            }
            else {
                var by_dimension = crossfilterData.dimension(function(d) {
                    var tmp = "";
                    for(i=0;i<dimensions.length;i++){
                        if(i>0) { tmp = tmp + "_"; }

                        tmp = tmp + d[dimensions[i]];
                    }
                    return tmp;
                });
                group = by_dimension.group();
            }

            return group;
        },

        updateCrossfilter: function(crossfilterData) {
            // TODO optimization has to be done in order to limit the number of cycles on data
            // TODO has sense to recreate dimension if nothing is changed?, and in general, is better to use a new dimension if added instead of recreate all
            // TODO verify if saving crossfilter data is useful (perhaps no unless we use crossfilterstore to make aggregaation and filtering)
            // TODO structure defined in initialize could be the same as the one provided to records in order to avoid the cycle inside updatestore?

            var start = new Date().getTime();


            this.updateStore(this.reduce(this.createDimensions(crossfilterData)));

            var end = new Date().getTime();
            var time = end - start;

            console.log("updateCrossfilter - exec time: " + time);
        },

        reduce: function(group) {
            var aggregatedFields = this.attributes.aggregation.aggregatedFields;
            var aggregationFunctions = this.attributes.aggregation.aggregationFunctions;

            if(this.attributes.aggregation.aggregationFunctions == null || this.attributes.aggregation.aggregationFunctions.length == 0)
                throw("Error aggregationFunctions parameters is not set for virtual dataset ");


            var partitioning = false;
            var partitions;
            if(this.attributes.aggregation.partitions != null) {
                partitions = this.attributes.aggregation.partitions;
                var partitioning = true;
            }

            function addFunction(p, v) {
                p.count = p.count +1;
                for(i=0;i<aggregatedFields.length;i++){



                    // for each aggregation function evaluate results
                    for(j=0;j<aggregationFunctions.length;j++){
                        var currentAggregationFunction = this.recline.Data.Aggregations.aggregationFunctions[aggregationFunctions[j]];

                        p[aggregationFunctions[j]][aggregatedFields[i]] =
                            currentAggregationFunction(
                                p[aggregationFunctions[j]][aggregatedFields[i]],
                                v[aggregatedFields[i]]);
                    }


                    if(partitioning) {
                        // for each partition need to verify if exist a value of aggregatefield_by_partition_partitionvalue_sum
                        for(x=0;x<partitions.length;x++){
                            var fieldName = aggregatedFields[i] + "_by_" + partitions[x] + "_" + v[partitions[x]];

                            // for each aggregation function evaluate results
                            for(j=0;j<aggregationFunctions.length;j++){
                                var currentAggregationFunction = this.recline.Data.Aggregations.aggregationFunctions[aggregationFunctions[j]];

                                p.partitions[aggregationFunctions[j]][fieldName] =
                                    currentAggregationFunction(
                                        p.partitions[aggregationFunctions[j]][fieldName],
                                        v[aggregatedFields[i]]);

                                if(p.partitions.count[fieldName] == null)
                                    p.partitions.count[fieldName] = 0;

                                p.partitions.count[fieldName] =   p.partitions.count[fieldName] + 1;

                            }
                        }
                    }


                }
                return p;
            }

            function removeFunction(p, v) {
                throw "crossfilter reduce remove function not implemented";
            }

            function initializeFunction() {

                var tmp = {count: 0};

                for(j=0;j<aggregationFunctions.length;j++){
                    tmp[aggregationFunctions[j]] = {};
                    this.recline.Data.Aggregations.initFunctions[aggregationFunctions[j]](tmp, aggregatedFields, partitions);
                }

                if(partitioning){
                    tmp["partitions"] = {};
                    tmp["partitions"]["count"] = {};

                    for(j=0;j<aggregationFunctions.length;j++){

                        tmp["partitions"][aggregationFunctions[j]] = {};

                    }
                }

                return tmp;
            }


            return group.reduce(addFunction,removeFunction,initializeFunction);

        },

        updateStore: function(reducedGroup) {



            var dimensions = this.attributes.aggregation.dimensions;
            var aggregationFunctions =    this.attributes.aggregation.aggregationFunctions;
            var aggregatedFields = this.attributes.aggregation.aggregatedFields;

            var partitioning = false;
            var partitionsFields = [];
            var partitions;

            if(this.attributes.aggregation.partitions != null) {
                partitions = this.attributes.aggregation.partitions;
                var partitioning = true;
            }



            var tmpResult;
            var result = [];
            var fields = [];

            var tmpField;

            if(dimensions == null)  {
                tmpResult =  [reducedGroup.value()];
                tmpField = tmpResult;
            }
            else {
                tmpResult =  reducedGroup.all();
                if(tmpResult.length > 0) {
                    tmpField = tmpResult[0].value;
                }
                else
                    tmpField = {count: 0};

                for (var x in tmpField.partitions[aggregationFunctions[0]]) {
                    partitionsFields.push(x);
                }
            }



            // set of fields array
            fields.push( {id: "count", type: "number"});

            // defining fields based on aggreagtion functions
            for(var j=0;j<aggregationFunctions.length;j++){

                var tempValue;
                if(typeof tmpField[aggregationFunctions[j]] == 'function')
                    tempValue = tmpField[aggregationFunctions[j]]();
                else
                    tempValue = tmpField[aggregationFunctions[j]];

                for (var x in tempValue) {
                    fields.push( {id: x + "_" + aggregationFunctions[j], type: "number"});
                }
            }

            if(partitioning) {
                for(var j=0;j<aggregationFunctions.length;j++){

                    var tempValue;
                    if(typeof tmpField.partitions[aggregationFunctions[j]] == 'function')
                        tempValue =     tmpField.partitions[aggregationFunctions[j]]();
                    else
                        tempValue = tmpField.partitions[aggregationFunctions[j]];

                    for (var x in tempValue) {
                        fields.push( {id: x + "_" + aggregationFunctions[j], type: "number"});
                    }
                }
            }

            // adding all dimensions to field list
            if(dimensions != null) {
                fields.push( {id: "dimension"});
                for(var i=0;i<dimensions.length;i++){
                    var originalFieldAttributes = this.attributes.dataset.fields.get(dimensions[i]).attributes;;
                    fields.push( {id: dimensions[i], type: originalFieldAttributes.type, label: originalFieldAttributes.label, format: originalFieldAttributes.format});

                }
            }



            // set  results of dataset
            for(var i=0;i<tmpResult.length;i++){

                var currentField;
                var tmp;

                // if dimensions specified add dimension' fields
                if(dimensions != null) {
                    var keyField = tmpResult[i].key.split("_");

                    tmp = {dimension: tmpResult[i].key, count: tmpResult[i].value.count};

                    for(var j=0;j<keyField.length;j++){
                        tmp[dimensions[j]] = keyField[j];
                    }
                    currentField = tmpResult[i].value;

                }
                else {
                    currentField = tmpResult[i];
                    tmp = {count: tmpResult[i].count};
                }

                // add records foreach aggregation function
                for(var j=0;j<aggregationFunctions.length;j++){

                    // apply finalization function, was not applied since now
                    // todo verify if can be moved above
                    // note that finalization can't be applyed at init cause we don't know in advance wich partitions data can be built
                    recline.Data.Aggregations.finalizeFunctions[aggregationFunctions[j]](currentField,  aggregatedFields, partitionsFields);

                    var tempValue;



                    if(typeof currentField[aggregationFunctions[j]] == 'function')
                        tempValue = currentField[aggregationFunctions[j]]();
                    else
                        tempValue = currentField[aggregationFunctions[j]];




                    for (var x in tempValue) {

                        var tempValue2;
                        if(typeof tempValue[x] == 'function')
                            tempValue2  =  tempValue[x]();
                        else
                            tempValue2  = tempValue[x];

                        tmp[x + "_" + aggregationFunctions[j]] =  tempValue2;
                    }


                    // adding partition records
                    if(partitioning) {
                        var tempValue;
                        if(typeof currentField.partitions[aggregationFunctions[j]] == 'function')
                            tempValue =currentField.partitions[aggregationFunctions[j]]();
                        else
                            tempValue =currentField.partitions[aggregationFunctions[j]];

                        for (var x in tempValue) {
                            var tempValue2;
                            if(typeof currentField.partitions[aggregationFunctions[j]] == 'function')
                                tempValue2 =  currentField.partitions[aggregationFunctions[j]]();
                            else
                                tempValue2 = currentField.partitions[aggregationFunctions[j]];

                            tmp[x + "_" + aggregationFunctions[j]] =  tempValue2[x];
                        }
                    }

                }

                // count is always calculated for each partition
                if(partitioning) {
                    for (var x in tmpField.partitions["count"]) {
                        tmp[x + "_count"] =  tmpResult[i].value.partitions["count"][x];
                    }
                }


                result.push(tmp);
            }


            this._store = new recline.Backend.Memory.Store(result, fields);

            this.fields.reset(fields);
            this.query();



            /*    console.log("VMODEL crossfilter result")
             console.log(tmpResult);
             console.log("VModel result");
             console.log(result);
             console.log("VModel fields");
             console.log(fields);
             */

        },

        query: function(queryObj) {
            /*console.log("query start");
             console.log(this.attributes.dataset.toJSON());
             console.log(self.records.toJSON() );
             */

            console.log("VModel - query for " + JSON.stringify(queryObj));

            var self = this;
            var dfd = $.Deferred();
            this.trigger('query:start');

            if (queryObj) {
                this.queryState.set(queryObj, {silent: true});
            }
            var actualQuery = this.queryState.toJSON();

            this._store.query(actualQuery, this.toJSON())
                .done(function(queryResult) {
                    self._handleQueryResult(queryResult);
                    self.trigger('query:done');
                    dfd.resolve(self.records);
                })
                .fail(function(arguments) {
                    self.trigger('query:fail', arguments);
                    dfd.reject(arguments);
                });
            return dfd.promise();
        },

        _handleQueryResult: function(queryResult) {
            var self = this;
            self.recordCount = queryResult.total;
            var docs = _.map(queryResult.hits, function(hit) {
                var _doc = new my.Record(hit);
                _doc.fields = self.fields;
                return _doc;
            });
            self.records.reset(docs);
        },

        toTemplateJSON: function() {
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
        getFieldsSummary: function() {
            // TODO update function in order to manage facets/filter and selection

            var self = this;
            var query = new my.Query();
            query.set({size: 0});

            var dfd = $.Deferred();
            this._store.query(query.toJSON(), this.toJSON()).done(function(queryResult) {
                if (queryResult.facets) {
                    _.each(queryResult.facets, function(facetResult, facetId) {
                        facetResult.id = facetId;
                        var facet = new my.Facet(facetResult);
                        // TODO: probably want replace rather than reset (i.e. just replace the facet with this id)
                        self.fields.get(facetId).facets.reset(facet);
                    });
                }
                dfd.resolve(queryResult);
            });
            return dfd.promise();
        }
    });



}(jQuery, this.recline.Model));

/*jshint multistr:true */

this.recline = this.recline || {};
this.recline.View = this.recline.View || {};

(function($, my) {

my.FacetViewer = Backbone.View.extend({
  className: 'recline-facet-viewer well', 
  template: ' \
    <a class="close js-hide" href="#">&times;</a> \
    <div class="facets row"> \
      <div class="span1"> \
        <h3>Facets</h3> \
      </div> \
      {{#facets}} \
      <div class="facet-summary span2 dropdown" data-facet="{{id}}"> \
        <a class="btn dropdown-toggle" data-toggle="dropdown" href="#"><i class="icon-chevron-down"></i> {{id}} {{label}}</a> \
        <ul class="facet-items dropdown-menu"> \
        {{#terms}} \
          <li><a class="facet-choice js-facet-filter" data-value="{{term}}">{{term}} ({{count}})</a></li> \
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
    'click .js-hide': 'onHide',
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
      facets: this.model.facets.toJSON(),
      fields: this.model.fields.toJSON()
    };
    tmplData.facets = _.map(tmplData.facets, function(facet) {
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
    var $target= $(e.target);
    var fieldId = $target.closest('.facet-summary').attr('data-facet');
    var value = $target.attr('data-value');
    this.model.queryState.addTermFilter(fieldId, value);
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
          <label>Filter type</label> \
          <select class="filterType"> \
            <option value="term">Term (text)</option> \
            <option value="range">Range</option> \
            <option value="geo_distance">Geo distance</option> \
          </select> \
          <label>Field</label> \
          <select class="fields"> \
            {{#fields}} \
            <option value="{{id}}">{{label}}</option> \
            {{/fields}} \
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
            <a class="js-remove-filter" href="#" title="Remove this filter">&times;</a> \
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
            <a class="js-remove-filter" href="#" title="Remove this filter">&times;</a> \
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
            <a class="js-remove-filter" href="#" title="Remove this filter">&times;</a> \
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
    var fieldType  = this.model.fields.find(function (e) { return e.get('id') === field }).get('type');
    this.model.queryState.addFilter({type: filterType, field: field, fieldType: fieldType});
    // trigger render explicitly as queryState change will not be triggered (as blank value for filter)
    this.render();
  },
  onRemoveFilter: function(e) {
    e.preventDefault();
    var $target = $(e.target);
    var filterId = $target.closest('.filter').attr('data-filter-id');
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

(function($, my) {
	
my.GenericFilter = Backbone.View.extend({
  className: 'recline-filter-editor well', 
  template: ' \
    <div class="filters"> \
      <h3>{{filterLabel}}</h3> \
      <a href="#" class="js-add-filter">Add filter</a> \
	  <hr> \
      <div id="filterCreationForm" class="form-stacked js-add" style="display: none;"> \
        <fieldset> \
          <label>Filter type</label> \
          <select class="filterType"> \
            <option value="term">Term (text)</option> \
            <option value="slider">Slider</option> \
            <option value="range">Range</option> \
            <option value="range_slider">Range slider</option> \
            <option value="range_calendar">Date range</option> \
            <option value="drop_down">Drop down</option> \
            <option value="listbox">Listbox</option> \
            <option value="list">Value list</option> \
          </select> \
          <label>Field</label> \
          <select class="fields"> \
            {{#fields}} \
            <option value="{{id}}">{{label}}</option> \
            {{/fields}} \
          </select> \
		  <br> \
          <input type="button" id="addFilterButton" class="btn" value="Add"></input> \
        </fieldset> \
      </div> \
      <div class="form-stacked js-edit"> \
        {{#filters}} \
          {{{filterRender}}} \
        {{/filters}} \
      </div> \
    </div> \
  ',
  filterTemplates: {
    term: ' \
      <div class="filter-{{type}} filter"> \
        <fieldset data-filter-field="{{field}}" data-filter-id="{{id}}" data-filter-type="{{type}}" data-control-type="{{controlType}}"> \
          <legend> \
            {{field}} <small>{{controlType}}</small> \
            <a class="js-remove-filter" href="#" title="Remove this filter">&times;</a> \
          </legend> \
          <input type="text" value="{{term}}" name="term" class="data-control-id" /> \
          <input type="button" class="btn" id="setFilterValueButton" value="Set"></input> \
        </fieldset> \
      </div> \
    ',
	slider : ' \
	<script> \
		$(document).ready(function(){ \
			$( "#slider-range{{ctrlId}}" ).slider({ \
				min: {{min}}, \
				max: {{max}}, \
				value: {{min}}, \
				slide: function( event, ui ) { \
					$( "#amount{{ctrlId}}" ).val(  ui.value ); \
				} \
			}); \
			$( "#amount{{ctrlId}}" ).val(  $( "#slider-range{{ctrlId}}" ).slider( "value" ) ); \
		}); \
	</script> \
      <div class="filter-{{type}} filter"> \
        <fieldset data-filter-field="{{field}}" data-filter-id="{{id}}" data-filter-type="{{type}}" data-control-type="{{controlType}}"> \
          <legend> \
            {{field}} <small>{{controlType}}</small> \
            <a class="js-remove-filter" href="#" title="Remove this filter">&times;</a> \
          </legend> \
		  <p> \
			  <label for="amount{{ctrlId}}">Value range:</label> \
			  <input type="text" id="amount{{ctrlId}}" style="border:none;" disabled="true"></input> \
		  </p> \
		  <div id="slider-range{{ctrlId}}" class="data-control-id" ></div> \
		  <br> \
          <input type="button" class="btn" id="setFilterValueButton" value="Set"></input> \
        </fieldset> \
      </div> \
    ',
    range: ' \
      <div class="filter-{{type}} filter"> \
        <fieldset data-filter-field="{{field}}" data-filter-id="{{id}}" data-filter-type="{{type}}" data-control-type="{{controlType}}"> \
          <legend> \
            {{field}} <small>{{controlType}}</small> \
            <a class="js-remove-filter" href="#" title="Remove this filter">&times;</a> \
          </legend> \
          <label class="control-label" for="">From</label> \
          <input type="text" value="{{start}}" name="start"  class="data-control-id-from" /> \
          <label class="control-label" for="">To</label> \
          <input type="text" value="{{stop}}" name="stop" class="data-control-id-to" /> \
		  <br> \
          <input type="button" class="btn" id="setFilterValueButton" value="Set"></input> \
        </fieldset> \
      </div> \
    ',
    range_slider: ' \
	<script> \
		$(document).ready(function(){ \
			$( "#slider-range{{ctrlId}}" ).slider({ \
				range: true, \
				min: {{min}}, \
				max: {{max}}, \
				values: [ {{min}}, {{max}} ], \
				slide: function( event, ui ) { \
					$( "#amount{{ctrlId}}" ).val(  ui.values[ 0 ] + " - " + ui.values[ 1 ] ); \
				} \
			}); \
			$( "#amount{{ctrlId}}" ).val(  $( "#slider-range{{ctrlId}}" ).slider( "values", 0 ) + " - " + $( "#slider-range{{ctrlId}}" ).slider( "values", 1 ) ); \
		}); \
	</script> \
      <div class="filter-{{type}} filter"> \
        <fieldset data-filter-field="{{field}}" data-filter-id="{{id}}" data-filter-type="{{type}}" data-control-type="{{controlType}}"> \
          <legend> \
            {{field}} <small>{{controlType}}</small> \
            <a class="js-remove-filter" href="#" title="Remove this filter">&times;</a> \
          </legend> \
		  <p> \
			  <label for="amount{{ctrlId}}">Value range:</label> \
			  <input type="text" id="amount{{ctrlId}}" style="border:none;" disabled="true"></input> \
		  </p> \
		  <div id="slider-range{{ctrlId}}" class="data-control-id-from data-control-id-to" ></div> \
		  <br> \
          <input type="button" class="btn" id="setFilterValueButton" value="Set"></input> \
        </fieldset> \
      </div> \
    ',
	range_calendar: ' \
	<script> \
	$(function() { \
		$( "#from{{ctrlId}}" ).datepicker({ \
			defaultDate: "{{startDate}}", \
			changeMonth: true, \
			numberOfMonths: 1, \
			onSelect: function( selectedDate ) { \
				$( "#to{{ctrlId}}" ).datepicker( "option", "minDate", selectedDate ); \
			} \
		}); \
		$( "#to{{ctrlId}}" ).datepicker({ \
			defaultDate: "{{endDate}}", \
			changeMonth: true, \
			numberOfMonths: 1, \
			onSelect: function( selectedDate ) { \
				$( "#from{{ctrlId}}" ).datepicker( "option", "maxDate", selectedDate ); \
			} \
		}); \
	}); \
	</script> \
      <div class="filter-{{type}} filter"> \
        <fieldset data-filter-field="{{field}}" data-filter-id="{{id}}" data-filter-type="{{type}}" data-control-type="{{controlType}}"> \
          <legend> \
            {{field}} <small>{{controlType}}</small> \
            <a class="js-remove-filter" href="#" title="Remove this filter">&times;</a> \
          </legend> \
			<label for="from{{ctrlId}}">From</label> \
			<input type="text" id="from{{ctrlId}}" name="from{{ctrlId}}" class="data-control-id-from" value="{{startDate}}"/> \
			<br> \
			<label for="to{{ctrlId}}">to</label> \
			<input type="text" id="to{{ctrlId}}" name="to{{ctrlId}}" class="data-control-id-to" value="{{endDate}}"/> \
 		  <br> \
          <input type="button" class="btn" id="setFilterValueButton" value="Set"></input> \
       </fieldset> \
      </div> \
	',
    drop_down: ' \
      <div class="filter-{{type}} filter"> \
        <fieldset data-filter-field="{{field}}" data-filter-id="{{id}}" data-filter-type="{{type}}" data-control-type="{{controlType}}"> \
          <legend> \
            {{field}} <small>{{controlType}}</small> \
            <a class="js-remove-filter" href="#" title="Remove this filter">&times;</a> \
          </legend> \
			<select class="drop-down fields data-control-id" > \
			<option></option> \
            {{#values}} \
            <option value="{{val}}">{{val}}</option> \
            {{/values}} \
          </select> \
        </fieldset> \
      </div> \
    ',
	list: ' \
	  <style> \
		.odd-row { background: aliceblue } \
		.even-row { background: azure } \
		.list-filter-item { cursor:pointer; } \
		.list-filter-item:hover { background: lightblue;cursor:pointer; } \
		.selected { background: orange } \
		.selected:hover { background: red } \
	  </style> \
      <div class="filter-{{type}} filter"> \
        <fieldset> \
          <legend> \
            {{field}} <small>{{controlType}}</small> \
            <a class="js-remove-filter" href="#" title="Remove this filter">&times;</a> \
          </legend> \
			<div style="max-height:500px;width:100%;border:1px solid grey;overflow:auto;"> \
				<table style="width:100%" data-filter-field="{{field}}" data-filter-id="{{id}}" data-filter-type="{{type}}" > \
				{{#values}} \
				<tr><td class="list-filter-item {{evenOdd}}" >{{val}}</td><tr> \
				{{/values}} \
			  </table> \
		  </div> \
	    </fieldset> \
      </div> \
	',
    listbox: ' \
      <div class="filter-{{type}} filter"> \
        <fieldset data-filter-field="{{field}}" data-filter-id="{{id}}" data-filter-type="{{type}}" data-control-type="{{controlType}}"> \
          <legend> \
            {{field}} <small>{{controlType}}</small> \
            <a class="js-remove-filter" href="#" title="Remove this filter">&times;</a> \
          </legend> \
			<select class="fields data-control-id"  multiple SIZE=10> \
            {{#values}} \
            <option value="{{val}}">{{val}}</option> \
            {{/values}} \
          </select> \
		  <br> \
          <input type="button" class="btn" id="setFilterValueButton" value="Set"></input> \
        </fieldset> \
      </div> \
    '
  },
  events: {
    'click .js-remove-filter': 'onRemoveFilter',
    'click .js-add-filter': 'onAddFilterShow',
    'click #addFilterButton': 'onAddFilter',
	'click .list-filter-item': 'onListItemClicked',
	'click #setFilterValueButton': 'onFilterValueChanged',
	'change .drop-down': 'onFilterValueChanged'
  },
  _ctrlId : 0,
  _sourceDataset: null,
  _targetDatasets: [],
  _activeFilters: [],
  initialize: function(args) {
    this.el = $(this.el);
    _.bindAll(this, 'render');
	_.bindAll(this, 'getFieldType');
	this._sourceDataset = args.sourceDataset;
	this._targetDatasets = args.filtersTargetDatasets;
    this._sourceDataset.fields.bind('all', this.render); 
    this._sourceDataset.records.bind('reset', this.render); 
	this.sourceFields = args.sourceFields;
	this.filterDialogLabel = args.label;
	this._activeFilters = [];

    if (this.sourceFields && this.sourceFields.length)
		for (var k in this.sourceFields)
			this.addNewFilterControl(this.sourceFields[k]);

    this.render();
  },
  render: function() {
    var self = this;
    var tmplData = $.extend(true, {}, this._targetDatasets[0].queryState.toJSON());
    // we will use idx in list as there id ...
    tmplData.filters = _.map(tmplData.filters, function(filter, idx) {
      filter.id = idx;
      return filter;
    });
	_.each(this._activeFilters , function(flt) { 
		tmplData.filters.push(flt); 
	});
    tmplData.fields = this._sourceDataset.fields.toJSON();
	tmplData.records = _.pluck(this._sourceDataset.records.models, "attributes");
	tmplData.filterLabel = this.filterDialogLabel;
	tmplData.dateConvert = self.dateConvert;
    tmplData.filterRender = function() {
	  // add value list to selected filter or templating of record values will not work
	  this.tmpValues = _.uniq(_.pluck(tmplData.records, this.field));
	  this.values = new Array();
	  if (this.start)
		this.startDate = tmplData.dateConvert(this.start);
		
	  if (this.stop)
		this.endDate = tmplData.dateConvert(this.stop);
		
	  if (this.tmpValues.length)
	  {
		  this.max = this.tmpValues[0];
		  this.min = this.tmpValues[0];
	  }
	  for (var i in this.tmpValues)
	  {
		var v = this.tmpValues[i];
		this.values.push({val: v, evenOdd: (i % 2 == 0 ? 'even-row' : 'odd-row') });
		if (v > this.max)
			this.max = v;
			
		if (v < this.min)
			this.min = v;
	  }
	  if (this.controlType.indexOf("slider") >= 0 || this.controlType.indexOf("calendar") >= 0)
		self._ctrlId++;
		
	  this.ctrlId = self._ctrlId;
      return Mustache.render(self.filterTemplates[this.controlType], this);
    };
    var out = Mustache.render(this.template, tmplData);
    this.el.html(out);
  },
  onListItemClicked: function(e) {
    e.preventDefault();
    var $target = $(e.currentTarget);
	$table = $target.parent().parent().parent();
	$table.find('td').each(function() { 
						$(this).removeClass("selected");
					});
	
	$target.addClass("selected");
	var fieldId     = $table.attr('data-filter-field');
	_.each(this._targetDatasets, function(ds) { 
		ds.queryState.setFilter({field: fieldId, type: 'term', controlType: 'list', term:$target.text(), fieldType: "number"});
	});
  },
	dateConvert : function(d) { 
		// convert 2012-01-31 00:00:00 to 01/31/2012
		try
		{
			var p = d.split(/\D/); 
			return p[1]+"/"+p[2]+"/"+p[0]; 
		}
		catch(ex) {
			return d;
		}
	},
	dateConvertBack : function(d) { 
		// convert 01/31/2012  to 2012-01-31 00:00:00
		try
		{
			var p = d.split(/\D/); 
			return p[2]+"-"+p[0]+"-"+p[1]+" 00:00:00"; 
		}
		catch(ex) {
			return d;
		}
	},
    onFilterValueChanged: function(e) {
    e.preventDefault();
    var $target = $(e.target).parent();
	var fieldId     = $target.attr('data-filter-field');
	var fieldType     = $target.attr('data-filter-type');
	var controlType     = $target.attr('data-control-type');
	var term;
	var from;
	var to;
	if (fieldType == "term")
	{
		var termObj = $target.find('.data-control-id');
		switch (controlType)
		{
			case "term": term = termObj.val();break;
			case "slider": term = termObj.slider("value");break;
			case "drop_down": term = termObj.val();break;
			case "listbox": term = termObj.val();break;
		}
	}
	else if (fieldType == "range")
	{
		var fromObj = $target.find('.data-control-id-from');
		var toObj = $target.find('.data-control-id-to');
		switch (controlType)
		{
			case "range": from = fromObj.val();to = toObj.val();break;
			case "range_slider": from = fromObj.slider("values", 0);to = toObj.slider("values", 1);break;
			case "range_calendar": from = this.dateConvertBack(fromObj.val());to = this.dateConvertBack(toObj.val());break;
		}
	}
	_.each(this._targetDatasets, function(ds) { 
		ds.queryState.setFilter({field: fieldId, type: fieldType, controlType: controlType, term:term, start: from, stop: to, fieldType: 'number'});
		//ds.queryState.trigger('change');
	});

  },
  onAddFilterShow: function(e) {
    e.preventDefault();
    var $target = $(e.target);
    $target.hide();
    this.el.find('div.js-add').show();
  },
  hidePanel: function (obj) {
	$(function() {
		obj.hide( "blind", {}, 1000, function() {});
	});
  },
  getFilterTypeFromControlType: function(controlType) {
	switch (controlType)
	{
		case "listbox":
		case "list" :
		case "drop_down" :
		case "slider" :
			return "term";
		case "range_slider" :
		case "range_calendar" :
			return "range";
	}
	return controlType;
  }
  ,
  getFieldType : function(field) {
	var fieldFound = this._sourceDataset.fields.find(function (e) { 
				return e.get('id') === field
			})
	if (typeof fieldFound != "undefined" && fieldFound != null)
		return fieldFound.get('type');
			
    return "string";
  }
  ,
  onAddFilter: function(e) {
    e.preventDefault();
    var $target = $(e.target).parent().parent();
    $target.hide();//this.hidePanel($target);
    var controlType = $target.find('select.filterType').val();
	var filterType = this.getFilterTypeFromControlType(controlType);
    var field      = $target.find('select.fields').val();
	this.addNewFilterControl({type: filterType, field: field, controlType: controlType});
  },
  addNewFilterControl: function(newFilter)
  {
	if (typeof newFilter.type == 'undefined')
		newFilter.type = this.getFilterTypeFromControlType(newFilter.controlType)

	if (typeof newFilter.fieldType == 'undefined')
		newFilter.fieldType = this.getFieldType(newFilter.field)
	
	this._activeFilters.push(newFilter);
	this.render();
  },
  onRemoveFilter: function(e) {
    e.preventDefault();
    var $target = $(e.target);
    var filterId = $target.closest('.filter').attr('data-filter-id');
	_.each(this._targetDatasets, function(ds) { 
		ds.queryState.removeFilter(filterId);
	});
  }


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

