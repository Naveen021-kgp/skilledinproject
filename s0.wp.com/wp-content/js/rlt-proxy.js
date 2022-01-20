(function() {
    var currentToken;
    var parentOrigin;
    var iframeOrigins;
    var initializationListeners = [];
    var hasBeenInitialized = false;
    var RLT_KEY = 'jetpack:wpcomRLT';

    function getOriginFromUrl(url) {
        var parser = document.createElement('a');
        parser.href = url;
        return parser.origin;
    }

    function rltIframeInjector(event) {
        if (!currentToken) {
            return;
        }
        rltInjectToken(currentToken, event.target.contentWindow, getOriginFromUrl(event.target.src));
    }

    function rltMonitorIframes() {
        var iframes = document.querySelectorAll("iframe");
        for (var i = 0; i < iframes.length; i++) {
            var iframe = iframes[i];
            if (rltShouldAuthorizeIframe(iframe)) {
                iframe.addEventListener('load', rltIframeInjector);
            }
        }
        var observer = new MutationObserver(function(mutationsList, observer) {
            for (var i = 0; i < mutationsList.length; i++) {
                var mutation = mutationsList[i];
                if (mutation.type === 'childList') {
                    for (var j = 0; j < mutation.addedNodes.length; j++) {
                        var node = mutation.addedNodes[j];
                        if (node instanceof HTMLElement && node.nodeName === 'IFRAME' && rltShouldAuthorizeIframe(node)) {
                            node.addEventListener('load', rltIframeInjector);
                        }
                    }
                }
            }
        });
        observer.observe(document.body, {
            subtree: true,
            childList: true
        });
    }

    function rltShouldAuthorizeIframe(iframe) {
        if (!Array.isArray(iframeOrigins)) {
            return;
        }
        return iframeOrigins.indexOf(getOriginFromUrl(iframe.src)) >= 0;
    }

    function rltInvalidateWindowToken(token, target, origin) {
        if (target && typeof target.postMessage === 'function') {
            try {
                target.postMessage(JSON.stringify({
                    type: 'rltMessage',
                    data: {
                        event: 'invalidate',
                        token: token,
                        sourceOrigin: window.location.origin,
                    },
                }), origin);
            } catch (err) {
                return;
            }
        }
    }
    window.rltInvalidateToken = function(token, sourceOrigin) {
        if (token === currentToken) {
            currentToken = null;
        }
        try {
            if (window.location === window.parent.location && window.localStorage) {
                if (window.localStorage.getItem(RLT_KEY) === token) {
                    window.localStorage.removeItem(RLT_KEY);
                }
            }
        } catch (e) {
            console.info("localstorage access for invalidate denied - probably blocked third-party access", window.location.href);
        }
        var iframes = document.querySelectorAll("iframe");
        for (var i = 0; i < iframes.length; i++) {
            var iframe = iframes[i];
            var iframeOrigin = getOriginFromUrl(iframe.src);
            if (iframeOrigin !== sourceOrigin && rltShouldAuthorizeIframe(iframe)) {
                rltInvalidateWindowToken(token, iframe.contentWindow, iframeOrigin);
            }
        }
        if (parentOrigin && parentOrigin !== sourceOrigin && window.parent) {
            rltInvalidateWindowToken(token, window.parent, parentOrigin);
        }
    }
    window.rltInjectToken = function(token, target, origin) {
        if (target && typeof target.postMessage === 'function') {
            try {
                target.postMessage(JSON.stringify({
                    type: 'loginMessage',
                    data: {
                        event: 'login',
                        success: true,
                        type: 'rlt',
                        token: token,
                        sourceOrigin: window.location.origin,
                    },
                }), origin);
            } catch (err) {
                return;
            }
        }
    };
    window.rltIsAuthenticated = function() {
        return !!currentToken;
    };
    window.rltGetToken = function() {
        return currentToken;
    };
    window.rltAddInitializationListener = function(listener) {
        if (hasBeenInitialized) {
            listener(currentToken);
        } else {
            initializationListeners.push(listener);
        }
    };
    window.rltStoreToken = function(token) {
        currentToken = token;
        try {
            if (window.location === window.parent.location && window.localStorage) {
                window.localStorage.setItem(RLT_KEY, token);
            }
        } catch (e) {
            console.info("localstorage access denied - probably blocked third-party access", window.location.href);
        }
    }
    window.rltInitialize = function(config) {
        if (!config || typeof window.postMessage !== 'function') {
            return;
        }
        currentToken = config.token;
        iframeOrigins = config.iframeOrigins;
        parentOrigin = config.parentOrigin;
        try {
            if (!currentToken && window.location === window.parent.location && window.localStorage) {
                currentToken = window.localStorage.getItem(RLT_KEY);
            }
        } catch (e) {
            console.info("localstorage access denied - probably blocked third-party access", window.location.href);
        }
        window.addEventListener('message', function(e) {
            var message = e && e.data;
            if (typeof message === 'string') {
                try {
                    message = JSON.parse(message);
                } catch (err) {
                    return;
                }
            }
            var type = message && message.type;
            var data = message && message.data;
            if (type !== 'loginMessage') {
                return;
            }
            if (data && data.type === 'rlt' && data.token !== currentToken) {
                rltStoreToken(data.token);
                var iframes = document.querySelectorAll("iframe");
                for (var i = 0; i < iframes.length; i++) {
                    var iframe = iframes[i];
                    if (rltShouldAuthorizeIframe(iframe)) {
                        rltInjectToken(currentToken, iframe.contentWindow, getOriginFromUrl(iframe.src));
                    }
                }
                if (parentOrigin && parentOrigin !== data.sourceOrigin && window.parent) {
                    rltInjectToken(currentToken, window.parent, parentOrigin);
                }
            }
        });
        window.addEventListener('message', function(e) {
            var message = e && e.data;
            if (typeof message === 'string') {
                try {
                    message = JSON.parse(message);
                } catch (err) {
                    return;
                }
            }
            var type = message && message.type;
            var data = message && message.data;
            if (type !== 'rltMessage') {
                return;
            }
            if (data && data.event === 'invalidate' && data.token === currentToken) {
                rltInvalidateToken(data.token);
            }
        });
        if (iframeOrigins) {
            if (document.readyState !== 'loading') {
                rltMonitorIframes();
            } else {
                window.addEventListener('DOMContentLoaded', rltMonitorIframes);
            }
        }
        initializationListeners.forEach(function(listener) {
            listener(currentToken);
        });
        initializationListeners = [];
        hasBeenInitialized = true;
    };
})();