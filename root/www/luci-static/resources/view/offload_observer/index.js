'use strict';
'require view';
'require poll';
'require rpc';
'require offload_observer.ui as observerUI';

const summary = rpc.declare({object:'offload_observer',method:'summary',expect:{'':{}}});

return view.extend({
    load() { return L.resolveDefault(summary(),{}); },
    render(data) {
        const observer=observerUI.create();
        observer.update(data);
        poll.add(()=>L.resolveDefault(summary(),{}).then(next=>observer.update(next)),5);
        return observer.root;
    },
    handleSave:null,
    handleSaveApply:null,
    handleReset:null
});
