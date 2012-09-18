jQuery(function($) {
  window.dataExplorer = null;
  window.explorerDiv = $('.data-explorer-here');

  // This is some fancy stuff to allow configuring the multiview from
  // parameters in the query string
  //
  // For more on state see the view documentation.
  var state = recline.View.parseQueryString(decodeURIComponent(window.location.search));
  if (state) {
    _.each(state, function(value, key) {
      try {
        value = JSON.parse(value);
      } catch(e) {}
      state[key] = value;
    });
  } else {
    state.url = 'demo';
  }
  var dataset = null;
  if (state.dataset || state.url) {
    var datasetInfo = _.extend({
        url: state.url,
        backend: state.backend
      },
      state.dataset
    );
    dataset = new recline.Model.Dataset(datasetInfo);
  } else {
    var dataset = new recline.Model.Dataset({
      records: [
        {id: 0, date: '2011-02-02', x: 1, y: 12, z: 13, country: 'DE', title: 'pippo', lat:53.56, lon:12.40},
        {id: 1, date: '2011-03-02', x: 2, y: 10, z: 4, country: 'UK', title: 'pluto', lat:55.97, lon:-2.60},
        {id: 2, date: '2011-04-03', x: 3, y: 8, z: 19, country: 'US', title: 'paperino', lat:41.00, lon:-76.5},
        {id: 3, date: '2011-05-04', x: 4, y: 6, z: 26, country: 'UK', title: 'tizio', lat:58.27, lon:-7.20},
        {id: 4, date: '2011-06-04', x: 5, y: 4, z: 5, country: 'UK', title: 'caio', lat:53.58, lon:1},
        {id: 5, date: '2011-07-02', x: 6, y: 2, z: 18, country: 'DE', title: 'sempronio', lat:52.04, lon:8.9},
        {id: 6, date: '2012-01-01', x: 7, y: 2, z: 3, country: 'DE', title: 'first', lat:52.56, lon:13.40},
        {id: 7, date: '2012-02-02', x: 8, y: 4, z: 24, country: 'UK', title: 'second', lat:54.97, lon:-1.60},
        {id: 8, date: '2012-03-03', x: 9, y: 6, z: 9, country: 'US', title: 'third', lat:40.00, lon:-75.5},
        {id: 9, date: '2012-04-04', x: 10, y: 8, z: 6, country: 'UK', title: 'fourth', lat:57.27, lon:-6.20},
        {id: 10, date: '2012-05-04', x: 11, y: 10, z: 15, country: 'UK', title: 'fifth', lat:51.58, lon:0},
        {id: 11, date: '2012-06-02', x: 12, y: 12, z: 18, country: 'DE', title: 'sixth', lat:51.04, lon:7.9}
       ],
      // let's be really explicit about fields
      // Plus take opportunity to set date to be a date field and set some labels
      fields: [
        {id: 'id'},
        {id: 'date', type: 'date'},
        {id: 'x'},
        {id: 'y'},
        {id: 'z'},
        {id: 'country', 'label': 'Country'},
        {id: 'title', 'label': 'Title'},
        {id: 'lat'},
        {id: 'lon'}
      ]
    });
  }
  createExplorer(dataset, state);
});


// make Explorer creation / initialization in a function so we can call it
// again and again
var createExplorer = function(dataset, state) {
  // remove existing data explorer view
  var reload = false;
  if (window.dataExplorer) {
    window.dataExplorer.remove();
    reload = true;
  }
  window.dataExplorer = null;
  var $el = $('<div />');
  $el.appendTo(window.explorerDiv);

  var views = [
    {
      id: 'grid',
      label: 'Grid',
      view: new recline.View.SlickGrid({
        model: dataset
      }),
    },
    {
      id: 'graph',
      label: 'Graph',
      view: new recline.View.Graph({
        model: dataset
      }),
    },
    {
      id: 'map',
      label: 'Map',
      view: new recline.View.Map({
        model: dataset
      }),
    },
    {
      id: 'transform',
      label: 'Transform',
      view: new recline.View.Transform({
        model: dataset
      })
    }
  ];

  window.dataExplorer = new recline.View.MultiView({
    model: dataset,
    el: $el,
    state: state,
    views: views
  });
}

