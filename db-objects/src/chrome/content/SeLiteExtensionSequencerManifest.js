Components.utils.import("chrome://selite-extension-sequencer/content/SeLiteExtensionSequencer.js");
SeLiteExtensionSequencer.registerPlugin( {
    pluginId: 'db-objects@selite.googlecode.com',
    // This plugin doesn't use coreUrl: 'chrome://selite-db-objects/content/extensions/db-objects.js'
    // because we don't want to flood Selenium namespace. If a user wants to use this directly,
    // they can use Components.utils.import() in their Core extensions.
    requisitePlugins: {
        'misc@selite.googlecode.com': 'SeLite Miscellaneous',
        'commands@selite.googlecode.com': 'SeLite Commands',
        'db-storage@selite.googlecode.com': 'SeLite DB Storage'
    }
} );
var EXPORTED_SYMBOLS= [];