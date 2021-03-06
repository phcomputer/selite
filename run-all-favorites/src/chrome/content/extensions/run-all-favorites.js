/* Copyright 2011, 2012 Samit Badle
 * Copyright 2014 Peter Kehl
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 1.1. If a copy of the MPL was not distributed with this file,
 * You can obtain one at http://mozilla.org/MPL/1.1/.
 */
"use strict";

window.setTimeout( function() {
    // Se IDE loads this file twice, and with a different scope object! See http://code.google.com/p/selenium/issues/detail?id=6697
    if( !Favorites.interceptedBySeLiteRunAllFavorites ) {
        Favorites.interceptedBySeLiteRunAllFavorites= true;

        /** Get path parts (all parent folders and the leaf) of the given file/folder.
            @param nsIFile file File or folder
            @return array Array of strings, all folder parts of the path to file, starting with the root/volume, ending with the leaf
        */
        var pathParts= function pathParts( file ) {
           var parts= [file.leafName];

           var iterator= file;
           while( iterator.parent ) {
             iterator= iterator.parent;
             parts.push( iterator.leafName );
           }
           parts.reverse();
           return parts;
        };

        /** Get a relative path for the given file, relative to the given folder.
         *  @param {nsIFile} file
         *  @param {nsIFile} folderRelativeTo
         *  @return {string} File path for the given file, relative to path of folderRelativeTo.
        */
        var getRelativePath= function getRelativePath( file, folderRelativeTo ) {
          var filePathParts= pathParts(file), folderPathParts= pathParts(folderRelativeTo);
          var sharedPartsCount= 0;
          while( sharedPartsCount<filePathParts.length && sharedPartsCount<folderPathParts.length ) {
            if( filePathParts[sharedPartsCount]===folderPathParts[sharedPartsCount] )  {
               sharedPartsCount++;
            }
            else {
               break;
            }
          }
          if( !sharedPartsCount ) {
             throw new Error( "Root folders of parameter file and folderRelativeTo don't match." );
          }
          var result= '';
          for( var i=sharedPartsCount; i<folderPathParts.length; i++ ) {
            if( result ) {
               result+= '/';
            }
            result+= '..';
          }
          for( var i=sharedPartsCount; i<filePathParts.length; i++ ) {
             if( result ) {
               result+= '/';
             }
            result+= filePathParts[i];
          }
          return result;
        };

        /** When testing on Windows: Windows > Run: cmd > run: echo %USERPROFILE%
         * @param {string} filePath Absolute file path.
         * @returns {string} File path relative to user's home.
         */
        var getRelativePathToHome= function getRelativePathToHome( filePath ) {
            var homeFolder= Components.classes["@mozilla.org/file/directory_service;1"].getService(Components.interfaces.nsIProperties).get("Home", Components.interfaces.nsIFile);
            var file = Components.classes['@mozilla.org/file/local;1'].createInstance(Components.interfaces.nsILocalFile);
            file.initWithPath(filePath);
            return getRelativePath( file, homeFolder );
        };

        /** @param nsIFile baseFolder
            @param string path Relative path, e.g. result of relativePath()
            @return nsIFile
        */
        var applyRelativePath= function applyRelativePath( baseFolder, path ) {
           var file= baseFolder;
           var pathParts= path.split( '/');
           var i=0;
           while( i<pathParts.length && pathParts[i]==='..' ) {
              file= file.parent;
              i++;
           }
           if( i===0 ) {
              file= file.clone(); // That's because the following code will modify file.
           }
           while( i<pathParts.length ) {
              file.append( pathParts[i] );
              i++;
           }
           // Following code modifies file by calling append(). Side note: To make it safe, Mozilla made file.parent resolve to a new object everytime it's used: file.parent!==file.parent.
           return file;
        };

        /** @param string path Relative path, e.g. result of relativePath()
            @return nsIFile
        */
        var applyRelativePathToHome= function applyRelativePathToHome( path ) {
            var homeFolder= Components.classes["@mozilla.org/file/directory_service;1"].getService(Components.interfaces.nsIProperties).get("Home", Components.interfaces.nsIFile);
            return applyRelativePath( homeFolder, path );
        };

        // Update any old-style absolute paths. I don't intercept Favorites.prototype.load(), because that was already run from favorites' content/logic/Favorites.js when it created an instance.
        var updatedSomePaths= false;
        for( var i=0; i<editor.favorites.favorites.length; i++ ) {
            var favorite= editor.favorites.favorites[i];
            if( /^([a-zA-Z]:\\|\/)/.test(favorite.path) ) {
                favorite.path= getRelativePathToHome(favorite.path);
                updatedSomePaths= true;
            }
            if( updatedSomePaths ) {
                editor.favorites.save( editor.favorites.prefBranch );
            }
        }

        var console= Components.utils.import("resource://gre/modules/devtools/Console.jsm", {}).console;
        // Mostly copied from original Favorites with these changes:
        // -adding 'Run all'
        // -showing 'Run all', 'Clear all' only when there is one or more favorite test suites.
        // - showing 'Remove favorite'/'Add favorite' even when accessed from the toolbar. Otherwise, if there was nothing in the menu, clicking at the dropdown from the toolbar seemed confusing.
        Favorites.prototype.populateMenuPopup= function populateMenuPopup(menu) {
            XulUtils.clearChildren(menu);
            if( this.favorites.length > 0 ) {
                XulUtils.appendMenuItem(menu, {
                  label: "Run all",
                  id: "menu-favorite-run-all"
                });
            }
            XulUtils.appendMenuItem(menu, {// Original Favorites only put it into menu with id 'menu_popup_favorite', but I like it in both the menu and context menu
                label: (this.isCurSuiteFavorite() ? "Remove" : "Add" ) + " favorite",
                id: "menu-favorite-button"
            });
            menu.appendChild(document.createElement("menuseparator"));
            if( this.favorites.length > 0 ) {
                  for (var i = 0; i < this.favorites.length; i++) {
                    XulUtils.appendMenuItem(menu, {
                      label: this.favorites[i].name,
                      value: this.favorites[i].path
                    });
                  }
                menu.appendChild(document.createElement("menuseparator"));
                XulUtils.appendMenuItem(menu, {
                  label: "Clear all",
                  id: "menu-favorite-clear"
                });
                XulUtils.appendMenuItem(menu, {
                  label: "Export - save",
                  id: "menu-favorite-export-save"
                });
                XulUtils.appendMenuItem(menu, {
                  label: "Export - display",
                  id: "menu-favorite-export-display"
                });
            }
            XulUtils.appendMenuItem(menu, {
              label: "Import",
              id: "menu-favorite-import"
            });
        };

        // Copied from original Favorites + transforming absolute file path to relative
        Favorites.prototype.isFavorite = function isFavorite(suite) {
          var suiteRelativePath= getRelativePathToHome(suite);
          for( var i=0; i<this.favorites.length; i++ ) {
            if( this.favorites[i].path===suiteRelativePath ) {
              return true;
            }
          }
          return false;
        };

        // Copied from original Favorites + transforming absolute file path to relative
        Favorites.prototype.toggleSuiteFavorite = function toggleSuiteFavorite() {
          var curSuite = this.editor.app.getTestSuite();
          if (curSuite.file) {
            var suiteRelativePath= getRelativePathToHome( curSuite.file.path );
            if( !this.removeFavorite(suiteRelativePath) ) {
              var suiteName = curSuite.file.leafName;
              suiteName = suiteName.replace(/\.[^.]+$/, "");
              this.addFavorite( suiteRelativePath, suiteName );
            }
            this.save(this.prefBranch);
            this.suiteStateChanged(curSuite);
          } else {
            //Suite must be saved first
            Favorites.alert("Please save the suite first.", "SeLite Run All Favorites");
          }
        };

        // Mostly copied from original Favorites + transforming test suite file path from relative to absolute + handling 'Run All' menu item
        Favorites.prototype.menuClicked = function menuClicked(evt) {
          if( evt.target.id ) {
            if( evt.target.id==="favorite-button" || evt.target.id==="menu-favorite-button" ) {
              this.toggleSuiteFavorite();
            }
            else
            if( evt.target.id==="menu-favorite-clear" ) {
                if (this.favorites.length > 0 && Favorites.confirm("Are you sure you want to clear all favourites?", "SeLite Run All Favorites")) {
                  this.clearFavorites();
                  this.save(this.prefBranch);
                  document.getElementById('favorite-button').classList.remove('fav');
                }
            }
            else
            if( evt.target.id==="menu-favorite-run-all" ) {
                this.runAllFavorites();
            }
            else
            if( evt.target.id==="menu-favorite-export-save" ) {
                this.exportFavoritesSave();
            }
            else
            if( evt.target.id==="menu-favorite-export-display" ) {
                this.exportFavoritesDisplay();
            }
            if( evt.target.id==="menu-favorite-import" ) {
                this.importFavorites();
            }
          }
          else {
            try {
                var path = evt.target.value || evt.target.getAttribute('value');
                path= applyRelativePathToHome(path).path;
                if (FileUtils.fileExists(path)) {
                  this.editor.loadRecentSuite(path);
                  if (evt.ctrlKey || evt.metaKey || this.meta) {
                    this.editor.playTestSuite();
                  }
                } else {
                  if (Favorites.confirm("This favorite could not be found!\n" + path + "\nWould you like to clear this favourites?", "Favorites (Selenium IDE)")) {
                    if (this.removeFavorite(path)) {
                      this.save(this.prefBranch);
                    }
                  }
                }
            } catch(err) {
              Favorites.alert("Error: Could not load test suite.", "SeLite Run All Favorites");
            }
          }
        };
        
        var oldTestSuiteProgressUpdate;
        var testSuitePlayDoneObserver;
        // This assumes that this.favorites.length>0. Therefore I only have 'Run all' in the menu if there is at least one favorite.
        Favorites.prototype.runAllFavorites= function runAllFavorites() {
            var self= this;
            
            oldTestSuiteProgressUpdate= TestSuiteProgress.prototype.update;
            var testSuiteFromLastUpdate;
            var sumRuns, sumTotal;
            var lastTestCaseRuns, lastTestCaseTotal;
            /** @overrides TestSuiteProgress.prototype.update() so that it cumulates the runs & failures. It doesn't adjust the progress indicator (that would mean getting a number of test cases in all favorite test suites first).
             * This is in addition to overriding TestSuiteProgress.prototype.reset() below. */
            TestSuiteProgress.prototype.update= function update( givenRuns, givenTotal, failure ) {
                if( testSuiteFromLastUpdate===undefined ) {
                    sumRuns= 0;
                    sumTotal= 0;
                    lastTestCaseRuns= 0;
                    lastTestCaseTotal= 0;
                }
                if( self.editor.app.getTestSuite()!==testSuiteFromLastUpdate ) {
                    sumRuns+= lastTestCaseRuns;
                    sumTotal+= lastTestCaseTotal;
                    testSuiteFromLastUpdate= self.editor.app.getTestSuite();
                }
                lastTestCaseRuns= givenRuns;
                lastTestCaseTotal= givenTotal;
                oldTestSuiteProgressUpdate.call( this, sumRuns+givenRuns, sumTotal+givenTotal, failure );
            };
            
            /** This assumes that testSuiteIndex<self.favorites.length
             * @param [bool] dontReset Whether to reset success/failure numbers; optional.
            */
            var loadAndPlayTestSuite= function loadAndPlayTestSuite( dontReset ) {
                self.editor.loadRecentSuite( applyRelativePathToHome(self.favorites[testSuiteIndex].path).path );
                self.editor.playTestSuite( undefined, dontReset );
            };

            var testSuiteIndex= 0;
            testSuitePlayDoneObserver= {
                testSuitePlayDone: function testSuitePlayDoneHandler() {
                    console.debug( 'SeLite Run All Favorites: processing testSuitePlayDoneHandler');
                    testSuiteIndex++;
                    if( testSuiteIndex<self.favorites.length ) {
                        self.editor.getUserLog().info( 'Playing test suite ' +self.favorites[testSuiteIndex].path );
                        loadAndPlayTestSuite.call( undefined, true );
                    }
                    else {
                        self.editor.app.removeObserver( testSuitePlayDoneObserver );
                        testSuitePlayDoneObserver= undefined;
                        TestSuiteProgress.prototype.update= oldTestSuiteProgressUpdate;
                        testSuiteFromLastUpdate= undefined;
                        self.editor.getUserLog().info( 'Finished playing all favorites' );
                    }
                }
            };

            self.editor.app.addObserver( testSuitePlayDoneObserver );
            self.editor.getUserLog().info( 'Starting to play all favorites' );
            self.editor.getUserLog().info( 'Playing test suite ' +self.favorites[testSuiteIndex].path );
            loadAndPlayTestSuite.call();
        };
        
        Favorites.prototype.exportFavoritesDisplay = function exportFavoritesDisplay() {
            var indentedData= JSON.stringify( this.favorites, undefined, ' ' );
            // I don't generate content type 'text/json', since that causes Firefox to show 'Save file as' dialog, but it gives the file an ugly/random-like default filename.
            // I can't generate the file for direct download (i.e. forcing 'Save file' popup). If I follow http://stackoverflow.com/questions/283956/is-there-any-way-to-specify-a-suggested-filename-when-using-data-uri > see 'answered Sep 8', then link.download is empty.
            var data = JSON.stringify(this.favorites, undefined, ' ');
            var uri= 'data:text/plain;charset=utf-8,' +escape(data);
            openTabOrWindow( uri );
        };
        
        var nsIFilePicker = Components.interfaces.nsIFilePicker;
        
        Favorites.prototype.exportFavoritesSave = function exportFavoritesSave() {
            var filePicker = Components.classes["@mozilla.org/filepicker;1"].createInstance(nsIFilePicker);
            filePicker.init( window, "Export the list of all Favorites", nsIFilePicker.modeSave );
            filePicker.appendFilter( 'JSON', '*.json' );
            filePicker.appendFilter( 'Text', '*.txt' );
            filePicker.appendFilters( nsIFilePicker.filterAll );
            var result= filePicker.show();
            if( result===nsIFilePicker.returnOK || result===nsIFilePicker.returnReplace ) {
                var file = Components.classes["@mozilla.org/file/local;1"].createInstance(Components.interfaces.nsILocalFile);
                file.initWithPath( filePicker.file.path );
            
                var foStream = Components.classes["@mozilla.org/network/file-output-stream;1"].
                       createInstance(Components.interfaces.nsIFileOutputStream);

                foStream.init(file, 0x02 | 0x08 | 0x20, 438/*===0666, but strict mode refuses octal literals*/, 0); 
                var converter = Components.classes["@mozilla.org/intl/converter-output-stream;1"].
                                createInstance(Components.interfaces.nsIConverterOutputStream);
                converter.init(foStream, "UTF-8", 0, 0);
                var data = JSON.stringify(this.favorites, undefined, ' ');
                converter.writeString(data);
                converter.close(); // this closes foStream
            }
        };
        
        Favorites.prototype.importFavorites = function importFavorites() {
            var filePicker = Components.classes["@mozilla.org/filepicker;1"].createInstance(nsIFilePicker);
            filePicker.init( window, "Import a list of all Favorites", nsIFilePicker.modeOpen );
            filePicker.appendFilter( 'JSON', '*.json' );
            filePicker.appendFilter( 'Text', '*.txt' );
            filePicker.appendFilters( nsIFilePicker.filterAll );
            var result= filePicker.show();
            if (result===nsIFilePicker.returnOK ) {
                var file = Components.classes["@mozilla.org/file/local;1"].createInstance(Components.interfaces.nsILocalFile);
                file.initWithPath( filePicker.file.path );
                var fstream = Components.classes["@mozilla.org/network/file-input-stream;1"].createInstance(Components.interfaces.nsIFileInputStream);
                var cstream = Components.classes["@mozilla.org/intl/converter-input-stream;1"].createInstance(Components.interfaces.nsIConverterInputStream);
                fstream.init(file, -1, 0, 0);
                cstream.init(fstream, "UTF-8", 0, 0); // you can use another encoding here if you wish
                var data= '';
                var read = 0;
                do {
                    var str= {};
                    read = cstream.readString(0xffffffff, str); // read as much as we can and put it in str.value
                    data += str.value;
                } while( read );
                cstream.close(); // this closes fstream
                data= JSON.stringify( JSON.parse(data) ); // Remove any extra whitespace possibly added by exportFavorites(). Mozilla Preferences API would strip new lines anyway.
                this.prefBranch.setCharPref("favorites", data);
                this.clearFavorites();
                this.load( this.prefBranch );
            }
        };
        
        var oldPause= Debugger.prototype.pause;
        /** A minor issue: 
         *  1. click 'Run all' favorites
         *  2. hit 'Pause' button while executing the last command of a last test case of any test suite other than the the last on the list of favorites
         *  3. that test suite will finish and you won't be able to 'Resume' running the rest of favorite test suites.
         * This is caused by debugger's pause() sets debugger's pauseTimeLimit <- checked by debugger's runner.shouldAbortCurrentCommand() <- ??
         * which gets too complicated to work around.
         * */
        Debugger.prototype.pause= function pause() {
            if( testSuitePlayDoneObserver ) {
                console.debug( 'SeLite Run All Favorites: removing testSuitePlayDoneObserver');
                // I must do this before I invoke oldPause.call( this ), which would otherwise trigger testSuitePlayDoneHandler()
                this.editor.app.removeObserver( testSuitePlayDoneObserver );
            }
            oldPause.call( this );
        };
        
        var oldDoContinue= Debugger.prototype.doContinue;
        Debugger.prototype.doContinue= function doContinue(step) {
            if( testSuitePlayDoneObserver ) {
                console.debug( 'SeLite Run All Favorites: setting up testSuitePlayDoneObserver');
                this.editor.app.addObserver( testSuitePlayDoneObserver );
            }
            oldDoContinue.call( this, step );
        };
        
        var oldDoCommand= Editor.controller.doCommand;
        Editor.controller.doCommand= function doCommand(cmd) {
            console.debug( 'SeLite Run All Favorites: Editor.controller.doCommand ' +cmd );
            switch( cmd ) {
                // If you've paused 'Run all' and then you trigger any of the following GUI commands, that disables 'resume' button for the paused 'Run all'
                case "cmd_add":
                case "cmd_new":
                case "cmd_open":
                case "cmd_new_suite":
                case "cmd_open_suite":
                case "cmd_selenium_testcase_clear":
                case "cmd_selenium_play":
                case "cmd_selenium_play_suite":
                case "cmd_selenium_step":
                case "cmd_selenium_rollup":
                case "cmd_selenium_reload":
                    if( testSuitePlayDoneObserver && editor.selDebugger.state===Debugger.PAUSED ) {
                        console.debug( 'SeLite Run All Favorites: cleaning testSuitePlayDoneObserver and resetting debugger state' );
                        testSuitePlayDoneObserver= undefined;
                        TestSuiteProgress.prototype.update= oldTestSuiteProgressUpdate;
                        editor.selDebugger.setState( Debugger.STOPPED );
                        console.debug( 'SeLite Run All Favorites: cleaned testSuitePlayDoneObserver and reset debugger state' );
                    }
                    break;
                default:
                    ;
            }
            oldDoCommand.call( this, cmd );
        };
        
        var oldPlayTestSuite= Editor.prototype.playTestSuite;
        /** @overrides of Editor.prototype.playTestSuite from Selenium's chrome/content/editor.js.
        This adds optional parameter dontReset, which indicates not to reset success/failure numbers.
        */
        Editor.prototype.playTestSuite= function playTestSuite( startIndex, dontReset ) {
            console.debug( 'SeLite Run All Favorites: overriden playTestSuite(): dontReset ' +dontReset );
            if( dontReset ) {
                var oldReset= TestSuiteProgress.prototype.reset;
                // Temporary override of TestSuiteProgress.prototype -> reset() from Selenium's chrome/content/testSuiteProgress.js
                TestSuiteProgress.prototype.reset= function reset() {};
            }
            try {
                oldPlayTestSuite.call( this, startIndex );
            }
            finally {
                if( dontReset ) {
                    TestSuiteProgress.prototype.reset= oldReset;
                }
            }
        };
        // 'editor' is an instance of either StandaloneEditor or SidebarEditor. Those classes don't refer to Editor.prototype, but they have copies of all functions from Editor.prototype (copied via objectExtend()).
        SidebarEditor.prototype.playTestSuite= StandaloneEditor.prototype.playTestSuite= Editor.prototype.playTestSuite;
        
        // Selenium IDE sometimes auto-loads the last test suite when it starts. Following ensures the star for it to be correct:
        this.editor.favorites.suiteStateChanged( editor.app.testSuite );
    }
}, 3000 );