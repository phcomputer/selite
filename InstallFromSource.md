

# Get the source #
You need SeLite source to get frameworks and PackagedTests that come with it. You may also install development versions of AddOns from source. Download it compressed, or check it out with a [GIT client](http://git-scm.com/downloads) (which makes receiving updates or managing local modifications easier).

Frameworks and all add-ons (except for SelBlocksGlobal) are in the same repository. SelBlocksGlobal has a repository on its own. Wiki pages are in another repository; you can view them offline (see WikiStandard > [Wiki Viewer](WikiStandard#Wiki_Viewer.md)).

| **Repository**                        | **Browse or download as .zip or .tgz** | **Check out from GIT** |
|:--------------------------------------|:---------------------------------------|:-----------------------|
| SeLite except for SelBlocksGlobal     | [browse or download](https://code.google.com/p/selite/source/browse/)                           | [checkout](https://code.google.com/p/selite/source/checkout) |
| SelBlocksGlobal                       | [browse or download](https://code.google.com/p/selite/source/browse?repo=sel-blocks-global) | [checkout](https://code.google.com/p/selite/source/checkout?repo=sel-blocks-global) |
| Wiki                                  | [browse or download](https://code.google.com/p/selite/source/browse?repo=wiki) | [checkout](https://code.google.com/p/selite/source/checkout?repo=wiki) |

# Install add-ons from source #
(If you've already installed any SeLite add-ons from downloads, uninstall them and restart Firefox. Only then apply the next steps.) Run _selite\setup\_proxies.bat_ and _selite.sel-blocks-global\setup\_proxy.bat_ (or _selite/setup\_proxies.sh_ and _selite.sel-blocks-global/setup\_proxy.sh_ on Mac OS/Linux). You can provide a Firefox profile name as a parameter, otherwise it uses 'default' profile. After setting up proxy files, start Firefox (with that profile).

On Windows (and probably on Mac OS, too):
  * you may need to accept add-ons
  * verify that all SeLite add-ons are enabled at Firefox menu > Tools > Add-ons > Extensions.

Restart Firefox.

Add-ons set up this way won't receive any updates. You'll need to run <i>GIT pull</i> (or download a new .zip file and extract it at the same location).

# Install Selenium IDE from source #
You'd need this only for debugging Selenium IDE, or custom add-ons that override it.

[Download Selenium IDE](http://docs.seleniumhq.org/download/) as an .xpi file, but don't install it (right click at the link to an .xpi file >  'Save Link As...'). Then unzip the .xpi file (you may have to rename it to end with .zip). It contains several .xpi files inside, and you want selenium-ide.xpi. Unzip it and point a proxy file to the unzipped folder. All that is done by the following steps for Linux. For Windows or Mac OS see _setup\_proxies.bat_ or _setup\_proxies.sh_ above and figure out similar steps to the effect of the following.

```
cd ~/.mozilla/firefox/*.default/extensions
# if you have Selenium IDE installed already from an .xpi file, turn Firefox off and:
   rm -rf \{a6fd85ed-e919-4a43-a5af-8da18bda539f\}.xpi

unzip ~/Downloads/selenium-ide-X.Y.Z.xpi
mkdir selenium-ide-X.Y.Z
cd selenium-ide-X.Y.Z
unzip ../selenium-ide.zip
pwd > `echo ~/.mozilla/firefox/*.default`/extensions/\{a6fd85ed-e919-4a43-a5af-8da18bda539f\}
```

Restart Firefox.

For debugging Selenium IDE, apply DevelopmentTools > [Debugging](DevelopmentTools#Debugging.md). Then use Firefox > Tools > Web Developer > Browser Toolbox. You need to know a file name; locate it in that unzipped folder using _grep_ or some other text search tool. It may be worth creating a NetBeans project from the unzipped folder: it eases the navigation.