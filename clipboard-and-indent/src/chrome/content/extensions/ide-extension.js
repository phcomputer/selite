/*
 * Copyright 2005 Shinya Kasatani
 * Copyright 2015 Peter Kehl
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
 * 
 * Based on Selenium code of ide/main/src/content/treeView.js and ide/main/src/content/testCase.js
 *
 * This, and related code in html.js, makes Selenium IDE accept HTML from native clipboard, regardless of its souce (potentially another Selenium IDE instance, or a file), as far as it fits the format.
 * */
"use strict";

(function() { // Anonymous function to make the variables local
    Components.utils.import( "chrome://selite-extension-sequencer/content/SeLiteExtensionSequencer.js" );
    var loadedTimes= SeLiteExtensionSequencer.coreExtensionsLoadedTimes['SeLiteClipboardAndIndent'] || 0;
    if( !loadedTimes ) {
        // For clipboard:
        
        // Ideally, I would change behaviour of isCommandEnabled() so that it allows cmd_paste even if self.clipboard==null. However, isCommandEnabled() is out of easy reach outside of original constructor of TreeView (and I don't want to replace the whole TreeView constructor just for that). Therefore, I
        // - leave original isCommandEnabled untouched
        // - change initialize() to set this.clipboard to non-null
        // - replace paste() to work regardless of this.clipboard.
        var originalTreeViewInitialize= TreeView.prototype.initialize;
        TreeView.prototype.initialize= function initialize( editor, document, tree ) {
            originalTreeViewInitialize.call( this, editor, document, tree );
            this.clipboard= [];
        };
        
        TreeView.prototype.getCommandsFromClipboard= function getCommandsFromClipboard() {
            var formatter= this.editor.app.getClipboardFormat().getFormatter();
            if( formatter.parseCommandsAndHeader ) {
                var trans = this._createTransferable();
                trans.addDataFlavor("text/unicode");
                var clipboard = Components.classes["@mozilla.org/widget/clipboard;1"].
                    getService(Components.interfaces.nsIClipboard);
                clipboard.getData(trans, Components.interfaces.nsIClipboard.kGlobalClipboard);
                var str= {};
                var strLength= {};
                trans.getTransferData( "text/unicode", str, strLength );
                if( str ) {
                    var text= str.value.QueryInterface( Components.interfaces.nsISupportsString ).data;
                    var commands= formatter.parseCommandsAndHeader( text ).commands;
                    if( commands.length ) {
                        return commands;
                    }
                }
            }
            // not reading from a real clipboard...
            return this.clipboard;
        };

        TreeView.prototype.paste= function paste() {
            if (!this.treebox.focused) return;
            var commands = this.getCommandsFromClipboard();
            if (commands) {
                var currentIndex = this.tree.currentIndex;
                if (this.selection.getRangeCount() == 0) {
                    currentIndex = this.rowCount;
                }
                this.executeAction(new TreeView.PasteCommandAction(this, currentIndex, commands));
            }
        };
        
        // For indentation - https://code.google.com/p/selenium/issues/detail?id=6903:
        
        /** The body is identical to original getDefinition(), but this adds trimLeft() for indented commands. */
        Command.prototype.getDefinition = function getDefinition() {
                if (this.command == null) return null;
                var commandName = this.command.trimLeft().replace(/AndWait$/, '');
                var api = Command.loadAPI();
                var r = /^(assert|verify|store|waitFor)(.*)$/.exec(commandName);
                if (r) {
                        var suffix = r[2];
                        var prefix = "";
                        if ((r = /^(.*)NotPresent$/.exec(suffix)) != null) {
                                suffix = r[1] + "Present";
                                prefix = "!";
                        } else if ((r = /^Not(.*)$/.exec(suffix)) != null) {
                                suffix = r[1];
                                prefix = "!";
                        }
                        var booleanAccessor = api[prefix + "is" + suffix];
                        if (booleanAccessor) {
                                return booleanAccessor;
                        }
                        var accessor = api[prefix + "get" + suffix];
                        if (accessor) {
                                return accessor;
                        }
                }
                return api[commandName];
        };
        
        var indentedText= /^(\s+)(.*)/;
        // Opening commands, which indent the next new commands/comments to the right:
        var openingCommands= ['if', 'elseIf', 'else', 'while', 'for', 'foreach', 'forXml', 'forJson', 'function', 'try', 'catch', 'finally'];
        var newCommandOrCommentIndentation= function newCommandOrCommentIndentation( testCase, currentIndex ) {
            if( currentIndex>0 ) {
                var previousCommand= testCase.commands[currentIndex-1];
                var previousCommandText= previousCommand.command
                    ? previousCommand.command
                    : previousCommand.comment;
                var match= indentedText.exec( previousCommandText );
                var indentation= '';
                if( match ) {
                    indentation= match[1];
                }
                var commandItself= match
                    ? match[2]
                    : previousCommandText;
                if( previousCommand.command && openingCommands.indexOf(commandItself)>=0 ) {
                    indentation+= '  ';
                }
                return indentation;
            }
            return '';
        };
        
        /** Insert a new command/comment into the tree, and select it. Don't start editing - that's up to the caller.
         *  @param {boolean} insertComment Whether a comment; otherwise it's a command.
         *  @return {number} length of indentation prefix, if any
         * */
        TreeView.prototype.insertCommandBase= function insertCommandOrComment(insertComment ) {
            if (this.tree.currentIndex >= 0) {
                var currentIndex = this.tree.currentIndex;
                var indentation= newCommandOrCommentIndentation( this.testCase, currentIndex );
                this.insertAt( currentIndex,
                    insertComment
                        ? new Comment(indentation)
                        : new Command(indentation)
                );
                this.selection.select(currentIndex);
                return indentation.length;
            }
        };
        
        TreeView.prototype.insertCommand= function insertCommand( insertComment ) {
            var indentationLength= this.insertCommandBase( false );
            var action=document.getElementById('commandAction');
            action.focus();
            if( indentationLength ) {
                action.setSelectionRange( indentationLength, indentationLength );
            }
        };
        TreeView.prototype.insertComment= function insertComment() {
            this.insertCommand( true );
        };
        
        /** This handles indentation for commands generated via Firefox context menu (right click on the tested webpage) or in Selenium IDE recording mode.
         *  In some situations (either the very first command in the test case, or after a change of window) the original addCommand() calls itself recursively, so that it adds two or more extra command(s) before the actual given command. However, we want to indent them all.
         *  There's no easy workaround, so I just duplicate the original addCommand(), modified to support indentation and refactored the related part.
         * */
Editor.prototype.addCommand = function (command, target, value, window, insertBeforeLastCommand) {
  this.log.debug("addCommand: command=" + command + ", target=" + target + ", value=" + value + " window.name=" + window.name);
  if (command != 'open' &&
      command != 'selectWindow' &&
      command != 'selectFrame') {
    if (this.getTestCase().commands.length == 0) {
      var top = this._getTopWindow(window);
      this.log.debug("top=" + top);
      var path = this.getPathAndUpdateBaseURL(top)[0];
      this.addCommand("open", path, '', top);
      this.recordTitle(top);
    }
    if (!this.safeLastWindow.isSameWindow(window)) {
      if (this.safeLastWindow.isSameTopWindow(window)) {
        // frame
        var destPath = this.safeLastWindow.createPath(window);
        var srcPath = this.safeLastWindow.getPath();
        this.log.debug("selectFrame: srcPath.length=" + srcPath.length + ", destPath.length=" + destPath.length);
        var branch = 0;
        var i;
        for (i = 0; ; i++) {
          if (i >= destPath.length || i >= srcPath.length) {
            break;
          }
          if (destPath[i] == srcPath[i]) {
            branch = i;
          }
        }
        this.log.debug("branch=" + branch);
        if (branch == 0 && srcPath.size > 1) {
          // go to root
          this.addCommand('selectFrame', 'relative=top', '', window);
        } else {
          for (i = srcPath.length - 1; i > branch; i--) {
            this.addCommand('selectFrame', 'relative=up', '', window);
          }
        }
        for (i = branch + 1; i < destPath.length; i++) {
          this.addCommand('selectFrame', destPath[i].name, '', window);
        }
      } else {
        // popup
        var windowName = window.name;
        if (windowName == '') {
          this.addCommand('selectWindow', 'null', '', window);
        } else {
          this.addCommand('selectWindow', "name=" + windowName, '', window);
        }
      }
    }
  }
  //resultBox.inputField.scrollTop = resultBox.inputField.scrollHeight - resultBox.inputField.clientHeight;
  this.clearLastCommand();
  this.safeLastWindow.setWindow(window);
  
  if (insertBeforeLastCommand && this.view.getRecordIndex() > 0) {
    var index = this.view.getRecordIndex() - 1;
  }
  else {
    var index= this.view.getRecordIndex();
  }
  var indentation= newCommandOrCommentIndentation( this.getTestCase(), index );
  
  var command = new Command( indentation+command, target, value);
  // bind to the href attribute instead of to window.document.location, which
  // is an object reference
  command.lastURL = window.document.location.href;
  this.getTestCase().commands.splice(index, 0, command);
  this.view.rowInserted(index);

  if( !( insertBeforeLastCommand && this.view.getRecordIndex() > 0 ) ) {
    //this.lastCommandIndex = this.getTestCase().commands.length;
    this.lastCommandIndex = index; //Samit: Revert patch for issue 419 as it disables recording in the middle of a test script
    this.timeoutID = setTimeout("editor.clearLastCommand()", 300);
  }
};
// 'editor' is an instance of either StandaloneEditor or SidebarEditor. Those classes don't refer to Editor.prototype, but they have copies of all functions from Editor.prototype (copied via objectExtend()).
        SidebarEditor.prototype.addCommand= StandaloneEditor.prototype.addCommand= Editor.prototype.addCommand;
// end of addCommand()
        
        // Append 'Indent' and 'Unindent' to top Edit menu and to context menu. They can't be added through XBL (see dev-tech-xul.mozilla.narkive.com/D4u2AkVT/binding-menus-using-xbl-doesn-t-work)
        var menusToUpdate= [ document.getElementById('treeContextMenu'), document.getElementById('menu_edit').getElementsByTagName('menupopup')[0] ];
        for( var i=0; i<2; i++ ) { //@TODO var(..of..) once NetBeans like it        
            menusToUpdate[i].appendChild( document.createElement('menuseparator') );

            var indent= document.createElement("menuitem");
            indent.setAttribute('label', 'Indent');
            indent.setAttribute('command', 'cmd_indent');
            indent.setAttribute('accesskey', 'G');
            indent.setAttribute('key', 'indent-key');
            menusToUpdate[i].appendChild(indent);

            var unindent= document.createElement("menuitem");
            unindent.setAttribute('label', 'Unindent');
            unindent.setAttribute('command', 'cmd_unindent');
            unindent.setAttribute('accesskey', 'L');
            unindent.setAttribute('key', 'unindent-key');
            menusToUpdate[i].appendChild(unindent);
        }
   }
    SeLiteExtensionSequencer.coreExtensionsLoadedTimes['SeLiteClipboardAndIndent']= loadedTimes+1;   
    
    // See similar override in hands-on-gui/src/chrome/content/extensions/ide-extension.js
    var originalInitialize= TreeView.prototype.initialize;
    TreeView.prototype.initialize= function initialize(editor, document, tree) {
        originalInitialize.call( this, editor, document, tree );
        var controllers= this.tree.controllers;
        var originalController= controllers.getControllerAt( controllers.getControllerCount()-1 );
        controllers.removeController( originalController );
        
        var self= this;
        // Add handling for 'cmd_indent' and 'cmd_unindent'.
        var newController= {
            supportsCommand: function supportsCommand(cmd ) {
                return cmd==='cmd_indent' || cmd==='cmd_unindent' || originalController.supportsCommand.call(originalController, cmd);
            },

            isCommandEnabled: function isCommandEnabled(cmd ) {
                return cmd==='cmd_indent' || cmd==='cmd_unindent' || originalController.isCommandEnabled.call(originalController, cmd);
            },
            
            doCommand: function doCommand(cmd ) {
                if( cmd==='cmd_indent' ) {
                    self.indent();
                }
                else if( cmd==='cmd_unindent' ) {
                    self.indent( true );
                }
                else {
                    originalController.doCommand.call(originalController, cmd);
                }
            },
            onEvent: originalController.onEvent
        };        
        controllers.appendController( newController );
    };
    
    /** Indent or unindent by one level. 
     * @param {bool} [unindent=false] Whether to unindent instead of indenting.
     * */
    TreeView.prototype.indent= function indent( unindent ) {
        // Based on TreeView's copyOrDelete()
        if (!this.treebox.focused) {
            return;
        }
        var firstSelectedRowIndex, lastSelectedRowIndex;
        var count = this.selection.getRangeCount();
        if (count > 0) {
            for (var i = 0; i < count; i++) {
                var start = {};
                var end = {};
                this.selection.getRangeAt(i, start, end);
                if( firstSelectedRowIndex===undefined ) {
                    firstSelectedRowIndex= start.value;
                }
                lastSelectedRowIndex= end.value;
                
                for (var v = start.value; v <= end.value; v++) {
                    var command = this.getCommand(v);
                    var isCommandAndNotComment= command.command!==undefined;
                    var commandOrComment= isCommandAndNotComment
                        ? command.command
                        : command.comment;
                    if( !unindent ) {
                        commandOrComment= '  ' +commandOrComment;
                    }
                    else {
                        if( commandOrComment.startsWith('  ') ) {
                            commandOrComment= commandOrComment.substr( 2 );
                        }
                    }
                    command[ isCommandAndNotComment
                        ? 'command'
                        : 'comment' ]= commandOrComment;
                }
                // If current row is in the range, update commandAction.
                // It can happen that the row shown in the command detailed area is not in the selected range. E.g. if you Ctrl+click at multiple rows, the last clicked one is in the command detailed area. When you Ctrl+click at that row again, it will be deselected, but it will still be in the detailed area!
                if( this.tree.currentIndex>=0 && this.getCommand(this.tree.currentIndex)===this.currentCommand ) {
                    document.getElementById('commandAction').value= command.command;
                }
            }
            this.treebox.invalidateRange( firstSelectedRowIndex, lastSelectedRowIndex );
        }
    };
    
    /** We've ensured that 'Insert New Command' or 'Insert New Comment' inserts any spaces based on indentation of the previous command. However, on pressing TAB Firefox would select the whole field; when user would start typing the name of the new command, it would replace those leading spaces. Following prevents that: it moves the editing cursor to the end of 'Command' (or 'Comment') field.
    So, if there is an existing command/comment with indentation, pressing TAB moves the editing cursor to the end space prefix, and it selects the rest of the command or comment. That facilitates replacing the command/comment when user starts typing, while keeping the existing indentation.
    Similarly when the user clicks Shift+TAB at command's Target (textbox), which moves focus to Command.
    */
    var indentedText= /^(\s+)/;

    var selectRightFromIndent= function selectRightFromIndent( event ) {
        var action=document.getElementById('commandAction');
        var match= indentedText.exec( action.value );
        if( match ) {
            event.preventDefault();
            action.focus();
            action.setSelectionRange( match[1].length, action.value.length );
        }
    };

    // Following two functions handle when the user navigates to Command detail (wide) input by TAB and Shift+TAB. These functions select (highlight) the part of the existing command right of indentation , so that when the user starts to type, typing replaces the existing command while preserving the indentation.

    // When the user navigates to Command detail input from the tree by hitting TAB.
    // This function is set up and/or extended by both Clipboard and Indent, and Hands-on GUI. See also another override of this at hands-on-gui/src/chrome/content/extensions/ide-extension.js
    var originalSeLiteTreeOnKeyPress= TreeView.seLiteTreeOnKeyPress;
    TreeView.seLiteTreeOnKeyPress= function seLiteTreeOnKeyPress( event ) {
        if( originalSeLiteTreeOnKeyPress ) {
            originalSeLiteTreeOnKeyPress.call( null, event );
        }
        
        var tree= event.currentTarget;
        if( event.keyCode===KeyEvent.DOM_VK_TAB && !event.shiftKey ) {
            var valueColumn= tree.columns.getColumnAt(2);
            if( tree.getAttribute('editing')!=='true' || tree.editingColumn===valueColumn ) {
                selectRightFromIndent( event );
            }
        }
    };
    
    // This function is specific to Clipboard and Indent, but set here, so that it can re-use selectRightFromIndent()
    // When the user navigates to Command detail (wide) input from Target detail (wide) input by hitting Shift+TAB. This doesn't handle Shift+TAB from 'Log' to Comment - there was no easy way to do it through XUL or XBL.
    TreeView.seLiteCommandTargetOnKeyPress= function seLiteCommandTargetOnKeyPress( event ) {
        if( event.keyCode===KeyEvent.DOM_VK_TAB && event.shiftKey ) {
            selectRightFromIndent( event );
        }
    };
})();
