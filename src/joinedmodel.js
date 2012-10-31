/*
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
