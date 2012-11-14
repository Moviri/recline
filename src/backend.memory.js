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
        this.distinctFieldsValues = {};

    if (fields) {
      this.fields = fields;
    } else {
      if (data) {
        this.fields = _.map(data[0], function(value, key) {
          return {id: key, type: 'string'};
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

    this.remove = function(doc) {
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
        self.remove(record);
      });
      dfd.resolve();
      return dfd.promise();
    },

    this.query = function(queryObj) {
                var dfd = $.Deferred();
                var numRows = queryObj.size || this.data.length;
                var start = queryObj.from || 0;
                var results = this.data;

                results = recline.Data.Filters.applyFiltersOnData(queryObj.filters, results, this.fields);
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
            var self=this;
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
                        tmp.termsall[val] = tmp.termsall[val] ? {count: tmp.termsall[val].count + 1, value: val} : {count:1, value: val};
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
                        _.map(tmp.termsall, function(d) { return d.value})
                        );

                _.each(termsWithZeroCount, function (d) {
                    tmp.termsall[d] = {count: 0, value: d};
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
            var self=this;
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
