SeLiteExtensionSequencer.registerPlugin( {
    pluginId: 'run-all-favorites@selite.googlecode.com',
    coreUrl: [
        'chrome://selite-run-all-favorites/content/extensions/run-all-favorites.js',
        'chrome://selite-run-all-favorites/content/extensions/run-all-favorites.js'
    ],
    nonSequencedRequisitePlugins: {
        'favorites_selenium-ide@Samit.Badle': 'Favorites (Selenium IDE)'
    }
} );