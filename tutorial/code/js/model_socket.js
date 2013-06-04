var dataset = new recline.Model.SocketDataset({
    url: 'localhost',
    port: 1337,
    queue: "tweet",
    queueSize: 10,
    resource: "socket.io",
    fields: [
        {id: 'text', type: 'string'}
    ]
});

/*jshint multistr: true */

var tweetFormatter = function () {
    return [
        {
            id: "text",
            formula: function (record) {
                var data = {
                    text: record.attributes.text,
                    created_at: record.attributes.created_at,
                    profile_image_url: record.attributes.user.profile_image_url,
                    profile_banner_url: record.attributes.user.profile_banner_url,
                    name: record.attributes.user.name
                };

                console.log(data);

                var tmpl = '<div style="height: 200px"><a class="u-url permalink customisable-highlight" ><time pubdate="" class="dt-updated">{{created_at}}</time></a>\
                            <div class="header h-card p-author">\
                                <a class="u-url profile" href="{{profile_banner_url}}" >\
                                    <img class="u-photo avatar" alt="" src="{{profile_image_url}}" >\
                                        <span class="full-name">                                       \
                                            <span class="p-name customisable-highlight">{{name}}</span>\
                                        </span>                                                  \
                                        <span class="p-nickname" dir="ltr">@<b>{{name}}</b></span>  \
                                    </a>                                                     \
                                </div>                                                     \
                                <div class="e-entry-content">                             \
                                    <p class="e-entry-title">{{text}}</p>                 \
                                </div></div>';

                var out = Mustache.render(tmpl, data);

                return out;
            }
        }
    ];
}


var $el = $('#grid1');
var grid1 = new recline.View.SlickGridGraph({
    model: dataset,
    el: $el,
    state: {
      customHtmlFormatters: tweetFormatter(),
        fitColumns:true,
            useCondensedStyle:true
    }
});

grid1.visible = true;
grid1.render();



dataset.attach();
