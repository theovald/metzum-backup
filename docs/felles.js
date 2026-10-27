/* Shared by login.js and sw.js: the derived key lives in IndexedDB, so the
   service worker finds it again after the browser has stopped it. */
var DB_NAVN = "metzum-backup";

function apneDb() {
    return new Promise(function (ok, feil) {
        var r = indexedDB.open(DB_NAVN, 1);
        r.onupgradeneeded = function () { r.result.createObjectStore("nokkel"); };
        r.onsuccess = function () { ok(r.result); };
        r.onerror = function () { feil(r.error); };
    });
}

function lesNokkel() {
    return apneDb().then(function (db) {
        return new Promise(function (ok) {
            var r = db.transaction("nokkel").objectStore("nokkel").get("k");
            r.onsuccess = function () { ok(r.result || null); };
            r.onerror = function () { ok(null); };
        });
    });
}

function lagreNokkel(k) {
    return apneDb().then(function (db) {
        return new Promise(function (ok, feil) {
            var t = db.transaction("nokkel", "readwrite");
            t.objectStore("nokkel").put(k, "k");
            t.oncomplete = function () { ok(); };
            t.onerror = function () { feil(t.error); };
        });
    });
}

function dekrypter(nokkel, buf) {
    return crypto.subtle.decrypt({ name: "AES-GCM", iv: buf.slice(0, 12) }, nokkel, buf.slice(12));
}
