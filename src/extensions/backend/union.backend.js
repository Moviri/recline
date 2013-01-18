this.recline = this.recline || {};
this.recline.Backend = this.recline.Backend || {};
this.recline.Backend.Jsonp = this.recline.Backend.Jsonp || {};

(function ($, my) {

    /*BackendConfiguration: {
        Backends: {
            [id: 1,
            backend: "Jsonp",
            params: { url: "http://"}]
        },
        Behaviour: {
            [field: id,
                value: ""
            backend: 1]
        },
    }

         // common sono i valori non in or
        // il field deve essere singolo term
        // il valore del field determina il backend
        // passare id del dataset nei params

    my.__type__ = 'VirtualBackend';
    my.fetch = function (dataset) {
        console.log("Fetching data structure " + dataset.url);
        var data = {onlydesc:"true"};
        return requestJson(dataset, data);
    };

    my.query = function (queryObj, dataset) {
        var data = buildRequestFromQuery(queryObj);
        console.log("Querying jsonp backend for ");
        console.log(data);
        return requestJson(dataset, data, queryObj);

    };
     */

}(jQuery, this.recline.Backend.Jsonp));
