(()=>{if(window.__constructorAnalytics||navigator.doNotTrack==='1')return;window.__constructorAnalytics=true;const endpoint="https://api.useconstructor.com/v1/projects/P-KUFJZZ/analytics/events";const cleanPath=(()=>{const __name=(target,name)=>{Object.defineProperty(target,"name",{value:name,configurable:true});return target;};return (function analyticsPath(value) {
    const path = String(value).split(/[?#]/, 1)[0];
    if (!path.startsWith('/') || path.startsWith('//'))
        return '/';
    const privateCollections = new Set(['reserva', 'reservas', 'reservations', 'bookings', 'citas', 'appointments', 'pedidos', 'orders', 'solicitudes', 'requests', 'confirmaciones', 'confirmations']);
    const actions = new Set(['new', 'nuevo', 'nueva', 'create', 'crear', 'edit', 'editar', 'cancel', 'cancelar', 'confirm', 'confirmar', 'details', 'detalle', 'history', 'historial', 'list', 'lista', 'mine', 'mias', ':id']);
    let privateDetail = false;
    return path.split('/').map(segment => {
        let decoded = segment;
        try {
            decoded = decodeURIComponent(segment);
        }
        catch { /* Keep malformed public paths intact. */ }
        const lower = decoded.toLowerCase();
        if (privateCollections.has(lower)) {
            privateDetail = true;
            return segment;
        }
        const identifier = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(decoded)
            || /^[0-9a-f]{24,}$/i.test(decoded) || /^\d{8,}$/.test(decoded) || /@/.test(decoded);
        return identifier || (privateDetail && segment && !actions.has(lower)) ? ':id' : segment;
    }).join('/').slice(0, 500);
});})();const cleanReferrer=(()=>{const __name=(target,name)=>{Object.defineProperty(target,"name",{value:name,configurable:true});return target;};return (function analyticsReferrer(value) {
    try {
        const url = new URL(value);
        return /^https?:$/.test(url.protocol) ? url.origin : '';
    }
    catch {
        return '';
    }
});})();const id=(storage,key)=>{try{const store=window[storage];let id=store.getItem(key);if(!id){id=crypto.randomUUID();store.setItem(key,id)}return id}catch{return crypto.randomUUID()}};const visitor=id('localStorage','constructor-visitor');const session=id('sessionStorage','constructor-session');const send=(event)=>{if(navigator.doNotTrack==='1'||typeof event!=='string'||!event.trim()||event.length>100)return;fetch(endpoint,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({visitor,session,path:cleanPath(location.pathname),referrer:cleanReferrer(document.referrer),event:event.trim()}),keepalive:true}).catch(()=>{})};let path='';const page=()=>{if(path!==location.pathname){path=location.pathname;send('pageview')}};page();for(const method of ['pushState','replaceState']){const original=history[method];history[method]=function(...args){const result=original.apply(this,args);page();return result}}addEventListener('popstate',page);window.constructorTrack=send;})();