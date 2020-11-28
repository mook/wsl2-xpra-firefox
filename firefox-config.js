// First line is ignored
const { classes: Cc, interfaces: Ci, utils: Cu } = Components;
var log = (msg) => { Services.console.logStringMessage(msg); };

var xulWindowListener = {
    onWindowTitleChange: (xulWin, newTitle) => {},
    onOpenWindow: (xulWin) => {
        try {
            var window = xulWin.QueryInterface(Ci.nsIInterfaceRequestor)
                               .getInterface(Ci.nsIDOMWindow);
            let loadHandler = () => {
                window.removeEventListener("load", loadHandler);
                var rootElem = window.document.documentElement;
                if (rootElem.getAttribute("windowtype") != "navigator:browser") {
                    return;
                }
                Services.wm.removeListener(xulWindowListener);
                log(`Found the browser window`);

                CustomizableUI.addListener({
                    onAreaNodeRegistered: (aArea, aNode) => {
                        log(`Got area ${aArea}`);
                        if (aArea != "nav-bar") {
                            return;
                        }
                    }
                });

                var remaining_buttons = ["ublock0-button"];
                var hInt = window.setInterval(() => {
                    if (!CustomizableUI.getAreaType("nav-bar")) {
                        return;
                    }
                    if (remaining_buttons.length < 1) {
                        window.clearInterval(hInt);
                        return;
                    }
                    var id = remaining_buttons.pop();
                    if (CustomizableUI.canWidgetMoveToArea(id, "nav-bar")) {
                        CustomizableUI.ensureWidgetPlacedInWindow(id, window);
                        CustomizableUI.addWidgetToArea(id, "nav-bar");
                        log(`Placed button ${id}`);
                    } else {
                        remaining_buttons.push(id);
                        log(`Button ${id} is not ready yet`);
                    }
                }, 500);
            };
            window.addEventListener("load", loadHandler);
        } catch (e) {
            Cu.reportError(e);
        }
    },
    onCloseWindow: (xulWin) => {}
};

function trim(str) {
    let lines = str.split("\n");
    while (lines[0] === "") {
        lines.shift();
    }
    let prefix = /^\s*/.exec(lines[0])[0];
    let re = new RegExp("^" + prefix.split('').map(c => "\\" + c).join(''));
    return lines.map(l => l.replace(re, '')).join("\n");
}

var uBlockTimer;

function uBlockUpdate() {
    var hiddenDOMWindow;
    try {
        hiddenDOMWindow = Services.appShell.hiddenDOMWindow;
    } catch (e) {
        // hidden window is not ready yet
        return;
    }
    var name = String.fromCharCode(181) + "Block";
    for (var frame of Array.from(hiddenDOMWindow.frames)) {
        if (name in frame) {
            try {
                // delay 0 uses default delay, so do delay 1 instead
                frame[name].assets.updateStart({ delay: 1 });
            } catch (e) {
                log(`Failed to update uBlock: ${e}`);
            }
            uBlockTimer.cancel();
            uBlockTimer = undefined;
            log("uBlock update triggered");
            checkForStartupFinished();
            return;
        }
    }
    log("uBlock not ready, retrying...");
}

function checkForStartupFinished() {
    if (uBlockTimer !== undefined) {
        return;
    }
}
try {
    Cu.import("resource://gre/modules/Services.jsm");
    Cu.import("resource:///modules/CustomizableUI.jsm");

    Services.wm.addListener(xulWindowListener);

    // We use throwaway docker containers, no need for private browsing
    Services.prefs.setBoolPref("browser.newtabpage.enabled", false);
    Services.prefs.setBoolPref("browser.newtabpage.enhanced", false);
    Services.prefs.setBoolPref("browser.privatebrowsing.autostart", false);
    Services.prefs.setBoolPref("extensions.pocket.enabled", false);

    const Timer = Components.Constructor("@mozilla.org/timer;1", "nsITimer", "initWithCallback");
    uBlockTimer = new Timer(uBlockUpdate, 1000, Ci.nsITimer.TYPE_REPEATING_SLACK);

    log("First run script has executed");
} catch (e) {
    dump(e);
    dump("\n");
    try {
        Cu.reportError(e);
    } catch (ex) {
        /* nothing */
    }
}
