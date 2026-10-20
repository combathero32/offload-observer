'use strict';
'require baseclass';
'require rpc';
'require offload_observer.ui as observerUI';

const summary = rpc.declare({object:'offload_observer',method:'summary',expect:{'':{}}});

return baseclass.extend({
    widgets:[{id:'offload_observer',slot:'tabs',title:_('Traffic usage'),order:90}],
    load() { return L.resolveDefault(summary(),{}); },
    render(data) {
        this.observer ??= observerUI.create();
        this.observer.update(data);
        return {tabs:[{id:'offload_observer',title:_('Traffic usage'),content:()=>this.observer.root}]};
    }
});
