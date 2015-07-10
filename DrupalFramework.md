﻿#summary Using SeLite with Drupal 7
#labels Technicality-XXX,GeneralImportance-XX


The test example logs in as an admin and creates a user with random credentials. It logs in as that user and posts and validates random content.

# Install Drupal 7 #
## Install Drupal 7.24 on Fedora 19/20 ##
These steps are for 7.24 on Fedora 19 and Drupal 7.24-1 on Fedora 20. For other systems see [installation docs](https://drupal.org/documentation/install).

Use Applications > Administration > Software Management (Apper) > install Drupal7. If you haven't got Apache running, start it:
<pre>
su<br>
systemctl enable httpd.service<br>
systemctl start httpd.service<br>
</pre>

The following steps are based on docs from /usr/share/doc/drupal7-7.24. If you read them, note that /usr/share/drupal7/sites is a symlink which resolves to /etc/drupal7.

Setup Drupal
<pre>
su<br>
cd /etc/drupal7/default<br>
cp default.settings.php settings.php<br>
chmod 666 settings.php<br>
<br>
# Visit http://localhost/drupal7 and follow it. Database configuration<br>
- database type: SQLite<br>
- filename: don't have it start with '.ht'. See notes below.<br>
- don't use Advanced > DB prefix. See notes below.<br>
<br>
# After you've installed it via the web interface, continue as root user:<br>
cd /etc/drupal7/default<br>
chmod 644 settings.php<br>
<br>
# Following is for SeLite Settings buttons to reload test/app/vanilla DB. (Or do it per group or in a less restrictive way, as you need.)<br>
cd files<br>
setfacl -m u:testersUserName:rw data.sqlite<br>
</pre>
<a href='Hidden comment: TODO test DB prefix
'></a>

Notes
  * If you have DB filename starting with '.ht' and if (accidentally) the folder is accessible online, the file won’t be served. However, that makes it hidden on Linux/Mac OS, and therefore hard to list it or to pick up the file via SettingsInterface.
  * If you use Advanced > DB prefix, then DB prefix becomes a postfix of the DB file name, e.g. prefix ‘drupal_’ makes the DB file name /etc/drupal7/default/files/data.sqlite-drupal`_`. But Drupal also creates a file without the postfix, which can be confusing._

## Install Drupal 7.26 on CentOS 6.5 ##
Use System > Administration > Add/Remove Software to install Apache (httpd), PHP and mbstring. Then System > Administration > Services > enable and start service httpd.

<pre>
wget http://ftp.drupal.org/files/projects/drupal-7.26.tar.gz<br>
tar xvzf drupal-7.26.tar.gz<br>
sudo cp -r drupal-7.26 /var/www/html/drupal7<br>
cd /var/www/html/drupal7/sites/default/<br>
sudo cp -r default.settings.php settings.php<br>
chmod a+w settings.php<br>
</pre>

Visit http://localhost/drupal7/install.php. Select Standard installation, follow steps in a browser as per notes for Fedora.

<pre>
cd /var/www/html/drupal7/sites/default/<br>
sudo chmod o-w settings.php<br>
cd files<br>
chmod chmod a+rwx .<br>
chmod chmod a+rwx *sqlite*<br>
</pre>

# Install SeLite Drupal test framework #
Apply InstallFramework. The framework and tests are in [drupal](https://code.google.com/p/selite/source/browse/drupal) folder. The above installation had _appDB_ filename _/etc/drupal7/default/files/data.sqlite_
.
When using Drupal as a non-admin user, it needs a front page, but that doesn't exist by default. Do that before you run other tests: Open Firefox menu > Tools > Selenium IDE. Selenium menu > File > Open Test Suite... > locate _drupal/test\_suites\_and\_cases/setup\_content\_suite.html_. Then run the test suite (menu > Actions > Play entire test suite).

# Limitation #
Example _create\_user\_suite.html_ only works with English installation.

# DB schema #
When extending DB table definitions in the framework, see [DB Schema](https://drupal.org/node/1785994).