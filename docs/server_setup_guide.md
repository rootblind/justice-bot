# Installation for Linux Server

This installation guide uses Debian.

This file serves as a guide to walk through setting up a linux server to run the Justice-Bot.


## 1. Create a sudoer user account

```bash
adduser server # any username, server is used in this example

usermod -aG sudo server
```

## 2. Change from root to user

```bash
su - server
```

## 3. Make sure the system is up to date

```bash
sudo apt update
sudo apt upgrade
```

## 4. Postgresql installation

Install packages

```bash
sudo apt install postgresql postgresql-contrib -y
```

Check the status of the service using systemctl

```bash
sudo systemctl status postgresql
```

If systemctl is not installed simply use `sudo apt install systemctl`

After checking the status, you must see something like `Active: active (running).
Otherwise run:

```bash
sudo systemctl start postgresql
sudo systemctl enable postgresql
```

Linux should automatically create the postgres superuser. Connect as postgres.

```bash
sudo -iu postgres
psql
```

Create the database and its owner user

```bash
CREATE USER testuser WITH PASSWORD 'passwd'; # use your own user name and password

CREATE DATABASE testdb OWNER testuser; # use your own database name and set the user created as owner

GRANT ALL PRIVILEGES ON DATABASE testdb TO testuser; # grant full access to your user
```

Exit psql and change user account

```bash
\q
su - server
```

Change directory to postgresql installation to check which version is installed

```bash
cd /etc/postgresql/
ls
```

In my case, version 16 is installed.

Open the config file using your text editor of choice.

```bash
sudo nano 16/main/pg_hba.conf
```

Look for this line and change `METHOD` to md5 to access the database on localhost using the password set.

```bash
# TYPE  DATABASE        USER            ADDRESS                 METHOD
local   all             all                                     md5
```

Save changes and restart the service

```bash
sudo systemctl restart postgresql
```

Now you can access the database from the terminal by connecting to it locally

```bash
psql -U testuser -d testdb -h localhost # will ask for the password provided when the user was created
```

## 5. Node.js installation

Node.js will be installed using `fnm`.

Make sure you are in the sudoer account created

```bash
\q # to leave the database connection
su - server
```

Install curl if it's not already installed

```bash
sudo apt install curl unzip # unzip is a dependency needed
```

Installing fnm

```bash
curl -o- https://fnm.vercel.app/install | bash
```

In order for the current shell to recognize fnm run

```bash
source ~/.bashrc
```

Install node

```bash
fnm install 24 # or the latest version on nodejs.org
```

Check if node installed correctly

```bash
node -v
npm -v
```

## 6. FTP
If you don't care about FTP, skip this section to **7. Setting up the project**.

Additionally, you can set up FTP service on your linux server in order to use clients such as FileZilla to easily upload and download files from the server.

The information of this section is compiled using Hostinger's [How to set up an FTP server on an Ubuntu VPS](https://www.hostinger.com/uk/tutorials/how-to-setup-ftp-server-on-ubuntu-vps/) tutorial.

Install vsftpd
```bash
sudo apt install vsftpd
```

Optionally make a backup of the config file in order to go back if something doesn't work
```bash
sudo cp /etc/vsftpd.conf /etc/vsftpd.conf.bk
```

Configure your system's firewall to allow FTP connection over the internet.
Uncomplicated Firewall (UFW) will be used in this case.
Checking if the firewall is ready.
```bash
sudo ufw status # checking if ufw is installed
sudo apt install ufw # installing ufw otherwise
sudo ufw enable # if status reports ufw as disable, enable it
```

Run these commands to allow FTP traffic.
```bash
sudo ufw allow OpenSSH
```

```bash
sudo ufw allow 20/tcp 
```

```bash
sudo ufw allow 21/tcp 
```

```bash
sudo ufw allow 990/tcp 
```

```bash
sudo ufw allow 40000:50000/tcp 
```

Make sure the changes took effect.
```bash
sudo ufw status
```

Create the directory where the user will have access through FTP and will eventually clone the project there

```bash
sudo mkdir /home/server/ftp
```

Set the ownership of the directory
```bash
sudo chown nobody:nogroup /home/server/ftp
```

If you wish, you can remove the write permission using this command

```bash
sudo chmod a-w /home/server/ftp
```

Create the directory that will hold all the files
```bash
sudo mkdir /home/server/ftp/files
```

```bash
sudo chown server:server /home/server/ftp/files
```

Now what follows is vsftpd config.
Open the file

```bash
sudo nano /etc/vsftpd.conf
```

Make sure the following lines exist

```
# Allow anonymous FTP? (Disabled by default).
anonymous_enable=NO
#
# Uncomment this to allow local users to log in.
local_enable=YES
```

Uncomment the following line

```
write_enable=YES
```

Uncomment chroot_local_user

```
chroot_local_user=YES
```

Add the user_sub_token

```
user_sub_token=$USER local_root=/home/$USER/ftp
```

Set the ports to the ones allowed by the firewall

```
pasv_min_port=40000 pasv_max_port=50000
```

To restrict which users can connect over FTP set the following lines

```
userlist_enable=YES userlist_file=/etc/vsftpd.userlist userlist_deny=NO
```

Once you've done those changes, press Ctrl + X -> Y -> Enter in order to save changes and exit nano.

Now you need to create the user list

```bash
echo "server" | sudo tee -a /etc/vsftpd.userlist
```

Verify that the file was created correctly

```bash
cat /etc/vsftpd.userlist
```

Apply changes by restarting the FTP daemon

```bash
sudo systemctl restart vsftpd
```

It's important to secure the FTP connection as it doesn't automatically encrypt data.

Issue an SSQL certificate

```bash
sudo openssl req -x509 -nodes -days 365 -newkey rsa:2048 -keyout /etc/ssl/private/vsftpd.pem -out /etc/ssl/private/vsftpd.pem
```

You will be prompted to enter the corresponding details.

After you complete the information required and you create the certificate, open vsftpd configuration file again

```bash
sudo nano /etc/vsftpd.conf
```

Scroll down to the following lines

```
# rsa_cert_file=/etc/ssl/certs/ssl-cert-snakeoil.pem
# rsa_private_key_file=/etc/ssl/private/ssl-cert-snakeoil.key
```

Uncomment those lines and replice the paths to your certificate

```
rsa_cert_file=/etc/ssl/private/vsftpd.pem
rsa_private_key_file=/etc/ssl/private/vsftpd.pem
```

Enable the ssl line

```
ssl_enable=YES
```

Add the following lines at the end to reject anonymous connection

```
allow_anon_ssl=NO

force_local_data_ssl=YES

force_local_logins_ssl=YES
```

More ssl configuration

```
ssl_tlsv1=YES

ssl_sslv2=NO

ssl_sslv3=NO

require_ssl_reuse=NO

ssl_ciphers=HIGH
```

Restart FTP once again

```
sudo systemctl restart vsftpd
```

If everything worked correctly, now you should be able to connect using an FTP client.

## 7. Setting up the project

Install git if it's not already installed

```bash
sudo apt install git
```

Make sure to change directory in the desired location, for example in the home directory.

```bash
cd ~

# Or if you followed the FTP steps
cd /home/server/ftp/files
```

Clone the project

```bash
git clone git@github.com:rootblind/justice-bot.git
```

Go inside the project directory

```bash
cd justice-bot/
```

Install dependencies

```bash
npm install
```

Rename `.env.example` into `.env` or create a new file with that name and complete the data required.

```bash
cp .env.example .env
```

Open `.env` and set the environment variables.

```bash
nano .env
```

Use the existing scripts to build and run the project

```bash
npm run build
npm run start
```