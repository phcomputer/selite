/* Copyright 2005 Shinya Kasatani
 * Copyright 2014 Peter Kehl
 * Based on Selenium code of ide/main/src/content/testCase.js
 *
 * This is needed for SelBlocksGlobal to work until Selenium accepts https://code.google.com/p/selenium/issues/detail?id=5495
 * 
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *      http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

"use strict";
// Anonymous function keeps 'global' and local variables out of global scope
( function(global) {
// Se IDE loads this file twice, and with a different scope object! See http://code.google.com/p/selenium/issues/detail?id=6697
if( !Favorites.interceptedBySeLiteRunAllFavorites ) {
    Favorites.interceptedBySeLiteRunAllFavorites= true;
    
    var SBDialogs = {}; // copied from original Favories
    SBDialogs.alert = function(message, title) {
        Components.classes["@mozilla.org/embedcomp/prompt-service;1"].getService(Components.interfaces.nsIPromptService).alert(null, title, message);
    };
    
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

    /**
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
    for( var i=0; i<global.editor.favorites.favorites.length; i++ ) {
        var favorite= global.editor.favorites.favorites[i];
        if( /^([a-zA-Z]:\\|\/)/.test(favorite.path) ) {
            favorite.path= getRelativePathToHome(favorite.path);
            updatedSomePaths= true;
        }
        if( updatedSomePaths ) {
            global.editor.favorites.save( global.editor.favorites.prefBranch );
        }
    }
    
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
        XulUtils.appendMenuItem(menu, {
            label: (this.isCurSuiteFavorite() ? "Remove" : "Add" ) + " favorite",
            id: "menu-favorite-button"
        });
        if( this.favorites.length > 0 ) {
            menu.appendChild(document.createElement("menuseparator"));
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
        }
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
      } else {
        //Suite must be saved first
        SBDialogs.alert("Please save the suite first.", "SeLite Run All Favorites");
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
          this.clearFavorites();
          this.save(this.prefBranch);
        }
        else
        if( evt.target.id==="menu-favorite-run-all" ) {
            this.runAllFavorites();
        }
      }
      else {
        try {
          this.editor.loadRecentSuite( applyRelativePathToHome(evt.target.value).path );
          if (evt.ctrlKey) {
            this.editor.playTestSuite();
          }
        } catch(err) {
          SBDialogs.alert("Error: Could not load test suite.", "Favorites (Selenium IDE)");
        }
      }
    };
    
    // This assumes that this.favorites.length>0. Therefore I only have 'Run all' in the menu if there is at least one favorite.
    Favorites.prototype.runAllFavorites= function runAllFavorites() {
        var testSuiteIndex= 0;
        var self= this;

        // This assumes that testSuiteIndex<self.favorites.length
        var loadAndPlayTestSuite= function loadAndPlayTestSuite() {
            self.editor.loadRecentSuite( applyRelativePathToHome(self.favorites[testSuiteIndex].path).path );
            self.editor.playTestSuite();
        };
        
        var testSuitePlayDoneHandler= function testSuitePlayDoneHandler() {
            testSuiteIndex++;
            if( testSuiteIndex<self.favorites.length ) {
                loadAndPlayTestSuite();
            }
            else {
                self.editor.app.removeObserver(testSuitePlayDoneHandler);
            }
        };
        
        self.editor.app.addObserver( {testSuitePlayDone: testSuitePlayDoneHandler} );
        loadAndPlayTestSuite();
    };
}
} )( this );