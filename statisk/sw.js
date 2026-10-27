/* Decrypts the deck on request. Everything under deck/ is looked up in the
   encrypted manifest and served from the matching encrypted blob. */
importScripts("felles.js");

var base = self.registration.scope;
var deckSti = new URL("deck/", base).pathname;
var nokkel = null, manifest = null;
var minne = new Map();

function hentNokkel() {
    if (nokkel) return Promise.resolve(nokkel);
    return lesNokkel().then(function (k) { nokkel = k; return k; });
}

function hentBlob(navn) {
    return fetch(base + navn).then(function (r) {
        if (!r.ok) throw new Error(navn);
        return r.arrayBuffer();
    }).then(function (buf) {
        return hentNokkel().then(function (k) { return dekrypter(k, buf); });
    });
}

function hentManifest() {
    if (!manifest) {
        manifest = hentBlob("m.bin").then(function (data) {
            return JSON.parse(new TextDecoder().decode(data));
        }).catch(function (err) { manifest = null; throw err; });
    }
    return manifest;
}

self.addEventListener("install", function () { self.skipWaiting(); });
self.addEventListener("activate", function (e) { e.waitUntil(self.clients.claim()); });
self.addEventListener("message", function (e) {
    if (e.data && e.data.type === "ny-nokkel") {
        nokkel = null;
        manifest = null;
        minne.clear();
    }
});

self.addEventListener("fetch", function (e) {
    var url = new URL(e.request.url);
    if (url.origin !== self.location.origin || url.pathname.indexOf(deckSti) !== 0) return;
    var sti = decodeURIComponent(url.pathname.slice(deckSti.length)) || "index.html";
    e.respondWith(svar(e.request, sti));
});

function svar(req, sti) {
    if (req.method !== "GET") return Promise.resolve(new Response(null, { status: 405 }));
    return hentNokkel().then(function (k) {
        if (!k) return Response.redirect(base, 302);
        return hentManifest().then(function (m) {
            var fil = m[sti];
            if (!fil) return new Response("Finnes ikke", { status: 404 });
            if (!minne.has(sti)) minne.set(sti, hentBlob("b/" + fil.b));
            return minne.get(sti).then(function (data) {
                return new Response(data, { headers: { "Content-Type": fil.t, "Cache-Control": "no-store" } });
            });
        });
    }).catch(function () {
        minne.delete(sti);
        return Response.redirect(base, 302);
    });
}
