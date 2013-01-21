this.recline = this.recline || {};
this.recline.Backend = this.recline.Backend || {};
this.recline.Backend.ParallelUnionBackend = this.recline.Backend.ParallelUnionBackend || {};

(function ($, my) {
    // Behaviour is used to choose the content of the query to be executed on relative backend
    // if behaviour is not specified all different orid will be executed on backend[1] in parallel
    // query item must must have a "orid" attributes
    // e.g. {field: "fieldname", type:"term", term:"fieldvalue", fieldType:"string", orid="year" };

    /*BackendConfigurationExample =  {
        backends:
            [{
                    id:1,
                    backend:"Jsonp",
                    params:{ url:"http://" }
                }],
        behaviour:
        [
            {
                orid:"year",
                backend:1
            },
            {
                orid:"month",
                backend:1
            },
            {
                orid:"week",
                backend:1
            },
            {
                orid:"day",
                backend:1
            }
        ]
    }*/

    // common sono i valori non in or
    // il field deve essere singolo term
    // il valore del field determina il backend
    // passare id del dataset nei params

    my.__type__ = 'ParallelUnionBackend';

    my.fetch = function (dataset) {
        var backendsFetch = [];
        _.each(dataset.backendConfiguration.backends, function(b) {
            b["instance"] = my._backendFromString(b.backend);
            backendsFetch.push(b.instance.fetch(dataset));
        });

        my.fetchedData = [];

        var dfd = $.when(backendsFetch).then(my.handleFetchedData, my.errorOnFetching);
        return dfd;
    };

    my.query = function (queryObj, dataset) {
        var data = buildRequestFromQuery(queryObj);
        console.log("Querying jsonp backend for ");
        console.log(data);
        return requestJson(dataset, data, queryObj);

    };

    my.handleFetchedData = function(results) {
        console.log(results);
    };

    my.errorOnFetching = function() {
        return {
            message:'Request Error: error on fetching union parallel backends',
                configuration: dataset.backendConfiguration
        };
    };

    my._backendFromString = function(backendString) {
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


}(jQuery, this.recline.Backend.ParallelUnionBackend));
