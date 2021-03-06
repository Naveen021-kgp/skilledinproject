(function() {
    var WPGroHo = window.WPGroHo || {};
    WPGroHo.my_hash = '';
    WPGroHo.data = {};
    WPGroHo.renderers = {};
    WPGroHo.syncProfileData = function(hash, id) {
        if (!WPGroHo.data[hash]) {
            WPGroHo.data[hash] = {};
            var spans = document.querySelectorAll('div.grofile-hash-map-' + hash + ' span');
            for (var i = 0; i < spans.length; i++) {
                var span = spans[i];
                WPGroHo.data[hash][span.className] = span.textContent;
            }
        }
        WPGroHo.appendProfileData(WPGroHo.data[hash], hash, id);
    };
    WPGroHo.appendProfileData = function(data, hash, id) {
        for (var key in data) {
            if (typeof WPGroHo.renderers[key] === 'function') {
                return WPGroHo.renderers[key](data[key], hash, id, key);
            }
            var card = document.getElementById(id);
            if (card) {
                var heading = card.querySelector('h4');
                if (heading) {
                    var extra = document.createElement('p');
                    extra.className = 'grav-extra ' + key;
                    extra.innerHTML = data[key];
                    heading.insertAdjacentElement('afterend', extra);
                }
            }
        }
    };
    window.WPGroHo = WPGroHo;
})();