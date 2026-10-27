(function () {
    "use strict";

    var skjema = document.getElementById("skjema");
    var melding = document.getElementById("melding");
    var valg = document.getElementById("valg");

    function vis(tekst, feil) {
        melding.textContent = tekst;
        melding.classList.toggle("is-feil", !!feil);
    }

    function hent(url) {
        return fetch(url, { cache: "no-store" }).then(function (r) {
            if (!r.ok) throw new Error(url);
            return r;
        });
    }

    function avled(passord) {
        return hent("salt.json").then(function (r) { return r.json(); }).then(function (s) {
            var salt = Uint8Array.from(atob(s.salt), function (c) { return c.charCodeAt(0); });
            return crypto.subtle.importKey("raw", new TextEncoder().encode(passord), "PBKDF2", false, ["deriveKey"])
                .then(function (base) {
                    return crypto.subtle.deriveKey(
                        { name: "PBKDF2", salt: salt, iterations: s.iter, hash: "SHA-256" },
                        base, { name: "AES-GCM", length: 256 }, false, ["decrypt"]);
                });
        });
    }

    function startArbeider() {
        return navigator.serviceWorker.register("sw.js").then(function () {
            return navigator.serviceWorker.ready;
        }).then(function (reg) {
            reg.active.postMessage({ type: "ny-nokkel" });
        });
    }

    function klar() {
        skjema.hidden = true;
        vis("", false);
        valg.hidden = false;
    }

    if (!("serviceWorker" in navigator) || !window.crypto || !crypto.subtle) {
        vis("Nettleseren støtter ikke denne siden. Bruk Chrome, Edge eller Firefox.", true);
        skjema.hidden = true;
        return;
    }

    lesNokkel().then(function (k) {
        if (k) return startArbeider().then(klar);
    }).catch(function () { /* logg inn på vanlig måte */ });

    skjema.addEventListener("submit", function (e) {
        e.preventDefault();
        vis("Åpner …", false);
        var nokkel;
        avled(document.getElementById("passord").value).then(function (k) {
            nokkel = k;
            return hent("m.bin").then(function (r) { return r.arrayBuffer(); });
        }).then(function (buf) {
            return dekrypter(nokkel, buf);
        }).then(function () {
            return lagreNokkel(nokkel);
        }).then(startArbeider).then(klar).catch(function (err) {
            vis(err && err.name === "OperationError" ? "Feil passord." : "Noe gikk galt. Prøv igjen.", true);
        });
    });
})();
